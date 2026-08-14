#!/usr/bin/env python3
"""Repack modified App.tsx back into the original bundled HTML.

The bundler structure:
- Outer HTML has <script type="__bundler/template">{JSON-encoded inner HTML string}</script>
- That inner HTML string contains <script type="text/babel">...</script> with the React source

We:
1. Swap the inner babel script body with our modified App.tsx.
2. Inject an extra <script> that registers region-specific right-panel images
   (any PNG at unpacked/right_panel_<region>.png is picked up automatically).
"""
import base64, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "bundle-source.html"
UNPACKED = ROOT / "unpacked"
NEW_APP = UNPACKED / "App.tsx"
OUT = ROOT / "index.html"

html = SRC.read_text(encoding="utf-8")

# Pre-compile App.tsx with esbuild → plain JS so the browser doesn't run Babel
# Standalone at boot. In-browser Babel was the bottleneck for time-to-visible
# (~2.3 sec on a 100 KB TSX file); esbuild does it offline in ~5 ms.
import subprocess, shutil
COMPILED = UNPACKED / "App.compiled.js"
try:
    subprocess.run(
        ["npx", "--yes", "esbuild", str(NEW_APP),
         "--loader:.tsx=tsx", "--jsx=transform",
         "--jsx-factory=React.createElement", "--jsx-fragment=React.Fragment",
         "--target=es2020", f"--outfile={COMPILED}"],
        check=True, capture_output=True,
    )
    new_app_src = COMPILED.read_text(encoding="utf-8")
    print(f"App.tsx compiled with esbuild: {len(new_app_src)/1024:.1f} KB")
except (subprocess.CalledProcessError, FileNotFoundError) as e:
    # Fallback to in-browser Babel if esbuild isn't available — slower but works.
    print(f"esbuild unavailable ({e}); falling back to in-browser Babel")
    new_app_src = NEW_APP.read_text(encoding="utf-8")

# window.RIGHT_PANEL_IMGS is no longer referenced by App.tsx (we use full_page.jpg
# as a single background). Skip bundling to keep the HTML small.
regions = {}

# Bundle the full-page design export. The new App renders this single image
# as the page background and only overlays the 2 dynamic data cards on top.
# Design background images are served as separate files. We:
#   - downscale from 2x retina to 1.5x (saves ~30% pixels with imperceptible
#     loss on most screens),
#   - emit BOTH AVIF (smaller on modern browsers, Safari 16.4+ supports) and
#     WebP (fallback for older Safari). JSX uses <picture> to pick one.
# Compared to the original JPEGs/PNGs this is roughly 75-90% smaller.
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)
try:
    from PIL import Image as _Image
    import pillow_avif  # registers the AVIF codec; import is the side effect
    _HAS_AVIF = True
except ImportError:
    try:
        from PIL import Image as _Image
    except ImportError:
        _Image = None
    _HAS_AVIF = False

SCALE = 0.75   # 2x retina source → 1.5x retina output
design_imgs = {}
# We ship AVIF only (Safari 16.4+ / 2023-03; all modern Chromium / Firefox 113+).
# Tried <picture> with AVIF + WebP fallback, but the HTML preload scanner
# eagerly fetches the <img src=webp> before the parser knows there's an AVIF
# <source>, so both files end up downloaded (worse than not bothering). For
# the very small Safari < 16.4 audience the React UI still renders — they
# just see no design background.

