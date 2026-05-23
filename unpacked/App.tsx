
const { useState } = React;

/* ── DesignImage ────────────────────────────────────────────────────────────
 * The 3 large illustrated backgrounds are AVIF (smaller than WebP at the same
 * quality, ~70% smaller than the original JPEGs). Universal support among
 * 2023+ browsers; pre-AVIF Safari users just see no background.
 */
const DesignImage = ({ name, alt = '', style }) => {
  const e = (typeof window !== 'undefined' && window.DESIGN_IMGS && window.DESIGN_IMGS[name]) || '';
  // Backwards-compat for older repacks that emitted {avif, webp} objects.
  const src = typeof e === 'string' ? e : (e.avif || e.webp || '');
  return <img src={src} alt={alt} style={style}/>;
};

/* ── async resources ─────────────────────────────────────────────────────────
 * The big data blobs (window.DATASETS / COUNTY_CHARS / BUTTON_SVGS /
 * TAOYUAN_CROPS) used to be inlined into the HTML (~970 KB). Now repack.py
 * writes them to assets/page-data.json and a bootloader script in index.html
 * fetches it in parallel, dispatching 'page-data-ready' when the assignment
 * is done. Components that read these globals subscribe via usePageDataReady
 * so they re-render once the fetch completes.
 */
let _pageDataReady = !!(typeof window !== 'undefined' && window.COUNTY_CHARS && Object.keys(window.COUNTY_CHARS).length > 0);
const _pageDataListeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('page-data-ready', () => {
    _pageDataReady = true;
    for (const fn of _pageDataListeners) fn(Date.now());
  });
}
const usePageDataReady = () => {
  const [, force] = React.useState(_pageDataReady ? 1 : 0);
  React.useEffect(() => {
    if (_pageDataReady) { force(x => x + 1); return; }
    const fn = () => force(x => x + 1);
    _pageDataListeners.add(fn);
    return () => { _pageDataListeners.delete(fn); };
  }, []);
  return _pageDataReady;
};

/* ── Chart.js lazy loader ────────────────────────────────────────────────────
 * Chart.js is ~200 KB and is only needed on the /dashboard route. We injected
 * it inline before, which forced every visitor to download it whether they
 * navigated to the dashboard or not. Now we load it on demand via a dynamic
 * <script> tag the first time a chart component mounts.
 */
