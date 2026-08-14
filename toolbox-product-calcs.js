// 產品型態工具內容覆蓋（蜂蜜/黑豬肉/石門活魚）——由 PRODUCT_SKIN 合併進 CALCS。
// 內容依 toolbox-assets/crop-params.json 專屬參數包；連結皆實測可達。

// ── 共用文案引擎 v2（2026-08-15）：全品項行銷文案的唯一引擎 ──
// cfg（物件或回傳物件的函式，後者供依作物動態組態）：
//   emoji/noun/unit/defPrice/fresh/story[2]/safe/ship/keep/notice[]/tags[]/
//   sells={賣點label:[{head,sub}×N]}/defSell
// 客製維度：主打賣點(+🎲隨機)、三平台、三種口吻、自家亮點填空、
//           節氣時令句、作業日誌入文（都是使用者自己的資料）、多層隨機池
function _seasonPhrase() {
  // 近似節氣（±1 天，只當文案時令語，非農事依據）
  const T = [[1,5,'小寒'],[1,20,'大寒'],[2,3,'立春'],[2,18,'雨水'],[3,5,'驚蟄'],[3,20,'春分'],
             [4,4,'清明'],[4,19,'穀雨'],[5,5,'立夏'],[5,20,'小滿'],[6,5,'芒種'],[6,21,'夏至'],
             [7,6,'小暑'],[7,22,'大暑'],[8,7,'立秋'],[8,22,'處暑'],[9,7,'白露'],[9,22,'秋分'],
             [10,8,'寒露'],[10,23,'霜降'],[11,7,'立冬'],[11,22,'小雪'],[12,6,'大雪'],[12,21,'冬至']];
  const now = new Date(), m = now.getMonth() + 1, d = now.getDate();
  let cur = '冬至';
  for (let i = 0; i < T.length; i++) if (m > T[i][0] || (m === T[i][0] && d >= T[i][1])) cur = T[i][2];
  return cur;
}
function _recentLogLine() {
  // 最近 14 天的田間紀錄（跳過噴藥——用藥細節不進賣文），只有本人才寫得出的細節
  try {
    const logs = (NZD.S.get('logs', []) || []).slice(-40).reverse();
    const cut = Date.now() - 14 * 86400000;
    const hit = logs.find(x => x && x.txt && x.cat !== '噴藥' &&
                          x.date && new Date(x.date).getTime() >= cut);
    return hit ? { date: hit.date.slice(5).replace('-', '/'), txt: hit.txt } : null;
  } catch (e) { return null; }
}
function _mkCopywrite(cfgOrFn) {
  const getCfg = () => (typeof cfgOrFn === 'function' ? cfgOrFn() : cfgOrFn);
  const cfg0 = typeof cfgOrFn === 'function' ? null : cfgOrFn;
  return {
    inputs: [
      { key: 'sell', label: '主打賣點', unit: '', def: cfg0 ? cfg0.defSell : '🎲 幫我想',
        options: (cfg0 ? Object.keys(cfg0.sells) : ['新鮮直送', '產地故事', '安心品質', '量大優惠']).concat(['🎲 幫我想']) },
      { key: 'voice', label: '文案口吻', unit: '', def: '親切鄰家',
        options: ['親切鄰家', '質感文青', '直球促購'] },
      { key: 'tone', label: '要發到哪', unit: '', def: 'FB/LINE 社團',
        options: ['FB/LINE 社團', 'IG 貼文', '拍賣/蝦皮商品文'] },
      { key: 'price', label: '售價', unit: cfg0 ? '元/' + cfg0.unit : '元',
        def: String(cfg0 ? cfg0.defPrice : 45) },
      { key: 'custom', label: '自家亮點（選填，會編進文案）',
        unit: '例：在地農友吳伯伯，吃玉米長大的黑毛豬', def: '' },
    ],
    button: '生文案 ›',
    run(v) {
      const cfg = getCfg();
      const pf = NZD.S.get('profile');
      const farm = (pf && pf.farm_name) ? pf.farm_name : (CROP.county + '小農');
      const county = CROP.county;
      const price = +v.price || 0;
      const priceLine = (price ? price + ' 元／' + cfg.unit : '歡迎私訊詢價') +
                        (cfg.unitNote ? '（' + cfg.unitNote + '）' : '');
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      let sell = v.sell === '🎲 幫我想' ? pick(Object.keys(cfg.sells)) : v.sell;
      if (!cfg.sells[sell]) sell = cfg.defSell;
      const h = pick(cfg.sells[sell]);
      const custom = (v.custom || '').trim();
      const szn = _seasonPhrase();
      const log = _recentLogLine();
      const tagsN = v.voice === '質感文青' ? 4 : 99;
      const tags = cfg.tags.concat([county.slice(0, 2) + '小農']).slice(0, tagsN)
        .map(t => '#' + t.replace(/\s/g, '')).join(' ');
      const specBlock = '─ 商品規格 ─\n・品項：' + cfg.noun + '（' + county + '產）\n・價格：' + priceLine +
        '\n・出貨：' + cfg.ship + '\n・保存：' + cfg.keep +
        '\n\n─ 購買須知 ─\n' + cfg.notice.map(x => '・' + x).join('\n') +
        '\n・大量訂購（店家/團購）歡迎聊聊議價';
      let text;

      if (v.voice === '質感文青') {
        const noEmoji = (s) => s.replace(/^[^一-鿿「【\w]+\s*/, '');
        const open = pick([szn + '時節，' + noEmoji(h.head),
                           szn + '將至。' + noEmoji(h.head),
                           '又到了' + szn + '。' + noEmoji(h.head)]);
        // 「產地故事」賣點開頭已是故事本身 → 內文不重講
        const body = (sell === '產地故事' ? '' : cfg.story[0] + cfg.story[1]) +
          (custom ? '\n——' + custom + '。' : '') +
          (log ? '\n' + log.date + '，' + log.txt + '。日子就是這樣一天天把味道養出來的。' : '');
        const ctaSoft = pick(['數量不多，想嚐的私訊我們。', '這一批不多，有緣再會。私訊聊。',
                              '慢慢做，慢慢賣。想要的跟我們說一聲。']);
        if (v.tone === '拍賣/蝦皮商品文') {
          text = '【' + farm + '】' + cfg.noun + '\n\n' + open + '\n' + body + '\n\n' + specBlock;
        } else {
          text = open + '\n\n' + body + '\n\n' + cfg.noun + '｜' + priceLine + '\n' + cfg.ship +
            '\n\n' + ctaSoft + (v.tone === 'IG 貼文' ? '\n\n' + tags : '');
        }
      } else if (v.voice === '直球促購') {
        const punch = pick(['今天訂今天排單', '手刀來', '晚了就沒了', '就是這麼直接']);
        const bullets = [custom, cfg.fresh, cfg.safe].filter(Boolean)
          .map(x => '✅ ' + x).join('\n');
        const ctaHard = pick(['🔥 留言 +1 直接排單，額滿為止！', '🔥 別滑走——+1 就是你的！',
                              '🔥 私訊秒回，現在就訂！']);
        if (v.tone === '拍賣/蝦皮商品文') {
          text = '💥【' + farm + '】' + cfg.noun + '｜' + sell + '，' + punch + '！\n\n' +
            bullets + '\n\n' + specBlock;
        } else {
          text = '💥 ' + cfg.noun + ' ' + (price ? price + ' 元／' + cfg.unit : '開賣') + '，' + punch + '！\n\n' +
            bullets + '\n📦 ' + cfg.ship + '\n\n' + ctaHard +
            (v.tone === 'IG 貼文' ? '\n\n' + tags : '');
        }
      } else {  // 親切鄰家
        const customLine = custom ? '⭐ ' + custom : '';
        const logLine = log ? '📓 田間小記：' + log.date + ' ' + log.txt : '';
        const cta = pick(['要的請留言 +1 或私訊，收單後依序安排出貨！',
                          '數量有限，留言 +1 先搶先贏，私訊也通！',
                          '想吃的別猶豫——留言 +1 或私訊下單，額滿收單！']);
        if (v.tone === 'IG 貼文') {
          text = h.head + '\n' + (h.sub || '') + '\n' + (customLine ? customLine + '\n' : '') +
            '—\n' + cfg.story[0] + '\n' + cfg.story[1] + (logLine ? '\n' + logLine : '') +
            '\n—\n' + cfg.emoji + ' ' + farm + '｜' + cfg.noun + '\n💰 ' + priceLine +
            '\n📦 ' + cfg.ship + '\n🛒 訂購請私訊，或留言 +1\n—\n' + tags;
        } else if (v.tone === '拍賣/蝦皮商品文') {
          text = '【' + farm + '】' + cfg.noun + '｜' + sell +
            '\n\n' + (custom ? '✔ ' + custom + '\n' : '') +
            '✔ ' + cfg.fresh + '\n✔ ' + cfg.safe + '\n✔ ' + cfg.story[0] + cfg.story[1] +
            '\n\n' + specBlock;
        } else {
          text = h.head + '\n' + (h.sub || '') + '\n\n' + (customLine ? customLine + '\n\n' : '') +
            cfg.story[0] + cfg.story[1] + (logLine ? '\n' + logLine : '') +
            '\n\n🛒 本週供應\n・' + farm + '｜' + cfg.noun + '\n・' + priceLine +
            '\n・' + cfg.ship + '\n📍 ' + county + '面交／全台宅配\n\n' + cta;
        }
      }
      const short = cfg.emoji + ' ' + (custom ? custom + '｜' : '') + cfg.noun + ' ' +
        (price ? price + ' 元／' + cfg.unit : '私訊詢價') + '｜' + cfg.fresh + '，要的 +1！';
      return { headline: '文案好了，長按複製直接發！（口吻和賣點可以多試幾種）',
               detail: text + '\n\n— 短版（限時動態／群組快發）—\n' + short };
    },
  };
}

_mkCopywrite.v2 = true;   // 版本旗標 — toolbox 據此判斷引擎是否為配對版本