# Buttons baked into the design PNGs cause subtle misalignment when our SVG
# overlay sits on top — slightly different anti-aliasing / dimensions show
# through as a doubled-edge effect (visible especially on mobile). The user's
# original design has empty background under both regions, so we paint over
# the baked button regions with the surrounding background color before
# encoding. The React overlay then becomes the sole visual.
# Rects are in DESIGN units (source PNG is 2× this).
_BTN_PAINT_RECTS = {
    # Rect tuple is either (left, top, right, bottom) — sample bg from outside
    # left-4 — or (left, top, right, bottom, (R,G,B)) — explicit fill colour.
    # 2026-05-22: unpacked/full_page.jpg replaced with Figma 51-4788 export
    # (no tomato character) but text + badge + speech bubble are still baked.
    # Paint over those so the React overlay can render dynamic per-county text.
    # full_page.jpg replaced 2026-05-22 with Figma 51-4788 text-free + character-
    # free + bubble-only-outline export. We now only paint over the baked +/-
    # buttons; the right panel hero content (county/crop name, hello text inside
    # bubble, character standing on grass) is rendered entirely via React overlay.
    "full_page":      [(48, 605, 158, 882), (640, 808, 680, 884)],
    "taoyuan_detail": [(35, 1255, 285, 1905), (1465, 1735, 1545, 1905)],
}

def _paint_buttons(im, name, design_w):
    """Paint over baked regions: rect = (l,t,r,b) samples bg, (l,t,r,b,(R,G,B)) uses explicit colour."""
    if name not in _BTN_PAINT_RECTS:
        return im
    rects = _BTN_PAINT_RECTS[name]
    if not rects:
        return im
    im = im.convert("RGBA") if im.mode == "RGBA" else im.convert("RGB")
    px_per_design = im.size[0] / design_w
    from PIL import ImageDraw as _ImageDraw
    draw = _ImageDraw.Draw(im)
    for rect in rects:
        if len(rect) == 5:
            left, top, right, bottom, fill = rect
        else:
            left, top, right, bottom = rect
            sx = max(0, int((left - 4) * px_per_design))
            sy = int(((top + bottom) / 2) * px_per_design)
            fill = im.getpixel((sx, sy))
        draw.rectangle(
            (int(left * px_per_design), int(top * px_per_design),
             int(right * px_per_design), int(bottom * px_per_design)),
            fill=fill,
        )
    return im

# Source design canvas widths (the PNGs are exactly 2× these).
_DESIGN_W = {"full_page": 1440, "tomato_dashboard": 1440, "taoyuan_detail": 1601}

for name, src_ext, q in [
    ("full_page",        "jpg", 70),
    ("tomato_dashboard", "jpg", 70),
    ("taoyuan_detail",   "png", 70),
]:
    src = UNPACKED / f"{name}.{src_ext}"
    if not src.exists() or _Image is None:
        continue
    im = _Image.open(src)
    im = _paint_buttons(im, name, _DESIGN_W[name])
    W, H = im.size
    small = im.resize((int(W * SCALE), int(H * SCALE)), _Image.LANCZOS)
    if _HAS_AVIF:
        dst = ASSETS / f"{name}.avif"
        # AVIF doesn't support RGBA → convert if needed
        small_to_save = small.convert("RGB") if small.mode == "RGBA" else small
        small_to_save.save(dst, "AVIF", quality=q)
    else:
        dst = ASSETS / f"{name}.webp"
        small.save(dst, "WEBP", quality=q)
    design_imgs[name] = f"assets/{dst.name}"
print(f"Design assets ({'avif' if _HAS_AVIF else 'webp'}, 1.5x, q={q}, btn-painted): {list(design_imgs.keys())}")

# Bundle per-county character SVGs (hover-to-show on the map).
# Files at unpacked/county_chars/<key>.svg are loaded by key.
# Strip Adobe Illustrator metadata (each raw SVG is ~770 KB, 99% of which is
# AI's <metadata> + i: namespace blob; after stripping each is ~5 KB).
import re as _re
def _strip_ai(svg_text: str) -> str:
    s = _re.sub(r"<metadata>.*?</metadata>", "", svg_text, flags=_re.DOTALL)
    s = _re.sub(r"\s+xmlns:i=\"[^\"]+\"", "", s)
    s = _re.sub(r"<!--.*?-->", "", s, flags=_re.DOTALL)
    return s

