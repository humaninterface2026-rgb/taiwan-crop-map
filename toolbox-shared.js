/* 小農工具箱 共用地基（批次1）
 * NZD 命名空間：constants（門檻/係數單一出處）、storage（統一 key + 匯出/匯入備份）、
 * data（天氣/行情快取取用）、phase/harvestWindow（生育期單一實作）。
 * 所有工具一律經由這裡拿常數與資料，禁止各自寫死。 */
window.NZD = (function () {
  'use strict';

  /* ── constants：全工具唯一出處 ── */
  const C = {
    crop: '牛蕃茄',
    plantsPerFen: 1800,          // 株/分
    normalYieldKgFen: 3200,      // kg/分
    gradeCoef: { A: 1.15, B: 1.0, C: 0.85 },
    channelCoef: { '批發': 1.0, '直銷': 1.1, '電商': 1.2 },
    priceBand: { low: 40, high: 55 },            // 行情判讀 元/kg
    taikinDiv: 1.5,                              // 元/台斤 = 元/kg ÷ 1.5（全站口徑）
    sowTemp: { idealLo: 20, idealHi: 30, okLo: 16, hardHi: 32 },
    sowRain7d: { ideal: 60, ok: 120 },           // mm/7日
    alert: { heat: 35, cold: 12, rain1d: 80, windKmh: 89 },  // 警戒門檻（風=陣風10級）
    soilMoist: { lo: 40, hi: 60 },               // 土壤濕度 %
    houseTemp: 35, houseRH: 90,                  // 棚內警戒
    ph: { lo: 6.0, hi: 6.8 },
    daysToHarvest: { lo: 85, hi: 110 },          // 定植後
    hotHarvestAdvance: { temp: 27, days: 6 },    // 高溫提早（統一版本）
    storage: { tempLo: 10, tempHi: 13, rhLo: 85, rhHi: 90 },
    processing: { stockHi: 800, priceLo: 40 },   // kg / 元
    laborPeak: { lo: 20, hi: 28 },               // 人天/週
    growthPhases: [                              // 統一生育期分段（定植後天數）
      { key: 'seedling', name: '苗期', lo: 0, hi: 25, fert: '根系建立優先，氮不宜過高避免徒長' },
      { key: 'flower', name: '開花著果期', lo: 26, hi: 55, fert: '提高鉀、鈣、硼，提升開花著果率' },
      { key: 'fruit', name: '結果採收期', lo: 56, hi: 999, fert: '分次追肥，鉀鈣為主，控氮避免裂果' },
    ],
  };

  /* ── storage：nzd.FJ3.<name>.v1 ── */
  const KEY = n => 'nzd.FJ3.' + n + '.v1';
  const S = {
    get(n, fallback) {
      try { const v = localStorage.getItem(KEY(n)); return v ? JSON.parse(v) : (fallback ?? null); }
      catch (e) { return fallback ?? null; }
    },
    set(n, v) { try { localStorage.setItem(KEY(n), JSON.stringify(v)); } catch (e) {} },
    names: ['pref', 'profile', 'fields', 'season', 'logs', 'readings', 'cost', 'pest'],
    exportAll() {
      const out = { _exported_at: new Date().toISOString(), _app: 'nzd-toolbox-v1' };
      S.names.forEach(n => { const v = S.get(n); if (v != null) out[n] = v; });
      return JSON.stringify(out, null, 1);
    },
    importAll(json) {
      const d = JSON.parse(json);
      if (d._app !== 'nzd-toolbox-v1') throw new Error('不是本工具箱的備份檔');
      let n = 0;
      S.names.forEach(k => { if (d[k] != null) { S.set(k, d[k]); n++; } });
      return n;
    },
  };

  /* ── data：即時資料（10 分鐘記憶快取）── */
  const COUNTY_COORDS = {
    '台北市': [25.03, 121.56], '新北市': [25.01, 121.47], '基隆市': [25.13, 121.74],
    '桃園市': [24.99, 121.30], '新竹市': [24.81, 120.97], '新竹縣': [24.84, 121.01],
    '苗栗縣': [24.56, 120.82], '台中市': [24.14, 120.68], '彰化縣': [24.08, 120.54],
    '南投縣': [23.90, 120.69], '雲林縣': [23.71, 120.43], '嘉義市': [23.48, 120.45],
    '嘉義縣': [23.46, 120.29], '台南市': [23.00, 120.23], '高雄市': [22.63, 120.30],
    '屏東縣': [22.55, 120.55], '宜蘭縣': [24.75, 121.75], '花蓮縣': [23.99, 121.60], '台東縣': [22.76, 121.14],
  };
  const CODE_MAP = {
    '番茄': 'code_FJ3', '牛蕃茄': 'code_FJ3', '水蜜桃': 'fruit_Y1', '桃子': 'fruit_Y1', '甜柿': 'fruit_Z0',
    '綠竹筍': 'code_SH2', '哈密瓜': 'fruit_W1', '哈蜜瓜': 'fruit_W1', '包心白': 'code_LC1', '包心白菜': 'code_LC1',
    '甘藍': 'code_LA1', '甘藍-初秋': 'code_LA1', '青蔥': 'code_SE2', '青蔥-北蔥': 'code_SE2', '青蔥-粉蔥': 'code_SE6',
    '大蒜': 'code_SG1', '大蒜-硬梗': 'code_SG1', '洋蔥': 'code_SD1', '山藥': 'code_SU2',
    '文旦': 'fruit_H1', '柚子': 'fruit_H1', '梨': 'fruit_O10', '梨-寶島甘露梨': 'fruit_O10',
    '西瓜': 'fruit_T1', '大西瓜': 'fruit_T1', '芒果': 'fruit_R1', '芭樂': 'fruit_P1', '草莓': 'fruit_45',
    '葡萄': 'fruit_S1', '釋迦': 'fruit_31', '香蕉': 'fruit_A1', '鳳梨': 'fruit_B2',
  };
  const NZ_BASE = 'https://wyaoguang3-code.github.io/nongzhidao/data/';
  const _cache = {};
  async function _cached(key, fn) {
    if (_cache[key] && Date.now() - _cache[key].at < 6e5) return _cache[key].v;
    const v = await fn();
    _cache[key] = { v, at: Date.now() };
    return v;
  }
  const D = {
    countyCoords: c => COUNTY_COORDS[c] || COUNTY_COORDS['桃園市'],
    countyList: () => Object.keys(COUNTY_COORDS),
    cropList: () => ['番茄', '水蜜桃', '甜柿', '綠竹筍', '哈密瓜', '包心白', '甘藍-初秋', '青蔥-粉蔥',
      '青蔥', '大蒜', '洋蔥', '山藥', '文旦', '梨', '西瓜', '芒果', '芭樂', '草莓', '葡萄', '釋迦', '香蕉', '鳳梨', '稻米', '茶葉'],
    code: crop => CODE_MAP[crop] || null,
    async weather(county) {
      const [lat, lon] = D.countyCoords(county);
      return _cached('wx:' + county, async () => {
        const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
          + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max'
          + '&timezone=Asia%2FTaipei&forecast_days=16';
        return (await (await fetch(u)).json()).daily;
      });
    },
    async market(crop) {
      const code = D.code(crop);
      if (!code) return null;
      return _cached('mkt:' + code, async () =>
        (await (await fetch(NZ_BASE + code + '.json', { cache: 'no-store' })).json()));
    },
  };

  /* ── 生育期/採收窗（單一實作）── */
  function phase(transplantDateISO, onDateISO) {
    if (!transplantDateISO) return null;
    const days = Math.floor((new Date(onDateISO || Date.now()) - new Date(transplantDateISO)) / 864e5);
    if (days < 0) return { days, name: '未定植', fert: null };
    const p = C.growthPhases.find(g => days >= g.lo && days <= g.hi);
    return { days, key: p.key, name: p.name, fert: p.fert };
  }
  function harvestWindow(transplantDateISO, avgTemp) {
    if (!transplantDateISO) return null;
    const t = new Date(transplantDateISO);
    let lo = C.daysToHarvest.lo, hi = C.daysToHarvest.hi;
    if (avgTemp != null && avgTemp >= C.hotHarvestAdvance.temp) { lo -= C.hotHarvestAdvance.days; hi -= C.hotHarvestAdvance.days; }
    const d = n => { const x = new Date(t); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    return { start: d(lo), end: d(hi) };
  }

  return { C, S, D, phase, harvestWindow };
})();
