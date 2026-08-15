# 農知島 taiwan-crop-map — 開發須知

## 部署流程（鐵律）
1. 改前端一律改 `unpacked/App.tsx`，跑 `python3 repack.py` 產出 `index.html`＋`service-worker.js`（SW VERSION＝當下 git HEAD 短碼）
2. 所有變更**一次 commit**（含 repack 產物），commit 後**不要再跑 repack**
3. **推兩個 remote**（雙鏡像站，2026-08-19 起）：
   ```
   git push origin main
   git push humaninterface main
   ```
   - https://wyaoguang3-code.github.io/taiwan-crop-map/
   - https://humaninterface2026-rgb.github.io/taiwan-crop-map/
4. 部署後 curl 線上 service-worker.js 確認 VERSION 已換新
5. origin 站 VERSION 遲遲不換新＝Pages 部署撞「in progress deployment」（連續 push 常見，2026-08-15 一天三次）：
   `gh run list --repo wyaoguang3-code/taiwan-crop-map --limit 1` 看到 failure 就 `gh run rerun <id>`，等前一版跑完重跑必過

## 架構速記
- 行情資料：前端讀 nongzhidao 靜態資料站（跨網域、兩鏡像共用、每日排程自動更新），失敗才退回官方 API
- SW 策略：stale-while-revalidate（快取先回、背景更新）；HTML 用純路徑當快取鍵；工具箱大檔在部署時預抓
- 內容鐵律：使用者可見文字禁工程術語；病蟲害一律「依核准藥劑」＋植物保護資訊系統；不編造精確數字；連結要 curl 驗證可達
- 資料管線腳本在 `~/.openclaw/workspace/scripts/`（update_amis_batch / update_livestock_market / update_trade_only），改動要注意 launchd 跑的是 /usr/bin/python3 (3.9)