county_chars = {}
char_dir = UNPACKED / "county_chars"
if char_dir.exists():
    raw_total = 0
    clean_total = 0
    for p in sorted(char_dir.glob("*.svg")):
        key = p.stem
        raw = p.read_text(encoding="utf-8")
        cleaned = _strip_ai(raw).encode("utf-8")
        raw_total += len(raw.encode("utf-8"))
        clean_total += len(cleaned)
        data = base64.b64encode(cleaned).decode("ascii")
        county_chars[key] = f"data:image/svg+xml;base64,{data}"
    print(f"County characters bundled: {len(county_chars)} keys "
          f"({raw_total/1024:.0f} KB raw → {clean_total/1024:.0f} KB stripped)")

# Bundle dashboard datasets (parsed from agrstat.moa.gov.tw ODS exports).
datasets = {}
for name in ("tomato_export", "tomato_market", "disaster_yearly"):
    f = UNPACKED / f"{name}.json"
    if not f.exists():
        continue
    datasets[name] = json.loads(f.read_text())
print(f"Datasets bundled: {list(datasets.keys())}")

# Bundle Figma button SVGs (城市 pill / 加減號 / 上下箭頭, 各兩個 hover state).
button_svgs = {}
bf = UNPACKED / "figma_buttons.json"
if bf.exists():
    button_svgs = json.loads(bf.read_text())
print(f"Button SVGs bundled: {len(button_svgs)} keys")

# Bundle Taoyuan township crop characters (SVG data URLs).
taoyuan_crops = {}
tc = UNPACKED / "taoyuan_crops.json"
if tc.exists():
    taoyuan_crops = json.loads(tc.read_text())
print(f"Taoyuan crop characters bundled: {len(taoyuan_crops)} keys")

# Locate the template <script>...</script> block.
tpl_re = re.compile(
    r'(<script type="__bundler/template">)(.*?)(</script>)',
    re.DOTALL,
)
m = tpl_re.search(html)
if not m:
    raise SystemExit("template script not found")

tpl_json_str = m.group(2)
inner_html = json.loads(tpl_json_str)  # decoded inner HTML (string)

# Locate the original babel script — we use it both as the anchor for the
# regions_script injection (below) and as the swap point for our compiled JS.
# IMPORTANT: keep the babel attribute around while we inject `regions_script`,
# THEN flip it to plain JS. Switching first would lose the anchor.
babel_re = re.compile(
    r'(<script type="text/babel"[^>]*>)(.*?)(</script>)',
    re.DOTALL,
)
if not babel_re.search(inner_html):
    raise SystemExit("babel script not found inside template")
new_inner = inner_html

# Externalize the big data blobs to keep the initial HTML small.
# - DATASETS (~620 KB), COUNTY_CHARS (~120 KB), BUTTON_SVGS (~163 KB),
#   TAOYUAN_CROPS (~73 KB) go into assets/page-data.json (~960 KB), fetched
#   in parallel after HTML parse. Components subscribe to a 'page-data-ready'
#   custom event to re-render once data lands.
# - tomato_market.daily is trimmed to the last 365 days for the bundled
#   fallback — the live nongzhidao fetch (in useTomatoMarket) provides the
#   full 20-year history when online.
# - DESIGN_IMGS stays inline (just 3 short URLs).
# - Chart.js becomes an external file that the Dashboard component loads on
#   demand via dynamic <script> injection. Frontpage doesn't need it.
import copy
trimmed_datasets = copy.deepcopy(datasets)
if 'tomato_market' in trimmed_datasets:
    tm = trimmed_datasets['tomato_market']
    if isinstance(tm, dict) and isinstance(tm.get('daily'), list):
        tm['daily'] = tm['daily'][-365:]
page_data = {
    'datasets':       trimmed_datasets,
    'county_chars':   county_chars,
    'button_svgs':    button_svgs,
    'taoyuan_crops':  taoyuan_crops,
}
(ASSETS / "page-data.json").write_text(
    json.dumps(page_data, ensure_ascii=False, separators=(',', ':')),
    encoding="utf-8",
)
# Chart.js — copy to assets for on-demand loading by Dashboard
(ASSETS / "chart.umd.min.js").write_bytes((UNPACKED / "chart.umd.min.js").read_bytes())

