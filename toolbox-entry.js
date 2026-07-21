// 小農工具箱入口：右下角浮動鈕，點擊時偵測畫面上的作物/縣市帶參數跳轉。
// index.html 由 repack.py 注入 <script src="toolbox-entry.js">（見 repack.py 尾段）。
(function () {
  var CROPS = ['番茄', '牛蕃茄', '水蜜桃', '甜柿', '綠竹筍', '哈密瓜', '哈蜜瓜', '包心白', '甘藍-初秋', '青蔥-粉蔥', '柚子', '文旦', '茶葉', '包種茶', '稻米', '水稻', '青蔥', '大蒜', '洋蔥', '山藥', '梨', '西瓜', '大西瓜', '芒果', '芭樂', '草莓', '葡萄', '釋迦', '香蕉', '鳳梨', '蓮藕'];

  function leafTexts() {
    var out = [];
    document.querySelectorAll('div,span,h1,h2,h3,p').forEach(function (el) {
      if (el.children.length) return;
      var t = (el.textContent || '').trim();
      if (!t || t.length > 6) return;
      out.push({ el: el, t: t, fs: parseFloat(getComputedStyle(el).fontSize) || 0 });
    });
    return out;
  }

  function detect() {
    var leaves = leafTexts();
    var crop = null, county = null, cropFs = 0, countyFs = 0;
    leaves.forEach(function (n) {
      if (CROPS.indexOf(n.t) >= 0 && n.fs > cropFs && n.fs >= 20) { crop = n.t; cropFs = n.fs; }
      if (/^[一-鿿]{2,3}[市縣]$/.test(n.t) && n.fs > countyFs && n.fs >= 15 && n.fs < 26) { county = n.t; countyFs = n.fs; }
    });
    return { crop: crop || '番茄', county: county || '桃園市' };
  }

  var btn = document.createElement('a');
  btn.id = 'toolbox-fab';
  btn.textContent = '🧰 小農工具箱';
  btn.style.cssText = 'position:fixed;right:22px;bottom:22px;z-index:9999;background:#7fae4e;color:#fff;' +
    'font-family:"Noto Sans TC",sans-serif;font-size:15px;font-weight:900;text-decoration:none;' +
    'border-radius:99px;padding:12px 20px;box-shadow:0 3px 0 #5d8a34,0 6px 18px rgba(90,74,48,.25);cursor:pointer';
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    var d = detect();
    location.href = 'toolbox.html?county=' + encodeURIComponent(d.county) + '&crop=' + encodeURIComponent(d.crop);
  });
  window.addEventListener('load', function () { document.body.appendChild(btn); });
})();