window.PRODUCT_CALCS = {
  '蜂蜜': {
  /* ══ 蜂蜜 CALCS 覆蓋：養蜂語境（蜂場/蜂群/採蜜），數字依專屬參數 ══ */
  cost: {
    hideDyn: true, noPrepare: true,
    inputs: [
      { key: 'boxes', label: '蜂箱數', unit: '箱', def: '60' },
      { key: 'boxCost', label: '蜂群蜂箱攤提', unit: '元/箱/年', def: '3500' },
      { key: 'feedCost', label: '糖與花粉飼料', unit: '元/箱/年', def: '1200' },
      { key: 'medCost', label: '治蟎與資材', unit: '元/箱/年', def: '300' },
      { key: 'laborCost', label: '人力預算', unit: '元/年', def: '60000' },
      { key: 'otherCost', label: '場租運輸雜支', unit: '元/年', def: '30000' },
      { key: 'yieldPerBox', label: '每箱預估年產蜜', unit: 'kg', def: '20' },
      { key: 'pricePerKg', label: '預估售價', unit: '元/kg', def: '400' },
    ],
    run(v) {
      const n = +v.boxes || 0, y = +v.yieldPerBox || 20, p = +v.pricePerKg || 400;
      const bees = n * (+v.boxCost || 0), feed = n * (+v.feedCost || 0), med = n * (+v.medCost || 0);
      const labor = +v.laborCost || 0, other = +v.otherCost || 0;
      const total = bees + feed + med + labor + other;
      const totalYield = Math.max(1, n * y);
      const breakeven = total / totalYield;
      const scen = m => Math.round(totalYield * p * m - total);
      const fmt = x => Math.round(x).toLocaleString();
      const light = p >= breakeven * 1.2 ? '🟢 照這售價有不錯的利潤空間'
        : p >= breakeven ? '🟡 有賺但空間不大，售價要顧好' : '🔴 照這售價會賠，要嘛降成本要嘛把蜜賣出更好的價';
      NZD.S.set('cost', { saved_at: new Date().toISOString(), boxes: n,
        items: { bees: Math.round(bees), feed: Math.round(feed), med: Math.round(med), labor: labor, other: other },
        total_cost: Math.round(total), expected_qty: Math.round(totalYield), breakeven_price: +breakeven.toFixed(1), expected_price: p });
      return {
        headline: '養 ' + n + ' 箱一年投入約 ' + fmt(total) + ' 元，蜜一公斤賣過 ' + breakeven.toFixed(0) + ' 元就不賠！',
        detail: '成本組成：蜂群蜂箱 ' + fmt(bees) + '、糖與花粉飼料 ' + fmt(feed) + '、治蟎資材 ' + fmt(med)
          + '、人力 ' + fmt(labor) + '、場租運輸雜支 ' + fmt(other) + ' 元。預估年產蜜 ' + fmt(totalYield) + ' 公斤（每箱常態約 15~25 公斤）。'
          + '三種年景試算（照 ' + p + ' 元/kg 為基準）：流蜜期雨多的歉年 8 折→淨利 ' + fmt(scen(0.8)) + ' 元；平年→ ' + fmt(scen(1))
          + ' 元；豐年 1.2 倍→ ' + fmt(scen(1.2)) + ' 元。' + light + '。提醒：蜜量最大變數是龍眼荔枝流蜜期的天氣，連續下雨蜜量會大減。已存檔，年底損益分析會直接拿這份來對帳。',
      };
    },
  },
  variety: {
    inputs: [
      { key: 'scale', label: '打算養幾箱', unit: '箱', def: '20' },
      { key: 'goal', label: '你最在意', unit: '', def: '蜜量優先', options: ['蜜量優先', '好照顧少生病', '特色蜜與品牌'] },
    ],
    button: '推薦蜂種方向 ›',
    run(v) {
      const n = +v.scale || 0;
      const size = n <= 10 ? '這個規模適合邊做邊學，管理眉角先練熟再擴場。'
        : n <= 50 ? '這個規模一個人顧得來，採蜜期找一兩個幫手就夠。'
        : '這個規模已是專業蜂場等級，蜜源和轉場路線要認真規劃。';
      const map = {
        '蜜量優先': '主流是西洋蜂（義大利蜂系）——群勢大、產蜜量高，跟著龍眼荔枝主流蜜走，一年主收入就靠 3~5 月這一波。',
        '好照顧少生病': '一樣選西洋蜂，但重點在「買好蜂」：向信譽好的蜂場買帶新王的蜂群，蜂王產卵力強、群勢就穩，病也少一半。',
        '特色蜜與品牌': '可以考慮東方蜂（俗稱野蜂）採森林野蜜，風味特殊賣得到高價；但產量低、容易逃群，建議先把西洋蜂養穩再試。',
      };
      return {
        headline: '想「' + v.goal + '」，蜂種方向幫你抓好了！',
        detail: map[v.goal] + ' ' + size + ' 買蜂時機：秋末到早春（春繁前）最好，一開春大家搶蜂價格最高。春繁把蜂口養滿，流蜜期才接得住——群勢決定今年蜜量。＊實際購蜂請找在地養蜂產銷班或養蜂協會介紹的蜂場，看過蜂群狀況再買。',
        links: [{ label: '台灣養蜂協會', url: 'https://www.bee.org.tw' }],
      };
    },
  },
  rotate: {
    noPrepare: true,
    inputs: [
      { key: 'mode', label: '蜂場型態', unit: '', def: '固定場（不搬）', options: ['固定場（不搬）', '會轉場追蜜源'] },
      { key: 'worry', label: '最想解決', unit: '', def: '蜜源空窗餵太多糖', options: ['蜜源空窗餵太多糖', '想多收幾種蜜', '蜂群夏秋掉群勢'] },
    ],
    button: '排蜜源行事曆 ›',
    run(v) {
      const cal = '台灣蜜源大致這樣走：3~5 月龍眼、荔枝主流蜜（一年主收入）；5~6 月部分地區有烏桕；夏天是最大空窗，靠大花咸豐草等雜花維持；秋冬看地區有埔鹽、白千層、鴨腳木等零星蜜粉源。';
      const map = {
        '蜜源空窗餵太多糖': '對策：把補餵當「保群」不當「生產」——空窗期餵 1:1 糖水維持群勢就好，流蜜前停止餵糖，蜜才純。蜂場周邊能留蜜源植物就留（咸豐草別除光），糖錢會省很多。',
        '想多收幾種蜜': (v.mode === '會轉場追蜜源'
          ? '對策：照蜜源行事曆排轉場路線——主流蜜收完往烏桕或山區雜木林移，秋冬再看埔鹽、鴨腳木。轉場前先實地看流蜜狀況、談好放蜂點，搬車錢才不會白花。'
          : '對策：固定場想多收蜜種比較吃地利——先盤點半徑兩三公里內有什麼會開花的樹，有成片烏桕或柑橘就有機會多收一波；沒有的話主流蜜顧好、其他當保群蜜源就好。'),
        '蜂群夏秋掉群勢': '對策：夏秋掉群勢多半是空窗餓到＋蟹蟎累積——空窗期定期補餵別讓群垮，秋季斷子期確實治蟎；弱群及早合併，留強汰弱過冬。',
      };
      return {
        headline: '全年蜜源行事曆幫你排出來了！',
        detail: cal + '\n' + map[v.worry] + '\n共同原則：一年的蜜幾乎靠春天這一波，行事曆一切以「春繁養滿蜂口、流蜜期全力採蜜」為中心往前後排。',
      };
    },
  },
  soil: {
    hideDyn: true,
    inputs: [
      { key: 'src', label: '半徑 2 公里內蜜源', unit: '', def: '龍眼荔枝成片', options: ['龍眼荔枝成片', '果樹雜木混合', '蜜源稀少或近市區'] },
      { key: 'spray', label: '周邊農田噴藥狀況', unit: '', def: '幾乎沒有', options: ['幾乎沒有', '有但可以協調', '密集且難掌握'] },
      { key: 'env', label: '遮蔭與水源', unit: '', def: '有樹蔭也有乾淨水源', options: ['有樹蔭也有乾淨水源', '只有其中一樣', '兩樣都缺'] },
    ],
    button: '評估場址 ›',
    run(v) {
      const cards = [];
      if (v.src === '龍眼荔枝成片') cards.push('蜜源：主力蜜源就在採集圈內（蜜蜂有效採集半徑約 2~3 公里）✓');
      else if (v.src === '果樹雜木混合') cards.push('蜜源：雜花養群沒問題，但主流蜜量看年份——流蜜期可考慮短期轉場到龍眼荔枝區');
      else cards.push('蜜源：太少——靠餵糖撐不出蜜，建議另覓場址，或這裡只做分蜂育王用');
      if (v.spray === '幾乎沒有') cards.push('農藥：風險低 ✓');
      else if (v.spray === '有但可以協調') cards.push('農藥：跟周邊農友打好關係、掌握噴藥時間，噴藥那幾天關巢門或暫移蜂群');
      else cards.push('農藥：高風險——農藥中毒常常一夕倒一場，強烈建議換場址，至少要遠離噴藥範圍');
      if (v.env === '有樹蔭也有乾淨水源') cards.push('環境：遮蔭防西曬、近處有乾淨水 ✓');
      else if (v.env === '只有其中一樣') cards.push('環境：缺遮蔭就搭遮蔭網防蜂箱西曬過熱；缺水就放淺水盤加浮木讓蜂安全採水');
      else cards.push('環境：遮蔭和水源都要補——夏天蜂箱曝曬會過熱，沒乾淨水蜂會去吸農田溝水，風險高');
      const bad = cards.filter(c => !c.includes('✓')).length;
      return {
        headline: bad ? '這個場址有 ' + bad + ' 件事要處理！' : '場址條件很好，可以放心進場！',
        detail: cards.join('。') + '。其他眉角：蜂箱墊高防潮防螞蟻、巢門避開強風向、離人車活動處遠一點免糾紛；放蜂點記得先跟地主談好。',
      };
    },
  },
  subsidy: {
    inputs: [
      { key: 'reg', label: '有沒有申報養蜂事實', unit: '', def: '有', options: ['有', '還沒'] },
      { key: 'ins', label: '有沒有農保/農職保', unit: '', def: '有', options: ['有', '沒有'] },
      { key: 'age', label: '年齡', unit: '', def: '45 歲以上', options: ['未滿 45 歲', '45 歲以上'] },
    ],
    button: '看我能領什麼 ›',
    run(v) {
      const okReg = v.reg === '有', young = v.age === '未滿 45 歲';
      const items = [
        { name: '養蜂事實申報（多數補助的入場券）', need: true, gap: okReg ? '' : '還沒申報——先辦這件',
          mode: '每年春季向蜂場所在地公所申報，受理期間看公告', docs: '身分證、蜂場位置與箱數資料' },
        { name: '蜂具資材補助（蜂箱/搖蜜機等）', need: okReg, gap: okReg ? '' : '要先完成養蜂事實申報',
          mode: '各縣市養蜂產業計畫不定期受理——向農會推廣部或縣府農業處問當年度有沒有開', docs: '申報證明、報價單' },
        { name: '國產蜂產品證明標章', need: okReg, gap: okReg ? '' : '要先完成養蜂事實申報',
          mode: '向台灣養蜂協會申請，蜜送驗合格就能掛標章——市場區隔和價格都會更好', docs: '蜜樣送驗、蜂場資料' },
        { name: '天然災害現金救助', need: true, gap: '',
          mode: '蜂群列入救助品項——公告後 10 日內向公所送件（有時限！）', docs: '災前災後照片、身分證、存摺' },
        { name: '農業保險保費補助', need: true, gap: '',
          mode: '投保時向農會或產險公司送件，補助直接從保費折抵', docs: '投保時由承辦單位處理' },
        { name: '青年農民專案輔導（百大青農/貸款免息）', need: young, gap: young ? '' : '限 18~45 歲',
          mode: '線上報名，每年約 12 月到隔年 1 月遴選', docs: '經營計畫書（線上填寫上傳）' },
      ];
      const ok = items.filter(x => x.need && !x.gap), near = items.filter(x => x.gap);
      const insTip = v.ins === '沒有' ? '另外你還沒有農保/農職保——不是每項補助都要它，但天災救助從寬認定、農民退休儲金和職災保障都跟它掛鉤，養蜂箱數達門檻就能到農會問加保資格，順路辦起來。'
        : '你有農保/農職保，相關的退休儲金與職災保障資格都在，安心。';
      return {
        headline: '你目前符合 ' + ok.length + ' 項' + (near.length ? '、差一步 ' + near.length + ' 項' : '') + '！',
        detail: '✅ 符合：' + ok.map(x => x.name + '——' + x.mode + '（備：' + x.docs + '）').join('｜')
          + (near.length ? '。🟡 差一步：' + near.map(x => x.name + '——' + x.gap).join('｜') : '')
          + '。💡 養蜂的補助大多以「養蜂事實申報」為前提，每年記得準時申報；天災救助關鍵是災前照片，颱風來前先去蜂場拍。' + insTip + '（連結 2026-07 實測可達；受理期間與金額以各單位最新公告為準）',
        links: [
          { label: '台灣養蜂協會（標章與蜂業資訊）', url: 'https://www.bee.org.tw' },
          { label: '天然災害救助專區（農糧署）', url: 'https://www.afa.gov.tw/cht/index.php?code=list&ids=636' },
          { label: '百大青農線上報名系統', url: 'https://100farmer.moa.gov.tw/' },
        ],
      };
    },
  },
  drone: {
    inputs: [
      { key: 'need', label: '你想做什麼', unit: '', def: '蜂場遠端監看', options: ['蜂場遠端監看', '忙不過來找幫手'] },
    ],
    button: '怎麼找服務 ›',
    run(v) {
      if (v.need === '蜂場遠端監看') return {
        headline: '蜂場監看：先從「箱重」下手最有感！',
        detail: '① 挑一兩箱代表箱放電子秤（市面有蜂箱專用秤，平台秤改裝也行）——箱重天天增加＝流蜜進帳，一直掉＝空窗吃老本，要不要補餵一看就知道。② 加一支網路攝影機對著巢門，在家就能看出勤狀況、有沒有胡蜂騷擾。③ 預算有限就用土法：每週提箱手感估重＋巢門觀察 5 分鐘，一樣能掌握八成狀況。',
      };
      return {
        headline: '找幫手：從蜂友圈和產銷班問起最快！',
        detail: '① 加入在地養蜂產銷班或養蜂協會——轉場、採蜜互相支援是蜂友圈的常態。② 採蜜期的臨時人力（搬繼箱、割蜜蓋、搖蜜）先問蜂友和農會推廣部，有經驗的人一天抵兩個生手。③ 要長期代管的話分工談清楚：治蟎、補餵、採蜜誰負責、蜜怎麼分，白紙黑字最好。',
        links: [{ label: '台灣養蜂協會', url: 'https://www.bee.org.tw' }],
      };
    },
  },
  export: {
    inputs: [
      { key: 'dest', label: '想外銷去哪', unit: '', def: '日本', options: ['日本', '香港/澳門', '新加坡/馬來西亞'] },
    ],
    button: '要準備什麼 ›',
    run(v) {
      const common = '蜂蜜外銷共同必備：① 品質與殘留檢驗報告（含水率、農藥與動物用藥殘留——抗生素殘留是蜂蜜外銷最常見的卡關點，用藥期間的蜜千萬別混進出口批）② 輸出證明文件（依目的地要求，向防檢署與貿易商確認）③ 包裝標示（品名/淨重/產地/生產者，「蜂蜜」品名標示要符合當地規定）④ 報關文件（多半交給報關行處理）';
      const extra = {
        '日本': '日本另需：殘留標準全球數一數二嚴，抗生素幾乎零容忍；標示與品名規範也細，務必透過有輸日經驗的貿易商走。',
        '香港/澳門': '港澳門檻相對低：通路商多半仍要驗殘留與含水率，有國產蜂產品標章與檢驗報告會好談很多。',
        '新加坡/馬來西亞': '星馬：新加坡查驗嚴格；馬來西亞清真市場對認證與標示有額外要求，兩地都建議走有經驗的貿易商。',
      };
      return {
        headline: '外銷' + v.dest + '的蜂蜜文件清單開好了！',
        detail: common + '。' + extra[v.dest] + ' 建議路徑：第一次外銷先從養蜂協會或貿易商找有出口經驗的前輩合作，別自己單打。＊流程為 2026-07 整理概要，出貨前以防檢署與目的地最新規定為準。',
        links: [{ label: '動植物防疫檢疫署', url: 'https://www.aphia.gov.tw' }],
      };
    },
  },
  carbon: {
    inputs: [
      { key: 'fert', label: '白糖花粉餅用量', unit: 'kg/年', def: '900' },
      { key: 'power', label: '用電（搖蜜/濃縮/倉儲）', unit: '度/年', def: '400' },
      { key: 'km', label: '轉場與送貨里程', unit: 'km/年', def: '1000' },
      { key: 'out', label: '總蜜量', unit: 'kg', def: '1200' },
    ],
    button: '算碳足跡 ›',
    run(v) {
      const EF = { feed: 0.6, power: 0.494, km: 0.25 };
      const feedCo = (+v.fert || 0) * EF.feed, powerCo = (+v.power || 0) * EF.power, kmCo = (+v.km || 0) * EF.km;
      const total = feedCo + powerCo + kmCo;
      const per = total / Math.max(1, +v.out || 1);
      return {
        headline: '這一年碳足跡約 ' + Math.round(total).toLocaleString() + ' kgCO2e，每公斤蜂蜜約 ' + per.toFixed(2) + ' kg！',
        detail: '組成：糖與花粉餅 ' + Math.round(feedCo) + '（係數 0.6/kg 概算）＋用電 ' + Math.round(powerCo)
          + '（0.494/度）＋轉場運輸 ' + Math.round(kmCo) + '（0.25/km）kgCO2e。減碳最有感的順序：蜜源顧好少餵糖 → 轉場送貨併車併趟 → 搖蜜濃縮設備汰舊省電。順帶一提：蜜蜂幫周邊果樹授粉，本身就是環境加分項，跟客人說故事別忘了這點。＊為概算係數（2026-07 整理），正式碳盤查請依環境部/農業部公告方法學。',
      };
    },
  },
  learn: {
    inputs: [
      { key: 'topic', label: '想學什麼', unit: '', def: '養蜂入門與蜂群管理', options: ['養蜂入門與蜂群管理', '蜂病防治', '蜂蜜品質與加工', '行銷與品牌'] },
    ],
    button: '推薦資源 ›',
    run(v) {
      const lib = {
        '養蜂入門與蜂群管理': '① 農民學院（academy.moa.gov.tw）搜「養蜂」——有入門到進階的訓練班，很搶手，開放報名手腳要快。② 苗栗區農業改良場是全國蜜蜂研究重鎮，官網有蜂業技術資料、不定期辦講習。③ 加入在地養蜂產銷班，跟著資深蜂友實作學最快。',
        '蜂病防治': '① 苗栗區農業改良場有蜂病相關技術資料與諮詢管道。② 疑似美洲幼蟲病（封蓋子穿孔、挑開拉絲有臭味）不要自己處理——立刻通報所在地動物防疫機關。③ 治蟎時機與資材先問改良場或產銷班，用核准品項並遵守停藥期。',
        '蜂蜜品質與加工': '① 認識蜂蜜國家標準（含水率、純度指標）——分級賣價的依據。② 國產蜂產品證明標章向台灣養蜂協會申請，送驗合格掛標章。③ 農民學院有農產加工相關課程，想做蜂蜜加工品先上課再投資設備。',
        '行銷與品牌': '① 農民學院「農產品行銷」入門到進階課程。② 各縣市青農聯誼會常辦電商實戰工作坊——加入在地青農 LINE 群。③ 蜂蜜的品牌故事好講：蜜源、授粉生態、結晶知識，都是跟客人互動的好素材。',
      };
      return {
        headline: '「' + v.topic + '」的資源清單來了！',
        detail: lib[v.topic] + ' 建議路徑：先上農民學院線上課打底 → 報改良場或協會的實體講習 → 加入在地產銷班跟同行交流。（2026-07 整理）',
        links: [
          { label: '農民學院（線上課程）', url: 'https://academy.moa.gov.tw' },
          { label: '苗栗區農業改良場（蜜蜂研究）', url: 'https://www.mdares.gov.tw' },
          { label: '台灣養蜂協會', url: 'https://www.bee.org.tw' },
        ],
      };
    },
  },
  insure: {
    inputs: [
      { key: 'fear', label: '你最怕什麼', unit: '', def: '流蜜期一直下雨', options: ['流蜜期一直下雨', '蜂群垮群歉收', '颱風豪雨損失'] },
    ],
    button: '該保什麼 ›',
    run(v) {
      const map = {
        '流蜜期一直下雨': { pick: '蜂蜜保險（看降雨數據理賠）', why: '流蜜期下雨蜜蜂不出勤、花蜜被沖淡，正是蜂蜜歉收的頭號原因——這種保單依氣象數據理賠，不用逐箱勘損', how: '向農會或承辦產險公司投保，保費有政府補助；開放投保的地區與期間逐年調整，投保窗口通常在流蜜期前，現在就去農會問' },
        '蜂群垮群歉收': { pick: '先靠管理防、再用救助補——垮群目前沒有專門保單', why: '垮群主因是蟹蟎和空窗餓群，保險保不到管理面；治蟎和補餵做確實，比什麼保單都有效', how: '同時把「作業日誌」記好——蜂群列入天然災害救助品項，災損申請和佐證都用得上' },
        '颱風豪雨損失': { pick: '天然災害現金救助＋蜂蜜保險雙軌', why: '颱風掀箱、淹水的直接損失走現金救助；整季蜜量減產走保險，兩邊互補', how: '救助公告後 10 日內向公所送件，災前災後照片是關鍵；保險部分向農會問目前開放的投保方案' },
      };
      const m = map[v.fear];
      return {
        headline: '怕「' + v.fear + '」→ 建議：' + m.pick + '！',
        detail: '為什麼：' + m.why + '。怎麼做：' + m.how + '。＊保險開放品項與地區每年調整，以主管機關與保險公司公告為準（2026-07 整理）。',
        links: [
          { label: '農產業保險專區（農糧署）', url: 'https://www.afa.gov.tw/cht/index.php?code=list&ids=277' },
          { label: '農業金融署・推動農業保險', url: 'https://www.afna.gov.tw/view.php?theme=web_structure&id=208' },
        ],
      };
    },
  },
  proc: {
    inputs: [
      { key: 'stock', label: '目前蜜庫存', unit: 'kg', def: '300' },
      { key: 'price', label: '散裝收購行情', unit: '元/kg', def: '250' },
    ],
    button: '散裝還是瓶裝？›',
    run(v) {
      const s = +v.stock || 0, p = +v.price || 0;
      const c = NZD.S.get('cost');
      const be = c && c.breakeven_price ? c.breakeven_price : null;
      let head, det;
      if (be && p < be) {
        head = '散裝價 ' + p + ' 元低於你的損平價 ' + be + ' 元——別整批賣給收購商！';
        det = '建議：好蜜留著走瓶裝零售（蜂蜜耐放不怕壓貨），只出清品質普通的部分換現金。';
      } else if (s > 600) {
        head = '庫存 ' + s + ' 公斤偏多——雙軌走：好蜜瓶裝慢慢賣、其餘散裝出。';
        det = '瓶裝零售價通常是散裝的 1.5~2 倍，但要自己賣；先估你一年零售賣得掉多少，多出來的散裝出給收購商。';
      } else {
        head = '庫存 ' + s + ' 公斤不算壓力——優先走瓶裝零售，賺該賺的價差。';
        det = '蜂蜜跟蔬果最大的不同是「不會壞」——含水率達標又密封好，常溫可放兩年，不用賤賣。';
      }
      return {
        headline: head,
        detail: det + ' 加值方向：結晶蜜別急著加溫化開，直接做「結晶蜜/生蜜」產品反而有特色；想做蜂蜜醋、蜂蜜蛋糕等加工品，先算代工費＋包材會不會吃掉價差，小量試賣再放大。源頭也要顧：封蓋七成再搖，含水率夠低瓶裝才耐放。',
      };
    },
  },
  copywrite: _mkCopywrite({
    emoji: '🍯', noun: '台灣蜂蜜', unit: '瓶', unitNote: '700g 玻璃瓶裝', defPrice: 600,
    defSell: '今年新蜜開搖',
    fresh: '當季採收、封蓋熟成才搖蜜',
    story: ['蜂群跟著花期走，採什麼花就是什麼味，', '每一罐都是蜂場當季的真實風土。'],
    safe: '單一蜂場來源透明，不混充、不加工調和',
    ship: '常溫出貨、玻璃罐加強防撞', keep: '常溫保存即可，結晶為天然現象',
    notice: ['蜂蜜放久會結晶是純蜜的正常現象，隔水溫水就化開',
             '天然蜜每批花源不同，色澤香氣略有差異'],
    tags: ['台灣蜂蜜', '小農直送', '蜂場日常', '純蜂蜜'],
    sells: {
      '今年新蜜開搖': [
        { head: '🍯 今年新蜜開搖了！封蓋熟成才搖，濃、香、稠，一年就等這一波！',
          sub: '搖蜜、過濾、裝瓶一手包，鮮度直接封進瓶子裡。' },
        { head: '🍯 等了一整年——新蜜開搖，第一波最搶手！',
          sub: '封蓋七成以上才搖，濃稠度和香氣都是熟成的味道。' },
      ],
      '龍眼蜜': [
        { head: '🍯 龍眼花開的味道直接裝進瓶子裡——琥珀色龍眼蜜，香氣就是經典！',
          sub: '台灣人最熟悉的那一味，泡水、入菜、直接挖都對。' },
        { head: '🍯 琥珀色的龍眼蜜上架——香氣厚、尾韻甜，就是記憶中的味道。',
          sub: '龍眼花季一年一次，錯過再等明年。' },
      ],
      '荔枝蜜': [
        { head: '🍯 荔枝蜜帶著淡淡果酸花香，泡水不搶味，喝過就回不去！',
          sub: '清爽系的蜜，冰水氣泡水都百搭。' },
        { head: '🍯 喜歡清爽路線的看過來——荔枝蜜的果香花香剛剛好。',
          sub: '甜而不膩，夏天冰飲的最佳拍檔。' },
      ],
      '蜂場直送': [
        { head: '🐝 自家蜂場自己顧，搖蜜、過濾、裝瓶一手包，產地直送不轉手！',
          sub: '從蜂箱到你家餐桌，只有一段路。' },
        { head: '🐝 蜂場直出、當季現搖——中間沒有別人，價格和品質都實在。',
          sub: '你買的每一瓶，都養活一箱蜜蜂和一個蜂農。' },
      ],
    },
  }),
  buyer: {
    inputs: [
      { key: 'ch', label: '想走的通路', unit: '', def: '自有品牌零售（市集/團購）', options: ['蜂蜜收購商/大盤', '農會與展售活動', '自有品牌零售（市集/團購）', '電商平台', '飲料烘焙店直供'] },
    ],
    button: '怎麼接洽？›',
    run(v) {
      const guide = {
        '蜂蜜收購商/大盤': ['從養蜂協會、產銷班問在地收購商名單，多問兩三家比價', '好處：整批出清最省事，採蜜季結束現金就入袋', '眉角：含水率和純度決定收購價——封蓋七成再搖，價才談得上去；低於自己損平價寧可不出'],
        '農會與展售活動': ['向所在地農會推廣部登記，留意農特產展售與評鑑活動', '好處：得獎或評鑑入選就是最好的廣告，價格直接上一階', '眉角：送評的蜜先自己驗過含水率，拿最好的一批去'],
        '自有品牌零售（市集/團購）': ['加入在地市集與社區團購群，先發「行銷文案生成」做的貼文', '收單→裝瓶→面交或宅配，貨到收現金最單純', '眉角：固定開團節奏養回購客；結晶知識先教育，客訴少一半'],
        '電商平台': ['蝦皮/農產電商開店，用「行銷文案生成」的商品文', '玻璃瓶要包好緩衝材，夏天出貨避開整天曝曬的物流時段', '眉角：運費和抽成是獲利殺手——兩瓶免運門檻設好，別把利潤算漏'],
        '飲料烘焙店直供': ['列出附近手搖飲、甜點烘焙店——用蜜量大的店', '帶樣品直接拜訪，附檢驗報告與價目表，談固定月供量', '眉角：穩定供應比低價重要，寧可少接幾家也別斷貨'],
      };
      const g = guide[v.ch] || guide['自有品牌零售（市集/團購）'];
      return { headline: '走「' + v.ch + '」的三步驟：', detail: '① ' + g[0] + '。② ' + g[1] + '。③ ' + g[2] + '。搭配：先用「定價策略建議」算這個通路該賣多少，再去談。' };
    },
  },
  trace: {
    inputs: [],
    button: '生成履歷卡 ›',
    run() {
      const p = NZD.S.get('profile') || {};
      const season = NZD.S.get('season');
      const logs = NZD.S.get('logs', []);
      const meds = logs.filter(x => x.cat === '噴藥').slice(0, 5);
      const feeds = logs.filter(x => x.cat === '施肥').slice(0, 5);
      const g = NZD.S.get('grades');
      const lines = [
        '🍯 蜂蜜產品履歷卡',
        '品名：台灣蜂蜜（自家蜂場採蜜）',
        '生產者：' + (p.farm_name || '（到 ⚙️ 我的農場填名稱）'),
        season ? '春繁啟動：' + (season.sow_date || season.transplant_date || '—') + '｜採蜜：' + (season.harvest_start || '—') + ' 起' : '年度時程：（到「春繁啟動時機」排整年蜂事後自動帶入）',
        g && g.water ? '含水率：約 ' + g.water + '%（' + (g.date || '') + ' 檢測）' : '',
        meds.length ? '用藥（治蟎）紀錄：' + meds.map(x => x.date.slice(5) + ' ' + x.txt).join('；') : '用藥紀錄：本年無用藥紀錄',
        feeds.length ? '飼餵紀錄：' + feeds.map(x => x.date.slice(5) + ' ' + x.txt).join('；') + '（流蜜採收期不餵糖）' : '',
        '＊純蜂蜜放久會自然結晶，隔水加溫（不超過 40 度）即化開',
        '（資料來自小農工具箱作業日誌，' + new Date().toISOString().slice(0, 10) + ' 產出）',
      ].filter(Boolean);
      return { headline: '履歷卡生成了——複製貼到出貨單、貼文或印出來附瓶！', detail: lines.join('\n') };
    },
  },
  pnl: {
    inputs: [
      { key: 'soldKg', label: '實際售出蜜量', unit: 'kg', def: '1200' },
      { key: 'avgPrice', label: '平均售價', unit: '元/kg', def: '400' },
    ],
    button: '結算 ›',
    run(v) {
      const cost = NZD.S.get('cost');
      if (!cost) return { headline: '先去「成本試算」存一份計畫，我才有成本可以對！', detail: '成本試算會存年度總成本與損平價，年底回來這裡輸入實際賣量和均價就能結算。' };
      const kg = +v.soldKg || 0, p = +v.avgPrice || 0;
      const rev = kg * p, profit = rev - cost.total_cost;
      const margin = rev > 0 ? (profit / rev * 100).toFixed(1) : 0;
      const fmt = n => Math.round(n).toLocaleString();
      const vsPlan = cost.expected_qty ? '（計畫蜜量 ' + cost.expected_qty.toLocaleString() + ' kg，實售達成 ' + Math.round(kg / cost.expected_qty * 100) + '%）' : '';
      const it = cost.items || {};
      const itemLine = it.bees != null ? ' 成本組成參考：蜂群蜂箱 ' + fmt(it.bees) + '／糖與飼料 ' + fmt(it.feed || 0) + '／人力 ' + fmt(it.labor || 0) + ' 元。' : '';
      return {
        headline: profit >= 0 ? '這一年賺 ' + fmt(profit) + ' 元！毛利率 ' + margin + '%。' : '這一年虧 ' + fmt(-profit) + ' 元（毛利率 ' + margin + '%）。',
        detail: '營收 ' + fmt(rev) + ' 元（' + kg.toLocaleString() + ' kg × ' + p + ' 元）− 總成本 ' + fmt(cost.total_cost) + ' 元。'
          + '實際均價 ' + p + ' vs 損平價 ' + cost.breakeven_price + ' 元/kg' + (p >= cost.breakeven_price ? '，有守住！' : '——低於損平，明年從「少餵糖多顧蜜源」和「散裝改瓶裝拉高均價」下手。')
          + vsPlan + itemLine,
      };
    },
  },
  harvest: {
    noPrepare: true, hideDyn: true,
    inputs: [
      { key: 'capped', label: '蜜脾封蓋比例', unit: '', def: '七成以上', options: ['七成以上', '五到七成', '五成以下'] },
      { key: 'water', label: '含水率（有折射計再填）', unit: '%', def: '' },
      { key: 'flow', label: '最近流蜜狀況', unit: '', def: '大流蜜（箱重天天增）', options: ['大流蜜（箱重天天增）', '普通', '快結束了'] },
    ],
    button: '判斷能不能搖 ›',
    async run(v) {
      const w = v.water === '' ? null : +v.water;
      let head, det;
      if (v.capped === '七成以上') { head = '封蓋七成以上——可以搖了！'; det = '蜜已熟成，挑好天氣的清晨作業（高溫 33 度以上更要趁早收工，別在熱天午後翻箱讓蜂群緊迫）。'; }
      else if (v.capped === '五到七成') { head = '再等幾天——封蓋還不到七成。'; det = '可以先只搖封蓋足的那幾張脾，其餘留著繼續熟成；寧可晚兩天，也別搖出水蜜。'; }
      else { head = '先別搖！封蓋不到五成，水分還太高。'; det = '太早搖的蜜含水高、容易發酵變酸，香氣保存都差，收購價也上不去。讓蜂群繼續搧風濃縮。'; }
      if (w != null) {
        if (w <= 17.5) det += ' 你量到含水率 ' + w + '%——上品等級，耐放又好賣！';
        else if (w <= 20) det += ' 含水率 ' + w + '%——符合國家標準上限（20%），可正常裝瓶出貨。';
        else det += ' ⚠️ 含水率 ' + w + '% 超過 20%——別直接裝瓶賣，先濃縮處理或短期內用完，避免發酵。';
      }
      if (v.flow === '快結束了') det += ' 流蜜快收尾：封蓋足的儘快收完，記得留足蜂群自己吃的存蜜，別搖到見底。';
      try {
        const d = await getWeather();
        for (let i = 0; i < 3; i++) {
          if (d.precipitation_sum[i] >= 30) {
            det += ' ⚠️ ' + (i === 0 ? '今天' : i === 1 ? '明天' : '後天') + '預報有雨（' + d.precipitation_sum[i] + 'mm）——雨天蜜蜂不出勤、花蜜也會被沖淡，封蓋足的趁雨前先搖。';
            break;
          }
        }
      } catch (e) {}
      return { headline: head, detail: det + ' 原則就一條：蜜脾封蓋約七成再搖，水分夠低才耐放不發酵。' };
    },
  },
  grade: {
    noPrepare: true,
    inputs: [
      { key: 'water', label: '含水率', unit: '%', def: '19' },
      { key: 'flavor', label: '香氣風味', unit: '', def: '蜜源香氣明顯', options: ['蜜源香氣明顯', '普通', '有發酵酸味或雜味'] },
      { key: 'kg', label: '這批重量', unit: 'kg', def: '100' },
    ],
    button: '幫我分級 ›',
    run(v) {
      const w = +v.water || 0, kg = +v.kg || 0;
      NZD.S.set('grades', { date: new Date().toISOString().slice(0, 10), kg, water: w });
      if (v.flavor === '有發酵酸味或雜味') return {
        headline: '這批有發酵酸味——先隔開，別混進好蜜！',
        detail: '發酵多半是含水率太高（搖太早）或保存吸濕造成。這批不要裝瓶零售；量大可問加工用途，量少自家用掉。下一批記得封蓋七成以上再搖、瓶蓋鎖緊放乾燥處。',
      };
      let lv, out;
      if (w <= 17.5 && v.flavor === '蜜源香氣明顯') { lv = '特級'; out = '走自有品牌瓶裝賣好價，值得送驗掛「國產蜂產品證明標章」，市場區隔和價格都會更好'; }
      else if (w <= 20) { lv = '合格級'; out = '符合國家標準（含水率 20% 以下），瓶裝零售或散裝出貨都行'; }
      else { lv = '未達標'; out = '含水率超過 20% 容易發酵——先濃縮處理再裝瓶，或短期內出清別久放'; }
      return {
        headline: '這批 ' + kg + ' 公斤判定：' + lv + '（含水率 ' + w + '%）。',
        detail: '建議出路：' + out + '。分級標準：含水率 17.5% 以下且香氣足＝特級；20% 以下＝合格；超過 20% 要處理。提醒：①治蟎等用藥期間採的蜜不要出貨，停藥期要過。②結晶不是瑕疵——純蜜放久會結晶，跟客人講清楚就好，要化開就隔水加溫、不超過 40 度。接著到「定價策略建議」算各級賣多少。',
        links: [{ label: '台灣養蜂協會（標章申請）', url: 'https://www.bee.org.tw' }],
      };
    },
  },
  store: {
    hideDyn: true,
    inputs: [
      { key: 'temp', label: '存放處溫度', unit: '°C', def: '22' },
      { key: 'rh', label: '存放處濕度', unit: '%', def: '55' },
      { key: 'months', label: '預計存放', unit: '個月', def: '12' },
    ],
    button: '檢查儲存條件 ›',
    run(v) {
      const t = +v.temp, rh = +v.rh, want = +v.months || 12;
      const S = NZD.A.storage;
      const issues = [];
      if (t < S.tempLo) issues.push('溫度偏低（' + t + '°C）——會加速結晶（不是壞掉，但零售賣相要先跟客人說明）；蜂蜜不用冰，常溫陰涼就好');
      if (t > S.tempHi) issues.push('溫度偏高（' + t + '°C）——久放香氣流失、顏色變深，避免曝曬與悶熱倉庫');
      if (rh > S.rhHi) issues.push('濕度過高（' + rh + '%）——蜂蜜會吸濕，含水率一升就有發酵風險；瓶蓋鎖緊、移到乾燥處');
      const g = NZD.S.get('grades');
      const wWarn = g && g.water > 20 ? ' ⚠️ 你上次分級的含水率 ' + g.water + '% 偏高——那批別久放，儘快處理或出清。' : '';
      return {
        headline: issues.length ? '條件要調：' + issues[0].split('——')[0] + '！' : '條件不錯，密封好放一兩年都沒問題！',
        detail: (issues.length ? '全部問題：' + issues.join('；') + '。' : '') + '理想條件：' + S.tempLo + '~' + S.tempHi + '°C、濕度 ' + S.rhLo + '~' + S.rhHi + '%、避光密封。'
          + '含水率達標（20% 以下）又密封良好的蜂蜜，常溫放 ' + (want <= 24 ? want + ' 個月沒問題' : '超過兩年要注意風味變化，建議分批標示出貨') + '。'
          + wWarn + ' 結晶處理：隔水加溫不超過 40 度就化開，高溫久煮香氣會跑掉。',
      };
    },
  },
  labor: {
    hideDyn: true,
    inputs: [
      { key: 'total', label: '預計採蜜總量', unit: 'kg', def: '1200' },
      { key: 'perDay', label: '每人每天可處理', unit: 'kg', def: '80' },
      { key: 'people', label: '可用人數', unit: '人', def: '2' },
      { key: 'weeks', label: '採蜜期', unit: '週', def: '3' },
    ],
    button: '排排看 ›',
    run(v) {
      const total = +v.total || 0, per = +v.perDay || 80, ppl = +v.people || 1, weeks = Math.max(1, +v.weeks || 3);
      const manDays = Math.ceil(total / per);
      const perWeek = Math.ceil(manDays / weeks);
      const havePerWeek = ppl * 6;
      const peak = NZD.A.laborPeak;
      const bench = perWeek < peak.lo ? '低於採蜜高峰常態（' + peak.lo + '~' + peak.hi + ' 人天/週），輕鬆' :
        perWeek <= peak.hi ? '落在採蜜高峰常態區間（' + peak.lo + '~' + peak.hi + ' 人天/週）' : '超過採蜜高峰常態（' + peak.lo + '~' + peak.hi + ' 人天/週）——很趕';
      const gap = perWeek - havePerWeek;
      return {
        headline: gap <= 0 ? '人力夠！每週需 ' + perWeek + ' 人天，你們 ' + ppl + ' 人做得完。'
          : '缺工！每週需 ' + perWeek + ' 人天，你們只有 ' + havePerWeek + ' 人天——差 ' + gap + '。',
        detail: '總量 ' + total.toLocaleString() + ' kg ÷ 每人每天搬箱、割蓋、搖蜜約 ' + per + ' kg ＝ 約 ' + manDays + ' 人天，分 ' + weeks + ' 週＝每週 ' + perWeek + ' 人天。'
          + bench + '。' + (gap > 0 ? '對策：找蜂友或臨時工支援 ' + Math.ceil(gap / 6) + ' 人、分兩梯搖（先搖封蓋足的箱）、或拉長採蜜週數。' : '大流蜜那幾天優先配滿人，過濾裝瓶排次高；搖蜜是體力活，連續作業記得輪休。')
          + ' 提醒：搖蜜集中在流蜜那兩三週，人手要提前約，臨時找不到人。',
      };
    },
  },
  fert: {
    noPrepare: true,
    inputs: [
      { key: 'tdate', label: '春繁啟動日（開始獎勵餵的那天）', unit: '', def: '', type: 'date' },
    ],
    button: '排蜂群管理 ›',
    run(v) {
      let base = v.tdate;
      if (!base) {
        const season = NZD.S.get('season');
        if (season && (season.sow_date || season.transplant_date)) base = season.sow_date || season.transplant_date;
      }
      if (!base) return { headline: '先告訴我春繁啟動日，我才能算你現在走到哪一期！', detail: '春繁啟動日就是入春開始獎勵飼餵那天，抓大概也行；或先到「春繁啟動時機」把整年蜂事排出來，我就能直接讀到。' };
      const days = Math.floor((Date.now() - new Date(base)) / 864e5);
      if (days < 0) return { headline: '還沒開始（還有 ' + (-days) + ' 天），先把資材備齊！', detail: '先備妥：白糖（配 1:1 糖水）、花粉餅、巢框巢礎與繼箱；順手檢查蜂群過冬後的群勢，弱群先合併，開春才衝得起來。' };
      const g = NZD.A.growthPhases;
      let idx = g.findIndex(x => days >= x.lo && days < x.hi);
      if (idx < 0) idx = g.length - 1;
      const ph = g[idx];
      const plan = NZD.A.fertPlans[['seedling', 'flower', 'fruit'][idx]];
      const next = idx < g.length - 1 ? '約第 ' + g[idx + 1].lo + ' 天進「' + g[idx + 1].name + '」。' : '過完冬就是新一年的春繁，回「春繁啟動時機」重排。';
      return {
        headline: '你現在第 ' + days + ' 天，正值「' + ph.name + '」！',
        detail: '本期重點：' + plan + '\n下一步：' + next + ' 做完記得到「作業日誌」記一筆。',
      };
    },
  },
  pest: {
    inputs: [
      { key: 'part', label: '看到什麼異狀', unit: '', def: '工蜂翅膀捲曲畸形、封蓋子有針孔，蜂體上看得到褐色小圓點在爬',
        options: ['工蜂翅膀捲曲畸形、封蓋子有針孔，蜂體上看得到褐色小圓點在爬', '巢脾被蛀出隧道、掛著白色絲網和蟲糞，弱群整片脾被吃掉', '秋季蜂箱門口有大型胡蜂盤旋獵殺工蜂，工蜂嚇得不敢出勤', '封蓋子零星下陷穿孔、挑開有咖啡色黏稠物會拉絲、有腐臭味', '巢門口出現白色或灰黑色石灰塊狀的幼蟲乾屍', '大量工蜂在箱門前抽搐打轉死亡、屍體伸吻吐舌'] },
      { key: 'sev', label: '嚴重程度', unit: '', def: '輕微（少數幾箱）', options: ['輕微（少數幾箱）', '中等（好幾箱）', '嚴重（整場蔓延）'] },
    ],
    button: '幫我判斷 ›',
    run(v) {
      const T = NZD.A.pestTable || [];
      const t = T.find(x => x.symptom === v.part) || T[0];
      const sev = v.sev.startsWith('嚴重') ? 2 : v.sev.startsWith('中') ? 1 : 0;
      const rec = NZD.S.get('pest', []);
      rec.unshift({ date: new Date().toISOString().slice(0, 10), part: v.part, sev, soilborne: false });
      NZD.S.set('pest', rec.slice(0, 100));
      if (!t) return { headline: '先選一個最接近的異狀，我才能幫你判斷！', detail: '找不到接近的，直接拍照請教在地養蜂產銷班或苗栗區農業改良場。' };
      if (/法定/.test(t.act) || t.name === '美洲幼蟲病') {
        return {
          headline: '疑似「' + t.name + '」——這是法定傳染病，立刻通報！',
          detail: '不要自己處理、不要用藥壓：' + t.act + '\n同時做：①病箱病脾原地封存，不移到別群別場。②蜂具工具先別共用。③通報蜂場所在地動物防疫機關或防檢署，由獸醫與防疫人員判定處置。愈早通報，全場保住的機會愈大。',
          links: [{ label: '動植物防疫檢疫署', url: 'https://www.aphia.gov.tw' }],
        };
      }
      const sevAdd = sev === 2 ? '已經整場蔓延——建議儘快請苗栗區農業改良場或在地資深蜂友到場看，不要拖。'
        : sev === 1 ? '好幾箱有狀況還壓得住，這 3 天每天巡箱、擴大就升級處理。' : '早期發現處理最省錢，做完先觀察 3~5 天。';
      return {
        headline: '比較可能是：' + t.name + '。',
        detail: '先做這件事：' + t.act + '。' + sevAdd + ' 用藥提醒：治蟎等資材要用核准品項並遵守停藥期，用藥期間採的蜜不要出貨。',
      };
    },
  },
  chain: {
    noPrepare: true,
    inputs: [
      { key: 'mite', label: '秋季治蟎有沒有做', unit: '', def: '每年都有做', options: ['每年都有做', '有時有有時沒有', '沒有或不確定'] },
      { key: 'weak', label: '最近蜂群狀況', unit: '', def: '群勢正常', options: ['群勢正常', '部分箱偏弱', '常無故垮群或逃群'] },
      { key: 'history', label: '一年內病史', unit: '', def: '沒有', options: ['沒有', '有過巢蟲或白堊病', '有過疑似幼蟲病'] },
    ],
    button: '評估風險 ›',
    run(v) {
      let score = 0;
      if (v.mite === '沒有或不確定') score += 2; else if (v.mite === '有時有有時沒有') score += 1;
      if (v.weak === '常無故垮群或逃群') score += 2; else if (v.weak === '部分箱偏弱') score += 1;
      if (v.history === '有過疑似幼蟲病') score += 3; else if (v.history === '有過巢蟲或白堊病') score += 1;
      const mite = '蟹蟎是蜂群入冬垮群的頭號原因——秋季斷子期用核准蟎劑確實處理，平時抽公蜂蛹檢查蟎數。';
      let head, det;
      if (score >= 3) {
        head = '🔴 高風險！照這樣下去很可能越養越弱、入冬垮群。';
        det = '最優先：' + mite + '再來：弱群及早合併留強汰弱、淘汰老黑巢脾、換產卵力強的新王。'
          + (v.history === '有過疑似幼蟲病' ? ' ⚠️ 有幼蟲病史：病箱病脾絕對不流用到其他蜂群；再看到封蓋子穿孔、挑開拉絲有臭味，立刻通報動物防疫機關。' : '');
      } else if (score >= 1) {
        head = '🟡 中風險——趁現在把漏掉的補起來。';
        det = mite + '加上：無故偏弱的箱先查蟎數和存蜜，空窗期別餓到；巢蟲靠維持強群和汰換老脾就能壓住。';
      } else {
        head = '🟢 低風險，蜂群健康管理有做到位！';
        det = '維持節奏：秋季治蟎年年做、汰老脾、弱群合併；巡箱時多看封蓋子面積和蜂王產卵狀況——群勢是一切的本錢。';
      }
      return { headline: head, detail: det + ' 判定門檻：治蟎沒做、垮群、病史越多分數越高，3 分以上算高風險。' };
    },
  },
  water: {
    noPrepare: true, hideDyn: true,
    inputs: [
      { key: 'trend', label: '最近箱重/存蜜變化', unit: '', def: '持平', options: ['增加（有蜜源進帳）', '持平', '一直減少（吃老本）'] },
      { key: 'inside', label: '開箱看到的狀況', unit: '', def: '有蟲有卵群勢穩', options: ['有蟲有卵群勢穩', '子圈縮小', '存蜜見底'] },
    ],
    button: '要不要補餵 ›',
    async run(v) {
      let head, act;
      if (v.inside === '存蜜見底') { head = '要緊急補餵！存蜜見底再拖會餓死蜂。'; act = '先餵濃糖水（糖:水約 2:1）救急，之後改 1:1 維持；同時查是不是被胡蜂或盜蜂騷擾到不敢出勤。'; }
      else if (v.trend === '一直減少（吃老本）' || v.inside === '子圈縮小') { head = '進入蜜源空窗了——開始補餵維持群勢！'; act = '餵 1:1 糖水、花粉不足補花粉餅，餵到箱重止跌為止；空窗期把群勢顧住，下一波蜜源才接得上。'; }
      else if (v.trend === '增加（有蜜源進帳）') { head = '有蜜源進帳，不用餵！'; act = '流蜜期間餵糖反而混進蜜裡壞了純度——停止餵糖，專心加繼箱擴大貯蜜空間。'; }
      else { head = '暫時不用餵，但盯緊箱重變化。'; act = '持平代表進出打平；一旦連幾天下滑就開始補餵。'; }
      let wx = '';
      try {
        const d = await getWeather();
        const rain3 = d.precipitation_sum.slice(0, 3).reduce((a, b) => a + b, 0);
        const tmax = d.temperature_2m_max[0];
        if (rain3 >= 50) wx = ' 未來 3 天累積雨量約 ' + Math.round(rain3) + 'mm——連日雨蜜蜂出不了門，等於強制空窗，糖水提前備好。';
        if (tmax >= 33) wx += ' 今天高溫 ' + tmax + '°C——蜂場記得供水（淺盤放浮木讓蜂安全採水），蜂群散熱要喝很多水。';
      } catch (e) {}
      return { headline: head, detail: act + wx + ' 原則：空窗餵 1:1 保群、救急餵 2:1、流蜜停餵保純度。' };
    },
  },
  readings: {
    inputs: [
      { key: 'temp', label: '蜂場氣溫', unit: '°C', def: '30' },
      { key: 'rh', label: '環境濕度', unit: '%', def: '65' },
      { key: 'wchg', label: '蜂箱一週重量變化（有秤再填）', unit: 'kg', def: '' },
    ],
    button: '幫我判讀 ›',
    run(v) {
      const t = +v.temp, rh = +v.rh, w = v.wchg === '' ? null : +v.wchg;
      const T = NZD.A.sowTemp, H = NZD.A.soilMoist;
      const issues = [], tips = [];
      if (t >= T.hardHi) { issues.push('高溫（' + t + '°C）'); tips.push('蜂群忙著散熱幾乎停擺——加強遮蔭、供水，開箱作業改清晨'); }
      else if (t >= 33) { issues.push('偏熱（' + t + '°C）'); tips.push('翻箱作業改清晨，蜂場供水別斷'); }
      else if (t <= T.okLo) { issues.push('低溫（' + t + '°C）'); tips.push('出勤明顯減少，非必要別開箱（冷天開箱傷子脾）；入冬前縮巢保溫'); }
      if (rh > H.hi) { issues.push('太潮濕（' + rh + '%）'); tips.push('蜂箱墊高、加強通風——潮濕悶熱白堊病壓力大'); }
      else if (rh < H.lo) { issues.push('偏乾燥（' + rh + '%）'); tips.push('確保蜂場供水點有水'); }
      let wLine = '';
      if (w != null) {
        if (w >= 2) wLine = '箱重一週 +' + w + ' 公斤＝流蜜進帳中，繼箱空間要跟上。';
        else if (w <= -1) { issues.push('箱重下滑（' + w + ' 公斤/週）'); tips.push('蜜源空窗吃老本——到「飼餵補水排程」看要不要補餵'); }
        else wLine = '箱重大致持平，進出打平。';
      }
      const rec = NZD.S.get('readings', []);
      rec.unshift({ date: new Date().toISOString(), temp: t, rh: rh, wchg: w });
      NZD.S.set('readings', rec.slice(0, 60));
      if (!issues.length) return { headline: '數值都在安全範圍，蜂場狀況不錯！', detail: '氣溫 ' + t + '°C（出勤舒適區約 ' + T.idealLo + '~' + T.idealHi + '°C）、濕度 ' + rh + '%（參考區間 ' + H.lo + '~' + H.hi + '%）。' + wLine + ' 已記錄，累積起來就能看趨勢。' };
      return { headline: '注意：' + issues.join('、') + '！', detail: '建議動作：' + tips.join('；') + '。' + wLine + ' 已記錄這筆讀值（近 60 筆保留在手機）。' };
    },
  },
  warn: {
    inputs: [],
    button: '檢查未來 16 天 ›',
    async run() {
      const d = await NZD.D.weather(CROP.county);
      const hits = [];
      for (let i = 0; i < d.time.length; i++) {
        const day = d.time[i].slice(5).replace('-', '/');
        if (d.temperature_2m_max[i] >= 35) hits.push(day + ' 高溫 ' + d.temperature_2m_max[i] + '°C：蜂群忙於散熱、採集力大降——遮蔭、供水、加強通風');
        if (d.temperature_2m_min[i] <= 10) hits.push(day + ' 低溫 ' + d.temperature_2m_min[i] + '°C：蜂群結團——別開箱、縮巢保溫、確認存蜜夠');
        if (d.precipitation_sum[i] >= 80) hits.push(day + ' 暴雨 ' + d.precipitation_sum[i] + 'mm：出勤停擺、低窪蜂場恐積水——箱體墊高或先移高處');
        const gust = (d.wind_gusts_10m_max || d.wind_speed_10m_max)[i];
        if (gust >= NZD.C.alert.windKmh) hits.push(day + ' 強陣風 ' + Math.round(gust) + 'km/h：蜂箱恐被掀翻——上蓋壓重物、綁帶固定、災前拍照存證（申請救助要用）');
      }
      const season = NZD.S.get('season');
      const base = season ? (season.sow_date || season.transplant_date) : null;
      const ph = base ? NZD.phase(base) : null;
      const phNote = ph && ph.days >= 0 ? '你的蜂場正值' + ph.name + '（第 ' + ph.days + ' 天）。' : '';
      if (!hits.length) {
        return {
          headline: CROP.county + '未來 16 天沒有達到警戒的壞天氣，安心顧蜂！',
          detail: '每天都低於警戒門檻（高溫≥35°C、低溫≤10°C、暴雨≥80mm/日、強陣風）。7 日概況：高溫 '
            + Math.max(...d.temperature_2m_max).toFixed(1) + '°C、低溫 ' + Math.min(...d.temperature_2m_min).toFixed(1)
            + '°C、單日最大雨量 ' + Math.max(...d.precipitation_sum).toFixed(1) + 'mm。' + phNote + '流蜜期最怕連日下雨，建議每天早上再點一次確認。',
        };
      }
      return {
        headline: '注意！未來 16 天有 ' + hits.length + ' 個警戒訊號，先做防範！',
        detail: phNote + hits.join('｜') + '（門檻與對策依養蜂防災原則，預報來源 open-meteo，每天早上建議重新檢查）',
      };
    },
  },
  price: {
    noPrepare: true,
    inputs: [
      { key: 'grade', label: '這批的等級', unit: '', def: '特級（含水率低、香氣足）', options: ['特級（含水率低、香氣足）', '合格級（符合國家標準）', '一般散裝'] },
      { key: 'channel', label: '要走的通路', unit: '', def: '自有品牌零售（市集/宅配）', options: ['自有品牌零售（市集/宅配）', '電商平台', '散裝賣收購商'] },
    ],
    button: '算建議售價 ›',
    run(v) {
      const c = NZD.S.get('cost');
      const q = v.grade.startsWith('特級') ? 1.2 : v.grade.startsWith('合格') ? 1.0 : 0.8;
      const ch = v.channel.startsWith('散裝') ? 1.2 : v.channel.startsWith('電商') ? 1.9 : 2.0;
      if (!c || !c.breakeven_price) return {
        headline: '先去「成本試算」算出你的損平價，定價才有底！',
        detail: '蜂蜜沒有每天的公開批發行情，定價最穩的基準是自己的成本：先算出損平價（一公斤賣多少才不賠），散裝至少加二成、零售抓損平價的 1.8~2 倍起跳。豐年歉年價差很大——與其看別人開價，不如先算自己的成本。',
      };
      const be = c.breakeven_price;
      const p = be * q * ch;
      const lo = Math.round(p * 0.95), hi = Math.round(p * 1.05);
      const bottleLo = Math.round(lo * 0.7), bottleHi = Math.round(hi * 0.7);
      return {
        headline: '這批建議賣 ' + lo + '～' + hi + ' 元/公斤（700g 瓶裝約 ' + bottleLo + '～' + bottleHi + ' 元/瓶）！',
        detail: '算法：你的損平價 ' + be + ' 元/公斤 × 等級係數 ' + q + ' × 通路係數 ' + ch + '（散裝薄利走量、零售賺價差但要自己賣）＝ ' + Math.round(p) + ' 元，上下 5% 為議價空間。'
          + (v.channel.startsWith('散裝') ? ' 散裝提醒：收購價低於損平價寧可不出——蜂蜜耐放，留著瓶裝慢慢賣。' : ' 零售提醒：有掛國產蜂產品標章或附檢驗報告，這個價就站得住；結晶要先教育客人，別用降價處理。')
          + ' 走電商再留 15~20% 給抽成和運費，別把利潤算漏。',
      };
    },
  },
  yield: {
    noPrepare: true, hideDyn: true,
    inputs: [
      { key: 'boxes', label: '蜂箱數', unit: '箱', def: '60' },
      { key: 'perBox', label: '每箱預估年產蜜', unit: 'kg', def: '20' },
      { key: 'weather', label: '流蜜期天氣', unit: '', def: '普通', options: ['好（流蜜期少雨）', '普通', '差（流蜜期連日雨）'] },
    ],
    run(v) {
      const n = +v.boxes || 0, per = +v.perBox || 20;
      const f = v.weather.startsWith('好') ? 1.15 : v.weather.startsWith('差') ? 0.5 : 1;
      const kg = Math.round(n * per * f);
      const level = f > 1 ? '豐年' : f < 1 ? '歉年' : '平年';
      NZD.S.set('yield', { saved_at: new Date().toISOString().slice(0, 10), total_kg: kg, boxes: n });
      const cost = NZD.S.get('cost');
      const cmp = cost && cost.expected_qty ? ' 對照成本試算用的 ' + cost.expected_qty.toLocaleString() + ' kg——'
        + (Math.abs(kg - cost.expected_qty) / cost.expected_qty > 0.15 ? '差距超過 15%，建議回成本試算更新蜜量、重算損平價。' : '兩邊差不多，一致。') : '';
      return {
        headline: '這一年預估總蜜量約 ' + kg.toLocaleString() + ' 公斤（' + level + '）！',
        detail: '公式：蜂箱數 × 每箱年產蜜 × 天氣係數 = ' + n + ' × ' + per + ' × ' + f + '。每箱常態約 15~25 公斤；天氣係數：流蜜期少雨 1.15、普通 1、連日雨 0.5——流蜜期下雨蜜蜂不出勤、花蜜被沖淡，正是蜜量豐歉的最大變數。已存檔，人力排班會拿去算需要幾個人。' + cmp,
      };
    },
  },
},
  '黑豬肉': {
  cost: {
    noPrepare: true,
    hideDyn: true,
    inputs: [
      { key: 'heads', label: '這批飼養頭數', unit: '頭', def: '100' },
      { key: 'pigletPrice', label: '仔豬單價', unit: '元/頭', def: '3000' },
      { key: 'buyW', label: '仔豬購入體重', unit: 'kg/頭', def: '20' },
      { key: 'outW', label: '預計出欄體重', unit: 'kg/頭', def: '120' },
      { key: 'fcr', label: '飼料換肉率（長 1 公斤要吃幾公斤料）', unit: '', def: '3.5' },
      { key: 'feedPrice', label: '飼料價格', unit: '元/kg', def: '13' },
      { key: 'otherPerHead', label: '其他開銷（藥品/水電/雜支）', unit: '元/頭', def: '2000' },
      { key: 'price', label: '預估拍賣價（活體）', unit: '元/kg', def: '110' },
    ],
    run(v) {
      const heads = +v.heads || 0, pigletP = +v.pigletPrice || 0, feedP = +v.feedPrice || 0;
      const buyW = +v.buyW || 20, outW = +v.outW || 120, fcr = +v.fcr || 3.5, other = +v.otherPerHead || 0;
      const price = +v.price || 110;
      const gain = Math.max(1, outW - buyW);
      const feedKgHead = gain * fcr;
      const piglets = heads * pigletP;
      const feed = Math.round(heads * feedKgHead * feedP);
      const others = heads * other;
      const total = piglets + feed + others;
      const totalKg = Math.max(1, heads * outW);
      const breakeven = total / totalKg;
      const scen = m => Math.round(totalKg * price * m - total);
      const fmt = n => Math.round(n).toLocaleString();
      const light = price >= breakeven * 1.2 ? '🟢 照這行情有不錯的利潤空間'
        : price >= breakeven ? '🟡 有賺但空間不大，出欄時機和體重要顧好' : '🔴 照這行情會賠，要嘛降飼料成本要嘛拉價格區隔';
      NZD.S.set('cost', { saved_at: new Date().toISOString(), heads,
        items: { piglets: Math.round(piglets), feed, other: others },
        total_cost: Math.round(total), expected_qty: Math.round(totalKg), breakeven_price: +breakeven.toFixed(1), expected_price: price });
      return {
        headline: '養 ' + heads + ' 頭總投入約 ' + fmt(total) + ' 元，活體一公斤賣過 ' + breakeven.toFixed(1) + ' 元就不賠！',
        detail: '成本組成：仔豬 ' + fmt(piglets) + '、飼料 ' + fmt(feed) + '（每頭增重 ' + gain + ' kg × 換肉率 ' + fcr + ' ≈ 吃 ' + Math.round(feedKgHead) + ' kg 料）、其他 ' + fmt(others) + ' 元。'
          + '預估出欄總重 ' + fmt(totalKg) + ' kg。三種行情試算（照 ' + price + ' 元/kg 為基準）：行情差 8 折→淨利 ' + fmt(scen(0.8))
          + ' 元；持平→ ' + fmt(scen(1)) + ' 元；行情好 1.2 倍→ ' + fmt(scen(1.2)) + ' 元。' + light
          + '。提醒：黑豬要養 12~14 個月，資金會壓比較久；仔豬到出欄的損耗常見 3~8%，要另外抓。已存檔，財務損益分析會直接拿這份來對帳。',
      };
    },
  },
  variety: {
    inputs: [
      { key: 'goal', label: '你最在意', unit: '', def: '肉質風味賣好價', options: ['肉質風味賣好價', '長得快週轉快', '好照顧省心'] },
      { key: 'source', label: '仔豬來源', unit: '', def: '向種豬場/繁殖場購買', options: ['向種豬場/繁殖場購買', '自家母豬繁殖'] },
    ],
    button: '推薦方向 ›',
    run(v) {
      const goalMap = {
        '肉質風味賣好價': '走本土黑豬血統（桃園黑豬、平埔黑豬與其雜交肉豬）——慢養 12~14 個月，油花和風味才出得來，適合直銷、餐廳與禮盒市場，價格有區隔。',
        '長得快週轉快': '黑豬跟白豬雜交的豬長得比純黑豬快、飼料錢省一點，但市場區隔會變弱、拍賣價貼近一般豬——先想清楚你要走量還是走價。',
        '好照顧省心': '挑健康仔豬比挑血統重要——看活力好、毛色亮、沒下痢；來源場的疫苗紀錄和健康狀況要問清楚，帶病仔豬再好的血統都是賠。',
      };
      const srcMap = {
        '向種豬場/繁殖場購買': '固定跟一兩家信譽好的場拿豬，別到處比價亂買；新豬進場一定先隔離 2~4 週再併群，這是保命習慣。',
        '自家母豬繁殖': '自家繁殖要顧好母豬群：配種與分娩紀錄確實記、產房保溫做足、初乳 24 小時內一定吃到；血統更新可洽畜產試驗所的黑豬育種資源。',
      };
      return {
        headline: '「' + CROP.display + '」挑品種與豬源，先看這幾個重點！',
        detail: '1. ' + goalMap[v.goal] + ' 2. ' + srcMap[v.source]
          + ' 3. 不管哪條路，出欄體重抓 110~130 kg 最好賣，養過肥背脂厚會被扣價。＊實際血統與豬源請洽畜產試驗所與在地獸醫，小批試養順了再擴大。',
        links: [{ label: '畜產試驗所（黑豬育種研究）', url: 'https://www.tlri.gov.tw' }],
      };
    },
  },
  rotate: {
    noPrepare: true,
    inputs: [
      { key: 'goal', label: '你想怎麼排', unit: '', def: '全進全出防疫病', options: ['全進全出防疫病', '全年穩定出貨', '剛起步小規模試'] },
    ],
    button: '幫我排批次 ›',
    run(v) {
      const plans = {
        '全進全出防疫病': { pick: '同一批同進同出', why: '整棟清空才能徹底消毒，病原沒地方躲，是切斷疫病最有效的做法', how: '出清後全場沖洗消毒、空欄乾燥至少 5~7 天再進下一批；墊料糞便清乾淨，角落和飲水管線別漏掉' },
        '全年穩定出貨': { pick: '分棟分批進豬', why: '2~3 棟錯開進豬，每 2~3 個月就有一批可出，現金流穩', how: '批與批之間人員、工具、雨鞋分開用；每天動線先顧健康棟再進有狀況的棟，順序不能反' },
        '剛起步小規模試': { pick: '一批 20~30 頭養起', why: '先把餵料、清糞、防疫流程跑順，再談擴場', how: '滿 20 頭就要辦畜牧場登記；糞尿處理先想好，這是之後擴場最卡的一關' },
      };
      const p = plans[v.goal];
      return {
        headline: '建議：' + p.pick + '！',
        detail: '為什麼：' + p.why + '。怎麼做：' + p.how + '。共同原則：進豬挑乾爽天（7 日雨量 30mm 以內作業最順，連日大雨舍內潮濕、疾病壓力大就延後）；新豬一律隔離 2~4 週確認健康再併群。',
      };
    },
  },
  soil: {
    hideDyn: true,
    inputs: [
      { key: 'temp', label: '舍內溫度', unit: '°C', def: '26' },
      { key: 'vent', label: '通風與氣味', unit: '', def: '空氣清爽沒什麼味道', options: ['空氣清爽沒什麼味道', '有點氨味', '悶熱刺鼻'] },
      { key: 'space', label: '一頭豬的活動空間', unit: '', def: '1.2~1.5 平方公尺', options: ['1.5 平方公尺以上', '1.2~1.5 平方公尺', '不到 1.2 平方公尺'] },
      { key: 'wash', label: '沖洗消毒習慣', unit: '', def: '每天清糞＋定期全面消毒', options: ['每天清糞＋定期全面消毒', '偶爾沖洗', '很少清'] },
    ],
    button: '幫我評估 ›',
    run(v) {
      const t = +v.temp;
      const cards = [];
      if (t < 12) cards.push('太冷（' + t + '°C）→ 各齡層都受不了：仔豬保溫燈開起來、擋風簾放下，保育舍要拉到 26~28°C');
      else if (t < 18) cards.push('偏涼（' + t + '°C）→ 生長肥育豬還行，保育舍要加溫到 26~28°C、哺乳保溫區 30~32°C');
      else if (t <= 28) cards.push('溫度 ' + t + '°C 在理想帶 18~28°C ✓（生長肥育豬 18~22°C 最舒服）');
      else if (t < 32) cards.push('偏熱（' + t + '°C）→ 熱緊迫開始：通風全開、飲水給足，採食量會掉');
      else cards.push('太熱（' + t + '°C）→ 熱緊迫危險：水簾＋風扇全開、加滴水降溫，中午別趕豬別作業');
      if (v.vent === '有點氨味') cards.push('有氨味→ 通風不足：先清糞再加大風扇，氨味重豬會咳、長不快');
      else if (v.vent === '悶熱刺鼻') cards.push('悶熱刺鼻→ 氨氣太高傷呼吸道，立刻加強通風＋清糞，長期要檢討糞尿處理');
      else cards.push('通風氣味 ✓');
      if (v.space === '不到 1.2 平方公尺') cards.push('太擠→ 黑豬活動力強，太擠容易咬尾打架、增重變慢，每頭抓 1.2~1.5 平方公尺');
      else cards.push('活動空間 ✓（每頭 1.2~1.5 平方公尺是基本）');
      if (v.wash === '很少清') cards.push('很少清洗→ 病原和氨氣都在累積，從每天清糞做起，空欄時全面沖洗消毒＋乾燥');
      else if (v.wash === '偶爾沖洗') cards.push('沖洗頻率不夠→ 至少每天清糞、每批出清後全面消毒');
      else cards.push('清潔消毒習慣 ✓');
      const bad = cards.filter(c => !c.includes('✓')).length;
      return {
        headline: bad ? '要處理 ' + bad + ' 件事，照清單來！' : '豬舍條件不錯，照常管理！',
        detail: cards.join('。') + '。原則：地面乾爽、空氣流通對增重的影響，常常比多餵料還大；環境顧好，病也少一半。',
      };
    },
  },
  subsidy: {
    inputs: [
      { key: 'reg', label: '畜牧場登記', unit: '', def: '已有登記證', options: ['已有登記證', '還沒登記/申請中'] },
      { key: 'ins', label: '豬隻死亡保險', unit: '', def: '有保', options: ['有保', '沒保'] },
    ],
    run(v) {
      const okReg = v.reg === '已有登記證', okIns = v.ins === '有保';
      const items = [
        { name: '畜牧場登記證', need: !okReg, base: true,
          how: '養豬滿 20 頭就要辦——向桃園市動物保護處申請，備土地與設施資料、糞尿處理計畫。沒登記不只可能受罰，後面的補助保險多半也掛不上。' },
        { name: '豬隻死亡保險', need: !okIns, base: true,
          how: '政策性保險、保費有補助，向所在地農會辦；豬隻死亡和運輸損失有理賠，養豬的基本保障。' },
        { name: '糞尿資源化與沼氣設備補助', need: true, base: false,
          how: '向動物保護處或中央畜產會問當年度方案；處理後的沼渣沼液申請作農地肥分，還能省一筆肥料錢。' },
        { name: '天然災害救助', need: true, base: false,
          how: '畜禽舍受災在公告後 10 日內向公所送件——有時限！颱風來前先把豬舍內外拍照存證，理賠救助都要用。' },
        { name: '台灣豬標章／產銷履歷', need: true, base: false,
          how: '行銷加分項——消費者才分得出你是台灣本土黑豬；屠宰走合法屠宰場並保留屠檢單是前提。' },
      ];
      const todo = items.filter(x => x.need && x.base), can = items.filter(x => x.need && !x.base);
      return {
        headline: todo.length ? '先補 ' + todo.length + ' 項基本盤，再談其他補助！' : '基本盤都齊了——這幾個方向可以去問！',
        detail: (todo.length ? '🔴 先辦：' + todo.map(x => x.name + '——' + x.how).join('｜') + '。' : '')
          + '💡 可申請的方向：' + can.map(x => x.name + '——' + x.how).join('｜')
          + '。多數案件在動物保護處或農會臨櫃辦，去之前先電話問清楚當年度受理時間和要帶的文件。（連結 2026-07 實測可達；金額與資格以各單位最新公告為準）',
        links: [
          { label: '桃園市動物保護處（畜牧場登記）', url: 'https://animal.tycg.gov.tw' },
          { label: '中央畜產會', url: 'https://www.naif.org.tw' },
          { label: '農業金融署・推動農業保險', url: 'https://www.afna.gov.tw/view.php?theme=web_structure&id=208' },
        ],
      };
    },
  },
  drone: {
    inputs: [
      { key: 'need', label: '你想做什麼', unit: '', def: '裝溫濕度/氨氣監測', options: ['裝溫濕度/氨氣監測', '裝監視器遠端看豬舍'] },
    ],
    button: '怎麼下手 ›',
    run(v) {
      if (v.need === '裝溫濕度/氨氣監測') return {
        headline: '從一支溫濕度計加警報開始，幾百塊就有感！',
        detail: '① 先在保溫區和肥育舍各裝一組電子溫濕度計（幾百到一兩千元），有高低溫警報功能的優先。② 氨氣偵測器比較貴，先用鼻子巡——進舍會嗆就是超標。③ 量到的數值輸進「IoT 感測器整合」馬上判讀。最重要的一件事：斷電警報！夏天風扇水簾停電半小時就可能整舍出事，警報器加發電機備援比什麼監測都優先。',
      };
      return {
        headline: '網路攝影機看豬舍，手機隨時巡場！',
        detail: '① 一般網路攝影機（夜視款）裝在分娩舍和肥育舍走道，手機遠端看採食、有沒有豬躺著不動。② 分娩舍最值得裝——半夜壓死仔豬、難產都看得到。③ 畜牧資材行有整合方案可問，從兩三支裝起就好。眉角：鏡頭裝高一點防豬拱、線路走管防咬；網路不穩的舍先拉有線。',
      };
    },
  },
  export: {
    inputs: [
      { key: 'dest', label: '想外銷去哪', unit: '', def: '香港/澳門', options: ['香港/澳門', '新加坡', '日本'] },
    ],
    run(v) {
      const extra = {
        '香港/澳門': '港澳是台灣豬肉外銷的常見市場，門檻相對低，但一樣要走外銷資格的屠宰加工體系。',
        '新加坡': '新加坡查驗嚴格，藥物殘留標準要先對表管理，務必透過有經驗的貿易商。',
        '日本': '日本生鮮豬肉門檻最高，多以加工品（如調理食品）路線較可行，需符合日本的檢疫與衛生條件。',
      };
      return {
        headline: '豬肉外銷' + v.dest + '——先弄懂路徑再談文件！',
        detail: '重點先講：生鮮豬肉外銷必須來自具外銷資格的合法屠宰場與加工廠，個別牧場沒辦法自己出——實際路徑是把豬交給有外銷資格的屠宰／加工業者，或跟貿易商合作。必備：① 輸出檢疫證明（防檢署）② 目的地藥物殘留標準對表（用藥停藥期紀錄要齊）③ 全程冷鏈。' + extra[v.dest]
          + ' 加工品（香腸、調理包）門檻比生鮮低，但要找有食品工廠登記的廠合作。＊為 2026-07 整理概要，出貨前以防檢署公告為準。',
        links: [{ label: '動植物防疫檢疫署（輸出檢疫）', url: 'https://www.aphia.gov.tw' }],
      };
    },
  },
  compare: {
    noPrepare: true,
    inputs: [
      { key: 'lastYield', label: '上一批出欄總重', unit: 'kg', def: '12000' },
      { key: 'lastCost', label: '上一批總成本', unit: '元', def: '900000' },
      { key: 'lastPrice', label: '上一批平均拍賣價', unit: '元/kg', def: '105' },
    ],
    button: '跟上一批比 ›',
    run(v) {
      const cost = NZD.S.get('cost'), y = NZD.S.get('yield');
      if (!cost && !y) return { headline: '這批還沒有資料可以比！', detail: '先用「成本試算」和「出欄量預估」建立這批的數字，出完再回來比。' };
      const cur = { yield: y ? y.total_kg : (cost ? cost.expected_qty : 0), cost: cost ? cost.total_cost : 0, price: cost ? cost.expected_price : 0 };
      const pct = (a, b) => b > 0 ? Math.round((a - b) / b * 100) : 0;
      const dy = pct(cur.yield, +v.lastYield), dc = pct(cur.cost, +v.lastCost), dp = pct(cur.price, +v.lastPrice);
      const good = (dy > 0 ? 1 : 0) + (dc < 0 ? 1 : 0) + (dp > 0 ? 1 : 0);
      const arrow = n => n > 0 ? '↑' + n + '%' : n < 0 ? '↓' + (-n) + '%' : '持平';
      return {
        headline: good >= 2 ? '有進步！三個指標中 ' + good + ' 個變好。' : good === 1 ? '互有勝負——一個指標變好。' : '這批比較辛苦，三個指標都沒贏。',
        detail: '出欄總重 ' + arrow(dy) + '（' + (+v.lastYield).toLocaleString() + '→' + cur.yield.toLocaleString() + ' kg）、成本 ' + arrow(dc)
          + '（' + (+v.lastCost).toLocaleString() + '→' + cur.cost.toLocaleString() + ' 元，降才是好）、拍賣價 ' + arrow(dp)
          + '（' + v.lastPrice + '→' + cur.price + ' 元/kg）。歸因建議：出欄量掉→回看豬病與死亡紀錄；成本升→看飼料換肉率和仔豬價哪個暴增；價低→出欄時機（避開連假後第一拍）與體重規格要調。',
      };
    },
  },
  carbon: {
    inputs: [
      { key: 'feed', label: '飼料用量', unit: 'kg/批', def: '32000' },
      { key: 'power', label: '用電', unit: '度/批', def: '3000' },
      { key: 'km', label: '運輸里程', unit: 'km/批', def: '300' },
      { key: 'out', label: '出欄總重', unit: 'kg', def: '12000' },
    ],
    run(v) {
      const EF = { feed: 0.65, power: 0.494, km: 0.25 };
      const total = (+v.feed || 0) * EF.feed + (+v.power || 0) * EF.power + (+v.km || 0) * EF.km;
      const per = total / Math.max(1, +v.out || 1);
      return {
        headline: '這批飼料、用電加運輸約排 ' + Math.round(total).toLocaleString() + ' kgCO2e，每公斤豬（活體）約 ' + per.toFixed(2) + ' kg！',
        detail: '組成：飼料 ' + Math.round((+v.feed || 0) * EF.feed) + '（概算 0.65/kg，飼料生產是養豬最大宗）＋用電 ' + Math.round((+v.power || 0) * EF.power)
          + '（0.494/度）＋運輸 ' + Math.round((+v.km || 0) * EF.km) + '（0.25/km）kgCO2e。注意：糞尿發酵的甲烷這裡還沒算進去，是另一大來源——做沼氣回收或固液分離是牧場最大的減碳空間，沼渣沼液回田還省肥料錢。其次是顧好換肉率：豬長得順、料吃得省，碳也跟著降。＊為概算（2026-07 整理），正式碳盤查依環境部/農業部公告方法學。',
      };
    },
  },
  learn: {
    inputs: [
      { key: 'topic', label: '想學什麼', unit: '', def: '豬病防疫與生物安全', options: ['豬病防疫與生物安全', '飼養與飼料管理', '糞尿處理與環保', '行銷與品牌'] },
    ],
    run(v) {
      const lib = {
        '豬病防疫與生物安全': '① 農民學院（academy.moa.gov.tw）搜「畜牧」有養豬入門與防疫課程。② 防檢署官網有非洲豬瘟等重大疫病的防疫指引專區，一定要看。③ 在地動物防疫所與獸醫師公會不定期辦防疫講習，跟你的特約獸醫打聽。',
        '飼養與飼料管理': '① 畜產試驗所（tlri.gov.tw）官網有技術報告與黑豬研究可下載——本土黑豬的權威。② 農民學院畜牧類課程打底。③ 飼料廠的技術服務員常提供現場輔導，配方問題直接問。',
        '糞尿處理與環保': '① 畜牧糞尿資源化輔導——問桃園市動物保護處有什麼方案。② 中央畜產會辦理糞尿處理與沼氣相關講習。③ 沼渣沼液作農地肥分的申請，動保處可以問到底怎麼走。',
        '行銷與品牌': '① 農民學院「農產品行銷」入門到進階。② 台灣豬標章、產銷履歷是黑豬品牌的門票，中央畜產會可洽。③ 各縣市青農聯誼會常辦電商實戰工作坊，加入在地青農群跟同行交流。',
      };
      return {
        headline: '「' + v.topic + '」的免費資源清單來了！',
        detail: lib[v.topic] + ' 全部免費或政府補助。建議路徑：先上農民學院線上課打底 → 報實體講習 → 跟特約獸醫和同行養豬戶保持交流。（2026-07 整理）',
        links: [
          { label: '農民學院（線上課程）', url: 'https://academy.moa.gov.tw' },
          { label: '畜產試驗所', url: 'https://www.tlri.gov.tw' },
          { label: '中央畜產會', url: 'https://www.naif.org.tw' },
        ],
      };
    },
  },
  insure: {
    inputs: [
      { key: 'fear', label: '你最怕什麼', unit: '', def: '豬生病死亡', options: ['豬生病死亡', '颱風豪雨停電', '價格起落'] },
    ],
    run(v) {
      const map = {
        '豬生病死亡': { pick: '豬隻死亡保險', why: '政策性保險、保費有補助，飼養中死亡和運輸損失都有理賠，是養豬的基本保障', how: '向所在地農會辦理。日常保命還是靠生物安全；看到高燒不吃、皮膚紫斑、大量死亡，先停止豬隻車輛進出，立刻撥防檢署 0800-761-590 通報' },
        '颱風豪雨停電': { pick: '天災救助＋發電機備援', why: '畜禽舍受災可申請天然災害救助（公告後 10 日內向公所送件），但夏天停電半小時風扇水簾全停就出大事——備援比理賠更救命', how: '颱風來前把豬舍內外拍照存證（申請救助要用）、發電機油料備足、糞尿池先降水位防溢流' },
        '價格起落': { pick: '分散通路', why: '豬價照拍賣行情走，目前沒有保價格的保單——最實際的避險是不要全押一條路', how: '拍賣、分切直銷、加工品三條腿走：行情好多走拍賣，行情差把好貨留給直銷和禮盒，價格自己拿回一部分主導權' },
      };
      const m = map[v.fear];
      return {
        headline: '怕' + v.fear + '→ 建議：' + m.pick + '！',
        detail: '為什麼：' + m.why + '。怎麼做：' + m.how + '。＊險種與補助每年調整，以農會與主管機關公告為準（2026-07 整理）。',
        links: [{ label: '農業金融署・推動農業保險', url: 'https://www.afna.gov.tw/view.php?theme=web_structure&id=208' }],
      };
    },
  },
  proc: {
    noPrepare: true,
    inputs: [
      { key: 'stock', label: '手上分切肉庫存', unit: 'kg', def: '50' },
      { key: 'sellRate', label: '每週賣得掉', unit: 'kg', def: '30' },
    ],
    run(v) {
      const s = +v.stock || 0, r = Math.max(1, +v.sellRate || 1);
      const weeks = s / r;
      if (weeks > 6) return {
        headline: '這個量照現在的速度要賣 ' + Math.ceil(weeks) + ' 週——認真考慮做加工品！',
        detail: '香腸、臘肉、滷味都能拉長銷售期又提高單價，年節檔期特別好走。但兩件事先做：① 找有工廠登記的食品廠代工，自己家裡做是不能販售的；② 先算過代工費＋包材＋通路抽成，毛利抓不到三成就別做。賣不完的生肉現在就進 -18°C 冷凍（可放 3~6 個月），別放冷藏慢慢耗。',
      };
      if (weeks > 1) return {
        headline: '一週內賣不完——超過的部分今天就進冷凍！',
        detail: '冷藏（0~4°C）頂多放 7 天，照你的速度會有 ' + Math.round(s - r) + ' kg 過期風險。做法：這週賣得掉的 ' + Math.round(r) + ' kg 留冷藏，其他真空分裝直接進 -18°C 冷凍——第一時間就凍，別放到第五六天才凍，風味差很多。冷凍品可放 3~6 個月，慢慢出。',
      };
      return {
        headline: '量不大，照冷藏鮮售的節奏走就好！',
        detail: '庫存 ' + s + ' kg 一週內出得完，維持 0~4°C 冷藏、7 天內出完最保險。訂單再多起來，就把「接單分切、當天冷凍」變成固定流程，品質最穩。',
      };
    },
  },
  copywrite: _mkCopywrite({
    emoji: '🐷', noun: '台灣黑豬肉', unit: '台斤', unitNote: '真空分裝', defPrice: 350,
    defSell: '自家牧場直送',
    fresh: '接單分切、急速冷凍、全程冷鏈',
    story: ['黑豬急不得，飼養週期養好養滿，', '油花與肉香是時間換來的。'],
    safe: '合法屠宰場屠宰、屠檢合格，來源單一牧場',
    ship: '真空分裝、冷凍宅配', keep: '冷凍保存，退冰後當日料理完畢',
    notice: ['接單分切，實際重量與標示略有差異屬正常',
             '生鮮肉品全程冷凍出貨，不適用七天猶豫期'],
    tags: ['台灣黑豬', '黑豬肉', '產地直送', '冷凍宅配', '台灣豬'],
    sells: {
      '自家牧場直送': [
        { head: '🐷 自家牧場的台灣黑豬，當天分切、急速冷凍直送到你家！',
          sub: '從牧場到餐桌只有一段路，鮮度和來源都看得見。' },
        { head: '🐷 牧場直出的黑豬肉——沒有中間商，只有冷鏈和誠意。',
          sub: '指定部位可預訂，切法也能聊。' },
      ],
      '慢養14個月': [
        { head: '🐷 黑豬急不得——足足養 14 個月，油花和風味就是不一樣！',
          sub: '時間養出來的肉香，一煎就知道差在哪。' },
        { head: '🐷 別人養半年就出，我們的黑豬養足 14 個月。',
          sub: '慢工出細活，油花分布和口感騙不了人。' },
      ],
      '年節禮盒': [
        { head: '🧧 年節送禮送黑豬！自家牧場黑豬肉禮盒，數量有限，先訂先留。',
          sub: '長輩收到會記得的禮，比餅乾禮盒有誠意。' },
        { head: '🧧 過年圍爐的主角先訂起來——黑豬肉禮盒開放預購！',
          sub: '自用加菜、送禮體面，年前依訂單順序出貨。' },
      ],
      '合法屠宰安心': [
        { head: '✅ 合法屠宰場屠宰、屠檢合格，全程冷鏈，給家人吃的標準！',
          sub: '每一批來源清楚，吃得安心才是真的好吃。' },
        { head: '✅ 來源單一牧場、屠檢合格章看得到——安心是基本配備。',
          sub: '我們自己家餐桌吃的，就是這一批。' },
      ],
    },
  }),
  buyer: {
    inputs: [
      { key: 'ch', label: '想走的通路', unit: '', def: '肉品市場拍賣', options: ['肉品市場拍賣', '肉商/攤商承銷', '餐廳直供', '社區團購', '電商冷凍宅配'] },
    ],
    run(v) {
      const guide = {
        '肉品市場拍賣': ['向農會或運輸業者接洽，安排豬上肉品市場拍賣', '好處：量大出得掉、拍賣價透明每天可查', '眉角：出欄體重控制在 110~130 kg 規格帶，過重過肥會被殺價；避開連假後第一拍'],
        '肉商/攤商承銷': ['跟固定的肉商或市場攤商談長期供應', '好處：量穩定、現金流快，不用天天看行情', '眉角：重量怎麼計價、付款天期，白紙黑字談清楚再出豬'],
        '餐廳直供': ['列出附近主打台灣豬、黑豬料理的餐廳和燒肉店', '帶樣品直接拜訪主廚或採購，附價目表與供貨日', '眉角：穩定供應比低價重要，寧可少接幾家也別斷貨'],
        '社區團購': ['加入在地社區 FB 社團/LINE 群，先發「行銷文案生成」做的貼文', '收單→分切→冷凍面交，貨到收現金最單純', '眉角：固定每月開團日，年節檔提前一個月收單'],
        '電商冷凍宅配': ['蝦皮/農產電商開店，用「行銷文案生成」的商品文', '全程冷凍宅配是基本，保麗龍箱＋保冷劑要做足', '眉角：低溫運費是獲利殺手——免運門檻抓高一點，主推組合包'],
      };
      const g = guide[v.ch];
      return { headline: '走「' + v.ch + '」的三步驟：', detail: '① ' + g[0] + '。② ' + g[1] + '。③ ' + g[2] + '。搭配：先用「定價策略建議」算這個通路該賣多少，再去談。' };
    },
  },
  trace: {
    inputs: [],
    run() {
      const p = NZD.S.get('profile') || {};
      const logs = NZD.S.get('logs', []);
      const recent = logs.slice(0, 5);
      const lines = [
        '🐷 產品履歷卡',
        '品名：黑豬肉（' + CROP.county + '產）',
        '生產者：' + (p.farm_name || '（到 ⚙️ 我的農場填名稱）'),
        '飼養方式：台灣黑豬慢養 12~14 個月，出欄約 110~130 公斤',
        recent.length ? '牧場紀錄：' + recent.map(x => x.date.slice(5) + ' ' + x.txt).join('；') : '牧場紀錄：（用「作業日誌」記錄，這裡會自動帶入）',
        '屠宰：合法屠宰場屠宰，屠體經屠宰衛生檢查合格',
        '保存：冷藏 0~4°C 請於 7 天內食用；冷凍 -18°C 以下可放 3~6 個月，退冰請放冷藏室',
        '（資料來自小農工具箱作業日誌，' + new Date().toISOString().slice(0, 10) + ' 產出）',
      ].filter(Boolean);
      return { headline: '履歷卡生成了——複製貼到出貨單、貼文或印出來附箱！', detail: lines.join('\n') };
    },
  },
  pnl: {
    inputs: [
      { key: 'soldKg', label: '實際售出總重（活體）', unit: 'kg', def: '12000' },
      { key: 'avgPrice', label: '平均拍賣價', unit: '元/kg', def: '105' },
    ],
    run(v) {
      const cost = NZD.S.get('cost');
      if (!cost) return { headline: '先去「成本試算」存一份計畫，我才有成本可以對！', detail: '成本試算會存這批的總成本與損平價，出欄結束回來輸入實際賣出的總重和均價就能結算。' };
      const kg = +v.soldKg || 0, p = +v.avgPrice || 0;
      const rev = kg * p, profit = rev - cost.total_cost;
      const margin = rev > 0 ? (profit / rev * 100).toFixed(1) : 0;
      const fmt = n => Math.round(n).toLocaleString();
      const vsPlan = cost.expected_qty ? '（計畫出欄總重 ' + cost.expected_qty.toLocaleString() + ' kg，實際達成 ' + Math.round(kg / cost.expected_qty * 100) + '%）' : '';
      const items = cost.items || {};
      return {
        headline: profit >= 0 ? '這批賺 ' + fmt(profit) + ' 元！毛利率 ' + margin + '%。' : '這批虧 ' + fmt(-profit) + ' 元（毛利率 ' + margin + '%）。',
        detail: '營收 ' + fmt(rev) + ' 元（' + kg.toLocaleString() + ' kg × ' + p + ' 元）− 總成本 ' + fmt(cost.total_cost) + ' 元。'
          + '實際均價 ' + p + ' vs 損平價 ' + cost.breakeven_price + ' 元/kg' + (p >= cost.breakeven_price ? '，有守住！' : '——低於損平，下批從「顧好換肉率降飼料錢」或「分切直銷拉高價」下手。')
          + vsPlan + ' 成本組成參考：仔豬 ' + fmt(items.piglets || 0) + '／飼料 ' + fmt(items.feed || 0) + '／其他 ' + fmt(items.other || 0) + ' 元。',
      };
    },
  },
  harvest: {
    noPrepare: true,
    hideDyn: true,
    inputs: [
      { key: 'bdate', label: '這批出生日期', unit: '', def: '', type: 'date' },
      { key: 'avgW', label: '目前平均體重', unit: 'kg/頭', def: '100' },
    ],
    button: '算出欄時機 ›',
    async run(v) {
      if (!v.bdate) return { headline: '先給我這批的出生日期！', detail: '跟豬源場要，或抓大概也行——黑豬從出生到出欄大約 12~14 個月。' };
      const D = NZD.A.daysToHarvest;
      const days = Math.floor((Date.now() - new Date(v.bdate)) / 864e5);
      const w = +v.avgW || 0;
      let heat = '';
      try {
        const d = await NZD.D.weather(CROP.county);
        const hotDays = d.temperature_2m_max.slice(0, 7).filter(x => x >= NZD.A.hotHarvestAdvance.temp).length;
        if (hotDays >= 3) heat = ' 🌡 未來一週有 ' + hotDays + ' 天 30°C 以上——熱緊迫會讓採食掉、增重變慢，常見做法是提早約 ' + NZD.A.hotHarvestAdvance.days + ' 天、體重輕一點就出欄，減少損失。';
      } catch (e) {}
      let head, det;
      if (w >= 130 || days > D.hi) {
        head = '該出了！' + (w >= 130 ? '體重 ' + w + ' kg 已到上限' : '第 ' + days + ' 天已超過常見出欄天數') + '——儘快安排。';
        det = '養過重背脂會太厚，拍賣被扣價、飼料錢也白吃。安排出欄：運輸前約 12 小時停料、水照給，屠體品質比較穩。';
      } else if (days >= D.lo && w >= 110) {
        head = '就是現在！第 ' + days + ' 天、' + w + ' kg，正在 110~130 kg 的出欄帶。';
        det = '拍賣時機眉角：避開連假後第一拍、年節前行情通常較好。出欄前依獸醫指示確實做完停藥期；運輸前約 12 小時停料、水照給。趕豬別急，豬緊迫受傷屠體會扣價。';
      } else if (days >= D.lo) {
        head = '天數到了（第 ' + days + ' 天）但體重只有 ' + w + ' kg——先別急著出。';
        det = '出欄帶抓 110~130 kg。增重跟不上先檢查：飼料採食量、會不會太擠太熱、有沒有病在拖。調整後每週抽秤幾頭追進度。';
      } else {
        head = '還不到——第 ' + days + ' 天，離常見出欄（第 ' + D.lo + '~' + D.hi + ' 天、110~130 kg）還有約 ' + (D.lo - days) + ' 天。';
        det = '黑豬就是要有耐心，這段慢養才有風味和油花。現在顧好肥育期：控制背脂別過厚、每月抽秤看增重。';
      }
      return { headline: head, detail: det + heat };
    },
  },
  grade: {
    noPrepare: true,
    inputs: [
      { key: 'liveW', label: '出欄活體重', unit: 'kg/頭', def: '120' },
      { key: 'shape', label: '體態', unit: '', def: '勻稱結實', options: ['勻稱結實', '偏肥（背脂厚）', '偏瘦'] },
    ],
    run(v) {
      const w = +v.liveW || 120;
      const cLo = Math.round(w * 0.70), cHi = Math.round(w * 0.75);
      let judge;
      if (v.shape === '偏肥（背脂厚）') judge = '背脂過厚會被扣價——這批照實出，下批肥育後段把料控一下，別養過肥。';
      else if (v.shape === '偏瘦') judge = '偏瘦屠體輕、出肉少——先確認飼料採食和健康狀況，下批把增重顧回來。';
      else if (w >= 110 && w <= 130) judge = '體重在 110~130 kg 的規格帶、體態勻稱——正是拍賣喜歡的豬，好價機會高！';
      else if (w > 130) judge = '體態不錯但超重了——超過 130 kg 背脂容易過厚，下批早一點出。';
      else judge = '體態不錯但還輕——不到 110 kg 出欄總重吃虧，能再養就再養一陣。';
      return {
        headline: '活體 ' + w + ' kg 估屠體約 ' + cLo + '~' + cHi + ' kg（屠體率 70~75%）。',
        detail: judge + ' 賣相加分三件事：① 走合法屠宰場並保留屠檢單——屠體蓋有屠宰衛生檢查合格標誌，消費者買得安心；② 申請台灣豬標章或產銷履歷，分切走 CAS 認證廠更加分；③ 出欄前依獸醫指示確實做完停藥期。分切後好部位（里肌、五花、梅花）走直銷禮盒，其餘部位進加工或絞肉，整頭豬的價值才拉得滿。',
      };
    },
  },
  store: {
    hideDyn: true,
    inputs: [
      { key: 'method', label: '保存方式', unit: '', def: '冷藏（0~4°C）', options: ['冷藏（0~4°C）', '冷凍（-18°C以下）'] },
      { key: 'temp', label: '實際溫度', unit: '°C', def: '3' },
      { key: 'days', label: '預計存放', unit: '天', def: '5' },
    ],
    run(v) {
      const t = +v.temp, want = +v.days || 5;
      const S = NZD.A.storage;
      if (v.method === '冷凍（-18°C以下）') {
        const cold = t <= -18;
        return {
          headline: cold ? '冷凍條件 OK，這樣放 3~6 個月沒問題！' : '不夠冷（' + t + '°C）——冷凍要 -18°C 以下！',
          detail: (cold ? '維持 -18°C 以下，' : '溫度先調到 -18°C 以下再放，凍不透不耐放、風味也差。')
            + '冷凍可放 3~6 個月' + (want > 180 ? '，你想放 ' + want + ' 天太久了——先進先出、半年內出完' : '，你要放 ' + want + ' 天沒問題')
            + '。眉角：① 真空或密封分裝再凍，避免凍燒（表面乾白）；② 分小包凍，要多少退多少；③ 退冰放冷藏室慢慢退，千萬別室溫退冰，細菌長很快。',
        };
      }
      const issues = [];
      if (t > S.tempHi) issues.push('溫度太高（' + t + '°C）——超過 ' + S.tempHi + '°C 細菌長很快，生肉很快就變質');
      if (t < S.tempLo) issues.push('溫度低於 ' + S.tempLo + '°C——已經是微凍狀態，乾脆真空分裝直接進冷凍');
      const overDays = want > 7;
      return {
        headline: issues.length ? '條件要調：' + issues[0] + '！' : (overDays ? '冷藏頂多 7 天——你要放 ' + want + ' 天，撐不到！' : '條件不錯，冷藏 7 天內出完最保險。'),
        detail: (issues.length ? '全部問題：' + issues.join('；') + '。' : '') + '冷藏理想 ' + S.tempLo + '~' + S.tempHi + '°C、濕度 ' + S.rhLo + '~' + S.rhHi + '%，建議 7 天內出完。'
          + (overDays ? '賣不完的部分今天就真空分裝進 -18°C 冷凍（可放 3~6 個月），別放到快壞才凍。' : '')
          + ' 提醒：生熟分開放、分切器具每天消毒，肉品最怕交叉污染。',
      };
    },
  },
  labor: {
    noPrepare: true,
    hideDyn: true,
    inputs: [
      { key: 'heads', label: '這批出欄頭數', unit: '頭', def: '100' },
      { key: 'weeks', label: '分幾週出完', unit: '週', def: '2' },
      { key: 'people', label: '可用人數', unit: '人', def: '2' },
    ],
    run(v) {
      const heads = +v.heads || 0, weeks = Math.max(1, +v.weeks || 1), ppl = Math.max(1, +v.people || 1);
      const trucks = Math.ceil(heads / 25);
      const loadDays = Math.round(trucks * 1.5 * 10) / 10;
      const washDays = 3;
      const manDays = loadDays + washDays;
      const perWeek = Math.ceil(manDays / weeks);
      const havePerWeek = ppl * 6;
      const peak = NZD.A.laborPeak;
      const gap = perWeek - havePerWeek;
      return {
        headline: gap <= 0 ? '人力夠！出欄那幾週每週多 ' + perWeek + ' 人天，你們 ' + ppl + ' 人吃得下。'
          : '會缺工！每週要多 ' + perWeek + ' 人天，你們排得出 ' + havePerWeek + ' 人天——差 ' + gap + '。',
        detail: heads + ' 頭約 ' + trucks + ' 車（一車約 25 頭，趕豬裝車約 1.5 人天/車＝' + loadDays + ' 人天）＋出清後全場沖洗消毒約 ' + washDays + ' 人天，分 ' + weeks + ' 週攤。'
          + '這還不含每天的餵料清糞——數百頭規模常態是 ' + peak.lo + '~' + peak.hi + ' 人天/週，出欄清舍那週會頂到上限。'
          + (gap > 0 ? '對策：請運輸班協助趕豬裝車、出欄期拉長一週、或找臨時工。' : '眉角：趕豬別急，豬緊迫受傷屠體會扣價；裝車排清晨最涼的時段。'),
      };
    },
  },
  fert: {
    noPrepare: true,
    inputs: [
      { key: 'bdate', label: '這批出生日期', unit: '', def: '', type: 'date' },
    ],
    button: '排飼養重點 ›',
    run(v) {
      if (!v.bdate) return { headline: '先給我這批的出生日期，我才能算現在在哪一期！', detail: '不知道確切日期抓大概也行——哺乳保育期（0~70 天）、生長期（70~180 天）、肥育期（180 天到出欄）。' };
      if (!NZD.A.fertPlans) return { headline: '等我一下，資料還在載入！', detail: '網路慢的時候會這樣——稍等幾秒再按一次就好。' };
      const p = NZD.phase(v.bdate);
      if (p.days < 0) return { headline: '這批還沒出生（還有 ' + (-p.days) + ' 天）——先把產房備好！', detail: '保溫箱、保溫燈檢查好，教槽料先叫貨；出生 24 小時內一定要吃到初乳，這是整批豬的底子。' };
      const g = NZD.A.growthPhases;
      const plans = {
        seedling: { now: NZD.A.fertPlans.seedling, next: '約第 ' + g[1].lo + ' 天進「' + g[1].name + '」——生長豬料先備好' },
        flower: { now: NZD.A.fertPlans.flower, next: '約第 ' + g[2].lo + ' 天進「' + g[2].name + '」——換肥育料、開始控背脂' },
        fruit: { now: NZD.A.fertPlans.fruit, next: '接近出欄——依獸醫指示做完停藥期，運輸前約 12 小時停料、水照給' },
      };
      const pl = plans[p.key] || plans.fruit;
      return {
        headline: '這批第 ' + p.days + ' 天，正在「' + p.name + '」！',
        detail: '這期怎麼餵：' + pl.now + ' 下一步：' + pl.next + '。原則：換料一律用 7~10 天慢慢混，突然換料最容易下痢；餵完到「作業日誌」記一筆。',
      };
    },
  },
  pest: {
    inputs: [
      { key: 'part', label: '哪裡不對勁', unit: '', def: '突然高燒不吃、皮膚出現紅紫斑、短時間內死亡數明顯增加', options: [
        '突然高燒不吃、皮膚出現紅紫斑、短時間內死亡數明顯增加',
        '咳嗽、喘、呼吸急促,吃得少、長得慢、毛色變粗',
        '水樣或黃色下痢、屁股濕黏、脫水消瘦,仔豬死亡多',
        '一直磨蹭欄杆、皮膚搔癢,耳背和腹側有紅疹或結痂',
        '吃得不少卻愈養愈瘦、毛粗糙,糞便裡看得到蟲體',
        '母豬流產、死胎或木乃伊胎,生下的小豬特別虛弱',
        '關節腫脹、跛腳不願站起來、摸起來發燒',
      ] },
      { key: 'sev', label: '嚴重程度', unit: '', def: '輕微（一兩頭）', options: ['輕微（一兩頭）', '中等（同欄好幾頭）', '嚴重（多欄蔓延或有死亡）'] },
    ],
    run(v) {
      const table = NZD.A.pestTable || [];
      if (!table.length) return { headline: '等我一下，資料還在載入！', detail: '網路慢的時候會這樣——稍等幾秒再按一次就好。' };
      const t = table.find(x => x.symptom === v.part) || table[0];
      const urgent = /防檢署|豬瘟/.test(t.act) || /高危害/.test(t.name);
      const sev = v.sev.startsWith('嚴重') ? 2 : v.sev.startsWith('中') ? 1 : 0;
      const rec = NZD.S.get('pest', []);
      rec.unshift({ date: new Date().toISOString().slice(0, 10), part: v.part, sev, soilborne: !!t.soilborne });
      NZD.S.set('pest', rec.slice(0, 100));
      if (urgent) return {
        headline: '⚠️ 這不能等——' + t.name + '！',
        detail: '現在就做：' + t.act + '。不管幾頭，都不要自行處理、不要移動豬隻或私下運出——通報是法定義務，也是保護你自己和整個產業。防檢署專線 0800-761-590，24 小時都有人接。',
      };
      const sevAdd = sev === 2 ? '已經多欄蔓延或有死亡——今天就聯絡獸醫或動物防疫所到場看，不要拖。'
        : sev === 1 ? '同欄的先隔離出來，這 3 天早晚各巡一次，擴大就升級處理。' : '早期處理最省錢，隔離觀察 3~5 天。';
      return {
        headline: '比較可能是：' + t.name + '。',
        detail: '先做這件事：' + t.act + '。' + sevAdd
          + (t.soilborne ? ' ⚠️ 這類病原容易留在欄舍、糞便和墊料裡——已記錄，空欄要徹底沖洗消毒、乾燥後再進豬。' : '')
          + ' 用藥一律依獸醫診斷處方，並確實做完停藥期再出欄。',
      };
    },
  },
  chain: {
    noPrepare: true,
    inputs: [
      { key: 'ctrl', label: '人車進出管制', unit: '', def: '進出換鞋換衣有消毒', options: ['進出換鞋換衣有消毒', '偶爾落實', '幾乎沒有管制'] },
      { key: 'iso', label: '新豬進場', unit: '', def: '隔離 2~4 週再併群', options: ['隔離 2~4 週再併群', '關幾天就併群', '直接併群'] },
      { key: 'sick', label: '近半年豬隻異常（生病/死亡變多）', unit: '', def: '沒有', options: ['沒有', '偶爾 1~2 次', '常常發生'] },
    ],
    run(v) {
      const s1 = ['進出換鞋換衣有消毒', '偶爾落實', '幾乎沒有管制'].indexOf(v.ctrl);
      const s2 = ['隔離 2~4 週再併群', '關幾天就併群', '直接併群'].indexOf(v.iso);
      const s3 = ['沒有', '偶爾 1~2 次', '常常發生'].indexOf(v.sick);
      const score = s1 + s2 + s3;
      const fixes = [];
      if (s1 > 0) fixes.push('進出管制補起來：外人和車輛不進豬舍、門口設消毒點、換鞋換衣確實做——這是最便宜也最有效的一道牆');
      if (s2 > 0) fixes.push('新豬一律隔離 2~4 週確認健康再併群，隔離欄跟主群分開人員工具');
      if (s3 > 0) fixes.push('異常病例反覆出現，請獸醫或動物防疫所做整場健檢，重新檢視疫苗計畫');
      let head;
      if (score <= 1) head = '🟢 低風險——生物安全底子不錯，維持下去！';
      else if (score <= 3) head = '🟡 中風險——有破口，趁還沒出事補起來。';
      else head = '🔴 高風險！破口不補，一次疫病就可能整場歸零。';
      return {
        headline: head,
        detail: (fixes.length ? '要補的：' + fixes.join('。') + '。' : '繼續保持：進出管制、新豬隔離、健康監控三件事都有做到。')
          + '日常再顧三樣：飼料墊料來源清楚、豬舍周邊防鳥防鼠、用廚餘一定先蒸煮（中心 90°C 以上持續 1 小時並留紀錄，沒設備就改配方飼料）。'
          + '遇到高燒不吃、皮膚紫斑、大量死亡——先停止豬隻車輛進出，立刻撥防檢署 0800-761-590。',
      };
    },
  },
  water: {
    noPrepare: true,
    hideDyn: true,
    inputs: [
      { key: 'heads', label: '飼養頭數', unit: '頭', def: '100' },
      { key: 'stage', label: '豬齡', unit: '', def: '肥育豬', options: ['保育豬', '生長豬', '肥育豬'] },
    ],
    button: '今天怎麼降溫 ›',
    async run(v) {
      const heads = +v.heads || 0;
      const need = { '保育豬': [2, 4, '0.5~1'], '生長豬': [5, 8, '1~1.5'], '肥育豬': [8, 12, '1.5~2'] }[v.stage];
      const lo = heads * need[0], hi = heads * need[1];
      let wx = '', act = '天氣正常——照常供水，每天巡一輪飲水器就好。';
      try {
        const d = await getWeather();
        const tmax = d.temperature_2m_max[0];
        wx = '（今天 ' + CROP.county + ' 最高 ' + tmax + '°C，open-meteo 預報）';
        if (tmax >= 32) act = '🔴 熱緊迫警報（' + tmax + '°C）！水簾＋風扇全開、肥育舍加滴水降溫；需水量比平常多兩三成，水塔水量先確認。中午別趕豬別作業。';
        else if (tmax >= 30) act = '🟡 開始熱緊迫（' + tmax + '°C）——通風全開、檢查每個欄的飲水器出水，採食掉的話傍晚涼了補餵。';
      } catch (e) { wx = '（預報暫時抓不到，先照高溫標準備著）'; }
      return {
        headline: heads + ' 頭' + v.stage + '一天大約要 ' + lo.toLocaleString() + '~' + hi.toLocaleString() + ' 公升水！',
        detail: act + ' 乳頭飲水器檢查三件事：① 出水量——' + v.stage + '每分鐘要有 ' + need[2] + ' 公升，水流小豬喝不夠直接影響增重；② 有沒有堵塞漏水，每天巡；③ 高度隨豬長大調。'
          + '另外，停電警報一定要裝——夏天風扇水簾停半小時就可能出大事。' + wx,
      };
    },
  },
  readings: {
    inputs: [
      { key: 'temp', label: '舍內溫度', unit: '°C', def: '26' },
      { key: 'rh', label: '舍內濕度', unit: '%', def: '70' },
      { key: 'amm', label: '進舍聞到的味道', unit: '', def: '沒什麼味道', options: ['沒什麼味道', '有點氨味', '刺鼻嗆眼'] },
    ],
    run(v) {
      const t = +v.temp, rh = +v.rh;
      const M = NZD.A.soilMoist;
      const issues = [], tips = [];
      if (t >= 32) { issues.push('溫度過高（' + t + '°C）'); tips.push('熱緊迫危險——水簾風扇全開、加滴水降溫，飲水給足'); }
      else if (t > 28) { issues.push('偏熱（' + t + '°C）'); tips.push('加強通風，注意採食量有沒有掉'); }
      else if (t < 12) { issues.push('太冷（' + t + '°C）'); tips.push('保溫燈開起來、擋風簾放下，仔豬最怕冷'); }
      else if (t < 18) { issues.push('偏涼（' + t + '°C）'); tips.push('生長肥育豬還行，保育舍要加溫到 26~28°C'); }
      if (rh > M.hi) { issues.push('濕度過高（' + rh + '%）'); tips.push('舍內潮濕病原容易滋生——除濕通風、墊料保持乾燥'); }
      else if (rh < M.lo) { issues.push('濕度偏低（' + rh + '%）'); tips.push('太乾粉塵多、刺激呼吸道，地面可略灑水'); }
      if (v.amm === '有點氨味') { issues.push('有氨味'); tips.push('先清糞再加大風扇——氨味重豬會咳、長不快'); }
      else if (v.amm === '刺鼻嗆眼') { issues.push('氨氣太高'); tips.push('立刻通風＋清糞，人都嗆豬更受不了；長期要檢討糞尿處理'); }
      const rec = NZD.S.get('readings', []);
      rec.unshift({ date: new Date().toISOString(), temp: t, rh });
      NZD.S.set('readings', rec.slice(0, 60));
      if (!issues.length) return { headline: '數值都在安全範圍，豬舍狀況不錯！', detail: '溫度 ' + t + '°C（理想帶 18~28°C，生長肥育豬 18~22°C 最舒服）、濕度 ' + rh + '%（建議 ' + M.lo + '~' + M.hi + '%）、氣味正常。已記錄，累積起來就能看趨勢。' };
      return { headline: '注意：' + issues.join('、') + '！', detail: '建議動作：' + tips.join('；') + '。已記錄這筆（近 60 筆保留在手機）。' };
    },
  },
  warn: {
    inputs: [],
    async run() {
      const d = await NZD.D.weather(CROP.county);
      const hits = [];
      for (let i = 0; i < d.time.length; i++) {
        const day = d.time[i].slice(5).replace('-', '/');
        if (d.temperature_2m_max[i] >= 35) hits.push(day + ' 酷熱 ' + d.temperature_2m_max[i] + '°C：嚴重熱緊迫——水簾風扇滴水全上、飲水加倍確認，中午一切作業停');
        else if (d.temperature_2m_max[i] >= 32) hits.push(day + ' 高溫 ' + d.temperature_2m_max[i] + '°C：熱緊迫——通風降溫全開、需水多兩三成，別在中午趕豬');
        if (d.temperature_2m_min[i] <= 10) hits.push(day + ' 低溫 ' + d.temperature_2m_min[i] + '°C：仔豬保溫燈與擋風簾備好，保育舍加溫');
        if (d.precipitation_sum[i] >= 80) hits.push(day + ' 暴雨 ' + d.precipitation_sum[i] + 'mm：糞尿池先降水位防溢流、舍內除濕、飼料墊料防潮');
        const gust = (d.wind_gusts_10m_max || d.wind_speed_10m_max)[i];
        if (gust >= NZD.C.alert.windKmh) hits.push(day + ' 強陣風 ' + Math.round(gust) + 'km/h（約10級）：屋頂與門窗補強、發電機油料備足、災前拍照存證（申請救助要用）');
      }
      if (!hits.length) {
        return {
          headline: CROP.county + '未來 16 天沒有讓豬不舒服的壞天氣，安心工作！',
          detail: '每天都低於警戒門檻（高溫≥32°C、低溫≤10°C、暴雨≥80mm/日、風≥10級）。概況：最高 '
            + Math.max(...d.temperature_2m_max).toFixed(1) + '°C、最低 ' + Math.min(...d.temperature_2m_min).toFixed(1)
            + '°C、單日最大雨量 ' + Math.max(...d.precipitation_sum).toFixed(1) + 'mm。建議每天早上再點一次確認。',
        };
      }
      return {
        headline: '注意！未來 16 天有 ' + hits.length + ' 個警戒訊號，先做防範！',
        detail: hits.join('｜') + '（豬最怕熱和停電——警報器和發電機備援是第一優先。預報來源 open-meteo，每天早上建議重新檢查）',
      };
    },
  },
  price: {
    noPrepare: true,
    inputs: [
      { key: 'base', label: '最近毛豬拍賣價（活體）', unit: '元/kg', def: '110' },
      { key: 'ch', label: '要走的通路', unit: '', def: '肉品市場拍賣', options: ['肉品市場拍賣', '分切直銷/宅配', '做加工品'] },
    ],
    run(v) {
      const base = +v.base || 110;
      if (v.ch === '肉品市場拍賣') {
        const lo = Math.round(base * 110), hi = Math.round(base * 130);
        return {
          headline: '照行情走——每頭大約 ' + lo.toLocaleString() + '~' + hi.toLocaleString() + ' 元（110~130 kg）！',
          detail: '拍賣價由市場決定，你能控制的是時機和規格：① 黑豬拍賣常比一般豬有一到三成溢價，血統和品質顧好才拿得到；② 年節前行情通常較好、避開連假後第一拍；③ 體重壓在 110~130 kg 規格帶，過肥被扣價最冤。行情每天查肉品市場拍賣價，連兩週走升可以壓批慢出。',
        };
      }
      if (v.ch === '分切直銷/宅配') {
        const rawKg = base / 0.55;
        const rawJin = rawKg * 0.6;
        const sellJin = Math.round(rawJin * 1.5 / 10) * 10;
        return {
          headline: '分切直銷的話，平均一台斤至少要賣 ' + sellJin + ' 元才划算！',
          detail: '概算給你看：活體 ' + base + ' 元/kg，屠體率約 73%、屠體再分切可販售的約 75%——每公斤分切肉的原料成本約 ' + Math.round(rawKg) + ' 元（約 ' + Math.round(rawJin) + ' 元/台斤），再加屠宰分切費、真空包材、冷凍運費。整頭平均售價抓原料成本 1.5 倍起跳；里肌五花梅花這些熱門部位往上訂、絞肉滷用部位便宜出，整頭賣完才是真利潤。＊為概算，實際依你的屠宰分切費用調整。',
        };
      }
      return {
        headline: '加工品訂價：成本算清楚，毛利抓三成起！',
        detail: '訂價公式：原料肉＋代工費＋包材＋通路抽成＝成本，售價至少抓成本 1.4~1.5 倍（毛利三成）才值得做。眉角：① 找有工廠登記的食品廠代工，自家做不能販售；② 香腸臘肉走年節檔，提前兩個月備貨；③ 先小量試賣測市場，別一次做一大批壓庫存。',
      };
    },
  },
  yield: {
    noPrepare: true,
    hideDyn: true,
    inputs: [
      { key: 'heads', label: '這批飼養頭數', unit: '頭', def: '100' },
      { key: 'outW', label: '平均出欄體重', unit: 'kg/頭', def: '120' },
      { key: 'surv', label: '育成率', unit: '%', def: '95' },
    ],
    run(v) {
      const heads = +v.heads || 0, outW = +v.outW || 120, surv = Math.min(100, Math.max(50, +v.surv || 95));
      const outHeads = Math.round(heads * surv / 100);
      const liveKg = Math.round(outHeads * outW);
      const cLo = Math.round(liveKg * 0.70), cHi = Math.round(liveKg * 0.75);
      NZD.S.set('yield', { saved_at: new Date().toISOString().slice(0, 10), total_kg: liveKg });
      const cost = NZD.S.get('cost');
      const cmp = cost && cost.expected_qty ? ' 對照成本試算用的 ' + cost.expected_qty.toLocaleString() + ' kg——'
        + (Math.abs(liveKg - cost.expected_qty) / cost.expected_qty > 0.15 ? '差距超過 15%，建議回成本試算更新重算損平價。' : '兩邊差不多，一致。') : '';
      return {
        headline: '這批預估出欄 ' + outHeads + ' 頭、活體總重約 ' + (liveKg / 1000).toFixed(1) + ' 噸！',
        detail: '算法：' + heads + ' 頭 × 育成率 ' + surv + '%（仔豬到出欄常見損耗 3~8%）× 平均 ' + outW + ' kg ＝ ' + liveKg.toLocaleString() + ' kg。'
          + '換算屠體約 ' + cLo.toLocaleString() + '~' + cHi.toLocaleString() + ' kg（屠體率 70~75%）。'
          + '出欄帶抓 110~130 kg：不到 110 總重吃虧、超過 130 背脂厚會被扣價。已存檔，碳足跡和跨批比較會用到。' + cmp,
      };
    },
  },
},
  '石門活魚': {
  cost: {
    inputs: [
      { key: 'n', label: '放養尾數', unit: '尾', def: '2500' },
      { key: 'fryPrice', label: '魚苗單價', unit: '元/尾', def: '12' },
      { key: 'surv', label: '育成率', unit: '%', def: '80' },
      { key: 'size', label: '上市規格', unit: 'kg/尾', def: '2.5' },
      { key: 'feedPerKg', label: '飼料成本', unit: '元/kg魚', def: '30' },
      { key: 'utilMonth', label: '電費雜支', unit: '元/月', def: '8000' },
      { key: 'months', label: '養成月數', unit: '月', def: '15' },
      { key: 'price', label: '預估塘邊價', unit: '元/kg', def: '70' },
    ],
    noPrepare: true,
    hideDyn: true,
    run(v) {
      const n = +v.n || 0, fp = +v.fryPrice || 0, s = Math.min(100, Math.max(0, +v.surv || 80)) / 100;
      const sz = +v.size || 2.5, months = +v.months || 15, p = +v.price || 70;
      const kg = n * s * sz;
      const fry = n * fp, feed = kg * (+v.feedPerKg || 0), util = (+v.utilMonth || 0) * months;
      const total = fry + feed + util;
      const breakeven = total / Math.max(1, kg);
      const scen = m => Math.round(kg * p * m - total);
      const fmt = x => Math.round(x).toLocaleString();
      const light = p >= breakeven * 1.2 ? '🟢 照這價有不錯的利潤空間'
        : p >= breakeven ? '🟡 有賺但空間不大，育成率和規格要顧好' : '🔴 照這價會賠，要嘛壓飼料成本要嘛拉高育成率';
      NZD.S.set('cost', { saved_at: new Date().toISOString(),
        items: { fry: Math.round(fry), feed: Math.round(feed), power: Math.round(util) },
        total_cost: Math.round(total), expected_qty: Math.round(kg), breakeven_price: +breakeven.toFixed(1), expected_price: p });
      return {
        headline: '放 ' + n.toLocaleString() + ' 尾總投入約 ' + fmt(total) + ' 元，一公斤賣過 ' + breakeven.toFixed(1) + ' 元就不賠！',
        detail: '成本組成：魚苗 ' + fmt(fry) + '、飼料 ' + fmt(feed) + '、電費雜支 ' + fmt(util) + ' 元（養 ' + months + ' 個月）。'
          + '預估收成 ' + fmt(kg) + ' kg（育成率 ' + Math.round(s * 100) + '% × 規格 ' + sz + ' kg/尾）。'
          + '三種行情試算（照 ' + p + ' 元/kg 為基準）：行情差 8 折→淨利 ' + fmt(scen(0.8)) + ' 元；持平→ ' + fmt(scen(1))
          + ' 元；行情好 1.2 倍→ ' + fmt(scen(1.2)) + ' 元。' + light + '。'
          + '常態量級參考：混養池一分水面約放 ' + NZD.A.plantsPerFen + ' 尾、年產約 ' + NZD.A.normalYieldKgFen.toLocaleString() + ' 公斤。已存檔，出完魚到「財務損益分析」結算，會直接拿這份來對帳。',
      };
    },
  },
  sow: {
    inputs: [
      { key: 'temp', label: '未來7日均溫', unit: '°C', def: '24' },
      { key: 'rain', label: '未來7日累積雨量', unit: 'mm', def: '18' },
    ],
    hideDyn: true,
    run(v) {
      const t = +v.temp, r = +v.rain;
      let level = '適合放苗', impact = '水溫穩定、魚苗下池適應快。', action = '可以安排放苗、分池或拉網作業！';
      if (t < 10 || t > 35 || r > 100) {
        level = '不建議放苗'; impact = '太冷魚幾乎不吃料、太熱容易缺氧緊迫，大雨期間池水混濁、水質不穩。'; action = '建議延後幾天再評估，先顧好水位和排水。';
      } else if (t < 20 || t > 30 || r > 40) {
        level = '可放但要多顧'; impact = '水溫偏離適溫帶或雨水偏多，魚苗適應會比較慢。'; action = '可以小量先放，挑清晨下池、慢慢對水溫，頭幾天少量多餐。';
      }
      return {
        headline: '判斷結果：' + level + '（均溫 ' + t + '°C、雨量 ' + r + 'mm/7日）',
        detail: impact + ' ' + action + ' 門檻：理想 20~30°C 且雨量 <40mm；10~20°C 或 40~100mm 要多顧；<10°C、>35°C 或 >100mm 不建議。'
          + '提醒：這抓的是氣溫，池水溫變化比氣溫緩和，當趨勢參考就好。放苗時袋內外水溫差別超過 2°C，慢慢兌水再放。',
      };
    },
  },
  variety: {
    inputs: [
      { key: 'month', label: '預計放苗月', unit: '月', def: String(new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2) },
      { key: 'goal', label: '你最在意', unit: '', def: '好賣價', options: ['好賣價', '病害少好照顧', '省飼料成本'] },
    ],
    button: '推薦魚種方向 ›',
    run(v) {
      const m = Math.min(12, Math.max(1, +v.month || 1));
      const plans = {
        '好賣價': { pick: '大頭鰱（砂鍋魚頭）多放一點＋草魚當基本盤', why: '大魚頭是石門活魚的招牌，規格越大越值錢；但養成期長，要靠草魚先出維持週轉' },
        '病害少好照顧': { pick: '草魚為主、鰱魚大頭鰱配好配滿的傳統混養', why: '三種魚分層吃食——草魚吃草料、鰱魚濾藻、大頭鰱吃浮游動物，水質自然穩、病就少' },
        '省飼料成本': { pick: '拉高草魚吃青料的比例，鰱魚大頭鰱免餵', why: '草魚可用洗淨的青割牧草、菜葉補飼料；鰱魚大頭鰱吃水裡現成的，不用另外花錢' },
      };
      const p = plans[v.goal];
      const timing = (m >= 3 && m <= 5) || (m === 9 || m === 10) ? m + ' 月水溫多在 20~30°C 適溫帶，放苗的好時機。'
        : (m >= 6 && m <= 8) ? m + ' 月天熱，放苗挑清晨、慢慢對水溫，悶熱天先顧溶氧。'
        : m + ' 月偏冷、水溫低魚不太吃料，放苗成活率差——能等就等回暖再放。';
      return {
        headline: '建議方向：' + p.pick + '！',
        detail: '為什麼：' + p.why + '。時機：' + timing
          + ' 苗源：找有信譽的魚苗場或熟識中盤，選已馴餌、規格整齊的中苗，育成率高很多；新的搭配先小量試放，順了再加。實際比例到「混養搭配規劃」排。',
      };
    },
  },
  rotate: {
    inputs: [
      { key: 'goal', label: '這池想怎麼配', unit: '', def: '水質穩定為主', options: ['水質穩定為主', '衝產量', '主攻砂鍋魚頭'] },
    ],
    button: '排混養比例 ›',
    noPrepare: true,
    run(v) {
      const n = NZD.A.plantsPerFen;
      const plans = {
        '水質穩定為主': { r: [6, 2, 2], why: '三種魚分層吃食，草魚吃草料、鰱魚濾藻、大頭鰱吃浮游動物，水色最穩、病也少' },
        '衝產量': { r: [7, 2, 1], why: '草魚吃料長得快、是產量主力；投餵要跟上、水質要盯緊' },
        '主攻砂鍋魚頭': { r: [5, 2, 3], why: '大頭鰱多放，大魚頭賣價好；但養成期長，靠草魚先出魚維持週轉' },
      };
      const p = plans[v.goal];
      const c = p.r.map(x => Math.round(n * x / 10));
      return {
        headline: '這池建議：草魚 ' + p.r[0] + ' 成、鰱魚 ' + p.r[1] + ' 成、大頭鰱 ' + p.r[2] + ' 成！',
        detail: '為什麼：' + p.why + '。以一分水面約 ' + n + ' 尾計：草魚 ' + c[0] + ' 尾、鰱魚 ' + c[1] + ' 尾、大頭鰱 ' + c[2] + ' 尾。'
          + '原則：同一層吃食的魚別放太多，會搶食搶氧；放太密水質先垮——寧可疏一點。分批出魚後隨即補放中魚，池子產量才接得上。',
      };
    },
  },
  soil: {
    inputs: [
      { key: 'ph', label: '清晨池水 pH', unit: '', def: '7.8' },
      { key: 'nh3', label: '氨氮（有測再填）', unit: 'mg/L', def: '' },
      { key: 'color', label: '水色', unit: '', def: '淡綠茶色（清爽）', options: ['淡綠茶色（清爽）', '濃綠（快看不見手掌）', '茶褐轉黑、有臭味', '清澈見底'] },
    ],
    button: '幫我看水質 ›',
    hideDyn: true,
    run(v) {
      const ph = +v.ph, nh3 = v.nh3 === '' ? null : +v.nh3;
      const cards = [];
      if (ph < NZD.A.ph.lo) cards.push('偏酸（pH ' + ph + '）→ 生石灰少量多次調，每次每分水面約 10~20 公斤，隔幾天再測；一次下太多 pH 會暴衝');
      else if (ph > NZD.A.ph.hi) cards.push('偏高（pH ' + ph + '）→ 多半是藻太旺，午後會更高；換部分新水、減料，先別再培水');
      else cards.push('pH ' + ph + ' 在理想區間 ' + NZD.A.ph.lo + '~' + NZD.A.ph.hi + ' ✓');
      if (nh3 != null) {
        if (nh3 > 1) cards.push('氨氮 ' + nh3 + ' 危險→立刻換水約 1/3、今天停餵；查池裡有沒有殘餌和死魚。水溫高、pH 高時氨毒更毒');
        else if (nh3 > 0.5) cards.push('氨氮 ' + nh3 + ' 偏高→減料、加大換注新水，過幾天再測一次');
        else cards.push('氨氮 ' + nh3 + ' 正常 ✓');
      }
      if (v.color === '濃綠（快看不見手掌）') cards.push('水色偏濃→換 1/4 新水並減料，悶熱天濃水最容易半夜缺氧');
      else if (v.color === '茶褐轉黑、有臭味') cards.push('水已經老了→儘快換注新水（一次約 1/4~1/3，別一次換太多），底部有機物太多，該排清淤曬池了');
      else if (v.color === '清澈見底') cards.push('水太瘦→鰱魚大頭鰱沒東西吃；可少量培水養出淡綠茶色。若正要出魚反而好，順便去土味');
      else cards.push('水色淡綠茶色 ✓ 這就是最理想的水');
      const rec = NZD.S.get('readings', []);
      rec.unshift({ date: new Date().toISOString(), type: 'water', ph, nh3 });
      NZD.S.set('readings', rec.slice(0, 60));
      const bad = cards.filter(c => !c.includes('✓')).length;
      return {
        headline: bad ? '要處理 ' + bad + ' 件事，照著做！' : '水質狀況很好，照常管理！',
        detail: cards.join('。') + '。觀念：pH 清晨最低、午後最高；氨氮來自殘餌和魚的排泄，餵太多水就壞；溶氧天亮前最低。這三樣顧好，魚病少一半。已記錄這次檢測，下次再測就能看趨勢。',
      };
    },
  },
  subsidy: {
    inputs: [
      { key: 'reg', label: '有沒有養殖漁業登記', unit: '', def: '有', options: ['有', '沒有／不清楚'] },
      { key: 'decl', label: '今年放養申報做了沒', unit: '', def: '有', options: ['有', '還沒'] },
      { key: 'age', label: '年齡', unit: '', def: '45 歲以上', options: ['未滿 45 歲', '45 歲以上'] },
    ],
    button: '看我能領什麼 ›',
    run(v) {
      const okReg = v.reg === '有', okDecl = v.decl === '有', young = v.age === '未滿 45 歲';
      const items = [
        { name: '天然災害現金救助（颱風/寒害）', need: okReg && okDecl, gap: !okReg ? '要先有養殖漁業登記' : !okDecl ? '要先完成放養申報' : '',
          mode: '公告後限期向公所送件（有時限！災前災後照片先拍好）', docs: '放養申報紀錄、災損照片、身分證、存摺' },
        { name: '養殖水產保險保費補助', need: okReg, gap: okReg ? '' : '要先有養殖漁業登記',
          mode: '向漁會或有農險的產物保險公司投保，保費政府補助一部分；開放品項有限，先問你的魚種有沒有保單', docs: '養殖漁業登記、放養申報紀錄' },
        { name: '養殖設備補助（水車/增氧機/發電機）', need: okReg, gap: okReg ? '' : '要先有養殖漁業登記',
          mode: '各年度由漁業署與縣市公告受理，向區漁會或市府農業單位問最新一期', docs: '登記文件、設備報價單' },
        { name: '青年農民專案輔導（百大青農含漁業）', need: young, gap: young ? '' : '限 18~45 歲',
          mode: '線上報名，每年約 12 月~隔年 1 月遴選', docs: '經營計畫書（線上填寫上傳）' },
      ];
      const ok = items.filter(x => x.need && !x.gap), near = items.filter(x => x.gap);
      return {
        headline: '你目前符合 ' + ok.length + ' 項' + (near.length ? '、差一步 ' + near.length + ' 項' : '') + '！',
        detail: (ok.length ? '✅ 符合：' + ok.map(x => x.name + '——' + x.mode + '（備：' + x.docs + '）').join('｜') : '目前沒有直接符合的項目')
          + (near.length ? '。🟡 差一步：' + near.map(x => x.name + '——' + x.gap).join('｜') : '')
          + '。💡 放養申報是救助和保險的底——每批放苗記得申報；颱風寒流來之前先去塭邊拍照存證。（連結 2026-07 實測可達；資格與金額以最新公告為準）',
        links: [
          { label: '漁業署（養殖漁業與救助公告）', url: 'https://www.fa.gov.tw' },
          { label: '百大青農線上報名系統', url: 'https://100farmer.moa.gov.tw/' },
        ],
      };
    },
  },
  drone: {
    inputs: [
      { key: 'need', label: '你想做什麼', unit: '', def: '水質自動監測', options: ['水質自動監測', '空拍巡塭看全景'] },
    ],
    button: '怎麼找服務 ›',
    run(v) {
      if (v.need === '水質自動監測') return {
        headline: '魚塭最值得裝的是「溶氧監測＋警報」！',
        detail: '① 半夜缺氧浮頭是魚塭最大的損失來源——溶氧感測器配手機警報，出事馬上知道。② 從幾千元的手持溶氧計，到整套自動監測連動水車都有，量力升級：先買手持的養成天亮前測一次的習慣，再考慮自動化。③ 去哪問：水產試驗所的智慧養殖示範、在地漁會、養殖設備商都能問；買前先問同行用過哪套最穩。',
      };
      return {
        headline: '空拍巡塭：小塭走一圈就好，大面積才需要飛！',
        detail: '① 消費級空拍機飛塭區上方拍全景就夠用。② 看什麼：水色分區（整池該是均勻的淡綠茶色，局部翻黑＝底部有狀況）、堤岸有沒有沖蝕塌陷、進排水口與攔魚網有沒有異常。③ 發現異常→到池邊對照，用「魚病辨識」和「池水水質分析」判斷。＊空拍需遵守民航法規：機場周邊禁飛、400 呎以下。',
      };
    },
  },
  export: {
    inputs: [
      { key: 'dest', label: '想外銷去哪', unit: '', def: '日本', options: ['日本', '香港/澳門', '新加坡/馬來西亞'] },
    ],
    button: '要準備什麼 ›',
    run(v) {
      const common = '先說實話：活魚要外銷很難（活運和對方檢疫都卡關），石門活魚的強項是在地餐廳直供。要外銷通常走「冷凍加工」路線（魚片、魚頭料理包）。共同必備：① 輸出檢疫/衛生證明（向防檢署申請）② 藥物殘留檢驗報告 ③ 在登錄合格的加工廠處理 ④ 報關文件（多半交報關行處理）';
      const extra = {
        '日本': '日本另需：藥殘標準最嚴，用藥期就要對表管理；冷凍水產另有衛生要求，出貨前先向防檢署確認品項條件。',
        '香港/澳門': '港澳門檻相對低，但通路商多半要檢驗報告；港澳吃活魚文化強，有特殊活運管道的貿易商才做得起來。',
        '新加坡/馬來西亞': '新加坡查驗嚴格；馬來西亞清真市場對包裝標示有額外要求。兩地都建議走有水產經驗的貿易商。',
      };
      return {
        headline: '外銷' + v.dest + '的路線與文件清單開好了！',
        detail: common + '。' + extra[v.dest] + ' 建議路徑：第一次外銷先找有水產出口經驗的貿易商合作，別自己單打。＊流程為 2026-07 整理概要，出貨前以防檢署與漁業署公告為準。',
        links: [
          { label: '動植物防疫檢疫署（輸出檢疫）', url: 'https://www.aphia.gov.tw' },
          { label: '漁業署', url: 'https://www.fa.gov.tw' },
        ],
      };
    },
  },
  carbon: {
    inputs: [
      { key: 'feed', label: '飼料用量', unit: 'kg/期', def: '9000' },
      { key: 'power', label: '用電（水車/抽水）', unit: '度/期', def: '4000' },
      { key: 'km', label: '運輸里程', unit: 'km/期', def: '600' },
      { key: 'out', label: '總收成', unit: 'kg', def: '5000' },
    ],
    button: '算碳足跡 ›',
    run(v) {
      const EF = { feed: 2.0, power: 0.494, km: 0.25 };
      const total = (+v.feed || 0) * EF.feed + (+v.power || 0) * EF.power + (+v.km || 0) * EF.km;
      const per = total / Math.max(1, +v.out || 1);
      return {
        headline: '這期碳足跡約 ' + Math.round(total).toLocaleString() + ' kgCO2e，每公斤魚約 ' + per.toFixed(2) + ' kg！',
        detail: '組成：飼料 ' + Math.round((+v.feed || 0) * EF.feed) + '（係數 2.0/kg 概算）＋用電 ' + Math.round((+v.power || 0) * EF.power)
          + '（0.494/度）＋運輸 ' + Math.round((+v.km || 0) * EF.km) + '（0.25/km）kgCO2e。減碳最有感的順序：顧好餌料效率（八分飽、別讓殘餌沉底——省錢、減碳又顧水質）→ 就近直供餐廳減運輸 → 水車按需要開、配監測不空轉。＊為概算係數（2026-07 整理），正式碳盤查請依環境部/農業部公告方法學。',
      };
    },
  },
  learn: {
    inputs: [
      { key: 'topic', label: '想學什麼', unit: '', def: '魚病與水質管理', options: ['魚病與水質管理', '養殖技術', '加工與保鮮', '行銷與品牌', '智慧養殖'] },
    ],
    button: '推薦資源 ›',
    run(v) {
      const lib = {
        '魚病與水質管理': '① 水產試驗所（tfrin.gov.tw）有淡水養殖研究單位與技術專刊，官網可下載。② 農民學院（academy.moa.gov.tw）搜「水產養殖」有入門課程。③ 魚病搞不清楚原因，先問水試所或縣市動物防疫機關，別自己亂下藥。',
        '養殖技術': '① 水試所的訓練班與出版品是淡水養殖最完整的資源。② 農民學院搜「水產」線上課打底。③ 在地漁會和養殖同行的經驗最實戰——多走動多問。',
        '加工與保鮮': '① 水試所有水產加工與保鮮技術資料可查。② 農民學院搜「水產加工」相關課程。③ 想做魚片、料理包，先找登錄合格的代工廠談，衛生規格才過得了通路。',
        '行銷與品牌': '① 農民學院「農產品行銷」入門到進階。② 各縣市青農聯誼會常辦電商實戰工作坊——加入在地青農 LINE 群。③ 在地活魚節慶與觀光活動是曝光好機會，跟著檔期出貨。',
        '智慧養殖': '① 水試所有智慧養殖示範與研究成果。② 農業部智慧農業推動方案含養殖漁業，有補助與案例。③ 先從溶氧監測警報入手，投資小、最有感。',
      };
      return {
        headline: '「' + v.topic + '」的免費資源清單來了！',
        detail: lib[v.topic] + ' 全部免費或政府補助。建議路徑：先上線上課打底 → 追水試所講習與專刊 → 加入在地同業群跟同行交流。（2026-07 整理）',
        links: [
          { label: '水產試驗所', url: 'https://www.tfrin.gov.tw' },
          { label: '農民學院（線上課程）', url: 'https://academy.moa.gov.tw' },
          { label: '漁業署', url: 'https://www.fa.gov.tw' },
        ],
      };
    },
  },
  insure: {
    inputs: [
      { key: 'fear', label: '你最怕什麼', unit: '', def: '颱風豪雨', options: ['颱風豪雨', '寒流寒害', '魚病大量死亡', '價格不好'] },
    ],
    button: '該怎麼保 ›',
    run(v) {
      const map = {
        '颱風豪雨': { pick: '養殖水產保險（有開放品項才保得到）＋天災救助當基本盤', why: '保險理賠通常比現金救助高，但淡水魚開放品項有限', how: '向漁會或有農險的產險公司問你的魚種有沒有保單；沒有就靠放養申報＋災前照片領天災救助' },
        '寒流寒害': { pick: '養殖水產保險的低溫型保單', why: '寒害是養殖水產保險的主力險種，多為溫度參數型——低溫達標就理賠，不用逐尾算損失', how: '入冬前向漁會問開放品項與投保截止日，錯過就要再等一年' },
        '魚病大量死亡': { pick: '管理與紀錄就是你的保險', why: '魚病險幾乎沒有——水質顧好、每年清淤曬池、苗源挑好，才是真保障', how: '作業日誌把死魚數和用藥記清楚；短時間大量暴斃先通報縣市動物防疫機關釐清原因，別急著下藥' },
        '價格不好': { pick: '分散通路比等保單實際', why: '淡水活魚的收入型保單還很少；價格風險靠餐廳直供、零售、團購多條腿走路', how: '用「買家媒合」把通路分散，固定問兩三家盤商報價，別被單一價綁死' },
      };
      const m = map[v.fear];
      return {
        headline: '怕' + v.fear + '→ 建議：' + m.pick + '！',
        detail: '為什麼：' + m.why + '。怎麼做：' + m.how + '。投保時效：多數險種有截止日（颱風季、入冬前！），現在就去漁會問。＊險種開放品項每年調整，以主管機關與保險公司公告為準（2026-07 整理）。',
        links: [
          { label: '農業金融署・推動農業保險', url: 'https://www.afna.gov.tw/view.php?theme=web_structure&id=208' },
          { label: '漁業署', url: 'https://www.fa.gov.tw' },
        ],
      };
    },
  },
  proc: {
    inputs: [
      { key: 'stock', label: '池裡已達規格的量', unit: 'kg', def: '800' },
      { key: 'price', label: '這週收購價', unit: '元/kg', def: '70' },
    ],
    button: '活魚出還是加工？›',
    run(v) {
      const s = +v.stock || 0, p = +v.price || 0;
      const sLv = s > 1000 ? '高' : s >= 500 ? '中' : '低';
      const pLv = p < 60 ? '低' : p <= 80 ? '中' : '高';
      let head, det;
      if (sLv === '高' && pLv === '低') {
        head = '別硬出！活魚的好處就是可以留池等價。';
        det = '分批慢出，先出規格最大的；留池的改八分飽控飼料成本。弱魚傷魚別留——當日現宰冰鮮或加工（魚頭、魚片）止損。';
      } else if (sLv === '低' && pLv === '高') {
        head = '全力出貨！量不多、價又好，趁現在。';
        det = '好行情別留——聯絡固定往來的餐廳和盤商快出；規格齊活力好的走直供賣好價。';
      } else if (pLv === '高') {
        head = '行情好（' + p + ' 元）——以活魚直供為主，加工留給次級魚。';
        det = '達規格的分批出，A 級走餐廳直供；受傷沒力的才進現宰冰鮮或加工。';
      } else if (sLv === '高') {
        head = '在池量偏高（' + s + 'kg）——雙軌走：好魚分批出、次魚加工。';
        det = '行情中等不用賤賣；每週固定出一部分，C 級現宰冰鮮或做魚頭、魚片加工。留池的控制投餵，別越養越大超出餐廳要的規格。';
      } else {
        head = '不急，照正常節奏分批出魚就好。';
        det = '在池量' + sLv + '、行情' + pLv + '——維持分級分批出貨；每週問一次收購價再決定。';
      }
      return { headline: head, detail: det + ' 判斷門檻：量多>1000kg／行情低<60 元、高>80 元（照你輸入的口徑自己校準）。加工前先算成本：代工費、包材、冷凍運費若吃掉價差就別做。' };
    },
  },
  copywrite: _mkCopywrite({
    emoji: '🐟', noun: '石門活魚（草魚／大頭鰱）', unit: '台斤', unitNote: '整尾約 3~5 台斤', defPrice: 80,
    defSell: '現撈活魚',
    fresh: '活水養殖、現撈處理',
    story: ['水庫活水養出來的魚肉質緊實不帶土味，', '現撈處理直接封箱，鮮度看得見。'],
    safe: '養殖水源乾淨、出貨前活魚吊水吐沙',
    ship: '現撈處理後低溫宅配或面交', keep: '冷藏 2 天內食用，或分裝冷凍',
    notice: ['整尾出貨，實際重量依當日漁獲略有差異',
             '生鮮水產低溫出貨，不適用七天猶豫期'],
    tags: ['石門活魚', '現撈', '砂鍋魚頭', '產地直送'],
    sells: {
      '現撈活魚': [
        { head: '🐟 早上還在池裡游，中午就能上桌——活力好，肉質才彈！',
          sub: '活魚現撈現處理，這種新鮮超市買不到。' },
        { head: '🐟 活魚的彈性騙不了人——今天現撈，要的動作快！',
          sub: '魚鰓紅、眼睛亮，看得見的新鮮。' },
      ],
      '當日直送': [
        { head: '🚚 石門水庫邊的魚塭當天直送，不繞批發、少一層就是新鮮！',
          sub: '從魚塭到你家，中間沒有別人。' },
        { head: '🚚 當日處理當日出——石門直送，晚餐就能上桌。',
          sub: '砂鍋魚頭、糖醋、清蒸，怎麼煮都對味。' },
      ],
      '現撈現宰': [
        { head: '🔪 現撈現宰馬上冰鎮，魚鰓紅、眼睛亮，新鮮看得到！',
          sub: '處理乾淨到家直接下鍋，省事又新鮮。' },
        { head: '🔪 撈起來十分鐘內處理完冰鎮——鮮度就是這樣鎖住的。',
          sub: '可依需求切段、去鱗去鰓，跟我說就好。' },
      ],
      '量大優惠': [
        { head: '📦 這批規格齊、量也足，餐廳、辦桌、揪團訂更划算！',
          sub: '整批訂購另有優惠，歡迎店家長期配合。' },
        { head: '📦 辦桌、聚餐、餐廳備貨看過來——量大直配價更漂亮！',
          sub: '規格齊全出貨穩定，長期配合歡迎聊聊。' },
      ],
    },
  }),
  buyer: {
    inputs: [
      { key: 'ch', label: '想走的通路', unit: '', def: '活魚餐廳直供', options: ['活魚餐廳直供', '盤商收購', '自家塘邊零售', '社區團購', '電商冰鮮宅配'] },
    ],
    button: '怎麼接洽？›',
    run(v) {
      const guide = {
        '活魚餐廳直供': ['列出石門水庫周邊與市區的活魚、砂鍋魚頭餐廳，帶幾尾樣品魚直接找老闆談', '談定規格（草魚約 2~3 公斤/尾）、送貨日與活魚交貨方式', '眉角：餐廳最在意活力與規格一致——穩定供貨比低價重要，寧可少接幾家別斷貨'],
        '盤商收購': ['問在地漁會或同行認識的活魚盤商，多問兩三家比價', '約好拉網日，盤商多半整批收、當場過磅', '眉角：先講好規格與淘汰魚怎麼算，過磅時自己在場看'],
        '自家塘邊零售': ['塘邊掛牌、路口立牌，做假日遊客與熟客生意', '提供現撈現宰服務，處理好帶走，回購率最高', '眉角：固定開賣時段，養成熟客習慣；收現金最單純'],
        '社區團購': ['加入在地社區 FB 社團/LINE 群，先發「行銷文案生成」做的貼文', '收單→拉網現撈→面交點交貨，貨到收現金', '眉角：固定每週開團日，魚處理好分袋，交貨快不耽誤人'],
        '電商冰鮮宅配': ['現宰分切、真空包裝＋低溫宅配，主打魚頭與魚片', '用「行銷文案生成」寫商品文，照片拍清楚魚鰓魚眼', '眉角：運費和包材是獲利殺手——滿額免運門檻抓高一點'],
      };
      const g = guide[v.ch];
      return { headline: '走「' + v.ch + '」的三步驟：', detail: '① ' + g[0] + '。② ' + g[1] + '。③ ' + g[2] + '。搭配：先用「定價策略建議」算這個通路該賣多少，再去談。' };
    },
  },
  trace: {
    inputs: [],
    button: '生成履歷卡 ›',
    run() {
      const p = NZD.S.get('profile') || {};
      const season = NZD.S.get('season');
      const logs = NZD.S.get('logs', []);
      const meds = logs.filter(x => x.cat === '噴藥' || x.cat === '用藥').slice(0, 5);
      const feeds = logs.filter(x => x.cat === '施肥' || x.cat === '投餵').slice(0, 5);
      const lines = [
        '🐟 產品履歷卡',
        '品名：石門活魚（' + CROP.county + '石門水庫周邊魚塭養殖）',
        '生產者：' + (p.farm_name || '（到 ⚙️ 我的農場填名稱）'),
        season ? '放養：' + season.transplant_date + '｜出魚：' + (season.harvest_start || '—') + ' 起' : '養殖時程：（到「放養時機」排時程後自動帶入）',
        meds.length ? '用藥紀錄：' + meds.map(x => x.date.slice(5) + ' ' + x.txt).join('；') : '用藥紀錄：本季無用藥紀錄',
        feeds.length ? '投餵紀錄：' + feeds.map(x => x.date.slice(5) + ' ' + x.txt).join('；') : '',
        '（資料來自小農工具箱作業日誌，' + new Date().toISOString().slice(0, 10) + ' 產出）',
      ].filter(Boolean);
      return { headline: '履歷卡生成了——複製貼到出貨單、貼文或印出來給餐廳！', detail: lines.join('\n') };
    },
  },
  pnl: {
    inputs: [
      { key: 'soldKg', label: '實際售出量', unit: 'kg', def: '5000' },
      { key: 'avgPrice', label: '平均售價', unit: '元/kg', def: '70' },
    ],
    button: '結算 ›',
    run(v) {
      const cost = NZD.S.get('cost');
      if (!cost) return { headline: '先去「成本試算」存一份計畫，我才有成本可以對！', detail: '成本試算會存總投入與損平價，出完魚回來這裡輸入實際賣量和均價就能結算。' };
      const kg = +v.soldKg || 0, p = +v.avgPrice || 0;
      const rev = kg * p, profit = rev - cost.total_cost;
      const margin = rev > 0 ? (profit / rev * 100).toFixed(1) : 0;
      const fmt = n => Math.round(n).toLocaleString();
      const vsPlan = cost.expected_qty ? '（計畫收成 ' + cost.expected_qty.toLocaleString() + ' kg，實售達成 ' + Math.round(kg / cost.expected_qty * 100) + '%）' : '';
      const it = cost.items || {};
      return {
        headline: profit >= 0 ? '這批賺 ' + fmt(profit) + ' 元！毛利率 ' + margin + '%。' : '這批虧 ' + fmt(-profit) + ' 元（毛利率 ' + margin + '%）。',
        detail: '營收 ' + fmt(rev) + ' 元（' + kg.toLocaleString() + ' kg × ' + p + ' 元）− 總投入 ' + fmt(cost.total_cost) + ' 元。'
          + '實際均價 ' + p + ' vs 損平價 ' + cost.breakeven_price + ' 元/kg' + (p >= cost.breakeven_price ? '，有守住！' : '——低於損平，下批從「顧好育成率」或「規格養齊走餐廳直供」下手。')
          + vsPlan + ' 成本組成參考：魚苗 ' + fmt(it.fry || 0) + '／飼料 ' + fmt(it.feed || 0) + '／電費雜支 ' + fmt(it.power || 0) + ' 元。',
      };
    },
  },
  harvest: {
    inputs: [
      { key: 'tdate', label: '放苗日期', unit: '', def: '', type: 'date' },
    ],
    button: '算收成窗 ›',
    noPrepare: true,
    hideDyn: true,
    async run(v) {
      if (!v.tdate) return { headline: '先給我這池的放苗日期！', detail: '抓大概也可以。石門活魚從放苗到上市規格（草魚約 2~3 公斤/尾）大約要 12~18 個月。' };
      const d = await NZD.D.weather(CROP.county);
      const avg7 = d.temperature_2m_max.slice(0, 7).map((x, i) => (x + d.temperature_2m_min[i]) / 2)
        .reduce((a, b) => a + b, 0) / 7;
      const hw = NZD.harvestWindow(v.tdate, avg7);
      const days = Math.floor((Date.now() - new Date(v.tdate)) / 864e5);
      const toStart = Math.ceil((new Date(hw.start) - Date.now()) / 864e5);
      const hot = avg7 >= NZD.A.hotHarvestAdvance.temp;
      let rush = '';
      for (let i = 0; i < 3; i++) {
        const gust = (d.wind_gusts_10m_max || d.wind_speed_10m_max)[i];
        if ((d.precipitation_sum[i] >= NZD.C.alert.rain1d || gust >= NZD.C.alert.windKmh) && days >= 330) {
          rush = ' ⚠️ ' + d.time[i].slice(5).replace('-', '/') + ' 有暴雨/強風警訊——達規格的先撈一部分出掉，颱風跑魚、缺氧翻池都是整池的損失！';
          break;
        }
      }
      let head, det;
      if (toStart > 0) {
        head = '還沒到規格——大約 ' + toStart + ' 天後（' + hw.start.slice(5).replace('-', '/') + '）進上市窗。';
        det = '放養第 ' + days + ' 天。預估上市窗 ' + hw.start.slice(5).replace('-', '/') + '～' + hw.end.slice(5).replace('-', '/')
          + (hot ? '（近 7 日均溫 ' + avg7.toFixed(1) + '°C，攝食旺長得快，已按提早約 ' + NZD.A.hotHarvestAdvance.days + ' 天計）' : '（冬季低溫魚幾乎不長，實際會再延後）')
          + '。這段時間顧好投餵與水質，接近規格改八分飽。' + rush;
      } else if (new Date(hw.end) >= Date.now()) {
        head = '差不多了！放養第 ' + days + ' 天，已進上市規格窗。';
        det = '先撈幾尾秤看看——草魚約 2~3 公斤/尾就能出。建議分批出魚：先出達規格的，別一次清池。出魚前 3~5 天加大換水去土味、拉網前 1~2 天停餌讓魚排空。' + rush + ' 出魚後到「活魚分級建議」分規格，好魚走餐廳直供。';
      } else {
        head = '放養第 ' + days + ' 天，超過預估養成期——達規格就趕快出！';
        det = '養越久飼料越吃越多，規格過大餐廳反而難用。分批出清後安排清淤曬池，再放下一批。到「池底老化評估」看看該不該整池。';
      }
      NZD.S.set('harvest', { checked_at: new Date().toISOString().slice(0, 10), days, window: hw });
      return { headline: head, detail: det };
    },
  },
  grade: {
    inputs: [
      { key: 'size', label: '這批體型', unit: '', def: '大小整齊', options: ['大小整齊', '略有大小', '大小差很多'] },
      { key: 'vit', label: '活力狀況', unit: '', def: '活力好（搶食、游速快）', options: ['活力好（搶食、游速快）', '普通', '部分沒力、有傷'] },
      { key: 'kg', label: '這批重量', unit: 'kg', def: '300' },
    ],
    button: '幫我分級 ›',
    run(v) {
      const kg = +v.kg || 300;
      const sizeIdx = ['大小整齊', '略有大小', '大小差很多'].indexOf(v.size);
      const vitIdx = ['活力好（搶食、游速快）', '普通', '部分沒力、有傷'].indexOf(v.vit);
      const q = sizeIdx + vitIdx;
      const dist = q === 0 ? [70, 25, 5] : q === 1 ? [55, 35, 10] : q === 2 ? [35, 45, 20] : q === 3 ? [20, 45, 35] : [10, 40, 50];
      const A = Math.round(kg * dist[0] / 100), B = Math.round(kg * dist[1] / 100), C = kg - A - B;
      NZD.S.set('grades', { date: new Date().toISOString().slice(0, 10), kg, dist: { A, B, C } });
      return {
        headline: '這批 ' + kg + 'kg 建議分：A 級約 ' + A + 'kg、B 級 ' + B + 'kg、C 級 ' + C + 'kg。',
        detail: 'A 級（規格齊、活力好）走活魚餐廳直供賣好價；B 級走盤商或自家零售正常出；C 級（受傷、沒力）別上活魚車——當日現宰冰鮮或加工，弱魚半路翻肚會拖累整車的價。'
          + '分級標準：A 體型一致活力好無外傷／B 活力普通不影響出貨／C 有傷或明顯沒力。撈魚裝運動作放輕別擦傷魚體。接著到「定價策略建議」算各級賣多少。',
      };
    },
  },
  store: {
    inputs: [
      { key: 'mode', label: '這趟怎麼出', unit: '', def: '活魚運輸（到餐廳）', options: ['活魚運輸（到餐廳）', '現宰冰鮮（宅配/零售）'] },
      { key: 'temp', label: '運輸水溫／冰鮮溫度', unit: '°C', def: '18' },
      { key: 'hours', label: '路程時間', unit: '小時', def: '1' },
    ],
    button: '檢查運輸條件 ›',
    hideDyn: true,
    run(v) {
      const t = +v.temp, h = +v.hours || 1;
      const issues = [];
      if (v.mode === '活魚運輸（到餐廳）') {
        if (t < 12) issues.push('水溫太低（' + t + '°C）——跟池水差太多魚會緊迫，降溫要慢慢來');
        if (t > 20) issues.push('水溫偏高（' + t + '°C）——魚耗氧快、活力掉得快，加冰袋慢慢降到 12~20°C');
        if (h > 2) issues.push('路程超過 2 小時——裝載密度減半、全程打氣、中途停車檢查');
        return {
          headline: issues.length ? '條件要調：' + issues[0] + '！' : '條件不錯，照這樣出活力保得住！',
          detail: (issues.length ? '全部問題：' + issues.join('；') + '。' : '')
            + '活魚運輸口訣：水溫 12~20°C、降溫要慢（跟池水差別太大）、全程打氣、密度別貪多。出魚前 1~2 天停餌讓魚排空比較耐運，撈魚裝車動作放輕別擦傷。短程直送、當天到店最能保住活力——這就是石門活魚的本錢。',
        };
      }
      const S = NZD.A.storage;
      if (t > S.tempHi) issues.push('溫度偏高（' + t + '°C）——超過 ' + S.tempHi + '°C 鮮度掉得快，補冰壓到 ' + S.tempLo + '~' + S.tempHi + '°C');
      if (t < S.tempLo) issues.push('溫度太低（' + t + '°C）——沒有要凍就別低於 ' + S.tempLo + '°C，半凍半解肉質變差');
      if (h > 24) issues.push('要放超過一天——冰要補足、魚體覆冰保濕，或改急速冷凍');
      return {
        headline: issues.length ? '條件要調：' + issues[0] + '！' : '冰鮮條件不錯，照這樣出！',
        detail: (issues.length ? '全部問題：' + issues.join('；') + '。' : '')
          + '冰鮮口訣：現宰後盡快降到 ' + S.tempLo + '~' + S.tempHi + '°C、魚體覆冰保持濕度（' + S.rhLo + '~' + S.rhHi + '%）、當天出貨最好。宅配用保麗龍箱加冰袋走低溫宅配，魚鰓紅、眼睛亮就是最好的招牌。',
      };
    },
  },
  labor: {
    inputs: [
      { key: 'total', label: '預計收成總量', unit: 'kg', def: '5000' },
      { key: 'perDay', label: '每人每天可處理', unit: 'kg', def: '400' },
      { key: 'people', label: '可用人數', unit: '人', def: '3' },
      { key: 'weeks', label: '出魚期', unit: '週', def: '6' },
    ],
    button: '排排看 ›',
    hideDyn: true,
    run(v) {
      const total = +v.total || 0, per = +v.perDay || 400, ppl = +v.people || 1, weeks = Math.max(1, +v.weeks || 6);
      const manDays = Math.ceil(total / per);
      const perWeek = Math.ceil(manDays / weeks);
      const havePerWeek = ppl * 6;
      const peak = NZD.A.laborPeak;
      const bench = perWeek < peak.lo ? '低於常態高峰（' + peak.lo + '~' + peak.hi + ' 人天/週），輕鬆' :
        perWeek <= peak.hi ? '落在常態高峰區間（' + peak.lo + '~' + peak.hi + ' 人天/週）' : '超過常態高峰（' + peak.lo + '~' + peak.hi + ' 人天/週）——很趕';
      const gap = perWeek - havePerWeek;
      return {
        headline: gap <= 0 ? '人力夠！每週需 ' + perWeek + ' 人天，你們 ' + ppl + ' 人做得完。'
          : '缺工！每週需 ' + perWeek + ' 人天，你們只有 ' + havePerWeek + ' 人天——差 ' + gap + '。',
        detail: '總量 ' + total.toLocaleString() + ' kg ÷ 每人日處理 ' + per + ' kg ＝ 約 ' + manDays + ' 人天，分 ' + weeks + ' 週＝每週 ' + perWeek + ' 人天（約每天 ' + Math.ceil(perWeek / 6) + ' 人）。'
          + bench + '。拉網、分級、裝車打氣是人力最重的環節。' + (gap > 0 ? '對策：出魚日找臨時工 ' + Math.ceil(gap / 6) + ' 人、拉長出魚期分批出、或跟盤商約整批收省工。' : '出魚日優先配滿人——拉網要快，魚離水時間越短活力越好。'),
      };
    },
  },
  fert: {
    inputs: [
      { key: 'rdate', label: '放苗日期', unit: '', def: '', type: 'date' },
    ],
    button: '排投餵計畫 ›',
    noPrepare: true,
    run(v) {
      if (!v.rdate) return { headline: '先告訴我放苗日期，我才能算這池在哪一期！', detail: '不記得確切日期抓大概也行；石門活魚從放苗到上市大約 12~18 個月，分三個階段餵法不一樣。' };
      const days = Math.floor((Date.now() - new Date(v.rdate)) / 864e5);
      if (days < 0) return { headline: '還沒放苗（還有 ' + (-days) + ' 天）——先整池養水！', detail: NZD.A.fertPlans.seedling + ' 放苗當天挑清晨，袋內外水溫差 2°C 以內慢慢兌水再下池。' };
      const g = NZD.A.growthPhases;
      const ph = g.find(x => days >= x.lo && days < x.hi) || g[g.length - 1];
      const idx = g.indexOf(ph);
      const key = idx === 0 ? 'seedling' : idx === 1 ? 'flower' : 'fruit';
      const next = idx < g.length - 1 ? '約第 ' + g[idx + 1].lo + ' 天進「' + g[idx + 1].name + '」' : '達上市規格就分批出魚，出魚前記得停餌';
      return {
        headline: '這池第 ' + days + ' 天，是「' + ph.name + '」！',
        detail: '本期怎麼餵：' + NZD.A.fertPlans[key] + ' 下一步：' + next + '。通用原則：以 10~15 分鐘吃完為準、水色太濃就減料、悶熱天寧可少餵。餵完到「作業日誌」記一筆。',
      };
    },
  },
  pest: {
    inputs: [
      { key: 'part', label: '池邊看到什麼異狀', unit: '', def: '清晨或悶熱雷雨過後,魚整群浮到水面張嘴呼吸、趕也不散,嚴重時池邊開始翻肚死魚', options: [
        '清晨或悶熱雷雨過後,魚整群浮到水面張嘴呼吸、趕也不散,嚴重時池邊開始翻肚死魚',
        '魚離群靠邊慢游、體色發黑,撈起來掀開鰓蓋看,鰓絲末端發白潰爛、黏著泥屑',
        '魚不太吃料、肚子脹、肛門紅腫,池面漂著白色黏黏的糞便絲',
        '魚體或尾鰭的傷口長出一團團灰白像棉絮的東西,魚一直磨擦池壁、食慾變差',
        '低溫期魚體和魚鰭布滿針尖大小的白點,魚不停磨擦池壁、擠在進水口',
        '魚身上插著幾根像細針的小蟲、插入處紅腫發炎,魚常磨擦池壁或跳出水面',
      ] },
      { key: 'sev', label: '嚴重程度', unit: '', def: '輕微（一兩尾）', options: ['輕微（一兩尾）', '中等（陸續看到幾尾）', '嚴重（整池都是/開始死魚）'] },
    ],
    button: '幫我判斷 ›',
    run(v) {
      const t = (NZD.A.pestTable || []).find(p => p.symptom === v.part) || (NZD.A.pestTable || [])[0];
      if (!t) return { headline: '對照表載入不了，先做基本功。', detail: '先開水車、加注新水、停餵觀察；死魚撈離池區。狀況持續就聯絡水產養殖輔導單位。' };
      const sev = v.sev.startsWith('嚴重') ? 2 : v.sev.startsWith('中') ? 1 : 0;
      const sevAdd = sev === 2 ? '已經整池出狀況——先開水車、換水、停餵穩住，同時聯絡水產養殖輔導單位或水試所；短時間大量暴斃要通報縣市動物防疫機關釐清原因，千萬別急著自己下藥。'
        : sev === 1 ? '還壓得住，這 3 天每天清晨巡池，數死魚數有沒有增加。' : '早期處理最省錢，做完觀察 3~5 天。';
      const rec = NZD.S.get('pest', []);
      rec.unshift({ date: new Date().toISOString().slice(0, 10), part: v.part, sev, soilborne: !!t.soilborne });
      NZD.S.set('pest', rec.slice(0, 100));
      return {
        headline: '比較可能是：' + t.name + '。',
        detail: '先做這件事：' + t.act + '。' + sevAdd + (t.soilborne ? ' ⚠️ 這類毛病跟池底淤泥累積有關——已記錄，「池底老化評估」會算進清淤曬池的時機。' : '')
          + ' 需要用藥一律先問水產養殖輔導單位或獸醫，守停藥期；死魚撈離池區別留著。',
      };
    },
  },
  chain: {
    inputs: [
      { key: 'seasons', label: '幾年沒清淤曬池', unit: '年', def: '2' },
      { key: 'disease', label: '今年底泥相關魚病次數', unit: '次', def: '0' },
    ],
    button: '評估池底 ›',
    noPrepare: true,
    run(v) {
      const y = +v.seasons || 0;
      const recCnt = (NZD.S.get('pest', []) || []).filter(p => p.soilborne).length;
      const d = Math.max(+v.disease || 0, recCnt);
      const recNote = recCnt > 0 ? '（魚病辨識記錄到 ' + recCnt + ' 次跟底泥有關的毛病，已一併算進去）' : '';
      let head, act;
      if (y >= 3 || d >= 2) {
        head = '🔴 池底該整了！' + y + ' 年沒整池＋底泥型魚病 ' + d + ' 次。';
        act = '今年出完魚一定要排：池水排乾→清走底部淤泥→曝曬 2~4 週曬到龜裂→生石灰整池（每分水面約 50~75 公斤）→再進水養水。爛鰓、白點、錨頭蚤這些老毛病，大多是底泥養出來的。';
      } else if (y === 2 || d === 1) {
        head = '🟡 中風險——把清淤曬池排進今年冬季計畫。';
        act = '冬天低溫魚不長，出完魚正是曬池的好時機。這段時間先顧好換水、殘餌別沉底，死魚即撈即清。';
      } else {
        head = '🟢 池況還行，照常管理！';
        act = '維持每年出完魚清淤、曬池、生石灰整池一次的習慣，這是減少爛鰓、錨頭蚤、白點這些老毛病最有效的一招。';
      }
      return { headline: head, detail: act + recNote + ' 門檻：<2 年且 0 次＝低；2 年或 1 次＝中；≥3 年或 ≥2 次＝高。' };
    },
  },
  water: {
    inputs: [
      { key: 'color', label: '今天的水色', unit: '', def: '淡綠茶色（清爽）', options: ['淡綠茶色（清爽）', '濃綠（快看不見手掌）', '茶褐轉黑、有臭味'] },
      { key: 'float', label: '有沒有看到浮頭', unit: '', def: '沒有', options: ['沒有', '清晨有一點、天亮就散', '整群浮頭趕不散'] },
    ],
    button: '今天要換水開水車嗎 ›',
    noPrepare: true,
    hideDyn: true,
    async run(v) {
      const d = await getWeather();
      const rainToday = d.precipitation_sum[0], rainTmr = d.precipitation_sum[1];
      const tmax = d.temperature_2m_max[0];
      const muggy = tmax >= 32 || (rainToday >= 10 && tmax >= 28);
      let head, act;
      if (v.float === '整群浮頭趕不散') {
        head = '緊急！立刻開全部水車、加注新水、今天停餵！';
        act = '缺氧浮頭是最快讓整池翻掉的狀況——水車全開、新水加注、死魚撈離。穩住之後找原因：水色太濃就換水減料，連日悶熱雷雨就整夜開水車。這幾天天亮前一定要到池邊。';
      } else if (v.float === '清晨有一點、天亮就散') {
        head = '警戒！今晚水車開整夜，明天天亮前到池邊巡。';
        act = '清晨小浮頭是缺氧前兆——換掉約 1/4 池水、投餵減量，悶熱天傍晚就把水車開起來。連續兩天都浮頭就要大換水並查水質。';
      } else if (v.color === '茶褐轉黑、有臭味') {
        head = '水已經老了——儘快換注新水！';
        act = '一次換約 1/4~1/3，別一次換太多讓魚緊迫；停餵 1~2 天，底部有機物太多，順便評估「池底老化評估」該不該清淤。';
      } else if (v.color === '濃綠（快看不見手掌）') {
        head = '該換水了——水色太濃，半夜容易出事。';
        act = '換約 1/4 新水並減料；' + (muggy ? '今天悶熱（' + tmax + '°C），傍晚到清晨水車照開，天亮前巡一圈。' : '傍晚起開水車保險，天亮前巡池。');
      } else {
        head = muggy ? '水色不錯，但今天悶熱——水車照開別偷懶！' : '水色不錯，照常管理！';
        act = '維持每 7~10 天換注新水一次；' + (muggy ? '悶熱天（' + tmax + '°C）傍晚到清晨開水車，清晨天亮前繞池看一圈。' : '清晨還是繞池看一圈，看到浮頭馬上處理。');
      }
      const rainAdd = (rainToday >= 30 || rainTmr >= 30) ? ' ⚠️ 預報今明有較大雨（今 ' + rainToday + '／明 ' + rainTmr + 'mm）——雨後池水翻動大，先停餵並加開水車，等水色回穩再恢復投餵。' : '';
      return { headline: head, detail: act + rainAdd + '（今天 ' + tmax + '°C／雨 ' + rainToday + 'mm，明天雨 ' + rainTmr + 'mm，' + CROP.county + ' open-meteo 預報）' };
    },
  },
  readings: {
    inputs: [
      { key: 'wtemp', label: '池水溫', unit: '°C', def: '26' },
      { key: 'ph', label: '清晨池水 pH', unit: '', def: '7.8' },
      { key: 'dox', label: '溶氧（有測再填）', unit: 'mg/L', def: '' },
    ],
    button: '幫我判讀 ›',
    run(v) {
      const t = +v.wtemp, ph = +v.ph, dox = v.dox === '' ? null : +v.dox;
      const issues = [], tips = [];
      if (t < 10) { issues.push('水溫太低（' + t + '°C）'); tips.push('魚幾乎不吃料——停餵或大減料，水位加深保溫'); }
      else if (t < 20) { issues.push('水溫偏低（' + t + '°C）'); tips.push('攝食慢，投餵減量、挑中午餵'); }
      else if (t >= 35) { issues.push('水溫過高（' + t + '°C）'); tips.push('緊迫又缺氧——加開水車、加注新水、投餵減量'); }
      else if (t > 32) { issues.push('水溫偏高（' + t + '°C）'); tips.push('溶氧撐不住，悶熱午後別餵太多、水車多開'); }
      if (ph < NZD.A.ph.lo) { issues.push('pH 偏酸（' + ph + '）'); tips.push('生石灰少量多次調回 ' + NZD.A.ph.lo + '~' + NZD.A.ph.hi); }
      else if (ph > NZD.A.ph.hi) { issues.push('pH 偏高（' + ph + '）'); tips.push('藻太旺——換部分新水、減料，清晨再測一次確認'); }
      if (dox != null) {
        if (dox < 3) { issues.push('溶氧危險（' + dox + ' mg/L）'); tips.push('隨時會浮頭——立刻開水車、換水、停餵'); }
        else if (dox < 5) { issues.push('溶氧偏低（' + dox + ' mg/L）'); tips.push('清晨會更低——天亮前巡池、傍晚起開水車'); }
      }
      const rec = NZD.S.get('readings', []);
      rec.unshift({ date: new Date().toISOString(), type: 'water', wtemp: t, ph, dox });
      NZD.S.set('readings', rec.slice(0, 60));
      if (!issues.length) return { headline: '幾個數值都在安全範圍，池況不錯！', detail: '水溫 ' + t + '°C（適溫 20~30°C）、pH ' + ph + '（理想 ' + NZD.A.ph.lo + '~' + NZD.A.ph.hi + '）' + (dox != null ? '、溶氧 ' + dox + ' mg/L（5 以上安心）' : '') + '。已記錄，累積起來就能看趨勢。提醒：溶氧天亮前最低、pH 清晨最低，要抓最壞狀況就清晨測。' };
      return { headline: '注意：' + issues.join('、') + '！', detail: '建議動作：' + tips.join('；') + '。已記錄這筆讀值（近 60 筆保留在手機）。' };
    },
  },
  warn: {
    inputs: [],
    button: '檢查未來 16 天 ›',
    async run() {
      const d = await NZD.D.weather(CROP.county);
      const hits = [];
      for (let i = 0; i < d.time.length; i++) {
        const day = d.time[i].slice(5).replace('-', '/');
        if (d.temperature_2m_max[i] >= 33) hits.push(day + ' 高溫 ' + d.temperature_2m_max[i] + '°C：水溫升、溶氧掉——傍晚起水車開整夜，天亮前巡池');
        if (d.temperature_2m_min[i] <= 10) hits.push(day + ' 低溫 ' + d.temperature_2m_min[i] + '°C：魚幾乎不吃料——停餵或大減料，水位加深保溫');
        if (d.precipitation_sum[i] >= 80) hits.push(day + ' 暴雨 ' + d.precipitation_sum[i] + 'mm：濁水、水位暴漲跑魚——先降水位、檢查排水口與攔魚網');
        const gust = (d.wind_gusts_10m_max || d.wind_speed_10m_max)[i];
        if (gust >= NZD.C.alert.windKmh) hits.push(day + ' 強陣風 ' + Math.round(gust) + 'km/h（約10級）：颱風等級——飼料機具收好、備妥發電機（停電水車一停最危險）、災前拍照存證（申請救助要用）');
      }
      if (!hits.length) {
        return {
          headline: CROP.county + '未來 16 天沒有達到警戒的壞天氣，安心顧塭！',
          detail: '每天都低於警戒門檻（高溫≥33°C、低溫≤10°C、暴雨≥80mm/日、風≥10級）。概況：高溫 '
            + Math.max(...d.temperature_2m_max).toFixed(1) + '°C、低溫 ' + Math.min(...d.temperature_2m_min).toFixed(1)
            + '°C、單日最大雨量 ' + Math.max(...d.precipitation_sum).toFixed(1) + 'mm。清晨巡池照常，別鬆懈。建議每天早上再點一次確認。',
        };
      }
      return {
        headline: '注意！未來 16 天有 ' + hits.length + ' 個警戒訊號，先做防範！',
        detail: hits.join('｜') + '。颱風大雨前的總訣：先降低水位、檢查排水口和攔魚網、機具收好；雨後池水濁、水質翻動大，先停餵 1~2 天並加開水車，等水色回穩再恢復投餵。（預報來源 open-meteo，每天早上建議重新檢查）',
      };
    },
  },
  price: {
    inputs: [
      { key: 'fish', label: '魚種', unit: '', def: '草魚', options: ['草魚', '大頭鰱（砂鍋魚頭）', '鰱魚'] },
      { key: 'base', label: '盤商／塘邊行情', unit: '元/kg', def: '70' },
      { key: 'channel', label: '要走的通路', unit: '', def: '活魚餐廳直供', options: ['盤商收購', '活魚餐廳直供', '自家零售／現撈現宰'] },
    ],
    button: '算建議價 ›',
    noPrepare: true,
    run(v) {
      const base = +v.base || 70;
      const c = v.channel === '盤商收購' ? 1.0 : v.channel === '活魚餐廳直供' ? 1.15 : 1.3;
      const p = base * c;
      const lo = Math.round(p * 0.95), hi = Math.round(p * 1.05);
      const note = {
        '草魚': '草魚 2~3 公斤規格齊最好賣；過大餐廳難用，反而要折價。',
        '大頭鰱（砂鍋魚頭）': '砂鍋魚頭要的是大頭——規格越大頭越值錢，好頭跟魚體分開計價，別整尾賤賣。',
        '鰱魚': '鰱魚單價低，走量或跟其他魚搭配出，別佔太多池。',
      };
      return {
        headline: '這批建議賣 ' + lo + '～' + hi + ' 元/公斤（約 ' + Math.round(lo * 0.6) + '～' + Math.round(hi * 0.6) + ' 元/台斤）！',
        detail: '算法：你的行情 ' + base + ' 元/公斤 × 通路係數 ' + c + '（' + v.channel + '）＝ ' + Math.round(p) + ' 元，上下 5% 為議價空間。' + note[v.fish]
          + ' 活魚沒有公開拍賣行情——固定問兩三家盤商報價別只聽一家，每次出魚把成交價記到「作業日誌」，你的紀錄就是你的行情表。規格齊、活力好另有加成空間，先到「活魚分級建議」分好級再談。',
      };
    },
  },
  yield: {
    inputs: [
      { key: 'n', label: '放養尾數', unit: '尾', def: '2500' },
      { key: 'surv', label: '育成率', unit: '%', def: '80' },
      { key: 'size', label: '上市規格', unit: 'kg/尾', def: '2.5' },
    ],
    button: '算收成量 ›',
    noPrepare: true,
    hideDyn: true,
    run(v) {
      const n = +v.n || 0, s = Math.min(100, Math.max(0, +v.surv || 80)) / 100, sz = +v.size || 2.5;
      const kg = n * s * sz;
      NZD.S.set('yield', { saved_at: new Date().toISOString().slice(0, 10), total_kg: Math.round(kg) });
      const fen = (kg / NZD.A.normalYieldKgFen).toFixed(1);
      const cost = NZD.S.get('cost');
      const cmp = cost && cost.expected_qty ? ' 對照成本試算用的 ' + cost.expected_qty.toLocaleString() + ' kg——'
        + (Math.abs(kg - cost.expected_qty) / cost.expected_qty > 0.15 ? '差距超過 15%，建議回成本試算更新收成量重算損平價。' : '兩邊差不多，一致。') : '';
      return {
        headline: '這池預估可收約 ' + Math.round(kg).toLocaleString() + ' 公斤（' + (kg / 1000).toFixed(1) + ' 噸）！',
        detail: '公式：放養尾數 × 育成率 × 上市規格 ＝ ' + n.toLocaleString() + ' × ' + Math.round(s * 100) + '% × ' + sz + ' kg。常見區間（±10%）約 '
          + Math.round(kg * 0.9).toLocaleString() + ' ~ ' + Math.round(kg * 1.1).toLocaleString() + ' 公斤。'
          + '常態量級參考：混養池一分水面年產約 ' + NZD.A.normalYieldKgFen.toLocaleString() + ' 公斤，這產量約是 ' + fen + ' 分水面的量級。已存檔，人力排班會拿去算需要幾個人。' + cmp,
      };
    },
  },
},
};