regions_script = (
    '<script>window.DESIGN_IMGS='
    + json.dumps(design_imgs, ensure_ascii=False)
    + ';</script>'
    # Bootloader — empty globals so synchronous reads don't throw, then fetch
    # the heavy data in parallel and fire 'page-data-ready' when it lands.
    + "<script>"
      "window.DATASETS=window.DATASETS||{};"
      "window.COUNTY_CHARS=window.COUNTY_CHARS||{};"
      "window.BUTTON_SVGS=window.BUTTON_SVGS||{};"
      "window.TAOYUAN_CROPS=window.TAOYUAN_CROPS||{};"
      "fetch('assets/page-data.json').then(r=>r.json()).then(d=>{"
        "window.DATASETS=d.datasets||{};"
        "window.COUNTY_CHARS=d.county_chars||{};"
        "window.BUTTON_SVGS=d.button_svgs||{};"
        "window.TAOYUAN_CROPS=d.taoyuan_crops||{};"
        "window.dispatchEvent(new CustomEvent('page-data-ready'));"
      "}).catch(e=>console.warn('[page-data] fetch failed',e));"
    "</script>"
)
# Remove any previously-injected version so re-runs stay idempotent. Match
# every consecutive injected <script>…</script> regardless of how it was split.
new_inner = re.sub(
    r'(?:<script(?:\s[^>]*)?>window\.(?:RIGHT_PANEL_IMGS|DESIGN_IMGS|COUNTY_CHARS|DATASETS|BUTTON_SVGS|TAOYUAN_CROPS)=.*?</script>)+'
    r'(?:<script src="[^"]*chart[^"]*"></script>)?'
    r'(?:<script data-bundled="chart\.js">.*?</script>)?',
    '',
    new_inner,
    flags=re.DOTALL,
)

# Strip dead globals left over from earlier iterations of bundle-source.html —
# MAP_IMG_SRC / LEFT_PANEL_IMG / RIGHT_PANEL_IMG are old per-panel images that the
# current App.tsx no longer references. Together ~1.5 MB of base64 PNG.
new_inner = re.sub(
    r'<script>window\.(?:MAP_IMG_SRC|LEFT_PANEL_IMG|RIGHT_PANEL_IMG)=.*?</script>',
    '',
    new_inner,
    flags=re.DOTALL,
)
new_inner = babel_re.sub(
    lambda bm: regions_script + bm.group(0),
    new_inner,
    count=1,
)

# NOW swap the (still text/babel) script body with the esbuild-compiled JS and
# drop the type attribute so the browser runs it directly without Babel.
new_inner = babel_re.sub(
    lambda bm: '<script>' + new_app_src + bm.group(3),
    new_inner,
    count=1,
)

# Re-encode as JSON. Important: escape "</" → "<\u002F" so inner </script>
# tags inside the JSON string don't terminate the outer <script> early.
# (That's how the original bundler encoded it; \u002F is a valid JSON escape for /.)
# ── Bypass the runtime bundler ─────────────────────────────────────────────
# The outer HTML (bundle-source.html) embeds 108 assets (105 WOFF2 font slices
# + 3 JS files ≈ 6.5 MB base64-gzip). At runtime it parses the manifest,
# decodes/decompresses every asset, THEN injects the inner HTML — the user
# stares at a loading thumbnail for ~500 ms even though loadComplete fires at
# 700 ms. Here we pre-decode the manifest at repack time, save each asset to
# assets/<uuid>.<ext>, and rewrite UUID refs to those paths. The new index.html
# is just the inner HTML — no bundler, no thumbnail wait.
import gzip as _gzip

manifest_re = re.compile(r'<script type="__bundler/manifest">(.*?)</script>', re.DOTALL)
mm = manifest_re.search(html)
if not mm:
    raise SystemExit("manifest script not found")