let _chartPromise = null;
const ensureChart = () => {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.Chart) return Promise.resolve(window.Chart);
  if (_chartPromise) return _chartPromise;
  _chartPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'assets/chart.umd.min.js';
    s.async = true;
    s.onload  = () => resolve(window.Chart);
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
  return _chartPromise;
};
const useChart = () => {
  const [ok, setOk] = React.useState(!!(typeof window !== 'undefined' && window.Chart));
  React.useEffect(() => {
    if (ok) return;
    let cancelled = false;
    ensureChart().then(() => { if (!cancelled) setOk(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, [ok]);
  return ok;
};

/* ── REGION DATA ─────────────────────────────────────────────────────────────
 * Each county has its own coords (for Open-Meteo weather), the crop the design
 * features for that county (used to query the wholesale-price API), and an
 * optional `priceVariety` / `priceMarket` to scope the price filter. The map
 * click overlay flips `selected` between counties; the data overlays refetch.
 *
 * The static fields (mascotName, weather example, etc.) are baked into the
 * design's full-page PNG, so we don't render them here — they're only kept so
 * we have a per-region static fallback before live data arrives.
 */
const REGIONS_DATA = {
  taipei:    { name:'台北市', coords:[25.0330,121.5654], cropApi:'綠竹筍', weather:{temp:24,desc:'晴時多雲',hum:72,rain:15,fore:[{l:'明天',t:23,icon:'cloud'},{l:'後天',t:22,icon:'cloud'},{l:'週五',t:25,icon:'sun'}]} },
  taoyuan:   { name:'桃園市', coords:[24.9937,121.3010], cropApi:'番茄',   priceVariety:'番茄-牛番茄', weather:{temp:26,desc:'晴天',hum:65,rain:5,fore:[{l:'明天',t:25,icon:'sun'},{l:'後天',t:24,icon:'sun'},{l:'週五',t:26,icon:'cloud'}]} },
  yilan:     { name:'宜蘭縣', coords:[24.7021,121.7377], cropApi:'青蔥', priceVariety:'青蔥-北蔥', weather:{temp:22,desc:'多雲有雨',hum:85,rain:45,fore:[{l:'明天',t:22,icon:'cloud'},{l:'後天',t:21,icon:'cloud'},{l:'週五',t:23,icon:'cloud'}]} },
  taichung:  { name:'台中市', coords:[24.1477,120.6736], cropApi:'梨', priceVariety:'梨-寶島甘露梨', weather:{temp:27,desc:'多雲',hum:68,rain:12,fore:[{l:'明天',t:26,icon:'cloud'},{l:'後天',t:25,icon:'sun'},{l:'週五',t:27,icon:'sun'}]} },
  hualien:   { name:'花蓮縣', coords:[23.9871,121.6015], cropApi:'西瓜', priceVariety:'西瓜-大西瓜', weather:{temp:26,desc:'晴天',hum:70,rain:8,fore:[{l:'明天',t:25,icon:'sun'},{l:'後天',t:26,icon:'sun'},{l:'週五',t:27,icon:'sun'}]} },
  yunlin:    { name:'雲林縣', coords:[23.7092,120.4313], cropApi:'大蒜', priceVariety:'大蒜-硬梗', weather:{temp:29,desc:'晴天',hum:62,rain:5,fore:[{l:'明天',t:28,icon:'sun'},{l:'後天',t:27,icon:'sun'},{l:'週五',t:30,icon:'sun'}]} },
  tainan:    { name:'台南市', coords:[22.9999,120.2269], cropApi:'芒果', weather:{temp:28,desc:'多雲時晴',hum:70,rain:10,fore:[{l:'明天',t:27,icon:'cloud'},{l:'後天',t:26,icon:'cloud'},{l:'週五',t:28,icon:'sun'}]} },
  kaohsiung: { name:'高雄市', coords:[22.6273,120.3014], cropApi:'芭樂', weather:{temp:30,desc:'晴天',hum:65,rain:5,fore:[{l:'明天',t:29,icon:'sun'},{l:'後天',t:28,icon:'sun'},{l:'週五',t:31,icon:'sun'}]} },
  pingtung:  { name:'屏東縣', coords:[22.6690,120.4873], cropApi:'洋蔥', weather:{temp:32,desc:'大晴天',hum:60,rain:3,fore:[{l:'明天',t:31,icon:'sun'},{l:'後天',t:30,icon:'sun'},{l:'週五',t:32,icon:'sun'}]} },
  newtaipei:      { name:'新北市', coords:[25.0123,121.4674], cropApi:'包種茶', weather:{temp:25,desc:'多雲',hum:75,rain:20,fore:[{l:'明天',t:24,icon:'cloud'},{l:'後天',t:25,icon:'cloud'},{l:'週五',t:26,icon:'sun'}]} },
  taitung:        { name:'台東縣', coords:[22.7583,121.1444], cropApi:'釋迦', weather:{temp:27,desc:'多雲時晴',hum:75,rain:15,fore:[{l:'明天',t:26,icon:'cloud'},{l:'後天',t:27,icon:'sun'},{l:'週五',t:28,icon:'sun'}]} },
  chiayi_city:    { name:'嘉義市', coords:[23.4801,120.4491], cropApi:'哈蜜瓜', weather:{temp:29,desc:'晴天',hum:65,rain:5,fore:[{l:'明天',t:28,icon:'sun'},{l:'後天',t:29,icon:'sun'},{l:'週五',t:30,icon:'sun'}]} },
  hsinchu_city:   { name:'新竹市', coords:[24.8138,120.9675], cropApi:'水稻', weather:{temp:26,desc:'多雲',hum:70,rain:15,fore:[{l:'明天',t:25,icon:'cloud'},{l:'後天',t:26,icon:'cloud'},{l:'週五',t:27,icon:'sun'}]} },
  chiayi_county:  { name:'嘉義縣', coords:[23.4523,120.2552], cropApi:'鳳梨', weather:{temp:29,desc:'晴天',hum:68,rain:8,fore:[{l:'明天',t:28,icon:'sun'},{l:'後天',t:29,icon:'sun'},{l:'週五',t:30,icon:'sun'}]} },
  miaoli:         { name:'苗栗縣', coords:[24.5602,120.8214], cropApi:'草莓', weather:{temp:26,desc:'晴時多雲',hum:68,rain:10,fore:[{l:'明天',t:25,icon:'cloud'},{l:'後天',t:26,icon:'sun'},{l:'週五',t:27,icon:'sun'}]} },
  changhua:       { name:'彰化縣', coords:[24.0758,120.5418], cropApi:'葡萄', weather:{temp:28,desc:'多雲時晴',hum:70,rain:10,fore:[{l:'明天',t:27,icon:'cloud'},{l:'後天',t:28,icon:'sun'},{l:'週五',t:29,icon:'sun'}]} },
  hsinchu_county: { name:'新竹縣', coords:[24.8389,121.0177], cropApi:'甜柿', weather:{temp:26,desc:'多雲',hum:72,rain:18,fore:[{l:'明天',t:25,icon:'cloud'},{l:'後天',t:26,icon:'cloud'},{l:'週五',t:27,icon:'sun'}]} },
  nantou:         { name:'南投縣', coords:[23.9100,120.6878], cropApi:'香蕉', weather:{temp:27,desc:'多雲時晴',hum:72,rain:15,fore:[{l:'明天',t:26,icon:'cloud'},{l:'後天',t:27,icon:'sun'},{l:'週五',t:28,icon:'sun'}]} },
  keelung:        { name:'基隆市', coords:[25.1276,121.7392], cropApi:'山藥', weather:{temp:24,desc:'多雲有雨',hum:82,rain:35,fore:[{l:'明天',t:23,icon:'cloud'},{l:'後天',t:24,icon:'cloud'},{l:'週五',t:25,icon:'cloud'}]} },
};

/* ── REGION KEY → COUNTY_CHARS KEY ───────────────────────────────────────
 * REGIONS_DATA uses english region keys (nantou, taipei...) while county_chars
 * uses alphabetical-prefixed keys (o_nantou, p_taipei...). This map bridges
 * the two for the dashboard CharacterCard overlay.
 */
const REGION_TO_CHAR_KEY = {
  newtaipei:      'a_newtaipei',
  taoyuan:        'b_taoyuan',
  taitung:        'c_taitung',
  hualien:        'd_hualien',
  kaohsiung:      'e_kaohsiung',
  pingtung:       'f_pingtung',
  taichung:       'g_taichung',
  yilan:          'h_yilan',
  chiayi_county:  'i_chiayi_county',
  tainan:         'j_tainan',
  miaoli:         'k_miaoli',
  yunlin:         'l_yunlin',
  changhua:       'm_changhua',
  hsinchu_county: 'n_hsinchu_county',
  nantou:         'o_nantou',
  taipei:         'p_taipei',
  keelung:        'q_keelung',
  chiayi_city:    'extra_chiayi_city',
  hsinchu_city:   'extra_hsinchu_city',
};

/* ── WEATHER ICONS ─────────────────────────────────────────────────────── */
const SunIcon = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="9" fill="#f8c840"/>
    {[0,45,90,135,180,225,270,315].map(a=>(
      <line key={a} x1={20+13*Math.cos(a*Math.PI/180)} y1={20+13*Math.sin(a*Math.PI/180)}
        x2={20+17*Math.cos(a*Math.PI/180)} y2={20+17*Math.sin(a*Math.PI/180)}
        stroke="#f8c840" strokeWidth="2.5" strokeLinecap="round"/>
    ))}
  </svg>
);
const CloudSunIcon = ({size=38}) => (
  <svg width={size} height={size} viewBox="0 0 44 44">
    <circle cx="26" cy="16" r="8" fill="#f8c840"/>
    {[0,60,120,180,240,300].map(a=>(
      <line key={a} x1={26+10*Math.cos(a*Math.PI/180)} y1={16+10*Math.sin(a*Math.PI/180)}
        x2={26+13*Math.cos(a*Math.PI/180)} y2={16+13*Math.sin(a*Math.PI/180)}
        stroke="#f8c840" strokeWidth="2" strokeLinecap="round"/>
    ))}
    <ellipse cx="18" cy="28" rx="13" ry="8" fill="#d0e8f8"/>
    <ellipse cx="12" cy="26" rx="9" ry="7" fill="#d0e8f8"/>
    <ellipse cx="26" cy="28" rx="11" ry="7" fill="#d0e8f8"/>
    <ellipse cx="18" cy="24" rx="10" ry="7" fill="#e0f0fc"/>
  </svg>
);
const CloudIcon = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <ellipse cx="20" cy="24" rx="14" ry="9" fill="#c8dff0"/>
    <ellipse cx="14" cy="22" rx="10" ry="8" fill="#c8dff0"/>
    <ellipse cx="26" cy="23" rx="11" ry="8" fill="#c8dff0"/>
    <ellipse cx="20" cy="18" rx="10" ry="8" fill="#d8e8f8"/>
  </svg>
);
const RainIcon = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <ellipse cx="20" cy="18" rx="14" ry="9" fill="#c8dff0"/>
    <ellipse cx="14" cy="16" rx="10" ry="8" fill="#c8dff0"/>
    <ellipse cx="26" cy="17" rx="11" ry="8" fill="#c8dff0"/>
    <ellipse cx="20" cy="12" rx="10" ry="8" fill="#d8e8f8"/>
    <line x1="14" y1="28" x2="12" y2="35" stroke="#74b6e0" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="21" y1="28" x2="19" y2="36" stroke="#74b6e0" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="28" y1="28" x2="26" y2="35" stroke="#74b6e0" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);
const WeatherIcon = ({type, size=28}) =>
  type==='sun'  ? <SunIcon size={size}/> :
  type==='rain' ? <RainIcon size={size}/> :
                  <CloudIcon size={size}/>;

/* ── WEATHER LIVE-FETCH HOOK + CARD ────────────────────────────────────── */
const WMO_DESC = {
  0:'晴天',1:'大致晴朗',2:'多雲時晴',3:'多雲',
  45:'有霧',48:'凍霧',51:'毛毛雨',53:'毛毛雨',55:'大毛毛雨',
  61:'小雨',63:'中雨',65:'大雨',80:'陣雨',81:'陣雨',82:'大陣雨',
  95:'雷雨',96:'雷雨',99:'大雷雨'
};
const wmoIcon = c =>
  c===0||c===1 ? 'sun' :
  c===2        ? 'cloudsun' :
  (c>=51 && c<=82) || (c>=95 && c<=99) ? 'rain' :
                 'cloud';
const MainWxIcon = ({type, size=54}) =>
  type==='sun'      ? <SunIcon size={size}/> :
  type==='rain'     ? <RainIcon size={size}/> :
  type==='cloudsun' ? <CloudSunIcon size={size}/> :
                      <CloudIcon size={size}/>;

const ICON_TO_WMO = { sun: 0, cloud: 3, rain: 61 };
const DESC_TO_WMO = { '晴天': 0, '大晴天': 0, '多雲': 3, '多雲時晴': 2, '晴時多雲': 2, '多雲有雨': 61 };
const staticWx = (w) => ({
  temp: w.temp,
  code: DESC_TO_WMO[w.desc] ?? 3,
  hum:  w.hum,
  rain: w.rain,
  fore: w.fore.map(f => ({ label: f.l, temp: f.t, code: ICON_TO_WMO[f.icon] ?? 3 })),
});

// CWA 中央氣象署 Open Data — 取代 Open-Meteo（台灣本土資料更準確）
// F-D0047-089 = 鄉鎮 3 天 3hr 預報（即時）；F-D0047-091 = 鄉鎮 1 週 12hr 預報（明天/後天/週N）
// API key 為個人申請的 free key — 寫死在前端，理論上會被看到，最壞情況：被 CWA 限速
const CWA_KEY = 'CWA-8AA974C3-7C59-45FF-A587-5256281E5003';

// CWA「天氣現象」中文 → 我們 4 種 icon (sun/cloudsun/cloud/rain) 對應的 WMO code
// 規則：含雨/雷 → 61(rain icon)；多雲時晴 → 2(cloudsun)；晴天 → 0(sun)；其他 → 3(cloud)
const cwaTextToWmo = (txt) => {
  const t = String(txt || '');
  if (/雨|雷/.test(t)) return 61;
  if (/多雲時晴|晴時多雲/.test(t)) return 2;
  if (t === '晴天' || t === '晴') return 0;
  if (/多雲|陰|霧/.test(t)) return 3;
  return 3;
};

// 取一個 ElementValue 陣列裡的指定 key（CWA 結構慣例）
const _cwaVal = (timeArr, key) =>
  (timeArr || []).map(t => (t.ElementValue && t.ElementValue[0] && t.ElementValue[0][key]));

const useLiveWeather = (regionId) => {
  const region = REGIONS_DATA[regionId] || REGIONS_DATA.taoyuan;
  const [lat, lon] = region.coords;
  const cityName = region.name;  // 例：「桃園市」— 對應 CWA LocationName
  const [wx, setWx] = React.useState(() => staticWx(region.weather));
  React.useEffect(() => {
    setWx(staticWx(region.weather));
    let cancelled = false;
    const base = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore';
    const u3 = `${base}/F-D0047-089?Authorization=${CWA_KEY}&format=JSON&LocationName=${encodeURIComponent(cityName)}`;
    const uw = `${base}/F-D0047-091?Authorization=${CWA_KEY}&format=JSON&LocationName=${encodeURIComponent(cityName)}`;
    Promise.all([fetch(u3).then(r=>r.json()), fetch(uw).then(r=>r.json())])
      .then(([d3, dw]) => {
        if (cancelled) return;
        const sub3 = d3?.records?.Locations?.[0]?.Location?.[0];
        const subW = dw?.records?.Locations?.[0]?.Location?.[0];
        if (!sub3 || !subW) return;
        const els3 = sub3.WeatherElement || [];
        const elsW = subW.WeatherElement || [];

        const find = (arr, name) => (arr || []).find(e => e.ElementName === name);

        // 即時值（從 3hr 預報第一格）
        const tNow = _cwaVal(find(els3, '溫度')?.Time, 'Temperature')[0];
        const hNow = _cwaVal(find(els3, '相對濕度')?.Time, 'RelativeHumidity')[0];
        const rNow = _cwaVal(find(els3, '3小時降雨機率')?.Time, 'ProbabilityOfPrecipitation')[0];
        const wxNow = _cwaVal(find(els3, '天氣現象')?.Time, 'Weather')[0];

        // 未來 3 天最高溫 / 天氣 — 從 12hr 系列彙整成日（白天那一段）
        const dayLabels = ['日','一','二','三','四','五','六'];
        const maxTimes = find(elsW, '最高溫度')?.Time || [];
        const wxTimes = find(elsW, '天氣現象')?.Time || [];
        // 取「白天 06-18」段（StartTime 是當日 06:00 的那筆）— index 0/2/4 通常是白天
        const dailyByDate = {};
        maxTimes.forEach((t, i) => {
          const date = (t.StartTime || '').slice(0, 10);
          const startHour = Number((t.StartTime || '').slice(11, 13));
          // 偏好白天段（06-18）；若不是白天段就 fallback
          if (!dailyByDate[date] || (startHour === 6 && dailyByDate[date].startHour !== 6)){
            dailyByDate[date] = {
              startHour,
              maxTemp: Number(t.ElementValue?.[0]?.MaxTemperature),
              wxText: '',
            };
          }
        });
        wxTimes.forEach(t => {
          const date = (t.StartTime || '').slice(0, 10);
          const startHour = Number((t.StartTime || '').slice(11, 13));
          if (dailyByDate[date] && (startHour === 6 || !dailyByDate[date].wxText)){
            dailyByDate[date].wxText = t.ElementValue?.[0]?.Weather || '';
          }
        });
        const todayStr = new Date().toISOString().slice(0, 10);
        const futureDates = Object.keys(dailyByDate).sort().filter(d => d > todayStr).slice(0, 3);

        const fore = futureDates.map((d, i) => {
          const dt = new Date(d);
          return {
            label: i === 0 ? '明天' : (i === 1 ? '後天' : '週' + dayLabels[dt.getDay()]),
            temp: Number.isFinite(dailyByDate[d].maxTemp) ? Math.round(dailyByDate[d].maxTemp) : 25,
            code: cwaTextToWmo(dailyByDate[d].wxText),
          };
        });

        setWx({
          temp: Number.isFinite(Number(tNow)) ? Math.round(Number(tNow)) : region.weather.temp,
          code: cwaTextToWmo(wxNow),
          hum:  Number.isFinite(Number(hNow)) ? Math.round(Number(hNow)) : region.weather.hum,
          rain: Number.isFinite(Number(rNow)) ? Math.round(Number(rNow)) : region.weather.rain,
          fore: fore.length === 3 ? fore : staticWx(region.weather).fore,
        });
      }).catch(()=>{});
    return () => { cancelled = true; };
  }, [lat, lon, cityName]);
  return wx;
};

// Cards are rendered at exact design size (px) inside a ScaledOverlay wrapper
// that handles both positioning and uniform scaling for mobile.
const WeatherCard = ({wx}) => (
  <div style={{
    width:'100%', height:'100%',
    background:'#edf2f3',
    border:'1.5px solid #b1c1c4',
    borderRadius:15,
    padding:'10px 12px 8px',
    display:'flex', flexDirection:'column', justifyContent:'space-between',
    overflow:'hidden',
    boxSizing:'border-box',
    fontFamily:"'Noto Sans TC',sans-serif",
  }}>
    <div>
      <div style={{fontSize:17,fontWeight:900,color:'#427ea1',marginBottom:4,letterSpacing:1.5}}>天氣預報</div>
      <div style={{display:'flex',alignItems:'center',gap:2,marginBottom:2,marginLeft:-4}}>
        <MainWxIcon type={wmoIcon(wx.code)} size={72}/>
        <div style={{fontSize:48,fontWeight:900,color:'#427ea1',lineHeight:1,letterSpacing:-1}}>
          {wx.temp}<span style={{fontSize:26,fontWeight:700}}>°C</span>
        </div>
      </div>
      <div style={{fontSize:18,fontWeight:700,color:'#427ea1',textAlign:'center',marginBottom:8,letterSpacing:1}}>{WMO_DESC[wx.code]||'多雲時晴'}</div>
      <div style={{fontSize:15,fontWeight:700,color:'#427ea1',display:'flex',justifyContent:'space-between',padding:'0 2px'}}>
        <span>濕度 {wx.hum}%</span>
        <span>降雨機率 {wx.rain}%</span>
      </div>
    </div>
    <div style={{borderTop:'1px solid #b8d8ea',paddingTop:6,display:'flex',justifyContent:'space-around',marginBottom:-2}}>
      {wx.fore.map((f,i)=>(
        <div key={i} style={{textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:0}}>
          <div style={{fontSize:15,fontWeight:700,color:'#427ea1',marginBottom:1}}>{f.label}</div>
          <WeatherIcon type={wmoIcon(f.code)} size={54}/>
          <div style={{fontSize:18,fontWeight:700,color:'#5d5d5d',marginTop:1}}>{f.temp}°C</div>
        </div>
      ))}
    </div>
  </div>
);

/* ── PRICE LIVE-FETCH OVERLAY ──────────────────────────────────────────── */
const PRICE_FALLBACK = {
  '菠菜':   { price: 42,  chgPct: 2,  sparkVals: [38,40,41,43,42] },
  '番茄':   { price: 65,  chgPct: -2, sparkVals: [70,68,66,64,65] },
  '蘿蔔':   { price: 35,  chgPct: 1,  sparkVals: [32,33,34,35,35] },
  '南瓜':   { price: 55,  chgPct: 3,  sparkVals: [50,52,53,54,55] },
  '茄子':   { price: 48,  chgPct: -1, sparkVals: [52,50,49,48,48] },
  '洋蔥':   { price: 38,  chgPct: 4,  sparkVals: [34,35,36,37,38] },
  '彩椒':   { price: 118, chgPct: 3,  sparkVals: [105,110,112,115,118] },
  '花椰菜': { price: 58,  chgPct: -3, sparkVals: [64,62,60,59,58] },
  '鳳梨':   { price: 75,  chgPct: 6,  sparkVals: [66,68,71,73,75] },
};

const PriceOverlay = ({cropName, variety, market}) => {
  // Pull the cached nongzhidao snapshot via the same hook the dashboard uses.
  // Prefer the variety key (e.g. '番茄-牛番茄') when REGIONS_DATA defines one,
  // falling back to the broad crop name. NONGZHIDAO_MAP / WHOLESALE_NO_DATA
  // already cover every county we've backfilled.
  const noData = !!(cropName && WHOLESALE_NO_DATA.has(cropName));
  const m = useCropMarket(noData ? '__nodata__' : (variety || cropName || '番茄'));

  // Derive the displayed values from m.daily directly so price flips when
  // selected → new region → new cropName triggers a re-fetch.
  const data = React.useMemo(() => {
    const fallback = PRICE_FALLBACK[cropName] || null;
    if (!m || !Array.isArray(m.daily) || m.daily.length === 0) return fallback;
    const recent = m.daily.slice(-7);
    const sparkVals = recent.map(d => Math.round(d.price));
    const sparkDates = recent.map(d => {
      const parts = String(d.date || '').split(/[./-]/).map(n => parseInt(n, 10));
      return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : '';
    });
    const price = sparkVals[sparkVals.length - 1];
    const prevPrice = sparkVals[sparkVals.length - 2] || price;
    const chgPct = prevPrice ? Math.round((price - prevPrice) / prevPrice * 100) : 0;
    return { price, chgPct, sparkVals, sparkDates };
  }, [m, cropName]);

  // Crops without any AMIS wholesale data (tea, rice) get an explicit placeholder.
  if (noData) {
    return (
      <div style={{
        width:'100%', height:'100%',
        background:'#f5f4e1', border:'1.5px solid #e3e1bd', borderRadius:15,
        padding:'12px 14px', boxSizing:'border-box',
        display:'flex', flexDirection:'column',
        fontFamily:"'Noto Sans TC',sans-serif",
      }}>
        <div style={{fontSize:14,fontWeight:900,color:'#3b6826',marginBottom:4,letterSpacing:1}}>
          今日價格 · {cropName}
        </div>
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          color:'#888', fontSize:12, textAlign:'center',
        }}>
          <div>無批發市場交易資料</div>
          <div style={{fontSize:10, color:'#aaa', marginTop:4}}>(不在 AMIS 蔬果拍賣系統)</div>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { price, chgPct, sparkVals } = data;
  const sparkDates = data.sparkDates && data.sparkDates.length === sparkVals.length
    ? data.sparkDates
    : (() => {
        const now = new Date();
        return Array.from({length: sparkVals.length}, (_, i) => {
          const d = new Date(now - (sparkVals.length-1-i)*86400000);
          return `${d.getMonth()+1}/${d.getDate()}`;
        });
      })();

  // Sparkline coordinates in % of the chart area (the chart fills the bottom
  // half of the card; the price/chg metadata sits above).
  const padX = 8, padTop = 20, padBot = 22;
  const plotH = 100 - padTop - padBot;
  const minV = Math.min(...sparkVals);
  const maxV = Math.max(...sparkVals);
  const range = Math.max(maxV - minV, 1);
  const xPct = (i) => padX + i*(100-2*padX)/(sparkVals.length-1);
  const yPct = (v) => padTop + (1-(v-minV)/range)*plotH;
  const pts = sparkVals.map((v,i)=>`${xPct(i)},${yPct(v)}`).join(' ');

  return (
    <div style={{
      width:'100%', height:'100%',
      background:'#f5f4e1',
      border:'1.5px solid #e3e1bd',
      borderRadius:15,
      padding:'12px 14px',
      display:'flex', flexDirection:'column',
      overflow:'hidden',
      boxSizing:'border-box',
      fontFamily:"'Noto Sans TC',sans-serif",
    }}>
      <div style={{fontSize:14,fontWeight:900,color:'#3b6826',marginBottom:4,letterSpacing:1}}>
        今日價格 <span style={{fontWeight:500,color:'#9a9a9a',fontSize:10}}>(每公斤)</span>
      </div>
      <div style={{fontSize:34,fontWeight:900,color:'#3aaa5e',lineHeight:1.1,marginBottom:2}}>
        <span style={{fontSize:16}}>$</span>{price}
      </div>
      <div style={{fontSize:10,color:chgPct>=0?'#e05050':'#3aaa5e',marginBottom:4}}>
        較昨日 {chgPct>=0?'▲':'▼'} {Math.abs(chgPct)}%
      </div>
      <div style={{flex:1, position:'relative', minHeight:0, marginTop:6}}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
          <polyline points={pts} fill="none" stroke="#4cae6e" strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        </svg>
        {sparkVals.map((v,i)=>(
          <React.Fragment key={i}>
            <div style={{position:'absolute', left:`${xPct(i)}%`, top:`${yPct(v)}%`,
              width:7, height:7, background:'#4cae6e', borderRadius:'50%',
              transform:'translate(-50%,-50%)'}}/>
            <div style={{position:'absolute', left:`${xPct(i)}%`, top:`${yPct(v)}%`,
              transform:'translate(-50%,-170%)', fontSize:11, fontWeight:700,
              color:'#3aaa5e', whiteSpace:'nowrap', lineHeight:1}}>{v}</div>
            <div style={{position:'absolute', left:`${xPct(i)}%`, bottom:0,
              transform:'translateX(-50%)', fontSize:10, color:'#999',
              whiteSpace:'nowrap', lineHeight:1}}>{sparkDates[i]}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/* ── SCALED OVERLAY ────────────────────────────────────────────────────────
 * Renders `children` inside a fixed design-pixel box (`designW × designH`),
 * then uniformly scales it to match the page width via CSS `cqw`. The Page
 * container sets `container-type: inline-size`, so 100cqw = page width in px,
 * and `100cqw / 1440px` is the unitless scale factor (1 at desktop, 0.27 at
 * iPhone). Everything inside (fonts, SVG icons, padding) scales together so
 * the layout stays pixel-perfect to the design at any viewport.
 */
const ScaledOverlay = ({x, y, w, h, children}) => (
  <div style={{
    position:'absolute',
    left: `${x/1440*100}%`,
    top:  `${y/2996*100}%`,
    width: 0, height: 0,  // wrapper is just an anchor; child uses fixed px
  }}>
    <div style={{
      width: w, height: h,
      transformOrigin:'top left',
      transform:'scale(calc(100cqw / 1440px))',
    }}>
      {children}
    </div>
  </div>
);

/* ── 桃園市其他主要作物 strip carousel ──────────────────────────────────
 * 5-slot strip on the landing right-panel. The baked full_page image
 * shows 水蜜桃 / 水稻 / 甜柿 / 綠竹筍 / 哈密瓜 in slots 0..4, but 水稻 and
 * 甜柿 don't actually exist as Taoyuan crops in our data — the Figma
 * original included them but the implementation list is 10 real crops
 * (per user). Because of this we ALWAYS render virtual overlay cards
 * (hiding the baked image), so the visible content matches the data.
 *   crop = key into TAOYUAN_CROPS / NONGZHIDAO_MAP (price data)
 *   label = short display name shown under the character on the card */
const TAOYUAN_CROP_LIST = [
  { label:'茶葉',   crop:'茶葉'      },
  { label:'水蜜桃', crop:'水蜜桃'    },
  { label:'綠竹筍', crop:'綠竹筍'    },
  { label:'包心白', crop:'包心白'    },
  { label:'稻米',   crop:'稻米'      },
  { label:'柚子',   crop:'柚子'      },
  { label:'甘藍',   crop:'甘藍-初秋' },
  { label:'牛蕃茄', crop:'牛蕃茄'    },
  { label:'粉蔥',   crop:'青蔥-粉蔥' },
  { label:'哈密瓜', crop:'哈密瓜'    },
];
// 5 slot positions on the baked strip (design coords). Cards are 109×135
// at y=757; left edges 768, 885, 1002, 1119, 1236 (gap=8 from Figma 51:4980).
const STRIP_SLOTS = [
  { x: 768  },
  { x: 885  },
  { x: 1002 },
  { x: 1119 },
  { x: 1236 },
];

/* ── MAP CLICK NAVIGATION ──────────────────────────────────────────────────
 * 點擊桃園市 polygon (51:5084) → 切到桃園 detail / 蕃茄 dashboard view。
 * 舊的 TOMATO_HOTSPOT 透明 click 圓圈已移除（用 polygon-shaped click 取代）。
 */
const TAOYUAN_POLYGON_ID = '51_5084';

/* ── TW COUNTIES POLYGON OVERLAY ──────────────────────────────────────────
 * 18 個縣市的 SVG path，從 Figma 設計檔抽出（node id 51:5082~51:5101）。
 * Coordinates 在 1440×2996 design canvas 系統，cx/cy 是該 polygon 在 canvas
 * 的絕對位置，viewBox 是該 polygon 原始的 SVG viewBox。
 * 51:5082 isBase=true 是台灣本島輪廓底層，不參與 hover。
 */
const TW_COUNTIES = [
  { id:'51_5082', isBase:true,  cx:224.001, cy:163.000, cw:446.999, ch:712.593, viewBox:'0 0 466.822 732.466', d:'M456.856 74.8654C456.316 63.1225 448.205 56.222 438.986 50.737C433.128 47.2449 426.973 44.684 420.883 42.1044C413.163 38.8358 405.545 35.5485 398.719 30.3615C397.211 29.2068 395.73 27.9682 394.305 26.6086C388.867 21.4216 384.257 12.2769 376.528 10.2002C368.221 7.97457 340.507 19.4195 332.676 24.1874C326.958 27.6702 323.317 32.6244 316.994 35.3157C309.59 38.4633 299.58 40.1023 291.534 42.7004C276.746 47.4684 266.167 53.2141 253.111 61.0179C245.884 65.3295 241.601 66.6798 235.24 73.0867C221.132 87.2881 216.131 109.005 204.407 124.919C195.504 137.007 182.467 144.485 171.553 154.402C161.794 163.268 151.671 174.536 142.741 184.351C129.75 198.636 117.262 213.219 106.553 229.041C96.4953 243.894 88.7939 261.271 76.632 274.858C70.9328 281.218 64.7773 286.918 59.1992 293.39C41.2822 314.175 38.1905 332.204 30.1539 357.738C24.3523 376.167 16.2691 398.172 12.2834 416.723C4.96391 450.787 15.7104 467.969 28.3659 497.61C46.0129 538.91 54.8131 558.951 85.5625 592.345C101.571 609.731 143.784 648.387 147.993 669.554C150.684 683.131 145.693 704.354 153.934 715.455C159.466 722.904 170.436 725.27 177.578 718.546C183.901 712.596 195.346 667.607 199.062 656.246C205.916 635.275 212.984 610.895 221.393 590.771C224.54 583.247 227.204 579.764 232.558 573.785C253.455 550.43 278.049 529.002 298.928 505.656C326.455 474.879 331.605 431.678 342.044 392.594C355.156 343.5 366.554 293.399 382.795 245.44C393.849 233.232 403.478 229.833 412.194 214.737C416.217 207.772 430.828 178.996 431.815 172.468C434.814 152.475 417.754 129.669 427.606 112.404C435.745 98.1277 457.769 94.1792 456.875 74.8747L456.856 74.8654Z'},
  { id:'51_5083', isBase:false, cx:505.623, cy:163.000, cw:165.323, ch:129.191, viewBox:'0 0 172.123 135.992', d:'M150.852 44.2193C135.924 35.3353 119.097 32.4205 106.171 20.0909C100.733 14.9039 96.1233 5.75916 88.3941 3.6825C80.0874 1.45684 52.3738 12.9018 44.5421 17.6697C38.8243 21.1525 35.1831 26.1067 28.86 28.798C21.4567 31.9456 11.4459 33.5845 3.4 36.1827L56.8344 131.905C60.0844 134.428 60.6618 129.279 63.8559 127.705C84.6505 117.452 117.803 83.6386 138.327 79.299C149.26 76.9895 163.21 80.4351 168.723 68.3663C168.183 56.6234 160.071 49.7229 150.852 44.2379V44.2193Z'},
  { id:'51_5084', isBase:false, cx:467.200, cy:195.775, cw:92.951,  ch:111.735, viewBox:'0 0 99.7522 118.534', d:'M41.8327 3.40003C41.8327 3.40003 96.934 97.3526 96.3474 99.3268C95.5651 101.962 75.0313 115.642 70.878 115.121C61.8543 106.833 49.8879 101.85 42.3635 92.0259C37.4093 85.5445 32.8462 76.5953 28.7954 69.3968C19.9859 53.7148 12.3777 37.325 3.40052 21.7268C16.4658 13.923 27.0447 8.16797 41.8234 3.40934L41.8327 3.40003Z'},
  { id:'51_5085', isBase:false, cx:376.446, cy:545.669, cw:179.687, ch:263.652, viewBox:'0 0 186.486 270.452', d:'M183.077 3.4C172.638 42.484 167.488 85.6842 139.96 116.462C119.082 139.808 94.4881 161.235 73.5911 184.591C68.2365 190.569 65.5732 194.052 62.4256 201.577C54.0165 221.701 46.9484 246.081 40.0945 267.052C40.0945 267.052 19.421 246.928 10.3787 235.772C2.994 226.664 2.64944 225.752 4.0463 213.785C6.99832 188.465 14.9511 163.303 16.9346 138.057C16.3014 134.416 11.9153 130.346 8.37655 129.862C14.1316 128.26 20.492 131.594 22.5966 124.694C22.5966 124.694 29.1804 69.8438 37.4032 56.7878C43.894 46.479 74.9507 26.6344 74.9507 26.6344C76.2638 27.2024 123.99 56.0149 123.99 56.0149L136.152 50.5206C136.152 50.5206 152.271 19.9295 162.971 11.2131C168.698 6.54757 176.148 5.19729 183.086 3.4H183.077Z'},
  { id:'51_5086', isBase:false, cx:445.297, cy:359.132, cw:180.967, ch:239.160, viewBox:'0 0 187.767 245.961', d:'M184.367 12.0887C175.651 27.184 166.022 30.5831 154.968 42.7916C138.727 90.7503 127.329 140.851 114.217 189.946C107.289 191.743 99.839 193.093 94.1026 197.759C83.4027 206.485 67.2829 237.066 67.2829 237.066L55.121 242.561C55.121 242.561 7.39503 213.748 6.08199 213.18L3.40003 185.923C16.5305 175.176 38.1911 151.672 38.1911 151.672L71.3152 48.2859L99.8856 3.40022C110.427 5.97975 168.229 11.3716 184.358 12.0887H184.367Z'},
  { id:'51_5087', isBase:false, cx:242.455, cy:540.509, cw:205.533, ch:204.919, viewBox:'0 0 212.334 211.719', d:'M206.252 4.5457C206.252 3.39097 208.933 31.803 208.933 31.803C208.933 31.803 177.877 51.6477 171.386 61.9565L156.579 129.862C156.579 129.862 148.114 133.438 142.359 135.031C139.612 134.649 75.4592 151.802 75.4592 151.802C75.4592 151.802 64.5171 193.615 60.5966 208.319C29.8565 174.925 21.047 154.885 3.4 113.584C18.1508 111.312 41.6273 113.733 54.9254 107.243C60.6991 104.421 85.0044 81.5404 88.4779 76.0089C90.8898 72.1629 92.1563 67.3856 90.0796 63.0926C96.7007 64.983 101.888 58.0639 105.948 53.715C112.765 46.4141 117.765 37.1576 126.128 31.4491C146.969 24.5673 167.456 15.376 187.934 8.13097C190.579 7.19042 201.12 3.42821 203.113 3.40027C204.482 3.38164 205.125 4.00556 206.252 4.55499V4.5457Z'},
  { id:'51_5088', isBase:false, cx:299.633, cy:666.962, cw:113.499, ch:208.630, viewBox:'0 0 120.299 215.443', d:'M99.4014 3.40008C99.4014 3.40008 83.8031 67.1713 80.8511 92.501C79.4543 104.458 79.7988 105.371 87.1835 114.487C96.2258 125.644 116.899 145.768 116.899 145.768C113.184 157.129 101.739 202.117 95.4157 208.068C88.2731 214.791 77.3031 212.426 71.7715 204.976C63.5301 193.885 68.5308 172.653 65.8302 159.075C61.6304 137.899 19.408 99.2431 3.40006 81.8662C7.32057 67.1619 18.2626 25.3494 18.2626 25.3494L99.392 3.4094L99.4014 3.40008Z'},
  { id:'51_5089', isBase:false, cx:320.651, cy:337.425, cw:221.150, ch:83.122,  viewBox:'0 0 227.951 89.9224', d:'M173.873 6.54773C183.222 6.57566 206.252 4.29413 206.252 4.29413C206.252 4.29413 222.139 22.7699 224.551 25.098C218.945 38.3402 195.98 69.9837 195.98 69.9837C179.199 66.296 162.567 58.5946 145.321 57.9707L57.0209 86.5224L3.40028 48.0902C14.1095 32.2685 26.6067 17.6853 39.5882 3.40014C52.9701 8.77338 66.3706 14.3236 80.0132 19.0449C102.4 26.7928 110.744 29.2141 134.761 23.2821C141.885 21.522 157.306 15.3386 162.679 10.5427L173.863 6.53842L173.873 6.54773Z'},
  { id:'51_5090', isBase:false, cx:523.494, cy:227.958, cw:147.478, ch:139.863, viewBox:'0 0 154.278 146.663', d:'M106.171 143.263C90.0424 142.546 32.2405 137.154 21.6989 134.574C20.8608 134.118 3.40005 113.771 3.40005 113.771C5.48602 106.805 14.5749 82.9373 14.5749 82.9373C18.7282 83.4681 99.9321 18.6726 120.457 14.333C131.389 12.0235 145.339 15.4691 150.852 3.40028C151.737 22.7142 129.722 26.6533 121.583 40.9292C111.731 58.2036 128.791 81.0003 125.793 100.994C124.815 107.531 110.194 136.297 106.171 143.263Z'},
  { id:'51_5091', isBase:false, cx:226.354, cy:493.928, cw:200.635, ch:113.743, viewBox:'0 0 207.436 120.544', d:'M149.074 9.81872C160.584 10.6382 174.329 44.0883 184.414 50.8584C190.141 54.7044 197.321 54.7323 204.035 54.6951C183.557 61.9401 163.07 71.1314 142.229 78.0133L111.917 117.144L86.6992 79.764C85.5911 78.2368 84.5294 77.0075 82.8253 76.0391C79.9571 74.4094 59.1346 70.0419 55.9125 70.3399C51.3494 70.7589 46.0973 77.7339 41.9719 80.0899C36.2261 83.3586 33.0786 82.3249 26.8672 81.9524C19.0634 81.4868 11.1572 80.2575 3.40002 79.2797C7.38572 60.7295 15.4689 38.7243 21.2705 20.2951L94.7544 3.74706C105.091 1.54002 110.958 10.4613 118.985 14.4004C127.636 18.6469 149.064 9.81872 149.064 9.81872H149.074Z'},
  { id:'51_5092', isBase:false, cx:224.000, cy:560.852, cw:110.890, ch:89.832,  viewBox:'0 0 117.684 96.6322', d:'M5.76662 12.3539C13.5238 13.3317 21.4207 14.561 29.2338 15.0266C35.4452 15.3991 38.5928 16.4328 44.3385 13.1641C48.4639 10.8174 53.7161 3.83313 58.2791 3.41408C61.5012 3.11608 82.3237 7.48358 85.1919 9.11325C86.896 10.0817 87.8552 11.3948 89.0658 12.8382L114.284 50.2181C110.81 55.7589 79.1575 84.0779 73.3838 86.8902C60.0857 93.3809 36.6092 90.9597 21.8584 93.2319C9.19358 63.5906 -1.54359 46.4093 5.77593 12.3446L5.76662 12.3539Z'},
  { id:'51_5093', isBase:false, cx:356.849, cy:278.012, cw:130.085, ch:82.621,  viewBox:'0 0 136.885 89.4209', d:'M133.475 67.4692C128.102 72.265 105.687 80.9535 98.5726 82.7135C74.5559 88.6455 66.212 86.215 43.8251 78.4764C30.1825 73.755 16.7819 68.2049 3.40005 62.8316C12.3306 53.0164 22.4439 41.7484 32.2125 32.883C43.1267 22.9746 56.164 15.4875 65.0666 3.40001C70.4585 9.00606 133.485 67.4785 133.485 67.4785L133.475 67.4692Z'},
  { id:'51_5094', isBase:false, cx:244.243, cy:446.464, cw:127.784, ch:64.358,  viewBox:'0 0 134.585 71.1579', d:'M32.4454 3.40003L111.377 17.201C112.653 17.4245 118.203 18.3836 119.311 20.4231C119.889 21.4847 131.185 61.4999 131.185 61.4999L100.649 65.2901L76.884 51.2098L3.40007 67.7579C11.4366 42.2233 14.5284 24.1945 32.4454 3.40932V3.40003Z'},
  { id:'51_5095', isBase:false, cx:273.289, cy:382.115, cw:101.462, ch:81.362,  viewBox:'0 0 108.262 88.1626', d:'M50.7628 3.4L104.383 41.8322C105.101 43.0428 104.868 44.1323 104.607 45.4081C104.169 47.5686 90.2659 84.7622 90.2659 84.7622L3.40005 67.7485C8.97817 61.2764 15.1337 55.5773 20.8328 49.2169C33.0041 35.6395 40.6961 18.2532 50.7535 3.4H50.7628Z'},
  { id:'51_5096', isBase:false, cx:415.106, cy:210.701, cw:122.972, ch:134.780, viewBox:'0 0 122.971 134.78',  d:'M52.3205 0.0078125C53.4482 0.082906 54.4712 0.716143 55.0402 1.7041C59.5735 9.57618 63.7539 17.639 67.8771 25.6436C72.0111 33.6689 76.0845 41.628 80.4523 49.4033L82.0256 52.2324C85.589 58.6907 89.3062 65.6718 93.3088 71.041L93.7551 71.6309L93.757 71.6338C97.1759 76.1021 101.671 79.5529 106.69 83.0322C111.582 86.4246 117.135 89.9397 121.871 94.29C122.896 95.2314 123.244 96.7023 122.749 98.0029V98.0039C122.749 98.0045 122.749 98.0058 122.748 98.0068L122.724 98.0703C122.707 98.1153 122.681 98.1828 122.648 98.2705C122.581 98.4463 122.482 98.7059 122.357 99.0381C122.105 99.7026 121.743 100.66 121.302 101.831C120.419 104.174 119.221 107.368 117.958 110.779C115.413 117.654 112.663 125.248 111.653 128.606C111.278 129.85 110.228 130.773 108.945 130.982C108.348 131.08 101.476 132.033 93.6252 132.954C85.8251 133.869 76.7248 134.795 71.8078 134.78C70.8962 134.777 70.1677 134.429 69.922 134.311C69.5553 134.133 69.1992 133.916 68.884 133.709C68.2449 133.289 67.4964 132.723 66.6916 132.076C65.0674 130.771 62.9726 128.943 60.6017 126.801C55.8478 122.504 49.8276 116.796 43.9308 111.112C38.0286 105.423 32.2268 99.7356 27.9025 95.4727C25.74 93.3408 23.9453 91.5634 22.6916 90.3193C22.0649 89.6975 21.5727 89.2085 21.2375 88.875C21.07 88.7084 20.9413 88.5805 20.8547 88.4941C20.8114 88.451 20.7781 88.4175 20.756 88.3955C20.7452 88.3847 20.7362 88.3766 20.7306 88.3711C20.728 88.3684 20.7262 88.3656 20.7248 88.3643L20.7228 88.3633C20.7228 88.3632 20.7228 88.3624 20.7267 88.3584V88.3574L20.7228 88.3623C20.6857 88.3253 20.6496 88.2875 20.6144 88.249C15.311 83.1113 6.28627 75.1983 0.949387 69.6494C-0.198199 68.4561 -0.319465 66.6095 0.662278 65.2764C6.28971 57.6375 10.3019 48.609 14.8654 39.2412C19.3179 30.1014 24.2637 20.7287 31.6652 13.2217C31.7098 13.1711 31.7549 13.1206 31.8029 13.0723C38.5625 6.27306 43.5695 4.53574 50.3381 0.483398C50.8657 0.167493 51.4702 8.19988e-05 52.0851 0H52.0939L52.3205 0.0078125Z'},
  { id:'51_5099', isBase:false, cx:360.164, cy:392.005, cw:153.068, ch:153.226, viewBox:'0 0 159.868 160.026', d:'M156.458 15.413L123.334 118.799C123.334 118.799 101.683 142.303 88.5431 153.05L70.2256 156.626L44.2813 155.667L15.2733 115.968C12.88 108.453 3.4 74.8911 3.4 74.8911L17.5083 31.9518L105.808 3.4C123.055 4.02393 139.687 11.7253 156.468 15.413H156.458Z'},
  { id:'51_5100', isBase:false, cx:547.033, cy:199.417, cw:40.010,  ch:52.228,  viewBox:'0 0 46.8106 59.0278', d:'M21.85 3.4453C23.9081 3.1473 25.0814 4.36722 26.4224 5.69889C32.1961 11.4819 39.5715 23.4297 41.3874 31.3172C42.3466 35.4799 45.2614 46.4405 41.6575 49.2249C40.1395 50.3983 25.3236 55.5667 23.4238 55.6225C21.8687 55.6691 21.3379 55.4084 20.0993 54.5982C19.0284 53.8998 10.3865 44.9692 10.0233 44.0473C7.94666 38.7392 12.547 36.2528 12.1465 33.3008C10.4237 27.881 -0.369301 22.368 4.78044 16.3243C6.54048 14.2663 15.7132 7.29131 18.302 5.56852C19.3543 4.87009 20.5463 3.63154 21.8407 3.43598L21.85 3.4453Z'},
  { id:'51_5101', isBase:false, cx:602.990, cy:183.445, cw:46.397,  ch:38.091,  viewBox:'0 0 53.1965 44.8871', d:'M12.0066 34.8479C15.2566 36.4683 36.4609 41.0127 40.5677 41.3573C41.5641 41.4411 42.5419 41.6366 43.5383 41.3014C46.1365 40.4167 48.7998 26.057 49.7962 21.7175C37.5132 15.2454 24.3082 11.837 13.2172 3.40002C10.4049 7.72096 3.77443 14.9381 3.42056 18.0111C3.01082 21.5964 8.561 33.1344 12.0066 34.8572V34.8479Z'},
];

// 桃園 (51:5096) 在 Figma 設計中已是彩色（粉橘紅）— hover color 沿用同色系
const HOVER_FILL = '#f5a78a';
const TAOYUAN_BASE_FILL = '#f5a78a';

/* ── COUNTY → CHARACTER SVG MAPPING ────────────────────────────────────────
 * 17 個 polygon node id → 角色 SVG key（base64 編進 window.COUNTY_CHARS）。
 * 編號順序（a-q）對應 polygon order TW_COUNTIES[1..17]（index 0 是 isBase=true）。
 * Hover 時把 SVG 顯示在該 polygon 中心上方。
 * 額外 2 個 polygon 外 hotspot（新竹市、嘉義市 — design polygon 沒拆出）
 * 用 fixed canvas position 做小 hotspot 觸發。
 */
const COUNTY_CHAR_MAP = {
  '51_5083': 'a_newtaipei',        // a 新北市
  '51_5084': 'b_taoyuan',          // b 桃園市
  '51_5085': 'c_taitung',          // c 台東縣
  '51_5086': 'd_hualien',          // d 花蓮縣
  '51_5087': 'e_kaohsiung',        // e 高雄市
  '51_5088': 'f_pingtung',         // f 屏東縣
  '51_5089': 'g_taichung',         // g 台中市
  '51_5090': 'h_yilan',            // h 宜蘭縣
  '51_5091': 'i_chiayi_county',    // i 嘉義縣
  '51_5092': 'j_tainan',           // j 台南市
  '51_5093': 'k_miaoli',           // k 苗栗縣
  '51_5094': 'l_yunlin',           // l 雲林縣
  '51_5095': 'm_changhua',         // m 彰化縣
  '51_5096': 'n_hsinchu_county',   // n 新竹縣
  '51_5099': 'o_nantou',           // o 南投縣
  '51_5100': 'p_taipei',           // p 台北市
  '51_5101': 'q_keelung',          // q 基隆市
};

/* ── 桃園鄉鎮 polygon 資料（從 桃園地圖.ai 抽出，design canvas 1601×2000）─────
 * 13 個鄉鎮 polygon — hover 時 polygon 變色 + 顯示作物名稱方框。
 * 角色已印在底圖 taoyuan_detail.png 上，故不需另外的角色 SVG。
 */
const TAOYUAN_TOWNSHIPS = [
  { id:'1_10', crop:'綠竹筍',     cx:831.710, cy:908.150, cw:373.900, ch:337.240, viewBox:'0 0 373.896 337.24',  d:'M373.896 161.245C356.599 182.604 338.599 203.479 321.505 224.068C289.193 262.979 251.443 299.188 202.302 315.125C174.318 324.203 145.177 328.901 115.979 331.964C108.344 332.76 35.5104 333.677 33.8385 337.24C34.4583 335.875 70.3646 255.406 56.8021 201.547C43.1198 147.24 0 64.3594 0 64.3594C9.54167 62.4688 17.3125 46.875 23.5313 25.7188C29.9115 24.651 123.214 9.21875 207.266 0C220.411 19.1615 234.333 38.4948 240.177 60.0833C248.417 90.4948 241.927 128.26 265.677 148.984C287.708 168.224 321.156 159.854 350.406 159.411C356.182 159.328 361.927 159.641 367.625 160.328C369.729 160.583 371.818 160.88 373.896 161.245Z'},
  { id:'1_12', crop:'稻米',        cx:539.030, cy:943.360, cw:352.540, ch:302.030, viewBox:'0 0 352.541 302.026', d:'M326.521 302.026C274.995 253.75 185.526 260.214 120.969 224.51C67.7031 195.057 36.7917 140.307 3.0625 88.1979C2.04688 86.6198 1.02083 85.0573 0 83.4896C35.5104 64.3073 81.1823 33.9219 92.2188 0C92.2188 0 261.813 35.2448 292.682 29.1458C292.682 29.1458 335.802 112.026 349.484 166.333C363.042 220.193 327.141 300.661 326.521 302.026Z'},
  { id:'1_14', crop:'包心白',      cx:855.240, cy:720.540, cw:185.420, ch:213.330, viewBox:'0 0 185.422 213.328', d:'M180.177 182.365C181.349 184.104 182.536 185.854 183.734 187.599V187.609C99.6823 196.828 6.38021 212.26 0 213.328C15.1406 161.828 21.1302 77.3646 21.1302 77.3646C26.5781 43.6354 30.1406 34.1615 23.0052 0C23.0052 0 98.4688 27.1094 182.375 10C184.141 16.2708 185.411 22.5885 185.422 28.9948C185.505 57.9635 160.344 81.2656 155.672 109.854C151.344 136.38 164.62 159.37 180.177 182.365Z'},
  { id:'1_16', crop:'茶葉',        cx:256.730, cy:720.650, cw:382.820, ch:306.200, viewBox:'0 0 382.819 306.203', d:'M374.521 222.714C363.484 256.635 317.813 287.021 282.302 306.203C259.688 271.609 235.479 238.542 202.25 215.281C163.193 187.958 115.307 176.896 72.1719 156.604C44.3125 143.49 16.974 124.021 0 99.0729C55.9948 72.776 112.177 46.375 172.771 32.6667C212.505 23.6927 251.781 12.2917 290.922 0.984375C290.922 0.984375 290.896 0.645833 290.854 0C290.854 0 334.568 1.29688 374.521 13.4375C374.521 13.4375 393.193 165.333 374.521 222.714Z'},
  { id:'1_18', crop:'綠竹筍',     cx:808.180, cy:479.420, cw:294.840, ch:256.780, viewBox:'0 0 294.844 256.778', d:'M294.844 161.432C288.073 162.307 281.302 163.214 274.771 164.333C248.526 168.823 225.927 176.828 220.479 201.25C216.917 217.224 224.094 232.901 228.802 248.885C229.021 249.63 229.234 250.37 229.438 251.115C145.531 268.224 70.0677 241.115 70.0677 241.115C63.3854 209.151 30.1823 158.87 0 121.266C0 121.266 49.9375 34.2552 138.865 0C170.839 33.6042 210.75 56.5833 243.198 88.7083C264.49 109.797 280.854 134.932 294.844 161.432Z'},
  { id:'1_20', crop:'柚子',        cx:947.050, cy:328.310, cw:274.970, ch:312.550, viewBox:'0 0 274.971 312.547', d:'M274.891 198.495C273.203 246.302 241.214 293.74 194.958 305.948C182.995 309.104 169.458 310.792 155.979 312.547C141.99 286.047 125.625 260.911 104.333 239.823C71.8854 207.698 31.974 184.719 0 151.115C70.6458 123.896 68.5365 44.9531 95.0365 0C117.865 11.9792 141.479 23.1771 163.891 35.9583C182.547 46.6042 200.37 58.3542 216.214 72.5625C251.802 104.495 276.573 150.693 274.891 198.495Z'},
  { id:'1_22', crop:'稻米',        cx:497.160, cy:220.290, cw:311.950, ch:324.630, viewBox:'0 0 311.949 324.63',  d:'M309.74 143.974C298.193 184.76 266.5 286.76 254.693 324.63C239.865 316.13 222.958 311.505 206.594 306.594C182.188 299.266 157.521 292.818 132.656 287.26C99.9896 279.948 67.474 276.411 34.2708 272.635C27.1354 233.776 13.1042 192.411 0 158.974C87.8229 96.1406 181.563 42.3385 281.099 1.22396C282.094 0.807292 283.094 0.401041 284.094 0C300.042 47.625 318.365 113.531 309.74 143.974Z'},
  { id:'1_24', crop:'甘藍-初秋',   cx:751.850, cy:191.230, cw:290.230, ch:409.460, viewBox:'0 0 290.229 409.459', d:'M290.229 137.079C263.729 182.037 265.839 260.98 195.193 288.194C106.266 322.449 56.3281 409.459 56.3281 409.459C44.0938 394.199 32.3542 381.032 23.0833 372.006C19.9844 368.985 16.8125 366.011 13.5313 363.194C9.29688 359.537 4.75 356.423 0 353.699C11.8073 315.824 43.5 213.824 55.0469 173.037C63.6719 142.6 45.349 76.6884 29.401 29.0582C47.3177 21.6936 65.4219 14.7457 83.7188 8.24047C98.3958 3.02172 113.969 -1.98349 129.297 0.792553C160.76 6.50089 176.776 40.4488 196.229 65.829C220.583 97.5998 254.448 118.298 290.229 137.079Z'},
  { id:'1_26', crop:'青蔥-粉蔥',   cx:276.510, cy:379.270, cw:271.070, ch:341.380, viewBox:'0 0 271.073 341.38',  d:'M271.073 341.38C186.406 313.224 69.8229 236.292 0 186.99C1.28125 185.724 2.5625 184.453 3.84896 183.198C70.7813 117.547 142.276 56.2656 218.25 1.71354C219.047 1.13542 219.854 0.567708 220.651 0C233.755 33.4375 247.786 74.8021 254.922 113.661C257.255 126.286 258.849 138.646 259.453 150.385C263.854 235.927 270.344 330.776 271.073 341.38Z'},
  { id:'1_28', crop:'哈密瓜',      cx:165.660, cy:566.260, cw:381.990, ch:253.460, viewBox:'0 0 381.99 253.464',  d:'M381.99 155.375C342.849 166.682 303.573 178.083 263.839 187.057C203.245 200.766 147.063 227.167 91.0681 253.464C90.0473 251.969 88.9952 250.484 87.9119 249.036C75.3389 232.161 58.6775 218.625 38.99 211.109C18.1046 203.151 0.104562 179.984 0.00039533 156.281C-0.01523 151.344 0.432687 146.51 1.28165 141.776C6.8129 111.026 29.3702 84.4219 51.3077 61.0365C70.7244 40.3281 90.5837 19.9531 110.849 0C180.672 49.3021 297.261 126.234 381.922 154.391C381.964 155.036 381.99 155.375 381.99 155.375Z'},
  { id:'1_30', crop:'牛蕃茄',      cx:531.430, cy:492.930, cw:350.810, ch:322.370, viewBox:'0 0 350.809 322.372', d:'M344.943 304.974L344.927 304.99C344.188 305.5 320.224 321.906 277.682 322.37C234.469 322.839 99.8177 241.156 99.8177 241.156C59.8646 229.016 16.151 227.719 16.151 227.719C15.4219 217.115 8.93229 122.266 4.53125 36.724C3.92708 24.9844 2.33333 12.625 0 0C33.2031 3.77604 65.7188 7.3125 98.3854 14.625C123.25 20.1823 147.917 26.6302 172.323 33.9583C193.938 40.4479 216.484 46.4375 233.953 61.4948C237.234 64.3177 240.406 67.2813 243.505 70.3073C252.776 79.3333 264.516 92.5 276.75 107.76C306.932 145.365 340.141 195.651 346.818 227.609C353.953 261.776 350.391 271.245 344.943 304.974Z'},
  { id:'1_32', crop:'稻米',        cx:631.250, cy:734.080, cw:245.130, ch:239.130, viewBox:'0 0 245.125 239.131', d:'M245.125 63.8177C245.125 63.8177 239.135 148.281 223.995 199.781C217.776 220.938 210.005 236.531 200.464 238.422C169.594 244.521 0 209.276 0 209.276C18.6719 151.896 0 0 0 0C0 0 134.651 81.6823 177.865 81.2135C220.406 80.75 244.37 64.3438 245.109 63.8333L245.125 63.8177Z'},
  { id:'1_34', crop:'水蜜桃',      cx:865.550, cy:1069.390,cw:570.250, ch:739.470, viewBox:'0 0 570.249 739.468', d:'M570.193 514.688C567.281 619.172 475.75 717.396 375.26 736.281C328.833 745.01 274.62 736.797 245.911 699.276C215.469 659.458 224.094 602.953 209.615 554.974C184.005 470.057 89.8854 421.578 58.4063 338.656C39.9896 290.125 44.2292 232.474 13.25 190.823C9.1875 185.37 4.76042 180.458 0.015625 176.005H0V175.995C1.67188 172.432 74.5052 171.516 82.1406 170.719C111.339 167.656 140.479 162.958 168.464 153.88C217.604 137.943 255.354 101.734 287.667 62.8229C304.76 42.2292 322.76 21.3594 340.057 0C392.526 8.89063 439.385 49.276 453.635 100.896C463.229 135.677 459.073 172.526 460.057 208.589C461.661 267.255 477.703 325.339 505.635 376.891C533.87 429.052 571.906 453.552 570.193 514.688Z'},
];

// 桃園鄉鎮 design canvas size (與 polygon coords 同 1601×2000)
const TAOYUAN_W = 1601, TAOYUAN_H = 2000;

// design polygon 沒拆出的縣市 — 用 fixed hotspot（design canvas 1440×2996 座標）
// 新竹市在新竹縣中間、嘉義市在嘉義縣中間（憑地理估的位置）
const EXTRA_CITY_HOTSPOTS = [
  { id: 'extra_hsinchu_city', cx: 477, cy: 278, r: 22 }, // 在 n_hsinchu_county 區內
  { id: 'extra_chiayi_city',  cx: 327, cy: 551, r: 22 }, // 在 i_chiayi_county 區內
];

// 角色顯示尺寸 — 比照 Figma 桃園 design (Group 192 約 117×129)
const CHAR_DISPLAY_W = 117;
const CHAR_DISPLAY_H = 129;

// 縣市中文名 — 供 hover 時顯示的「桃園市」style 名稱方框用
const COUNTY_NAMES = {
  '51_5083': '新北市',
  '51_5084': '桃園市',
  '51_5085': '台東縣',
  '51_5086': '花蓮縣',
  '51_5087': '高雄市',
  '51_5088': '屏東縣',
  '51_5089': '台中市',
  '51_5090': '宜蘭縣',
  '51_5091': '嘉義縣',
  '51_5092': '台南市',
  '51_5093': '苗栗縣',
  '51_5094': '雲林縣',
  '51_5095': '彰化縣',
  '51_5096': '新竹縣',
  '51_5099': '南投縣',
  '51_5100': '台北市',
  '51_5101': '基隆市',
  'extra_hsinchu_city': '新竹市',
  'extra_chiayi_city':  '嘉義市',
};

/* ── PAGE ───────────────────────────────────────────────────────────────────
 * The whole page is rendered as one design PNG (full_page.jpg, 1440×2996),
 * with a transparent SVG over the map for click hotspots and 2 absolutely-
 * positioned cards (Weather, Price) that overlay the static data figures so
 * they show live values from Open-Meteo + 農業部交易行情 APIs.
 */
const Page = ({selected, cropOverride, onSelect, onCropSelect}) => {
  // When a taoyuan township polygon is clicked, App sets selected='taoyuan'
  // AND cropOverride=<that township's crop>. The hero panel then uses this
  // crop name everywhere instead of the county default (番茄), so character /
  // 作物名 / hello text / 今日價格 / 查看更多 all flip to the township's crop.
  const effectiveCrop = (selected === 'taoyuan' && cropOverride) ? cropOverride : null;
  // Subscribe to async page-data load so we re-render once COUNTY_CHARS /
  // BUTTON_SVGS / TAOYUAN_CROPS land. Before that, hover overlays render as
  // empty (existing `?.` chains already handle missing keys gracefully).
  usePageDataReady();
  const region = REGIONS_DATA[selected] || REGIONS_DATA.taoyuan;
  const wx = useLiveWeather(selected);
  const [hovered, setHovered] = React.useState(null);
  // 左側 map 切換：'main' = 台灣全圖、'taoyuan' = 桃園鄉鎮 detail
  const [leftMapView, setLeftMapView] = React.useState('main');
  // 桃園 detail 上的按鈕 hover 狀態 (城市 pill / 加減號 / 上下箭頭)
  const [hoveredBtn, setHoveredBtn] = React.useState(null);
  // 城市 pill 滾動位置 — 預設 0 讓可見 5 顆對齊 PNG 底圖 (新北/基隆/桃園/新竹市/新竹縣)
  const [cityScrollIdx, setCityScrollIdx] = React.useState(0);
  // 桃園市其他主要作物 strip — stripIdx=0 對齊烤在底圖上的 5 張卡片 (水蜜桃/水稻/甜柿/綠竹筍/哈密瓜)。
  // 點左右箭頭 ±1，slot i 顯示 list[(stripIdx+i) % N]。stripIdx !== 0 時 5 個 slot 都需要 overlay 蓋掉烤底。
  const [stripIdx, setStripIdx] = React.useState(0);

  const W = 1440, H = 2996;
  // 左側 map area 在 design canvas 上的位置（Rectangle 4 from Figma）
  const MAP_X = 34, MAP_Y = 87, MAP_W = 665, MAP_H = 830;

  return (
    <div style={{
      position:'relative',
      width:'min(1440px, 100%)',
      aspectRatio: `${W} / ${H}`,
      margin:'0 auto',
      fontFamily:"'Noto Sans TC',sans-serif",
      // Establish a query container so children can scale via cqw.
      containerType: 'inline-size',
    }}>
      {/* Full design as page background */}
      <DesignImage
        name="full_page"
        style={{
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          display:'block',
          userSelect:'none', pointerEvents:'none',
        }}
      />

      {/* 桃園鄉鎮 detail overlay — leftMapView==='taoyuan' 時顯示，蓋住整個左側 Taiwan map area */}
      {leftMapView === 'taoyuan' && (
        <div style={{
          position:'absolute',
          left:  `${MAP_X / W * 100}%`,
          top:   `${MAP_Y / H * 100}%`,
          width: `${MAP_W / W * 100}%`,
          height:`${MAP_H / H * 100}%`,
          zIndex: 10,
        }}>
          <DesignImage
            name="taoyuan_detail"
            alt="桃園市鄉鎮詳細地圖"
            style={{
              position:'absolute', inset:0,
              width:'100%', height:'100%',
              display:'block', objectFit:'fill',
              userSelect:'none', pointerEvents:'none',
            }}
          />
          {/* 「回上一頁」click hotspot — 回到台灣全圖
              master 桃園地圖.svg rect (45.61, 60.4, 252.94×53.58) × 1.333 → in-place 1601×2000 design */}
          <div
            onClick={() => setLeftMapView('main')}
            title="回上一頁"
            style={{
              position:'absolute',
              left:  `${(45.61 * 1.333) / TAOYUAN_W * 100}%`,
              top:   `${(60.4  * 1.333) / TAOYUAN_H * 100}%`,
              width: `${(252.94 * 1.333) / TAOYUAN_W * 100}%`,
              height:`${(53.58 * 1.333) / TAOYUAN_H * 100}%`,
              cursor:'pointer',
              zIndex: 13,
            }}
          />

          {/* 城市 pill / +-/ 上下箭頭 hover overlay。座標來自 Figma 原始檔 桃園地圖.svg
              (master viewBox 1201.1×1500)，乘以 1601/1201.1 ≈ 1.333 換算到本 detail
              design canvas (1601×2000)。每顆按鈕的 SVG 從 window.BUTTON_SVGS 取 (綠/咖
              兩個 state)，桃園市 pill 永遠是選中 (咖)，其餘 hover 時切到 咖。 */}
          {(() => {
            const F = 1601 / 1201.1;  // master → detail canvas scale factor
            // 桃園市 永遠固定在中間 slot (slot 3，永遠咖色)，其它 18 縣市 cyclic 環繞在 slot 1/2/4/5。
            // 桃園 detail 的 baked PNG 預設五顆是 新北/基隆/桃園/新竹市/新竹縣。
            const NEIGHBORS = ['新北市','基隆市','新竹市','新竹縣','苗栗縣','台中市','彰化縣',
                               '南投縣','雲林縣','嘉義市','嘉義縣','台南市','高雄市','屏東縣',
                               '台東縣','花蓮縣','宜蘭縣','台北市'];
            const N = NEIGHBORS.length;
            const wrap = (i) => ((i % N) + N) % N;
            // Arrows + 加減號 — 預設咖，hover 切換到綠（跟一般 hover 方向相反）。
            // baked PNG 是咖色 always-active 風格、底圖已塗掉，所以 overlay 是唯一視覺。
            // invertHover:true 讓 renderBtn 把預設/hover 顏色翻過來。
            const buttons = [
              { key:'up',     baseKey:'上箭頭', cx:124.06, cy:971.74,  size:61.86, invertHover:true,
                onClick: () => setCityScrollIdx(i => i - 1) },
              { key:'down',   baseKey:'下箭頭', cx:124.06, cy:1404.88, size:61.86, invertHover:true,
                onClick: () => setCityScrollIdx(i => i + 1) },
              { key:'plus',   baseKey:'加號',   cx:1129.37, cy:1330.74, size:72.56, invertHover:true },
              { key:'minus',  baseKey:'減號',   cx:1129.37, cy:1402.16, size:72.56, invertHover:true },
            ];
            // city pills — rect at (x, y, 156.89×53.58), icon viewBox (159.67×56.36) with 1.39 padding
            // 5 個固定 slot；slot 3 永遠是 桃園市，其它依 cityScrollIdx 從 NEIGHBORS cyclic 取
            const PILL_Y = [1017.14, 1089.33, 1161.52, 1233.71, 1305.90];
            const pillNames = [
              NEIGHBORS[wrap(cityScrollIdx)],
              NEIGHBORS[wrap(cityScrollIdx + 1)],
              '桃園市',
              NEIGHBORS[wrap(cityScrollIdx + 2)],
              NEIGHBORS[wrap(cityScrollIdx + 3)],
            ];
            const pills = pillNames.map((name, i) => ({
              key: `pill_${i}`,
              baseKey: name,
              y: PILL_Y[i],
              alwaysActive: name === '桃園市',
            }));
            const renderBtn = (b) => {
              const hovered = hoveredBtn === b.key;
              // invertHover: default 咖, hover 綠 (used for arrows + +/-)
              // alwaysActive: always 咖 (no hover swap, used for 桃園 selected pill)
              // default:     default 綠, hover 咖 (used for unselected city pills)
              const isActive = b.invertHover ? !hovered : (b.alwaysActive || hovered);
              const svgKey = `${b.baseKey}${isActive ? '咖' : '綠'}`;
              const svg = window.BUTTON_SVGS?.[svgKey];
              if (!svg) return null;
              // b.size is the rendered design-unit width/height (calibrated to baked).
              // Top-left = center − size/2 (in design canvas, since cx/cy are master-units
              // pre-applied F scale we still scale by F here for consistency).
              const size = b.size;
              const cxDesign = b.cx * F;
              const cyDesign = b.cy * F;
              const left = cxDesign - size/2;
              const top  = cyDesign - size/2;
              return (
                <div
                  key={b.key}
                  onMouseEnter={() => !b.alwaysActive && setHoveredBtn(b.key)}
                  onMouseLeave={() => !b.alwaysActive && setHoveredBtn(null)}
                  onClick={b.onClick}
                  style={{
                    position:'absolute',
                    left:  `${left / TAOYUAN_W * 100}%`,
                    top:   `${top  / TAOYUAN_H * 100}%`,
                    width: `${size / TAOYUAN_W * 100}%`,
                    height:`${size / TAOYUAN_H * 100}%`,
                    cursor: b.onClick ? 'pointer' : 'default',
                    zIndex: 12,
                  }}
                >
                  <svg viewBox={svg.viewBox} width="100%" height="100%" preserveAspectRatio="none" style={{display:'block'}}
                       dangerouslySetInnerHTML={{__html: svg.body}}/>
                </div>
              );
            };
            const renderPill = (p) => {
              const isActive = p.alwaysActive || hoveredBtn === p.key;
              const svgKey = `${p.baseKey}${isActive ? '咖' : '綠'}`;
              const svg = window.BUTTON_SVGS?.[svgKey];
              if (!svg) return null;
              // Pill SIZE pinned to baked AVIF measurements (204.6 × 66.7 design),
              // which has wider aspect (3.07) than the SVG natural aspect (2.83).
              // Letting the SVG stretch — pill rect inside renders the same.
              // POSITION: center each pill on its baked center y. p.y is the master-SVG
              // top-y; baked center sits ~F units below that (rect height/2).
              const PILL_W = 207;
              const PILL_H = 67;
              const PILL_PAD_X = 1.39 * (PILL_W / 156.89);
              const PILL_PAD_Y = 1.39 * (PILL_H / 53.58);
              const left = (45.61 - 1.39) * F;
              // Center y = p.y + 53.58/2 in master, → ×F in design.
              const centerY = (p.y + 53.58/2) * F;
              const top  = centerY - (PILL_H/2 + PILL_PAD_Y);
              const w = PILL_W + 2 * PILL_PAD_X;
              const h = PILL_H + 2 * PILL_PAD_Y;
              return (
                <div
                  key={p.key}
                  onMouseEnter={() => !p.alwaysActive && setHoveredBtn(p.key)}
                  onMouseLeave={() => !p.alwaysActive && setHoveredBtn(null)}
                  style={{
                    position:'absolute',
                    left:  `${left / TAOYUAN_W * 100}%`,
                    top:   `${top  / TAOYUAN_H * 100}%`,
                    width: `${w / TAOYUAN_W * 100}%`,
                    height:`${h / TAOYUAN_H * 100}%`,
                    cursor: p.alwaysActive ? 'default' : 'pointer',
                    zIndex: 12,
                  }}
                >
                  <svg viewBox={svg.viewBox} width="100%" height="100%" preserveAspectRatio="none" style={{display:'block'}}
                       dangerouslySetInnerHTML={{__html: svg.body}}/>
                </div>
              );
            };
            return <>{buttons.map(renderBtn)}{pills.map(renderPill)}</>;
          })()}

          {/* 13 個鄉鎮 polygon overlay：hover 變色 + 作物名 badge */}
          <svg
            viewBox={`0 0 ${TAOYUAN_W} ${TAOYUAN_H}`}
            preserveAspectRatio="none"
            style={{position:'absolute', inset:0, width:'100%', height:'100%', zIndex:11}}
          >
            {TAOYUAN_TOWNSHIPS.map(t => (
              <svg
                key={t.id}
                x={t.cx} y={t.cy} width={t.cw} height={t.ch}
                viewBox={t.viewBox}
                preserveAspectRatio="none"
                style={{overflow:'visible'}}
              >
                <path
                  d={t.d}
                  fill={hovered === t.id ? HOVER_FILL : 'transparent'}
                  opacity={hovered === t.id ? 0.55 : 1}
                  style={{
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    transition: 'fill 0.18s ease, opacity 0.18s ease',
                  }}
                  onMouseEnter={() => setHovered(t.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    // 牛蕃茄 (1_30) → 番茄市場儀表板
                    // Click any township polygon → carry its crop into the
                    // dashboard via onCropSelect (App-level state).
                    if (onCropSelect) onCropSelect(t.crop);
                    else if (t.crop === '牛蕃茄') window.location.hash = 'dashboard';
                  }}
                />
              </svg>
            ))}
            {/* hover 時顯示：作物角色 SVG (window.TAOYUAN_CROPS) + 作物名 badge
                角色置於 polygon 中心上方、badge 緊跟角色下方（與主地圖 county hover 同 layout） */}
            {hovered && (() => {
              const t = TAOYUAN_TOWNSHIPS.find(x => x.id === hovered);
              if (!t) return null;
              const cx = t.cx + t.cw/2;
              const cy = t.cy + t.ch/2;
              const cropChars = (typeof window !== 'undefined' && window.TAOYUAN_CROPS) || {};
              const charSrc = cropChars[t.crop];
              const charSize = 280;
              const labelW = 180, labelH = 56;
              const labelY = cy + charSize*0.15 + 6;
              return (
                <g style={{pointerEvents:'none'}}>
                  {charSrc && (
                    <image href={charSrc}
                           x={cx - charSize/2}
                           y={cy - charSize*0.85}
                           width={charSize}
                           height={charSize}
                           preserveAspectRatio="xMidYMid meet"/>
                  )}
                  <g transform={`translate(${cx - labelW/2}, ${labelY})`}>
                    <rect width={labelW} height={labelH} rx={labelH/2}
                          fill="#fbf6e9" stroke="#d1c4af" strokeWidth={2.5}/>
                    <text x={labelW/2} y={labelH/2 + 1}
                          textAnchor="middle" dominantBaseline="middle"
                          fill="#9b897c" fontSize={30} fontWeight={500}
                          fontFamily="'Noto Sans TC', 'Noto Sans CJK TC', sans-serif">
                      {t.crop}
                    </text>
                  </g>
                </g>
              );
            })()}
          </svg>
        </div>
      )}

      {/* 縣市 polygon overlay：滑過任一縣市 → 填上桃園色 + 顯示對應角色（detail mode 不顯示） */}
      {leftMapView === 'main' && <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{position:'absolute', inset:0, width:'100%', height:'100%'}}
      >


        {TW_COUNTIES.map(c => (
          <svg
            key={c.id}
            x={c.cx} y={c.cy} width={c.cw} height={c.ch}
            viewBox={c.viewBox}
            preserveAspectRatio="none"
            style={{overflow:'visible'}}
          >
            <path
              d={c.d}
              fill={
                c.isBase
                  ? 'transparent'  // 底層輪廓不填色（背景圖已是灰色）
                  : (hovered === c.id ? HOVER_FILL : 'transparent')
              }
              opacity={hovered === c.id ? 0.85 : 1}
              style={{
                cursor: c.isBase ? 'default' : 'pointer',
                pointerEvents: c.isBase ? 'none' : 'auto',
                transition: 'fill 0.18s ease, opacity 0.18s ease',
              }}
              onMouseEnter={c.isBase ? undefined : () => setHovered(c.id)}
              onMouseLeave={c.isBase ? undefined : () => setHovered(null)}
              onClick={c.isBase ? undefined : () => {
                // 點桃園市 polygon → 左側 map 切到桃園鄉鎮 detail + 也把右側
                // hero 切到 桃園市/水蜜桃 (App-level onSelect 把 taoyuanCrop
                // 設成 '水蜜桃' 默認)，這樣即使從別縣市切過來右側也對齊。
                if (c.id === TAOYUAN_POLYGON_ID) {
                  onSelect('taoyuan');
                  setLeftMapView('taoyuan');
                  setHovered(null);
                  return;
                }
                // 其餘 16 個 polygon county → 只切 selected，留在 landing。
                // 整個右側 hero panel (角色/縣市名/作物名/對話框/天氣/價格)
                // 都會自動跟著 selected 重渲染。要進 dashboard 從 「查看更多」 按鈕。
                const charKey = COUNTY_CHAR_MAP[c.id];
                if (charKey) {
                  const regionKey = charKey.replace(/^[a-q]_/, '');
                  onSelect(regionKey);
                }
              }}
            />
          </svg>
        ))}

        {/* 新竹市 / 嘉義市 extra hotspot — design polygon 沒拆出，用 fixed circle 觸發 */}
        {EXTRA_CITY_HOTSPOTS.map(h => (
          <circle
            key={h.id}
            cx={h.cx} cy={h.cy} r={h.r}
            fill="transparent"
            style={{cursor:'pointer'}}
            onMouseEnter={() => setHovered(h.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => {
              // 新竹市/嘉義市 extra hotspot — 跟其他 polygon 一樣只切 selected，
              // 不跳 dashboard。要進 dashboard 從 「查看更多」 按鈕。
              const regionKey = h.id.replace(/^extra_/, '');
              onSelect(regionKey);
            }}
          />
        ))}

        {/* Hovered 角色：渲染在 polygon 中心上方 — 用 SVG <image> 把角色 SVG 浮現 */}
        {hovered && (() => {
          // 找對應的 SVG key 跟中心座標
          const charsLib = (typeof window !== 'undefined' && window.COUNTY_CHARS) || {};
          let charKey = COUNTY_CHAR_MAP[hovered];
          let centerX, centerY;
          if (charKey) {
            // 從 TW_COUNTIES 找對應 polygon 中心
            const poly = TW_COUNTIES.find(c => c.id === hovered);
            if (!poly) return null;
            centerX = poly.cx + poly.cw / 2;
            centerY = poly.cy + poly.ch / 2;
          } else {
            // 從 EXTRA_CITY_HOTSPOTS 找
            const eh = EXTRA_CITY_HOTSPOTS.find(h => h.id === hovered);
            if (!eh) return null;
            charKey = eh.id;
            centerX = eh.cx;
            centerY = eh.cy;
          }
          const src = charsLib[charKey];
          // 角色置於 polygon 中心上方（向上偏移，讓角色「站」在 polygon 上）
          const w = CHAR_DISPLAY_W, h = CHAR_DISPLAY_H;
          // 縣市名稱方框 — 比照 Figma 桃園 District_button (64×24, rounded ~13)
          // 放在角色下方（與原本 桃園市 design 一致：character 站立在 polygon 上、label 在腳下）
          const name = COUNTY_NAMES[hovered];
          const labelW = 64, labelH = 24;
          const labelX = centerX - labelW / 2;
          // character 底端 ≈ centerY + 0.15h；label 再往下 4px
          const labelY = centerY + h * 0.15 + 4;
          return (
            <g style={{pointerEvents: 'none'}}>
              {src && (
                <image
                  href={src}
                  x={centerX - w/2}
                  y={centerY - h*0.85}
                  width={w}
                  height={h}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              {name && (
                <g transform={`translate(${labelX}, ${labelY})`}>
                  <rect
                    width={labelW} height={labelH} rx={labelH/2}
                    fill="#fbf6e9" stroke="#d1c4af" strokeWidth="1.5"
                  />
                  <text
                    x={labelW/2} y={labelH/2 + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#9b897c"
                    fontSize="12"
                    fontFamily="'Noto Sans TC', 'Noto Sans CJK TC', sans-serif"
                    fontWeight="500"
                  >
                    {name}
                  </text>
                </g>
              )}
            </g>
          );
        })()}
      </svg>}

      {/* 主地圖左下角 hover 按鈕 — 跟 taoyuan detail 一樣的 cycle 邏輯，
          差別是座標在主頁 design canvas (1440×2996) 而不是 taoyuan canvas (1601×2000)。
          位置從 full_page.jpg 像素量出 (pill x=61.5/y=731.5±n*40、寬 81.5、高 28.5；
          箭頭 r=13.8 在 (102.2, 625.8/865.8)、+- 在 (659.8, 825.8/865.8))。
          桃園市永遠在 slot 3 (咖)，其它 18 縣市透過 cityScrollIdx cyclic 環繞。 */}
      {leftMapView === 'main' && (() => {
        // 19 縣市 cyclic list — 中央 slot 永遠是當前 selected。點任何 pill →
        // 切 selected → pill 重排把該縣市移到中央，其它 4 slot 顯示前後 2 個。
        // 上下箭頭 = selected ±1 在 cycle 裡 step。
        const COUNTIES = ['新北市','基隆市','桃園市','新竹市','新竹縣','苗栗縣','台中市',
                          '彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','台南市','高雄市',
                          '屏東縣','台東縣','花蓮縣','宜蘭縣','台北市'];
        const N = COUNTIES.length;
        const wrap = (i) => ((i % N) + N) % N;
        const selectedName = (REGIONS_DATA[selected] || REGIONS_DATA.taoyuan).name;
        const selIdx = Math.max(0, COUNTIES.indexOf(selectedName));
        // Arrow / +- icon sizes calibrated to match the baked PNG visible-brown
        // diameter (~25 design). Mismatch causes the overlay to extend ~1 px
        // beyond the baked icon on mobile — at 8 px button width that ~12% extra
        // looks like the buttons are "off". Sizes pinned to baked-measured value.
        const ARROW_SIZE = 28.1;   // viewBox 50.18, visible r=22.32 → 12.5/22.32*50.18 ≈ 28.1
        const PM_SIZE    = 27.77;  // viewBox 55.63, visible r=25.04 → 12.5/25.04*55.63 ≈ 27.77
        // 預設咖色，hover 切換到綠色 (baked 已塗掉、overlay 是唯一視覺；invertHover:true
        // 讓 renderIcon 把預設/hover 顏色翻過來)。
        // 名字 → REGIONS_DATA key (供 pill onClick + 箭頭 step 用)
        const nameToKey = Object.fromEntries(
          Object.entries(REGIONS_DATA).map(([k, v]) => [v.name, k])
        );
        const stepSelected = (delta) => {
          const newName = COUNTIES[wrap(selIdx + delta)];
          const newKey = nameToKey[newName];
          if (newKey) onSelect(newKey);
        };
        const buttons = [
          { key:'main_up',    baseKey:'上箭頭', cx:102.2, cy:625.8, size:ARROW_SIZE, invertHover:true,
            onClick: () => stepSelected(-1) },
          { key:'main_down',  baseKey:'下箭頭', cx:102.2, cy:865.8, size:ARROW_SIZE, invertHover:true,
            onClick: () => stepSelected(+1) },
          { key:'main_plus',  baseKey:'加號',   cx:659.8, cy:825.8, size:PM_SIZE,   invertHover:true },
          { key:'main_minus', baseKey:'減號',   cx:659.8, cy:865.8, size:PM_SIZE,   invertHover:true },
        ];
        // Pill icon size: rect 81.5 design wide, but pill SVG has 1.39 padding inside viewBox 159.67.
        const PILL_W = 159.67 * (81.5 / 156.89);  // 82.93
        const PILL_H =  56.36 * (81.5 / 156.89);  // 29.29
        const PILL_PAD = 1.39 * (81.5 / 156.89);  // 0.722
        const PILL_X = 61.5 - PILL_PAD;            // icon top-left x
        const PILL_TOP_Y = [651.5, 691.5, 731.5, 771.5, 811.5].map(y => y - PILL_PAD);
        // 中央 slot = selected. 前後 ±2 slot = cycle 中相鄰縣市。
        const pillNames = [
          COUNTIES[wrap(selIdx - 2)],
          COUNTIES[wrap(selIdx - 1)],
          selectedName,
          COUNTIES[wrap(selIdx + 1)],
          COUNTIES[wrap(selIdx + 2)],
        ];
        const renderIcon = (b) => {
          const hovered = hoveredBtn === b.key;
          const isActive = b.invertHover ? !hovered : (b.alwaysActive || hovered);
          const svgKey = `${b.baseKey}${isActive ? '咖' : '綠'}`;
          const svg = window.BUTTON_SVGS?.[svgKey];
          if (!svg) return null;
          const left = b.cx - b.size/2;
          const top  = b.cy - b.size/2;
          return (
            <div
              key={b.key}
              onMouseEnter={() => !b.alwaysActive && setHoveredBtn(b.key)}
              onMouseLeave={() => !b.alwaysActive && setHoveredBtn(null)}
              onClick={b.onClick}
              style={{
                position:'absolute',
                left:  `${left  / W * 100}%`,
                top:   `${top   / H * 100}%`,
                width: `${b.size / W * 100}%`,
                height:`${b.size / H * 100}%`,
                cursor: b.onClick ? 'pointer' : 'default',
                zIndex: 12,
              }}
            >
              <svg viewBox={svg.viewBox} width="100%" height="100%" preserveAspectRatio="none" style={{display:'block'}}
                   dangerouslySetInnerHTML={{__html: svg.body}}/>
            </div>
          );
        };
        const renderPill = (name, slot) => {
          const key = `main_pill_${slot}`;
          const alwaysActive = name === selectedName;  // center slot = current selected
          const isActive = alwaysActive || hoveredBtn === key;
          const svg = window.BUTTON_SVGS?.[`${name}${isActive ? '咖' : '綠'}`];
          if (!svg) return null;
          return (
            <div
              key={key}
              onMouseEnter={() => !alwaysActive && setHoveredBtn(key)}
              onMouseLeave={() => !alwaysActive && setHoveredBtn(null)}
              onClick={alwaysActive ? undefined : () => {
                // Pills route to the same handler as polygon clicks: update
                // selected so the whole hero panel (character/name/weather/
                // price) refreshes for that county. No hash change — stay on
                // landing. 查看更多 button still routes to dashboard.
                const regionKey = nameToKey[name];
                if (regionKey) onSelect(regionKey);
              }}
              title={alwaysActive ? `${name} (目前選取)` : `切到 ${name}`}
              style={{
                position:'absolute',
                left:  `${PILL_X / W * 100}%`,
                top:   `${PILL_TOP_Y[slot] / H * 100}%`,
                width: `${PILL_W / W * 100}%`,
                height:`${PILL_H / H * 100}%`,
                cursor: alwaysActive ? 'default' : 'pointer',
                zIndex: 12,
              }}
            >
              <svg viewBox={svg.viewBox} width="100%" height="100%" preserveAspectRatio="none" style={{display:'block'}}
                   dangerouslySetInnerHTML={{__html: svg.body}}/>
            </div>
          );
        };
        return <>{buttons.map(renderIcon)}{pillNames.map((n, i) => renderPill(n, i))}</>;
      })()}

      {/* Animated mascot video — replaces the 3-mascot still in the middle.
          Full-width white panel (covers the entire row in the background image)
          with the video centred via objectFit:contain.                         */}
      <div style={{
        position:'absolute',
        left:   0,
        top:    `${1050/2996*100}%`,
        width:  '100%',
        height: `${(1500-1050)/2996*100}%`,
        background:'#ffffff',
        overflow:'hidden',
      }}>
        <video
          src="mascots.mp4"
          autoPlay loop muted playsInline
          style={{
            width:'100%', height:'100%',
            objectFit:'contain',
            display:'block',
            userSelect:'none', pointerEvents:'none',
          }}
        />
      </div>

      {/* === DYNAMIC HERO PANEL (county-specific character + name + greeting) ===
          Replaces the baked-in 桃園/番茄 content; repack.py paints over those
          regions with cream so this overlay is the sole visual. */}
      {/* (1) 角色 SVG — 18 counties use COUNTY_CHARS (crop-themed mascots);
          桃園 overrides to TAOYUAN_CROPS['牛蕃茄'] because COUNTY_CHARS.b_taoyuan
          is a 桃 (peach) county mascot, not the 番茄 crop the landing page
          headlines. */}
      {(() => {
        const charsLib  = (typeof window !== 'undefined' && window.COUNTY_CHARS) || {};
        const tyCrops   = (typeof window !== 'undefined' && window.TAOYUAN_CROPS) || {};
        const charKey   = REGION_TO_CHAR_KEY[selected];
        // Priority: taoyuan-township override → taoyuan default 牛蕃茄 → county SVG
        const svgStr    = effectiveCrop && tyCrops[effectiveCrop] ? tyCrops[effectiveCrop]
                       : selected === 'taoyuan'
                         ? (tyCrops['牛蕃茄'] || (charKey ? charsLib[charKey] : null))
                         : (charKey ? charsLib[charKey] : null);
        // Box matches ORIGINAL ori.png positioning. Box top at design y=143
        // puts visible feet near design y=319 — feet right at the top of the
        // grass shadow oval (matches ori.png).
        const w = 181, h = 200;
        const cx = 846, footY = 143 + h;
        return (
          <ScaledOverlay x={cx - w/2} y={footY - h} w={w} h={h}>
            {svgStr ? (
              <img src={svgStr} alt={region.cropApi}
                style={{display:'block', width:'100%', height:'100%', objectFit:'contain', objectPosition:'center bottom', userSelect:'none', pointerEvents:'none'}}/>
            ) : null}
          </ScaledOverlay>
        );
      })()}

      {/* (2) 縣市名 — sits right beside the baked pin icon at design (~1030, 122).
          Spec from Figma 51-4788: Noto Sans CJK TC Medium, 15px. Visually it
          reads larger at design canvas because the SVG is masked at 1× from
          a 2× source; we render at fontSize 17 to match the apparent size. */}
      <ScaledOverlay x={1045} y={107} w={280} h={32}>
        <div style={{
          fontSize:17, fontWeight:700, color:'#3b6826',
          letterSpacing:1.2, lineHeight:'32px', fontFamily:"'Noto Sans TC',sans-serif",
        }}>
          {region.name}
        </div>
      </ScaledOverlay>

      {/* (3) 作物名 large — Figma layout shows it visually ~2× the county name.
          Measured from ori.png: 番茄 glyph spans design y=141..167; centred
          between 桃園市 (ends y=126) and bubble top (y=186). */}
      <ScaledOverlay x={1015} y={135} w={300} h={42}>
        <div style={{
          fontSize:30, fontWeight:900, color:'#3b6826',
          letterSpacing:1.5, lineHeight:'42px', fontFamily:"'Noto Sans TC',sans-serif",
        }}>
          {effectiveCrop || region.cropApi}
        </div>
      </ScaledOverlay>

      {/* (4) 3-line hello text inside the Figma-baked speech bubble.
          Bubble interior (measured): design y=190..295 (height 105px). Text
          block = 3 × 26px = 78px → padding-top = padding-bottom = ~13px to
          centre vertically inside the bubble.
          Spec from Figma 51-4788: Noto Sans CJK TC Bold, 15px, tracking 1.5,
          leading 26, color #4e3628. */}
      <ScaledOverlay x={1042} y={203} w={310} h={90}>
        <div style={{
          fontSize:15, fontWeight:700, color:'#4e3628',
          letterSpacing:1.5, lineHeight:'26px', fontFamily:"'Noto Sans TC',sans-serif",
          whiteSpace:'nowrap',
        }}>
          <div>哈囉！我是來自{region.name.replace(/[市縣]$/, '')}的{effectiveCrop || region.cropApi}！</div>
          <div>這裡陽光充足，很適合我生長，</div>
          <div>快來看看今天的天氣和市場資訊吧！</div>
        </div>
      </ScaledOverlay>

      {/* 「查看更多」 button click hotspot — overlays the baked button at the
          bottom-right of the hero panel. Baked button measured at design
          (1194..1381, 319..350) = 187×31. We add a 4px padding around so the
          hover halo extends visually just beyond the button edges. */}
      <div
        onClick={() => { window.location.hash = 'dashboard'; }}
        onMouseEnter={() => setHovered('view-more')}
        onMouseLeave={() => setHovered(null)}
        title={`查看 ${region.name} ${effectiveCrop || region.cropApi} 詳細市場資訊`}
        style={{
          position:'absolute',
          left:   `${1190/1440*100}%`,
          top:    `${315/2996*100}%`,
          width:  `${(1385-1190)/1440*100}%`,
          height: `${(354-315)/2996*100}%`,
          cursor:'pointer',
          zIndex: 5,
          borderRadius: 999,
          background:  hovered === 'view-more' ? 'rgba(255,255,255,0.30)' : 'transparent',
          boxShadow:   hovered === 'view-more' ? '0 0 0 4px rgba(255,255,255,0.45)' : 'none',
          transition:  'background 150ms ease, box-shadow 150ms ease',
        }}
      />

      {/* 桃園市其他主要作物 strip — 5 visible slot carousel.
          Layout from Figma 51-4980 (Frame 2): card w=109, h=135, gap=8, y=757.
          Slot i shows TAOYUAN_CROP_LIST[(stripIdx + i) % N]. Left/right arrows
          shift stripIdx by ±1 (wraps). Virtual overlay cards are rendered for
          all 5 slots regardless of stripIdx so the baked image's stale crops
          (水稻, 甜柿) never leak through. Card visual matches Figma node
          51:4983: bg #fffcf5, radius 15, shadow 2px 3px 0 0 rgba(209,196,175,0.55). */}
      {(() => {
        const tyCrops = (typeof window !== 'undefined' && window.TAOYUAN_CROPS) || {};
        const N = TAOYUAN_CROP_LIST.length;
        return STRIP_SLOTS.map((slot, i) => {
          const item = TAOYUAN_CROP_LIST[(stripIdx + i) % N];
          const key  = `strip_${i}`;
          const svg  = tyCrops[item.crop] || null;
          return (
            <React.Fragment key={i}>
              <ScaledOverlay x={slot.x} y={757} w={109} h={135}>
                  {/* Card visual matches Figma 51:4983 + ori.png measurements:
                      - 109×135, bg #fffcf5, radius 15, shadow 2px 3px 0 0 rgba(209,196,175,0.55)
                      - Character occupies card y=10..107 (height 97 design, ~72% of card)
                      - Label centred at card y≈122 (12px from bottom), color #a48b78,
                        fontSize 14, weight 700, family Noto Sans TC */}
                  <div style={{
                    position:'relative',
                    width:'100%', height:'100%',
                    background:'#fffcf5',
                    borderRadius:15,
                    boxShadow:'2px 3px 0px 0px rgba(209,196,175,0.55)',
                    pointerEvents:'none',
                  }}>
                    {svg && (
                      <img src={svg} alt={item.label} style={{
                        position:'absolute',
                        left:'50%', top:22, transform:'translateX(-50%)',
                        height: 82, maxWidth:'80%',
                        objectFit:'contain', objectPosition:'center bottom',
                        display:'block', userSelect:'none',
                      }}/>
                    )}
                    <div style={{
                      position:'absolute',
                      left:0, right:0, bottom:9,
                      textAlign:'center',
                      fontSize:14, fontWeight:700,
                      color:'#a48b78',
                      letterSpacing:0.5, lineHeight:1,
                      fontFamily:"'Noto Sans TC',sans-serif",
                    }}>
                      {item.label}
                    </div>
                  </div>
                </ScaledOverlay>
              <div
                onClick={() => onCropSelect && onCropSelect(item.crop)}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                title={`查看桃園市${item.label}`}
                style={{
                  position:'absolute',
                  left:   `${slot.x/1440*100}%`,
                  top:    `${757/2996*100}%`,
                  width:  `${109/1440*100}%`,
                  height: `${135/2996*100}%`,
                  cursor:'pointer',
                  zIndex: 6,
                  borderRadius: 15,
                  background:  hovered === key ? 'rgba(255,255,255,0.30)' : 'transparent',
                  boxShadow:   hovered === key ? '0 0 0 4px rgba(255,255,255,0.45)' : 'none',
                  transition:  'background 150ms ease, box-shadow 150ms ease',
                }}
              />
            </React.Fragment>
          );
        });
      })()}

      {/* Left / right carousel arrow click hotspots — overlay the baked
          chevron-in-circle icons (32×32 design px each, from Figma 51:4981 /
          51:5074). ±1 shift with wrap. */}
      {[
        { side:'left',  x:728,  delta:-1 },
        { side:'right', x:1353, delta:+1 },
      ].map(a => {
        const key = `strip_arrow_${a.side}`;
        return (
          <div
            key={a.side}
            onClick={() => setStripIdx(prev => (prev + a.delta + TAOYUAN_CROP_LIST.length) % TAOYUAN_CROP_LIST.length)}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            title={a.side === 'left' ? '上一個作物' : '下一個作物'}
            style={{
              position:'absolute',
              left:   `${a.x/1440*100}%`,
              top:    `${808/2996*100}%`,
              width:  `${32/1440*100}%`,
              height: `${32/2996*100}%`,
              cursor:'pointer',
              zIndex: 6,
              borderRadius: '50%',
              background:  hovered === key ? 'rgba(255,255,255,0.30)' : 'transparent',
              boxShadow:   hovered === key ? '0 0 0 4px rgba(255,255,255,0.45)' : 'none',
              transition:  'background 150ms ease, box-shadow 150ms ease',
            }}
          />
        );
      })}

      {/* LIVE Weather card — covers static "天氣預報" card.
          Card edges in design coords: x=712-920, y=381-696. */}
      <ScaledOverlay x={712} y={381} w={920-712} h={696-381}>
        <WeatherCard wx={wx}/>
      </ScaledOverlay>

      {/* LIVE Price card — covers static "今日價格" card.
          Card edges in design coords: x=934-1165, y=381-696. */}
      <ScaledOverlay x={934} y={381} w={1165-934} h={696-381}>
        <PriceOverlay
          cropName={effectiveCrop || region.cropApi}
          variety={effectiveCrop || region.priceVariety}
          market={region.priceMarket}
        />
      </ScaledOverlay>
    </div>
  );
};

/* ── DASHBOARD DATA ─────────────────────────────────────────────────────────
 * Pre-aggregated tomato (FJ3 牛蕃茄) market dataset bundled into the page —
 * sourced from a daily ETL that hits AMIS and persists day/week/month/year
 * series + per-market comparison. This avoids the AMIS endpoint's broken
 * date filter (it always returns latest 200 rows in prod).
 */
// Module-level cache so every component share the same fetch result.
let _tmCache = (typeof window !== 'undefined' && window.DATASETS && window.DATASETS.tomato_market) || null;
let _tmFetched = false;
const _tmListeners = new Set();

// nongzhidao's cron currently updates `daily` + `latest_price` every day but
// the `weekly`/`monthly`/`yearly` aggregations are frozen (last refreshed 2026-05-04).
// We rebuild them client-side from the fresh `daily` so every chart matches today's data.
const _isoYearWeek = (dateStr) => {
  const [Y, M, D] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));   // Thursday of the ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};
const _aggregateDaily = (daily, keyFn) => {
  const groups = {};
  for (const r of daily) {
    if (r.price == null) continue;
    const key = keyFn(r);
    if (!groups[key]) groups[key] = { vsum: 0, pvsum: 0 };
    const v = r.volume || 0;
    groups[key].vsum  += v;
    groups[key].pvsum += r.price * v;
  }
  return Object.entries(groups)
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
    .map(([key, g]) => ({
      key,
      price:  g.vsum > 0 ? Math.round(g.pvsum / g.vsum * 100) / 100 : 0,
      volume: g.vsum,
    }));
};

// ── Crop market dispatcher ────────────────────────────────────────────────
// Given a crop name (e.g. "番茄", "釋迦", "香蕉"), return market data in the
// same shape regardless of source. Two paths:
//   1. nongzhidao   pre-aggregated daily/weekly/monthly/yearly + market_compare.
//                   Covers 番茄 (code_FJ3) and 釋迦 (fruit_31). Fast.
//   2. MOA agri API daily transactions per crop, aggregated client-side here.
//                   Covers every other crop in the wholesale catalogue.
const NONGZHIDAO_MAP = {
  // taoyuan 番茄 牛蕃茄 (FJ3)
  '番茄':         'code_FJ3',
  '牛蕃茄':       'code_FJ3',
  '番茄-牛番茄':  'code_FJ3',
  // hualien 西瓜 大西瓜 (T1)
  '西瓜':         'fruit_T1',
  '大西瓜':       'fruit_T1',
  '西瓜-大西瓜':  'fruit_T1',
  // 14 county crops backfilled 2026-05-22 (batch via scripts/backfill_amis.py)
  '綠竹筍':       'code_SH2',  // 台北
  '山藥':         'code_SU2',  // 基隆 (白薯蕷)
  '甜柿':         'fruit_Z0',  // 新竹縣 (柿子)
  '草莓':         'fruit_45',  // 苗栗
  '梨':           'fruit_O10', // 台中 broad fallback
  '梨-寶島甘露梨':'fruit_O10', // 台中 priceVariety
  '葡萄':         'fruit_S1',  // 彰化 (巨峰)
  '香蕉':         'fruit_A1',  // 南投
  '大蒜':         'code_SG1',  // 雲林 broad fallback
  '大蒜-硬梗':    'code_SG1',  // 雲林 priceVariety
  '哈蜜瓜':       'fruit_W1',  // 嘉義市 (網狀紅肉洋香瓜)
  '鳳梨':         'fruit_B2',  // 嘉義縣 (金鑽鳳梨)
  '芒果':         'fruit_R1',  // 台南 (愛文)
  '芭樂':         'fruit_P1',  // 高雄 (珍珠芭, AMIS=番石榴)
  '洋蔥':         'code_SD1',  // 屏東 (本產)
  '青蔥':         'code_SE2',  // 宜蘭 broad fallback (北蔥/三星蔥)
  '青蔥-北蔥':    'code_SE2',  // 宜蘭 priceVariety (三星蔥 cultivar)
  '青蔥-粉蔥':    'code_SE6',  // 桃園 township slot (different cultivar)
  '釋迦':         'fruit_31',  // 台東
  // 4 taoyuan township crops backfilled 2026-05-22
  '甘藍':         'code_LA1',  // 桃園 township (初秋 cultivar)
  '甘藍-初秋':    'code_LA1',
  '包心白':       'code_LC1',  // 桃園楊梅 (包白 cultivar)
  '包心白菜':     'code_LC1',
  '水蜜桃':       'fruit_Y1',  // 桃園復興拉拉山
  '桃子':         'fruit_Y1',
  '柚子':         'fruit_H1',  // 桃園大溪文旦
  '文旦':         'fruit_H1',
  // 哈密瓜 (alternate writing of 哈蜜瓜): same fruit, same data
  '哈密瓜':       'fruit_W1',
};

// Crops with no AMIS wholesale market data (sold via different channels —
// tea trade goes through 茶業改良場, rice through 糧食署 / 農糧署). Dashboard
// wholesale cards check this set and render a 「無批發資料」 placeholder
// instead of falling back to the broken MOA OpenData API (which returns
// only ~3-4 days of data).
const WHOLESALE_NO_DATA = new Set([
  '包種茶',
  '水稻',
  // taoyuan township slots — same reason as 新北包種茶 / 新竹市水稻
  '茶葉',
  '稻米',
]);

// MOA returns dates as either "115/05/21" or "115.05.21" — accept both separators.
const _rocToISO = (roc) => {
  const m = String(roc || '').match(/^(\d+)[\/.](\d+)[\/.](\d+)$/);
  if (!m) return null;
  return `${parseInt(m[1], 10) + 1911}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
};

// Normalise hyphenated taoyuan crops like "甘藍-初秋" / "番茄-牛番茄" to the
// broader CropName MOA expects (just the prefix before the dash).
const _moaCropName = (name) => (name || '').split('-')[0];

async function _fetchFromMOA(cropName) {
  const today = new Date();
  const from = new Date(today.getTime() - 5 * 365 * 24 * 3600 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const url = `https://data.moa.gov.tw/api/v1/AgriProductsTransType/?Start-Date=${fmt(from)}&End-Date=${fmt(today)}&CropName=${encodeURIComponent(_moaCropName(cropName))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MOA ${res.status}`);
  const json = await res.json();
  let rows = (json.Data || json.data || []).map(r => ({
    date:   _rocToISO(r.TransDate || r.tdate),
    price:  Number(r.Avg_Price ?? r.avg_price),
    volume: Number(r.Trans_Quantity ?? r.volume),
    market: r.MarketName || r.market,
    crop:   r.CropName || '',
  })).filter(r => r.date && !isNaN(r.price) && r.crop !== '休市' && r.price > 0);
  // If a specific variety was requested (cropName contains '-', e.g. "西瓜-大西瓜"
  // matching REGIONS_DATA.hualien.priceVariety), filter to exact CropName match.
  // Fallback: if no exact rows exist, fall back to the broad set so the panel
  // doesn't go empty (some varieties may have sparse trading days).
  if (cropName.includes('-')) {
    const exact = rows.filter(r => r.crop === cropName);
    if (exact.length > 0) rows = exact;
  }
  rows.sort((a, b) => a.date < b.date ? -1 : 1);
  const daily = _aggregateDaily(rows, r => r.date)
    .map(d => ({ date: d.key, price: d.price, volume: d.volume }));
  const weekly  = _aggregateDaily(rows, r => _isoYearWeek(r.date));
  const monthly = _aggregateDaily(rows, r => r.date.slice(0, 7));
  const yearly  = _aggregateDaily(rows, r => r.date.slice(0, 4));
  const latest_price = daily.length ? { date: daily[daily.length-1].date, price: daily[daily.length-1].price } : null;
  // market_compare: latest-month group-by-market.
  const latestMonth = monthly.length ? monthly[monthly.length-1].key : null;
  const lastMonthRows = latestMonth ? rows.filter(r => r.date.slice(0, 7) === latestMonth) : [];
  const byMarket = {};
  for (const r of lastMonthRows) {
    if (!byMarket[r.market]) byMarket[r.market] = { vsum: 0, pvsum: 0 };
    byMarket[r.market].vsum  += r.volume || 0;
    byMarket[r.market].pvsum += (r.price || 0) * (r.volume || 0);
  }
  const markets_volume = Object.entries(byMarket)
    .map(([market, g]) => ({ market, volume: Math.round(g.vsum) }))
    .filter(x => x.volume > 0)
    .sort((a, b) => b.volume - a.volume);
  const markets_price = Object.entries(byMarket)
    .map(([market, g]) => ({ market, price: g.vsum > 0 ? Math.round(g.pvsum / g.vsum * 100) / 100 : 0 }))
    .filter(x => x.price > 0)
    .sort((a, b) => a.price - b.price);
  return {
    code: 'MOA',
    name: cropName,
    updated_at: new Date().toISOString(),
    latest_price,
    daily,
    weekly,
    monthly,
    yearly,
    market_compare: { month: latestMonth, markets_volume, markets_price },
  };
}

const _cropMarketCache     = new Map();   // cropName → data
const _cropMarketListeners = new Map();   // cropName → Set<setter>
const _cropMarketInflight  = new Map();   // cropName → Promise (in-flight fetch)

async function _fetchCropMarket(cropName) {
  // Sentinel used by wholesale cards when WHOLESALE_NO_DATA.has(cropName).
  // The hook still runs (Rules of Hooks) but we skip both fetches.
  if (cropName === '__nodata__') return null;
  const code = NONGZHIDAO_MAP[cropName];
  if (code) {
    try {
      const r = await fetch(`https://wyaoguang3-code.github.io/nongzhidao/data/${code}.json`);
      if (r.ok) {
        const j = await r.json();
        if (j && Array.isArray(j.daily) && j.daily.length) {
          // Rebuild stale aggregations from fresh daily array.
          j.weekly  = _aggregateDaily(j.daily, r => _isoYearWeek(r.date));
          j.monthly = _aggregateDaily(j.daily, r => r.date.slice(0, 7));
          j.yearly  = _aggregateDaily(j.daily, r => r.date.slice(0, 4));
          // Some nongzhidao files (e.g. fruit_31 釋迦) have latest_price: null
          // even though `daily` is populated — derive it from the tail.
          if (!j.latest_price || j.latest_price.price == null) {
            const last = j.daily[j.daily.length - 1];
            if (last && last.price != null) j.latest_price = { date: last.date, price: last.price };
          }
        }
        return j;
      }
    } catch (e) { console.warn(`[crop-market] nongzhidao ${code} failed`, e && e.message); }
  }
  return _fetchFromMOA(cropName);
}

const useCropMarket = (cropName) => {
  const [data, setData] = React.useState(() => {
    if (!cropName) return null;
    if (_cropMarketCache.has(cropName)) return _cropMarketCache.get(cropName);
    // Special: 番茄/牛蕃茄 get instant-render from bundled DATASETS.tomato_market
    // (no need to wait for any network round-trip on cold load).
    if ((cropName === '番茄' || cropName === '牛蕃茄') &&
        typeof window !== 'undefined' && window.DATASETS && window.DATASETS.tomato_market) {
      const tm = window.DATASETS.tomato_market;
      _cropMarketCache.set(cropName, tm);
      return tm;
    }
    return null;
  });
  usePageDataReady();
  React.useEffect(() => {
    if (!cropName) { setData(null); return; }
    // Prime from bundled tomato_market if it landed after first render.
    if (!_cropMarketCache.has(cropName) &&
        (cropName === '番茄' || cropName === '牛蕃茄') &&
        typeof window !== 'undefined' && window.DATASETS && window.DATASETS.tomato_market) {
      const tm = window.DATASETS.tomato_market;
      _cropMarketCache.set(cropName, tm);
      setData(tm);
    } else if (_cropMarketCache.has(cropName)) {
      setData(_cropMarketCache.get(cropName));
    }
    if (!_cropMarketListeners.has(cropName)) _cropMarketListeners.set(cropName, new Set());
    _cropMarketListeners.get(cropName).add(setData);
    if (!_cropMarketInflight.has(cropName)) {
      _cropMarketInflight.set(cropName,
        _fetchCropMarket(cropName)
          .then(d => {
            _cropMarketCache.set(cropName, d);
            _cropMarketInflight.delete(cropName);
            const ls = _cropMarketListeners.get(cropName);
            if (ls) for (const fn of ls) fn(d);
          })
          .catch(err => {
            console.warn(`[crop-market] ${cropName} fetch failed:`, err && err.message);
            _cropMarketInflight.delete(cropName);
          }));
    }
    return () => {
      const ls = _cropMarketListeners.get(cropName);
      if (ls) ls.delete(setData);
    };
  }, [cropName]);
  return data;
};

// Backward-compat wrapper — PriceOverlay and other non-dashboard callers still
// use this. New dashboard cards take cropName explicitly via useCropMarket.
const useTomatoMarket = () => useCropMarket('番茄');

/* ── TRADE DATA (MOA TradeCoa export 量+值, per-country, monthly + yearly) ──
 * Mirrors the watermelon (T1) wholesale pipeline but pulled from
 * agrstat.moa.gov.tw/sdweb/public/trade/TradeCoa.aspx via
 * scripts/backfill_trade_export.py + monthly launchd. Each file is keyed by
 * the COA wildcard code (## → xx in filename).
 *
 * Map crop name → COA code. 番茄/蕃茄 has both AMIS wholesale + TradeCoa
 * trade, the others depend on whether anyone has run backfill yet.
 */
const TRADE_COA_MAP = {
  // hualien 西瓜 (103##10) — original target
  '西瓜':         '103xx10',
  '大西瓜':       '103xx10',
  '西瓜-大西瓜':  '103xx10',
  // 16 crops backfilled 2026-05-22 (batch via scripts/backfill_trade_export.py)
  '綠竹筍':       '103xx15',     // 台北 (竹筍 aggregate)
  '包種茶':       '109xxxx',     // 新北 (茶葉及其製品 aggregate)
  '山藥':         '0714302000',  // 基隆 (CCC 山藥生鮮冷藏)
  '水稻':         '101xx01',     // 新竹市 (稻米 aggregate)
  '甜柿':         '104xx25',     // 新竹縣 (柿子 aggregate)
  '草莓':         '0810100000',  // 苗栗 (CCC 鮮草莓)
  '梨':           '104xx10',     // 台中 broad
  '梨-寶島甘露梨':'104xx10',     // 台中 priceVariety
  '葡萄':         '104xx08',     // 彰化
  '香蕉':         '104xx03',     // 南投
  '大蒜':         '103xx26',     // 雲林 broad
  '大蒜-硬梗':    '103xx26',     // 雲林 priceVariety
  '哈蜜瓜':       '0807191000',  // 嘉義市 (CCC 鮮蜜瓜)
  '鳳梨':         '104xx04',     // 嘉義縣
  '芒果':         '104xx05',     // 台南
  '芭樂':         '104xx46',     // 高雄 (番石榴)
  '洋蔥':         '103xx03',     // 屏東
  '釋迦':         '104xx38',     // 台東
  // 4 taoyuan township crops added 2026-05-22
  '甘藍':         '103xx05',
  '甘藍-初秋':    '103xx05',
  '包心白':       '103xx06',     // 白菜 aggregate
  '包心白菜':     '103xx06',
  '水蜜桃':       '104xx12',     // 桃 aggregate
  '桃子':         '104xx12',
  '柚子':         '104xx24',
  '文旦':         '104xx24',
  // 哈密瓜 (alternate writing): same CCC as 哈蜜瓜
  '哈密瓜':       '0807191000',
  // taoyuan township 稻米/茶葉 reuse existing files for 水稻/包種茶
  '稻米':         '101xx01',
  '茶葉':         '109xxxx',
  // 宜蘭 青蔥-粉蔥 intentionally omitted — MOA's 103##03 conflates 洋蔥+蔥;
  // showing 洋蔥 numbers under a 青蔥 label would be misleading, so the trade
  // card renders a placeholder for 宜蘭 instead.
};

const _tradeCache     = new Map();
const _tradeListeners = new Map();
const _tradeInflight  = new Map();

// Shared placeholder for any wholesale card when the crop has no AMIS data.
// 4 sister cards (PricePanel / TrendChart / VolumeBars / PriceBars) each
// render their own variant — this is the inner content. Each card supplies
// its own outer card wrapper so colour + position match the design.
const _WholesaleNoDataMsg = ({title, subtitle}) => (
  <div style={{
    flex:1, background:'#fff', border:'1px solid #eee', borderRadius:10,
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    color:'#888', fontSize:12, textAlign:'center', padding:'12px',
    fontFamily:"'Noto Sans TC',sans-serif",
  }}>
    <div style={{fontSize:13, marginBottom:4}}>{title || '本作物無批發市場交易資料'}</div>
    <div style={{fontSize:10, color:'#aaa'}}>{subtitle || '(此作物不在 AMIS 蔬果拍賣系統，請改參考主管機關)'}</div>
  </div>
);

async function _fetchTrade(slug) {
  const url = `https://wyaoguang3-code.github.io/nongzhidao/data/trade_${slug}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`trade fetch ${slug} → ${r.status}`);
  return await r.json();
}

// Returns the loaded trade JSON or null while inflight / unsupported crop.
const useCropTrade = (cropName) => {
  const slug = cropName ? TRADE_COA_MAP[cropName] : null;
  const [data, setData] = React.useState(() => (slug ? _tradeCache.get(slug) || null : null));
  usePageDataReady();
  React.useEffect(() => {
    if (!slug) { setData(null); return; }
    const cached = _tradeCache.get(slug);
    if (cached) { setData(cached); return; }
    let ls = _tradeListeners.get(slug);
    if (!ls) { ls = new Set(); _tradeListeners.set(slug, ls); }
    ls.add(setData);
    if (!_tradeInflight.has(slug)) {
      _tradeInflight.set(slug,
        _fetchTrade(slug)
          .then(j => {
            _tradeCache.set(slug, j);
            (_tradeListeners.get(slug) || new Set()).forEach(fn => fn(j));
          })
          .catch(e => console.warn(`[trade] ${slug} failed`, e && e.message))
          .finally(() => _tradeInflight.delete(slug))
      );
    }
    return () => {
      const ls2 = _tradeListeners.get(slug);
      if (ls2) ls2.delete(setData);
    };
  }, [slug]);
  return data;
};

// Disaster yearly — fetch the same JSON nongzhidao's FJ3.html uses.
let _dsCache = (typeof window !== 'undefined' && window.DATASETS && window.DATASETS.disaster_yearly) || null;
let _dsFetched = false;
const _dsListeners = new Set();
const useDisasterYearly = () => {
  const [data, setData] = React.useState(() =>
    _dsCache ||
    (typeof window !== 'undefined' && window.DATASETS && window.DATASETS.disaster_yearly) ||
    null
  );
  usePageDataReady();
  React.useEffect(() => {
    if (!_dsCache && typeof window !== 'undefined' && window.DATASETS && window.DATASETS.disaster_yearly) {
      _dsCache = window.DATASETS.disaster_yearly;
      setData(_dsCache);
    }
    _dsListeners.add(setData);
    if (!_dsFetched) {
      _dsFetched = true;
      fetch('https://wyaoguang3-code.github.io/nongzhidao/data/tw_crop_disaster_yearly.json')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(j => {
          if (j && Array.isArray(j.yearly) && j.yearly.length) {
            _dsCache = j;
            for (const fn of _dsListeners) fn(j);
          }
        })
        .catch(err => console.warn('[disaster_yearly] live fetch failed, using bundled:', err));
    }
    return () => { _dsListeners.delete(setData); };
  }, []);
  return data;
};

// Note: nongzhidao's code_FJ3_export.json is currently empty (no tomato rows).
// We keep using the bundled tomato_export (parsed from agrstat ODS, richer schema)
// until nongzhidao starts populating that endpoint.

/* ── CARD 1: 價格面板 (AMIS) ────────────────────────────────────────────── */
const PricePanelCard = ({cropName}) => {
  const noData = !!(cropName && WHOLESALE_NO_DATA.has(cropName));
  // Always call the hook (Rules of Hooks): pass a stable sentinel name when
  // we know there's no data so we don't waste a fetch, but the hook still
  // runs every render to keep the hook order stable.
  const m = useCropMarket(noData ? '__nodata__' : (cropName || '番茄'));
  if (noData) {
    return (
      <div style={{
        position:'absolute',
        left:`${337/1440*100}%`, top:`${87/1468*100}%`,
        width:`${(714-337)/1440*100}%`, height:`${(375-87)/1468*100}%`,
        background:'#fff7ec', border:'1.5px solid #e8d8b8', borderRadius:14,
        padding:'14px 18px', boxSizing:'border-box',
        display:'flex', flexDirection:'column', gap:8,
        fontFamily:"'Noto Sans TC',sans-serif",
      }}>
        <div style={{fontSize:14, fontWeight:900, color:'#7a5418', letterSpacing:1.5}}>價格面板 · {cropName}</div>
        <_WholesaleNoDataMsg/>
      </div>
    );
  }
  const latest = m?.latest_price?.price ?? null;
  const latestDate = m?.latest_price?.date ?? null;

  // Day-over-day change from the daily series.
  const daily = m?.daily || [];
  const prev = daily.length >= 2 ? daily[daily.length-2].price : null;
  const chgPct = (latest != null && prev) ? Math.round((latest - prev) / prev * 100) : null;

  // 元/台斤 = 元/公斤 ÷ 1.5 (matches the conversion used by nongzhidao FJ3.html)
  const taikinPrice = latest != null ? latest / 1.5 : null;
  // Industry rule: retail ≈ wholesale × 2
  const retailKg = latest != null ? Math.round(latest * 2) : null;
  const retailTaikin = taikinPrice != null ? Math.round(taikinPrice * 2) : null;

  const buyTag  = (chgPct != null && chgPct <  0) ? { label:'推薦購買', bg:'#a5dba6', fg:'#2c5d2e' }
                : (chgPct != null && chgPct >  10) ? { label:'高點觀望', bg:'#f3d27a', fg:'#7a5418' }
                : { label:'價格平穩', bg:'#f3d27a', fg:'#7a5418' };
  const sellTag = (chgPct != null && chgPct >  5) ? { label:'高價時機', bg:'#a5dba6', fg:'#2c5d2e' }
                : (chgPct != null && chgPct < -5) ? { label:'較弱價格', bg:'#f6a99a', fg:'#7a261a' }
                : { label:'觀望', bg:'#f3d27a', fg:'#7a5418' };

  const fmt = v => (v == null ? '—' : v.toLocaleString('zh-TW', {maximumFractionDigits:2}));

  // Position over the design's 價格面板 slot. Figma node 39-1506:
  //   character card (Group 23):  x=34,  y=87, w=292, h=287 → bottom 374
  //   trend chart   (Group 179):  x=726, y=87, w=682, h=287 → bottom 374
  //   3 price cards (Groups 171/175/176): x=337, w=377, y=87/187/287, h=88 each
  //     → 3rd card bottom = 287+88 = 375 (≈ 374, aligns with neighbouring panels)
  //     → 12 px gap between adjacent cards
  // Match neighbours by using h=287 (same as character card); evenly space the
  // 3 sub-cards inside (top padding ≡ inter-card gap ≡ bottom padding = 12 px).
  return (
    <div style={{
      position:'absolute',
      left:   `${337/1440*100}%`,
      top:    `${87/1468*100}%`,
      width:  `${377/1440*100}%`,
      height: `${287/1468*100}%`,
      background:'#fceadb',
      border:'1.5px solid #ead1bb',
      borderRadius:14,
      padding:'12px 18px',
      boxSizing:'border-box',
      display:'flex', flexDirection:'column', gap:12,
      fontFamily:"'Noto Sans TC',sans-serif",
    }}>
      {/* Sub-card: 價格面板 (AMIS) */}
      <div style={{flex:1, background:'#fff5e8', borderRadius:10, padding:'10px 12px', boxShadow:'0 1px 0 #f0e0c8', display:'flex', flexDirection:'column', justifyContent:'space-evenly'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
          <div style={{fontSize:15, fontWeight:900, color:'#a85a16', letterSpacing:1}}>價格面板 (AMIS)</div>
          <div style={{fontSize:9, color:'#a89070'}}>{latestDate ? latestDate.replace(/-/g,'/') : ''}</div>
        </div>
        <div style={{marginTop:4, display:'flex', alignItems:'baseline', gap:10}}>
          <div style={{fontSize:12, color:'#7a5418', fontWeight:700}}>最新均價</div>
          <div style={{fontSize:14, fontWeight:900, color:'#5a3a18'}}>${fmt(latest)} / 公斤</div>
          <div style={{fontSize:11, color:'#a89070'}}>(${fmt(taikinPrice)} / 台斤)</div>
        </div>
      </div>
      {/* Sub-card: 試算預估零售價 */}
      <div style={{flex:1, background:'#fff5e8', borderRadius:10, padding:'10px 12px', boxShadow:'0 1px 0 #f0e0c8', display:'flex', flexDirection:'column', justifyContent:'space-evenly'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
          <div style={{fontSize:15, fontWeight:900, color:'#a85a16', letterSpacing:1}}>試算預估零售價</div>
          <div style={{fontSize:9, color:'#a89070'}}>(口徑A: 批發 × 2)</div>
        </div>
        <div style={{marginTop:4, display:'flex', alignItems:'baseline', gap:14}}>
          <div style={{fontSize:14, fontWeight:900, color:'#5a3a18'}}>${retailKg ?? '—'} / 公斤</div>
          <div style={{fontSize:9, color:'#c8a070'}}>|</div>
          <div style={{fontSize:14, fontWeight:900, color:'#5a3a18'}}>${retailTaikin ?? '—'} / 台斤</div>
        </div>
      </div>
      {/* Sub-card: 近期交易指標 */}
      <div style={{flex:1, background:'#fff5e8', borderRadius:10, padding:'10px 12px', boxShadow:'0 1px 0 #f0e0c8', display:'flex', flexDirection:'column', justifyContent:'space-evenly'}}>
        <div style={{fontSize:15, fontWeight:900, color:'#a85a16', letterSpacing:1, marginBottom:6}}>近期交易指標</div>
        <div style={{display:'flex', gap:14, fontSize:12, color:'#7a5418', alignItems:'center', flexWrap:'wrap'}}>
          <div>購買建議</div>
          <span style={{padding:'3px 10px', borderRadius:10, background:buyTag.bg, color:buyTag.fg, fontWeight:700}}>{buyTag.label}</span>
          <div>賣出建議</div>
          <span style={{padding:'3px 10px', borderRadius:10, background:sellTag.bg, color:sellTag.fg, fontWeight:700}}>{sellTag.label}</span>
        </div>
      </div>
    </div>
  );
};

/* ── CARD 2: 批發市場行情趨勢圖 (toggle 每週/每月/一年/每年) ──────────── */
const TrendChartCard = ({cropName}) => {
  const noData = !!(cropName && WHOLESALE_NO_DATA.has(cropName));
  const m = useCropMarket(noData ? '__nodata__' : (cropName || '番茄'));
  const chartReady = useChart();
  const [period, setPeriod] = useState('weekly');
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);

  React.useEffect(() => {
    if (!m || !chartReady || !window.Chart || !canvasRef.current) return;
    // '一年' = last 52 weeks of weekly series; '每週' = full weekly series
    let entries, priceLabel;
    if (period === 'weekly')      { entries = m.weekly;  priceLabel = '每週均價 (NTD/公斤)'; }
    else if (period === 'monthly'){ entries = m.monthly; priceLabel = '每月均價 (NTD/公斤)'; }
    else if (period === 'year52') { entries = m.weekly.slice(-52); priceLabel = '每週均價 (NTD/公斤)'; }
    else                          { entries = m.yearly;  priceLabel = '每年均價 (NTD/公斤)'; }
    const labels = entries.map(e => e.key || e.date);
    const prices = entries.map(e => e.price);
    const volumes = entries.map(e => e.volume);

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'交易量 (KG)', data: volumes, backgroundColor:'rgba(168,213,176,0.55)', borderColor:'rgba(168,213,176,1)', borderWidth:0, yAxisID:'y2', order:2 },
          { label: priceLabel, data: prices, type:'line', borderColor:'#3578d4', backgroundColor:'#3578d4', tension:0.25, pointRadius: period==='weekly' ? 1.5 : 3, pointHoverRadius:6, borderWidth:2, yAxisID:'y1', order:1 },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins: {
          legend:{ position:'top', labels:{ font:{size:11}, boxWidth:14, color:'#3a4a6a' } },
          tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${ctx.raw?.toLocaleString('zh-TW') ?? '—'}` } },
        },
        scales: {
          x: { ticks:{font:{size:10}, color:'#666', maxRotation:60, autoSkip:true,
                       maxTicksLimit: period==='weekly' ? 14 : period==='monthly' ? 12 : period==='yearly' ? 11 : 12},
               grid:{display:false} },
          y1:{ position:'left',  title:{display:true,text:'價格 (NTD/公斤)',font:{size:10},color:'#666'}, ticks:{font:{size:10},color:'#666'}, grid:{color:'rgba(0,0,0,0.05)'} },
          y2:{ position:'right', title:{display:true,text:'交易量 (KG)',font:{size:10},color:'#666'}, ticks:{font:{size:10},color:'#666',callback:v=>v>=1e6?(v/1e6).toFixed(0)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v}, grid:{drawOnChartArea:false} },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [m, period, chartReady]);

  if (noData) {
    return (
      <div style={{
        position:'absolute',
        left:`${726/1440*100}%`, top:`${87/1468*100}%`,
        width:`${(1407-726)/1440*100}%`, height:`${(374-87)/1468*100}%`,
        background:'#f4f6e8', border:'1.5px solid #d8dcc0', borderRadius:14,
        padding:'10px 14px', boxSizing:'border-box',
        display:'flex', flexDirection:'column', gap:6,
        fontFamily:"'Noto Sans TC',sans-serif",
      }}>
        <div style={{fontSize:17, fontWeight:900, color:'#5a7028', letterSpacing:1.5}}>批發市場行情趨勢圖 · {cropName}</div>
        <_WholesaleNoDataMsg/>
      </div>
    );
  }

  return (
    <div style={{
      position:'absolute',
      left:   `${726/1440*100}%`,
      top:    `${87/1468*100}%`,
      width:  `${(1407-726)/1440*100}%`,
      height: `${(374-87)/1468*100}%`,
      background:'#f4f6e8',
      border:'1.5px solid #d8dcc0',
      borderRadius:14,
      padding:'10px 14px',
      boxSizing:'border-box',
      display:'flex', flexDirection:'column', gap:6,
      fontFamily:"'Noto Sans TC',sans-serif",
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:17, fontWeight:900, color:'#5a7028', letterSpacing:1.5}}>批發市場行情趨勢圖</div>
        <div style={{display:'flex', gap:6}}>
          {[['weekly','每週'],['monthly','每月'],['year52','一年'],['yearly','每年']].map(([k, label]) => (
            <button key={k} onClick={()=>setPeriod(k)} style={{
              fontSize:11, padding:'3px 12px',
              border:'1px solid '+(period===k?'#7a8c2a':'#d8dcc0'),
              background: period===k ? '#bcc865' : '#fefef0',
              color: period===k ? '#3d4a10' : '#7a8c2a',
              borderRadius:14, cursor:'pointer',
              fontFamily:'inherit', fontWeight:700,
            }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{flex:1, background:'#fff', border:'1px solid #e3e6cd', borderRadius:10, padding:'8px 10px', position:'relative', minHeight:0}}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  );
};

/* ── CARD 3: 批發市場成交量比較 ─────────────────────────────────────────── */
const VolumeBarsCard = ({cropName}) => {
  const noData = !!(cropName && WHOLESALE_NO_DATA.has(cropName));
  const m = useCropMarket(noData ? '__nodata__' : (cropName || '番茄'));
  const chartReady = useChart();
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);

  React.useEffect(() => {
    if (!m || !chartReady || !window.Chart || !canvasRef.current) return;
    const list = (m.market_compare?.markets_volume) || [];
    const labels = list.map(x => x.market);
    const vols   = list.map(x => Math.round(x.volume));

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ label:'當月累積成交量 (KG)', data: vols, backgroundColor:'rgba(70,184,142,0.85)', borderColor:'#3aa07a', borderWidth:1 }] },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: {
          legend:{ position:'top', labels:{font:{size:11}, color:'#256b54'}},
          tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${ctx.raw?.toLocaleString('zh-TW')} KG` } },
        },
        scales: {
          x:{ ticks:{font:{size:10},color:'#666',maxRotation:60,minRotation:45}, grid:{display:false} },
          y:{ title:{display:true,text:'交易量 (KG)',font:{size:10},color:'#666'}, ticks:{font:{size:10},color:'#666',callback:v=>v.toLocaleString('zh-TW')}, grid:{color:'rgba(0,0,0,0.05)'} },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [m, chartReady]);

  if (noData) {
    return (
      <div style={{
        position:'absolute',
        left:`${34/1440*100}%`, top:`${385/1468*100}%`,
        width:`${(713-34)/1440*100}%`, height:`${(829-385)/1468*100}%`,
        background:'#dceef0', border:'1.5px solid #b6d7da', borderRadius:14,
        padding:'10px 14px', boxSizing:'border-box',
        display:'flex', flexDirection:'column', gap:6,
        fontFamily:"'Noto Sans TC',sans-serif",
      }}>
        <div style={{fontSize:17, fontWeight:900, color:'#256b78', letterSpacing:1.5}}>批發市場成交量比較 · {cropName}</div>
        <_WholesaleNoDataMsg/>
      </div>
    );
  }

  return (
    <div style={{
      position:'absolute',
      left:   `${34/1440*100}%`,
      top:    `${385/1468*100}%`,
      width:  `${(713-34)/1440*100}%`,
      height: `${(829-385)/1468*100}%`,
      background:'#dceef0',
      border:'1.5px solid #b6d7da',
      borderRadius:14,
      padding:'10px 14px',
      boxSizing:'border-box',
      display:'flex', flexDirection:'column', gap:6,
      fontFamily:"'Noto Sans TC',sans-serif",
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:17, fontWeight:900, color:'#256b78', letterSpacing:1.5}}>批發市場成交量比較</div>
        <div style={{fontSize:9, color:'#7a9a9e'}}>(當月交易日累積{m?.market_compare?.month ? '・' + m.market_compare.month : ''})</div>
      </div>
      <div style={{flex:1, background:'#fff', border:'1px solid #cfe3e7', borderRadius:10, padding:'8px 10px', position:'relative', minHeight:0}}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  );
};

/* ── CARD 4: 批發市場價格比較 ───────────────────────────────────────────── */
const PriceBarsCard = ({cropName}) => {
  const noData = !!(cropName && WHOLESALE_NO_DATA.has(cropName));
  const m = useCropMarket(noData ? '__nodata__' : (cropName || '番茄'));
  const chartReady = useChart();
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);

  React.useEffect(() => {
    if (!m || !chartReady || !window.Chart || !canvasRef.current) return;
    const list = (m.market_compare?.markets_price) || [];
    const labels = list.map(x => x.market);
    const prices = list.map(x => Math.round(x.price * 10) / 10);

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ label:'當月加權均價 (NTD/公斤, 低到高)', data: prices, backgroundColor:'rgba(245,167,40,0.9)', borderColor:'#d88820', borderWidth:1 }] },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: {
          legend:{ position:'top', labels:{font:{size:11}, color:'#a8581a'}},
          tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: $${ctx.raw} / 公斤` } },
        },
        scales: {
          x:{ ticks:{font:{size:10},color:'#666',maxRotation:60,minRotation:45}, grid:{display:false} },
          y:{ title:{display:true,text:'價格 (NTD/公斤)',font:{size:10},color:'#666'}, ticks:{font:{size:10},color:'#666'}, grid:{color:'rgba(0,0,0,0.05)'} },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [m, chartReady]);

  if (noData) {
    return (
      <div style={{
        position:'absolute',
        left:`${727/1440*100}%`, top:`${385/1468*100}%`,
        width:`${(1407-727)/1440*100}%`, height:`${(829-385)/1468*100}%`,
        background:'#fcedd6', border:'1.5px solid #eed8b4', borderRadius:14,
        padding:'10px 14px', boxSizing:'border-box',
        display:'flex', flexDirection:'column', gap:6,
        fontFamily:"'Noto Sans TC',sans-serif",
      }}>
        <div style={{fontSize:17, fontWeight:900, color:'#a8581a', letterSpacing:1.5}}>批發市場價格比較 · {cropName}</div>
        <_WholesaleNoDataMsg/>
      </div>
    );
  }

  return (
    <div style={{
      position:'absolute',
      left:   `${727/1440*100}%`,
      top:    `${385/1468*100}%`,
      width:  `${(1407-727)/1440*100}%`,
      height: `${(829-385)/1468*100}%`,
      background:'#fcedd6',
      border:'1.5px solid #eed8b4',
      borderRadius:14,
      padding:'10px 14px',
      boxSizing:'border-box',
      display:'flex', flexDirection:'column', gap:6,
      fontFamily:"'Noto Sans TC',sans-serif",
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:17, fontWeight:900, color:'#a8581a', letterSpacing:1.5}}>批發市場價格比較</div>
        <div style={{fontSize:9, color:'#bb9a72'}}>(當月交易量加權均價；可挑價格較佳市場)</div>
      </div>
      <div style={{flex:1, background:'#fff', border:'1px solid #f0e0c8', borderRadius:10, padding:'8px 10px', position:'relative', minHeight:0}}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  );
};

/* ── CARD 6: 每年農作物災損金額 ─────────────────────────────────────────── */
const DisasterChartCard = () => {
  const ds = useDisasterYearly();
  const chartReady = useChart();
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);

  React.useEffect(() => {
    if (!ds || !chartReady || !window.Chart || !canvasRef.current) return;
    const rows = ds.yearly || [];
    const labels = rows.map(r => r.year);
    const losses = rows.map(r => r.loss_100m_ntd);
    const qtys = rows.map(r => r.loss_qty_ton);

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'災損金額 (億元)', data: losses, backgroundColor:'rgba(245,150,150,0.85)', borderColor:'#e67878', borderWidth:1, yAxisID:'y1', order:2 },
          { label:'災損數量 (公噸)', data: qtys, type:'line', borderColor:'#3fb6c8', backgroundColor:'#3fb6c8', tension:0.25, pointRadius:4, pointHoverRadius:6, borderWidth:2.5, yAxisID:'y2', order:1 },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins: {
          legend:{ position:'top', labels:{font:{size:11}, color:'#3a6a78'}},
          tooltip:{ callbacks:{ label: ctx => {
            const v = ctx.raw;
            if (v == null) return ctx.dataset.label + ': —';
            return ctx.dataset.label + ': ' + v.toLocaleString('zh-TW');
          }}},
        },
        scales: {
          x:{ ticks:{font:{size:11}, color:'#666'}, grid:{display:false} },
          y1:{ position:'left',  title:{display:true,text:'金額 (億元)',font:{size:10},color:'#666'}, ticks:{font:{size:10},color:'#666'}, grid:{color:'rgba(0,0,0,0.05)'} },
          y2:{ position:'right', title:{display:true,text:'數量 (公噸)',font:{size:10},color:'#666'}, ticks:{font:{size:10},color:'#666',callback:v=>v.toLocaleString('zh-TW')}, grid:{drawOnChartArea:false} },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [ds, chartReady]);

  // Card position: x=726-1407, y=842-1287 (mirrors export-trend's mid-bottom row).
  return (
    <div style={{
      position:'absolute',
      left:   `${726/1440*100}%`,
      top:    `${842/1468*100}%`,
      width:  `${(1407-726)/1440*100}%`,
      height: `${(1287-842)/1468*100}%`,
      background:'#ddeee8',
      border:'1.5px solid #b7d3c8',
      borderRadius:14,
      padding:'14px 18px',
      boxSizing:'border-box',
      display:'flex', flexDirection:'column', gap:10,
      fontFamily:"'Noto Sans TC',sans-serif",
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:18, fontWeight:900, color:'#2e7c6c', letterSpacing:1.5}}>每年農作物災損金額</div>
        <div style={{fontSize:10, color:'#7aa090'}}>(億元)</div>
      </div>
      <div style={{flex:1, background:'#fff', border:'1px solid #cfe3d8', borderRadius:10, padding:'8px 10px', position:'relative', minHeight:0}}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  );
};

/* ── EXPORT TREND CHART (interactive, real data from agrstat.moa.gov.tw) ───
 * Replaces the static "外銷趨勢圖" cell in the dashboard image with a
 * Chart.js bar+line chart. Data lives in window.DATASETS.tomato_export
 * (parsed from the ODS export of 蕃茄,生鮮冷藏 1989-01 to 2026-03).
 */
const COUNTRY_OPTIONS = ['全球','APEC','CPTPP(12)','CPTPP','東協六國','歐盟','新南向國家','TPP','區域全面經濟夥伴關係協定'];

const ExportTrendChart = ({cropName} = {}) => {
  usePageDataReady();
  const chartReady = useChart();
  // Two data paths:
  //   1. cropName has a TRADE_COA_MAP entry (e.g. 西瓜) → fetch trade_<slug>.json
  //      from nongzhidao GH Pages, shape { code, name, data: {country: {yearly, monthly}} }.
  //   2. cropName IS 番茄 (any form) → fall back to legacy window.DATASETS.tomato_export.
  //   3. otherwise → no data; show placeholder so we don't mislabel 番茄 numbers
  //      as a different county's crop.
  const tradeJson = useCropTrade(cropName);
  const isTomato  = !!cropName && /(?:^|[-·])(?:番茄|蕃茄|牛番茄|牛蕃茄)(?:$|[-·])/.test(`-${cropName}-`);
  const fallback  = (isTomato && typeof window !== 'undefined' && window.DATASETS) ? window.DATASETS.tomato_export : null;
  const data      = tradeJson || fallback;
  const headlineCrop = tradeJson ? tradeJson.name : (cropName || '番茄');
  const [country, setCountry] = useState('全球');
  const [period, setPeriod] = useState('yearly');
  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  // When trade JSON loads (or cropName changes), reset `country` to whatever's
  // available — '全球' if the new data has it, else the first listed country.
  React.useEffect(() => {
    if (!tradeJson) return;
    const cs = Object.keys(tradeJson.data || {});
    if (!cs.length) return;
    if (!cs.includes(country)) setCountry(cs.includes('全球') ? '全球' : cs[0]);
  }, [tradeJson]);

  React.useEffect(() => {
    if (!data || !chartReady || !window.Chart || !canvasRef.current) return;
    const cd = data.data[country];
    if (!cd) return;
    const series = period === 'yearly' ? cd.yearly : cd.monthly;

    let entries = Object.entries(series);
    // Yearly: keep last 11 years (matches the design's 2016–2026 range).
    // Monthly: last 60 months stays legible.
    if (period === 'yearly') entries = entries.slice(-11);
    if (period === 'monthly') entries = entries.slice(-60);

    // MOA TradeCoa JSON keys are民國 ("105" / "105-04"). Convert ROC → 西元 for
    // display only — JSON data stays native MOA format. Legacy tomato_export
    // keys are already 西元 so leave them alone (digit-length heuristic).
    const rocToWestern = (k) => {
      const m = String(k).match(/^(\d{2,3})(?:-(\d{2}))?$/);
      if (!m) return k;
      const y = parseInt(m[1], 10);
      // ROC years are typically 50-130 (1961-2041). Real Western years are 4-digit.
      if (y < 200) {
        const western = y + 1911;
        return m[2] ? `${western}-${m[2]}` : String(western);
      }
      return k;
    };
    const labels = entries.map(([k]) => rocToWestern(k));
    const weights = entries.map(([,v]) => v?.w ?? null);
    const avgPrices = entries.map(([,v]) =>
      (v?.w && v?.v) ? Math.round(v.v * 1000 / v.w) : null);

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            // Bars on the right axis = export volume (公噸), light-blue palette.
            label: '出口量 (公噸)',
            data: weights,
            backgroundColor: 'rgba(189,211,250,0.95)',
            borderColor: 'rgba(165,193,238,1)',
            borderWidth: 1,
            yAxisID: 'y2',
            order: 2,
            barPercentage: 0.75,
            categoryPercentage: 0.85,
          },
          {
            // Line on the left axis = average price (NTD/公噸), purple.
            label: '均價 (NTD/公噸)',
            data: avgPrices,
            type: 'line',
            borderColor: '#9070d0',
            backgroundColor: '#9070d0',
            yAxisID: 'y1',
            tension: 0.25,
            pointRadius: period==='yearly' ? 4 : 1.5,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            order: 1,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 14, color:'#5d3fb8' } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw;
                if (v == null) return ctx.dataset.label + ': —';
                return ctx.dataset.label + ': ' + v.toLocaleString('zh-TW');
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 11 }, color:'#666', maxRotation: 0, autoSkip: true, maxTicksLimit: period==='yearly' ? 11 : 8 },
            grid: { display: false },
          },
          y1: {
            position:'left',
            title:{display:true, text:'均價 (NTD/公噸)', font:{size:10}, color:'#666'},
            ticks:{font:{size:10}, color:'#666'},
            grid:{color:'rgba(0,0,0,0.05)'},
          },
          y2: {
            position:'right',
            title:{display:true, text:'出口量 (公噸)', font:{size:10}, color:'#666'},
            ticks:{font:{size:10}, color:'#666'},
            grid:{drawOnChartArea:false},
          },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [country, period, data, chartReady]);

  if (!data) {
    // Distinguish "still loading" vs "no data exists for this crop":
    //   - tradeJson is undefined while the fetch is inflight; null/undefined after
    //   - if cropName is in TRADE_COA_MAP we're still waiting → loading
    //   - otherwise this crop has no trade backfill yet → show clear placeholder
    //     instead of misleading the user with 番茄's numbers.
    const slug = cropName ? TRADE_COA_MAP[cropName] : null;
    const loading = !!slug;  // there IS a file, we're just waiting
    return (
      <div style={{
        position:'absolute',
        left:`${34/1440*100}%`, top:`${842/1468*100}%`,
        width:`${(713-34)/1440*100}%`, height:`${(1287-842)/1468*100}%`,
        background:'#ece8f8', border:'1.5px solid #d4cfe8',
        borderRadius:14, padding:'14px 18px', boxSizing:'border-box',
        display:'flex', flexDirection:'column', gap:10,
        fontFamily:"'Noto Sans TC',sans-serif",
      }}>
        <div style={{fontSize:18, fontWeight:900, color:'#5d3fb8', letterSpacing:1.5}}>
          外銷趨勢圖{cropName ? ` · ${cropName}` : ''}
        </div>
        <div style={{
          flex:1, background:'#fff', border:'1px solid #e4dff0', borderRadius:10,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#888', fontSize:13, textAlign:'center', padding:'20px',
        }}>
          {loading
            ? '外銷資料載入中…'
            : <>本作物之外銷貿易資料尚未建檔<br/><span style={{fontSize:11,color:'#aaa'}}>(MOA 海關 COA 碼資料源待人工核對作物對應 + 跑 backfill)</span></>}
        </div>
      </div>
    );
  }

  // Two-layer nested layout matching the design:
  //   outer card (lavender bg + title + toggle)         x=34-713, y=842-1287
  //   └── inner chart card (white bg + canvas)          x=54-693, y=908-1241
  // (Earlier numbers were off — they pointed at the inner chart card's edges,
  // not the outer wrapper. Right and bottom now extend to match the design's
  // full lavender wrapper, so the card matches its neighbour 災損金額.)
  return (
    <div style={{
      position:'absolute',
      left:   `${34/1440*100}%`,
      top:    `${842/1468*100}%`,
      width:  `${(713-34)/1440*100}%`,
      height: `${(1287-842)/1468*100}%`,
      background:'#ece8f8',
      border:'1.5px solid #d4cfe8',
      borderRadius:14,
      padding:'14px 18px',
      boxSizing:'border-box',
      display:'flex', flexDirection:'column',
      gap:10,
      fontFamily:"'Noto Sans TC',sans-serif",
    }}>
      {/* Outer header: title + 每月/每年 toggle (and country picker for interactivity) */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:18, fontWeight:900, color:'#5d3fb8', letterSpacing:1.5}}>外銷趨勢圖{headlineCrop ? ` · ${headlineCrop}` : ''}</div>
        <div style={{display:'flex', gap:6, alignItems:'center'}}>
          <select
            value={country}
            onChange={e=>setCountry(e.target.value)}
            style={{
              fontSize:12, padding:'3px 8px',
              border:'1px solid #d4cfe8', borderRadius:14,
              background:'#fff', color:'#5d3fb8',
              fontFamily:'inherit', cursor:'pointer',
            }}>
            {/* Dynamic option list when trade JSON loaded; legacy fallback otherwise. */}
            {(tradeJson ? Object.keys(tradeJson.data || {}).sort() : COUNTRY_OPTIONS)
              .map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {[['monthly','每月'], ['yearly','每年']].map(([k, label]) => (
            <button key={k} onClick={()=>setPeriod(k)} style={{
              fontSize:12, padding:'4px 14px',
              border:'1px solid '+(period===k?'#7560d4':'#e8dfd0'),
              background: period===k ? '#7560d4' : '#faf2dd',
              color: period===k ? '#fff' : '#a8956e',
              borderRadius:16, cursor:'pointer',
              fontFamily:'inherit', fontWeight:700,
            }}>{label}</button>
          ))}
        </div>
      </div>
      {/* Inner chart card */}
      <div style={{
        flex:1,
        background:'#ffffff',
        border:'1px solid #e4dff0',
        borderRadius:10,
        padding:'8px 10px',
        position:'relative',
        minHeight:0,
        boxSizing:'border-box',
      }}>
        <canvas ref={canvasRef}/>
      </div>
    </div>
  );
};

/* ── DASHBOARD PAGE (clicking the tomato character opens this) ───────────
 * Mobile fix: dashboard cards use a mix of percent / cqw / Chart.js fixed-px
 * that all scale differently, breaking layout below ~1000px viewports. We
 * render the entire dashboard at fixed design pixels (1440×1468) inside a
 * uniformly-scaled wrapper so positioning and font sizes shrink as one unit
 * down to any viewport. Cards above remain unchanged.
 */
/* ── TAOYUAN DETAIL PAGE ────────────────────────────────────────────────────
 * 桃園市的鄉鎮地圖詳細頁，從 桃園地圖.ai 渲染而來。
 * Phase 1：純底圖 + 「回上一頁」back button。
 * Phase 2：每個鄉鎮 polygon 支援 hover 變色 + 角色浮現（待補）。
 */
const TaoyuanDetail = ({onBack, onCropSelect}) => {
  // AI 渲染的圖原始 size 是 2403×3000（design 1201.5×1500）
  // 圖內已有「← 回上一頁」label，shape 大約在 design coord (62-176, 30-72) 範圍
  // 用透明 click area 覆蓋該位置觸發 onBack
  const W = 1201, H = 1500;  // design canvas
  return (
    <div style={{
      position:'relative',
      width:'min(1201px, 100%)',
      aspectRatio: `${W} / ${H}`,
      margin:'0 auto',
      fontFamily:"'Noto Sans TC', sans-serif",
      containerType: 'inline-size',
      background: '#ffffff',
    }}>
      <DesignImage
        name="taoyuan_detail"
        alt="桃園市鄉鎮詳細地圖"
        style={{
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          display:'block',
          userSelect:'none', pointerEvents:'none',
        }}
      />
      {/* 「← 回上一頁」click hotspot — 對應 design 上的 button 位置 */}
      <div
        onClick={onBack}
        title="回上一頁"
        style={{
          position:'absolute',
          left: `${50/W*100}%`,
          top:  `${25/H*100}%`,
          width: `${130/W*100}%`,
          height:`${45/H*100}%`,
          cursor:'pointer',
          zIndex: 5,
        }}
      />
      {/* TODO Phase 2: 13 個鄉鎮 polygon overlay + hover 角色 SVG */}
    </div>
  );
};

/* ── CharacterCard — Figma-faithful template for all 19 counties ──────────
 * Source: Figma node 39-2695 (Group 23). SVG assets (pin, heart, grass) are
 * the original Figma exports — inlined to avoid extra fetches + repack churn.
 * Positions / sizes are in design-canvas px (the parent <Dashboard> renders
 * the whole 1440×1468 canvas and CSS-transform scales it; values here scale
 * along with everything else).
 *
 * Layout (card-relative px — card origin is (34, 87) in design canvas):
 *   card frame    : 292 × 287, bg #fdf7ea, border 1.5px #efd8c6, radius 15
 *   pin icon      : (22.27, 14), 18.45 × 22.54
 *   county name   : (49, 14), font 16 bold, color #3b6826
 *   crop name     : (15, 48), font 30 bold (replaces baked "番茄" text)
 *   heart icon    : (253, 15), 22.46 × 22.46
 *   grass         : (-8.5, 229), 321 × 88 — overflows card; clipped by overflow:hidden
 *   character     : (57.64, 72), 172.72 × 190.57 from window.COUNTY_CHARS[a_xx]
 *
 * Renders for ALL counties including taoyuan — fully overlays the baked
 * tomato card.
 */
const _PIN_SVG = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 18.454 22.5391" fill="none" xmlns="http://www.w3.org/2000/svg"><g><path d="M4.52809 9.49983C4.52809 6.90471 6.63185 4.80095 9.22698 4.80095C11.8221 4.80095 13.9259 6.90471 13.9259 9.49983C13.9259 12.095 11.8221 14.1987 9.22698 14.1987C6.63185 14.1987 4.52809 12.095 4.52809 9.49983Z" fill="#95AB52"/><path fill-rule="evenodd" clip-rule="evenodd" d="M0.0328606 8.24517C0.416921 3.58585 4.3105 0 8.98563 0H9.46838C14.1435 0 18.0371 3.58585 18.4211 8.24517C18.6279 10.7538 17.853 13.2448 16.2597 15.1934L10.9028 21.7447C10.0367 22.8039 8.41732 22.8039 7.55119 21.7447L2.19433 15.1934C0.600977 13.2448 -0.173921 10.7538 0.0328606 8.24517Z" fill="#95AB52"/></g><ellipse cx="8.98424" cy="8.98442" rx="4.49221" ry="4.49221" fill="#FDF8EB"/></svg>`;
const _HEART_SVG = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 22.461 22.461" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11.2305" cy="11.2305" r="11.2305" fill="#FFE2C9"/><path d="M8.82838 7.01908C7.09336 7.01908 5.61521 8.31639 5.61521 10.0013C5.61521 11.1636 6.15948 12.1422 6.88082 12.9528C7.59968 13.7606 8.52712 14.4387 9.36556 15.0062L10.8122 15.9855C10.9706 16.0927 11.1784 16.0927 11.3368 15.9855L12.7834 15.0062C13.6219 14.4387 14.5493 13.7606 15.2682 12.9528C15.9895 12.1422 16.5338 11.1636 16.5338 10.0013C16.5338 8.31639 15.0556 7.01908 13.3206 7.01908C12.4262 7.01908 11.6392 7.43844 11.0745 7.98105C10.5097 7.43844 9.72275 7.01908 8.82838 7.01908Z" fill="#BB561E"/></svg>`;
const _GRASS_SVG = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 320.999 87.7973" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="160.499" cy="45.27" rx="160.499" ry="42.5272" fill="#C4D588"/><ellipse cx="150.453" cy="29.8055" rx="58.547" ry="8.50545" fill="#BBCA7A"/><ellipse cx="60.0611" cy="47.4164" rx="8.58016" ry="3.4795" fill="#FDEBBF"/><ellipse cx="265.985" cy="55.7085" rx="8.58016" ry="3.4795" fill="#FDEBBF"/><ellipse cx="251.854" cy="38.5349" rx="8.58016" ry="3.4795" fill="#FDEBBF"/><ellipse cx="236.353" cy="28.9998" rx="5.07176" ry="2.01853" fill="#FDEBBF"/><path d="M283.493 34.3251C282.196 35.8582 286.838 30.2098 290.346 31.774C291.686 32.3705 293.825 34.5059 292.49 37.1565C288.859 44.3622 279.232 43.5558 270.844 40.3242C262.456 37.0926 260.848 26.5965 268.259 26.5024C272.58 26.4476 273.721 31.6568 273.721 31.6568C273.721 31.6568 273.432 24.6005 278.763 23.958C284.095 23.3155 288.872 27.9682 283.493 34.3251Z" fill="#67B225"/><path d="M45.3124 13.3301C45.7007 15.3412 44.1458 8.02173 48.9352 6.89183C50.7642 6.45905 54.2256 6.48692 55.7217 9.36658C59.7895 17.1944 47.9365 24.7507 37.0039 27.8368C26.0713 30.9229 16.8163 22.4128 23.4593 17.4608C27.3331 14.5733 33.6974 17.7528 33.6974 17.7528C33.6974 17.7528 29.5061 10.8881 33.6974 6.89179C37.8887 2.89551 43.703 4.99076 45.3124 13.3301Z" fill="#67B225"/></svg>`;

const CharacterCard = ({county, cropOverride}) => {
  usePageDataReady();
  const region = REGIONS_DATA[county] || REGIONS_DATA.taoyuan;
  // When a taoyuan township polygon was clicked, cropOverride carries that
  // township's crop name (e.g. '綠竹筍'). The matching character SVG lives in
  // window.TAOYUAN_CROPS (10 township-level SVGs), not COUNTY_CHARS.
  const useOverride = !!cropOverride && county === 'taoyuan';
  const cropName = useOverride ? cropOverride : (region.cropApi || '');
  const charKey = REGION_TO_CHAR_KEY[county];
  const charSrc = useOverride
    ? ((typeof window !== 'undefined' && window.TAOYUAN_CROPS) ? window.TAOYUAN_CROPS[cropOverride] : null)
    : ((charKey && typeof window !== 'undefined' && window.COUNTY_CHARS) ? window.COUNTY_CHARS[charKey] : null);
  return (
    <div style={{
      position:'absolute',
      // Figma Group 23: x=34, y=87, w=292, h=287 (percent of 1440×1468 canvas)
      left:   `${34/1440*100}%`,
      top:    `${87/1468*100}%`,
      width:  `${292/1440*100}%`,
      height: `${287/1468*100}%`,
      background:'#fdf7ea',
      border:'1.5px solid #efd8c6',
      borderRadius:15,
      overflow:'hidden',
      fontFamily:"'Noto Sans CJK TC', 'Noto Sans TC', sans-serif",
      zIndex: 3,
    }}>
      {/* Grass (bottom band — anchored to design (-8.5, 229), 321×88) */}
      <div style={{
        position:'absolute',
        left: -8.5, top: 229, width: 321, height: 88,
        pointerEvents:'none',
      }} dangerouslySetInnerHTML={{__html: _GRASS_SVG}}/>

      {/* Character SVG — design (91.64, 159), 172.72×190.57 → card-relative origin */}
      {charSrc && (
        <img src={charSrc} alt={region.name}
          style={{
            position:'absolute',
            left: 57.64, top: 72,
            width: 172.72, height: 190.57,
            objectFit:'contain',
            pointerEvents:'none',
          }}/>
      )}

      {/* Pin icon — design (56.27, 101) → card-relative (22.27, 14) */}
      <div style={{
        position:'absolute',
        left: 22.27, top: 14,
        width: 18.454, height: 22.539,
      }} dangerouslySetInnerHTML={{__html: _PIN_SVG}}/>

      {/* County name — design (83, 101) → card-relative (49, 14) */}
      <div style={{
        position:'absolute',
        left: 49, top: 14,
        fontSize: 16, fontWeight: 700,
        color: '#3b6826', letterSpacing: 1.6,
        lineHeight: '22px',
      }}>{region.name}</div>

      {/* Crop name (large) — design (49, 135) → card-relative (15, 48). Replaces baked "番茄" text */}
      <div style={{
        position:'absolute',
        left: 15, top: 48,
        fontSize: 30, fontWeight: 900,
        color: '#3b6826', letterSpacing: 2,
        lineHeight: '40px',
      }}>{cropName}</div>

      {/* Heart icon — design (287, 102) → card-relative (253, 15) */}
      <div style={{
        position:'absolute',
        left: 253, top: 15,
        width: 22.461, height: 22.461,
      }} dangerouslySetInnerHTML={{__html: _HEART_SVG}}/>
    </div>
  );
};

const Dashboard = ({onBack, selected, cropOverride}) => {
  const region = REGIONS_DATA[selected] || REGIONS_DATA.taoyuan;
  // Precedence:
  //   1. cropOverride  (taoyuan township click — already a fully-qualified name)
  //   2. priceVariety  ("西瓜-大西瓜", "番茄-牛番茄" etc. — narrows MOA filter to
  //                     the county's headline sub-variety; nongzhidao map also
  //                     covers the variety forms so 桃園 still hits FJ3 fast path)
  //   3. cropApi       ("西瓜", "番茄"); broad fallback when no variety set
  //   4. literal '番茄' final safety net
  const cropName = cropOverride || region.priceVariety || region.cropApi || '番茄';
  return (
  <div style={{
    position:'relative',
    width:'100%',
    maxWidth:1440,
    margin:'0 auto',
    aspectRatio:'1440 / 1468',
    overflow:'hidden',
    containerType: 'inline-size',
  }}>
    <div style={{
      position:'absolute', inset:0,
      width:1440, height:1468,
      transformOrigin:'top left',
      transform:'scale(calc(100cqw / 1440px))',
    }}>
      {/* Logo click area — covers the static "農知島 The Island of Harvest"
          mark in the top-left of the dashboard image; click returns to home. */}
      <div
        onClick={onBack}
        title="返回首頁"
        style={{
          position:'absolute',
          left: 16, top: 6,
          width: 200, height: 56,
          cursor:'pointer',
          zIndex: 5,
        }}
      />
      <DesignImage
        name="tomato_dashboard"
        alt="桃園市 番茄市場儀表板"
        style={{display:'block', width:1440, height:'auto', userSelect:'none'}}
      />
      <CharacterCard county={selected} cropOverride={cropOverride}/>
      <PricePanelCard cropName={cropName}/>
      <TrendChartCard cropName={cropName}/>
      <VolumeBarsCard cropName={cropName}/>
      <PriceBarsCard cropName={cropName}/>
      <ExportTrendChart cropName={cropName}/>
      <DisasterChartCard/>
    </div>
  </div>
  );
};

/* ── MAIN APP ────────────────────────────────────────────────────────────── */
const App = () => {
  const [selected, setSelected] = useState(()=>localStorage.getItem('tw-map-sel')||'taoyuan');
  // When the user clicks a township polygon inside the taoyuan-detail view,
  // this carries the township's crop name through to the dashboard's
  // CharacterCard so it shows e.g. 綠竹筍 + the matching TAOYUAN_CROPS SVG.
  // null = no override (use county-level cropApi).
  const [taoyuanCrop, setTaoyuanCrop] = useState(null);
  const computeView = () => {
    const h = window.location.hash;
    if (h === '#dashboard') return 'dashboard';
    if (h === '#taoyuan-detail') return 'taoyuan-detail';
    return 'main';
  };
  const [view, setView] = useState(computeView);

  const handleSelect = (id) => {
    setSelected(id);
    localStorage.setItem('tw-map-sel', id);
    // 點 桃園 polygon 改成 Page 內部 setLeftMapView，不再跳 dashboard。
    // Dashboard 仍可由 hash #dashboard 進入（未來在 dashboard 內加 link 到 #taoyuan-detail）
  };

  // Sync view with URL hash so browser back/forward works and the URL is shareable.
  React.useEffect(() => {
    const sync = () => setView(computeView());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // Scroll to top when switching views.
  React.useEffect(() => { window.scrollTo(0, 0); }, [view]);

  // The base bundle centers a fixed-size card; we render a full-width page,
  // so override body/root layout to allow vertical scroll and full-bleed.
  React.useEffect(() => {
    const body = document.body;
    const root = document.getElementById('root');
    const prev = {
      bodyDisplay: body.style.display,
      bodyAlign: body.style.alignItems,
      bodyJustify: body.style.justifyContent,
      bodyBg: body.style.background,
      bodyMinH: body.style.minHeight,
      rootPadding: root ? root.style.padding : '',
      rootDisplay: root ? root.style.display : '',
      rootWidth: root ? root.style.width : '',
    };
    body.style.display = 'block';
    body.style.alignItems = '';
    body.style.justifyContent = '';
    body.style.background = '#ffffff';
    body.style.minHeight = '';
    if (root) {
      root.style.padding = '0';
      root.style.display = 'block';
      root.style.width = '100%';
    }
    return () => {
      body.style.display = prev.bodyDisplay;
      body.style.alignItems = prev.bodyAlign;
      body.style.justifyContent = prev.bodyJustify;
      body.style.background = prev.bodyBg;
      body.style.minHeight = prev.bodyMinH;
      if (root) {
        root.style.padding = prev.rootPadding;
        root.style.display = prev.rootDisplay;
        root.style.width = prev.rootWidth;
      }
    };
  }, []);

  // Shared: when a taoyuan township is clicked (either in Page's leftMapView
  // overlay or in the dedicated TaoyuanDetail page), stash the crop and
  // navigate to the dashboard so it can render with cropOverride.
  // Also force `selected` to 'taoyuan' — clicking the 桃園 polygon only
  // switches the LEFT map (setLeftMapView) without updating selected, so if
  // the user had picked a non-taoyuan county earlier, the override gate
  // (`county === 'taoyuan'`) in CharacterCard would never trip and the panel
  // would show the previous county's defaults instead of the township crop.
  const onCropSelect = (crop) => {
    // 桃園 township polygon click: set both selected=taoyuan AND override
    // crop. Stay on landing (no hash change) — the hero panel re-renders for
    // that township crop; 「查看更多」 button then routes to the per-crop
    // dashboard.
    handleSelect('taoyuan');
    setTaoyuanCrop(crop);
  };

  if (view === 'dashboard') {
    return <Dashboard onBack={() => { window.location.hash = ''; }} selected={selected} cropOverride={taoyuanCrop}/>;
  }
  if (view === 'taoyuan-detail') {
    return <TaoyuanDetail onBack={() => { window.location.hash = 'dashboard'; }} onCropSelect={onCropSelect}/>;
  }
  // Clicking a non-taoyuan county on the main map should drop any stale
  // taoyuan-crop override.
  return <Page
    selected={selected}
    cropOverride={taoyuanCrop}
    onSelect={(id) => {
      handleSelect(id);
      // 桃園 default crop = 水蜜桃 (拉拉山, the township slot Figma highlights).
      // Other counties clear any stale override.
      if (id === 'taoyuan') setTaoyuanCrop('水蜜桃');
      else                  setTaoyuanCrop(null);
    }}
    onCropSelect={onCropSelect}
  />;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