manifest = json.loads(mm.group(1))

_MIME_EXT = {
    "font/woff2": "woff2",
    "text/javascript": "js",
    "application/javascript": "js",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
}
# Production builds of React/ReactDOM (much smaller than the dev builds the
# original bundle ships — ReactDOM dev = 1 MB, prod = 129 KB).
REACT_PROD     = UNPACKED / "react.production.min.js"
REACT_DOM_PROD = UNPACKED / "react-dom.production.min.js"

asset_url_for = {}
saved = 0
react_replaced = []
react_uuid = None
react_dom_uuid = None
for uuid, entry in manifest.items():
    raw = base64.b64decode(entry["data"])
    if entry.get("compressed"):
        raw = _gzip.decompress(raw)
    ext = _MIME_EXT.get(entry.get("mime", ""), "bin")
    # React dev → prod swap. Their license header carries the build name.
    if ext == "js":
        head = raw[:512].decode("utf-8", "ignore")
        if "react-dom.development.js" in head and REACT_DOM_PROD.exists():
            raw = REACT_DOM_PROD.read_bytes()
            react_replaced.append(("react-dom", uuid[:8]))
            react_dom_uuid = uuid
        elif "react.development.js" in head and REACT_PROD.exists():
            raw = REACT_PROD.read_bytes()
            react_replaced.append(("react", uuid[:8]))
            react_uuid = uuid
    dst = ASSETS / f"{uuid}.{ext}"
    dst.write_bytes(raw)
    asset_url_for[uuid] = f"assets/{uuid}.{ext}"
    saved += len(raw)
print(f"Manifest assets extracted: {len(manifest)} files ({saved/1024/1024:.1f} MB total)")
if react_replaced:
    print(f"  React dev → prod: {', '.join(f'{name}({u})' for name, u in react_replaced)}")

# Rewrite UUID references in the inner HTML to point at the extracted files.
for uuid, url in asset_url_for.items():
    new_inner = new_inner.replace(uuid, url)

# Drop Babel Standalone — App.tsx is now pre-compiled by esbuild. The Babel
# bundle's first bytes are an IIFE that assigns `.Babel = {}` on globalThis;
# React/ReactDOM both start with a `@license React` block, so we discriminate
# by that fingerprint instead of substring (their license blob includes "babel"
# elsewhere, which mis-flagged ReactDOM before).
babel_uuid = None
for uuid, entry in manifest.items():
    if entry.get("mime") not in ("text/javascript", "application/javascript"):
        continue
    data = base64.b64decode(entry["data"])
    if entry.get("compressed"):
        data = _gzip.decompress(data)
    head = data[:512].decode("utf-8", "ignore")
    if "@license React" in head:
        continue  # this is React or ReactDOM, keep
    if "Babel={}" in head or "self).Babel" in head or "globalThis).Babel" in head:
        babel_uuid = uuid
        break
if babel_uuid:
    new_inner = re.sub(
        rf'<script[^>]*src="assets/{babel_uuid}\.js"[^>]*></script>',
        '', new_inner,
    )
    print(f"Babel Standalone dropped (uuid={babel_uuid[:8]}…)")
else:
    print("WARNING: Babel UUID not detected — bundle may include Babel Standalone")

# Strip integrity + crossorigin attrs (were for SRI on CDN; not relevant for
# same-origin local files and break script load if mismatched).
new_inner = re.sub(r'\s+integrity="[^"]*"', '', new_inner)
new_inner = re.sub(r'\s+crossorigin="[^"]*"', '', new_inner)

# ── Preload critical resources ─────────────────────────────────────────────
# Tell the browser to start fetching the heaviest critical-path resources
# during HTML parse, before reaching the <script> / fetch() that uses them.
preload_links = []
if react_uuid:
    preload_links.append(f'<link rel="preload" as="script" href="assets/{react_uuid}.js">')
if react_dom_uuid:
    preload_links.append(f'<link rel="preload" as="script" href="assets/{react_dom_uuid}.js">')
preload_links.append('<link rel="preload" as="fetch" href="assets/page-data.json" crossorigin="anonymous">')
fp = design_imgs.get("full_page")
if fp:
    fp_url = fp if isinstance(fp, str) else (fp.get("avif") or fp.get("webp", ""))
    if fp_url:
        # `imagesrcset` would let the browser pick best format, but we ship a
        # single AVIF so a plain preload is fine.
        type_attr = ' type="image/avif"' if fp_url.endswith(".avif") else ""
        preload_links.append(f'<link rel="preload" as="image" href="{fp_url}"{type_attr}>')
preload_block = "".join(preload_links)
# Inject right after <head ...> opening tag (or at start of head content).
head_open = re.search(r'<head[^>]*>', new_inner)
if head_open:
    i = head_open.end()
    new_inner = new_inner[:i] + preload_block + new_inner[i:]

# ── Service Worker (cache assets + serve from cache on repeat visits) ──────
# Strategy:
#   - VERSION is tied to the git short-SHA, so every push gets a fresh cache.
#   - Install: pre-cache index.html + toolbox pages/data + critical JS/images.
#   - Activate: drop every cache whose name doesn't match the new VERSION,
#     then claim open clients so the new SW takes over without a reload.
#   - Fetch:
#       · same-origin HTML + 工具箱檔案 → stale-while-revalidate（快取先回、
#         秒開，背景抓新版更新快取；新 deploy 靠 SW 版本號換 cache 立即生效。
#         2026-07-30 從 network-first 改回——network-first 讓每次進站都等
#         GH Pages 來回 600KB+，整站秒讀體感就沒了）;
#       · same-origin /assets/ 重資產 → cache-first (instant repeat-visit load,
#         falls back to network if missing);
#       · cross-origin       → bypass (don't touch the live nongzhidao /
#         weather API requests).
try:
    BUILD_VERSION = subprocess.check_output(
        ["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"],
        stderr=subprocess.DEVNULL,
    ).decode().strip()
except Exception:
    BUILD_VERSION = "dev-" + str(int(__import__("time").time()))

# Asset list we want guaranteed-cached after install. URLs are relative so the
# same SW works whether the site is served at "/" (local) or "/taiwan-crop-map/"
# (GH Pages). The SW resolves them relative to its own scope.
precache_urls = [
    "index.html",
    "assets/page-data.json",
    # 工具箱三頁與其大檔 — 部署時就預抓，第一次點進工具箱也能秒開
    "toolbox.html",
    "crop-dashboard.html",
    "toolbox-shared.js",
    "toolbox-entry.js",
    "toolbox-product-calcs.js",
    "toolbox-assets/crop-params.json",
    "toolbox-assets/crop_chars.json",
]
if react_uuid:     precache_urls.append(f"assets/{react_uuid}.js")
if react_dom_uuid: precache_urls.append(f"assets/{react_dom_uuid}.js")
for k, v in design_imgs.items():
    url = v if isinstance(v, str) else (v.get("avif") or v.get("webp"))
    if url: precache_urls.append(url)

SW_TEMPLATE = '''\
// Auto-generated by repack.py. Do not edit by hand — re-runs will overwrite.
const VERSION = '__VERSION__';
const CACHE = `taiwan-crop-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', e => {
  // Take over immediately on first install so cache is populated without a reload.
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Best-effort: don't fail install if one URL 404s.
      Promise.all(PRECACHE.map(u =>
        c.add(new Request(u, { cache: 'reload' })).catch(err =>
          console.warn('[sw] precache miss', u, err))
      ))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const _SCOPE_PATH = new URL(self.registration.scope).pathname;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only manage same-origin requests. Live nongzhidao / weather API stay
  // direct so they always get the freshest data and never hit a stale cache.
  if (url.origin !== self.location.origin) return;
  // 只管自己站台路徑（GH Pages 上 nongzhidao 資料站與本站同網域——
  // 不加這條會被 SWR 蓋到，行情變成「上一次的」才對外顯示）
  if (!url.pathname.startsWith(_SCOPE_PATH)) return;
  const isHTML =
    req.destination === 'document' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html');

  // HTML 與工具箱檔案（非 /assets/）→ stale-while-revalidate：
  // 有快取立刻回（秒開），同時背景抓新版更新快取（下次就是新的）。
  // 新 deploy 會換 SW 版本號 → 全新 cache + install 重新預抓，不會卡舊版。
  if (isHTML || !url.pathname.includes('/assets/')) {
    // HTML 頁面帶 ?crop= 等查詢參數但內容同一份 → 用純路徑當快取鍵，
    // 才吃得到 install 時預抓的 toolbox.html / crop-dashboard.html。
    const key = isHTML ? new Request(url.origin + url.pathname) : req;
    e.respondWith((async () => {
      const cached = await caches.match(key, { ignoreSearch: isHTML });
      // no-cache: 背景更新一定去伺服器驗證，不吃瀏覽器 HTTP 快取的舊檔
      const refresh = fetch(req.url, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(key, copy));
        }
        return res;
      }).catch(() => null);
      if (cached) return cached;          // 秒開；refresh 在背景跑
      const res = await refresh;          // 冷載入：等網路
      if (res) return res;
      throw new Error('offline + no cache');
    })());
    return;
  }

  // 重資產（/assets/ 的 avif/woff2/js bundle）: cache-first。The cache name
  // includes VERSION, so a new deploy gets a fresh cache and old entries are
  // dropped in activate().
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  })());
});
'''
sw_js = (SW_TEMPLATE
         .replace('__VERSION__', BUILD_VERSION)
         .replace('__PRECACHE__', json.dumps(precache_urls)))
(ROOT / "service-worker.js").write_text(sw_js, encoding="utf-8")
print(f"Service Worker: version={BUILD_VERSION}, precache={len(precache_urls)} files")

# Register the SW from index.html. updateViaCache:'none' prevents the browser
# from caching service-worker.js for 24 h, so we see new versions promptly.
sw_register = (
    '<script>'
    'if("serviceWorker" in navigator){'
    'window.addEventListener("load",()=>navigator.serviceWorker'
    '.register("service-worker.js",{updateViaCache:"none"})'
    '.catch(e=>console.warn("[sw] register failed",e)));'
    '}'
    '</script>'
)
# Strip any prior registration block before re-injecting (idempotent).
new_inner = re.sub(
    r'<script>if\("serviceWorker"\s*in\s*navigator\).*?</script>',
    '', new_inner, flags=re.DOTALL,
)
# Inject just before </body> so it runs after the page-data bootloader.
if '</body>' in new_inner:
    new_inner = new_inner.replace('</body>', sw_register + '</body>', 1)
else:
    new_inner = new_inner + sw_register

# 小農工具箱入口（toolbox-entry.js：右下角浮動鈕 → toolbox.html?county=&crop=）。
# 同 SW 註冊的做法：先剝掉舊的再注入，重跑 repack 不會弄丟也不會重複。
toolbox_entry = (
    '\n<!-- 小農工具箱入口（repack.py 會重新注入此行） -->\n'
    '<script id="toolbox-entry" src="toolbox-entry.js"></script>'
)
new_inner = re.sub(
    r'\n?<!-- 小農工具箱入口[^>]*-->\n?<script id="toolbox-entry"[^>]*></script>',
    '', new_inner, flags=re.DOTALL,
)
if '</body>' in new_inner:
    new_inner = new_inner.replace('</body>', toolbox_entry + '</body>', 1)
else:
    new_inner = new_inner + toolbox_entry

OUT.write_bytes(new_inner.encode("utf-8"))
print(f"Wrote {OUT}")
print(f"Size: {len(new_inner):,} bytes (original outer: {len(html):,} bytes)")
