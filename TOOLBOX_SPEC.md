# 小農工具箱 30 功能藍圖（番茄・桃園市）

> 設計原則：純靜態站三引擎——規則計算（JS 決策樹/公式）＋即時資料（AMIS 行情/open-meteo 天氣）＋localStorage 個人紀錄（跨工具接力）。做不到的不假裝：無硬體→手輸讀值判斷；無視覺AI→症狀決策樹；無LLM→模板生成。


## 一、實作批次（審這裡：順序對不對）

- **批次 1｜共用地基＋資料中樞（先做被所有人讀的）**：共用模組(storage.js 統一 key/schema+匯出備份、alerts.js、open-meteo/AMIS fetch 快取、constants.js 係數表、phase() 生育期函式)＋田區與農場設定(fields/profile/season 骨架)＋作業日誌＋田間讀值判讀＋成本試算＋今天要澆水嗎
  - logs/readings/fields/season 是幾乎所有工具的上游；成本試算 S 難度但被 5+ 工具讀；灌溉是最高頻日常入口可先驗證「零輸入」體驗。共用門檻/係數先抽出，避免後面 30 個工具各自寫死。
- **批次 2｜生長管理閉環**：最佳播種時機（寫 season 日期，中樞）＋施肥計畫＋氣象預警（alerts.js 完整版＋.ics）＋巡田健檢地圖＋病蟲害症狀問答＋連作障礙
  - 播種時機是 season_id 與定植日的唯一寫入者，必須在採收/人力/溯源之前完成；病蟲害寫 pest/spray 是後面擋關與學習站的資料源；氣象預警的置頂條讓全站立刻有「活」的感覺。病蟲害照片素材需提早備。
- **批次 3｜採收與出貨核心**：採收時機預測＋產品分級＋產量預估＋保鮮儲存＋定價策略＋採收人力排班
  - 這批彼此緊密接力（harvest→grades→inventory→price）且全部依賴批次 1-2 的 season/cost/spray；定價與分級共用同一份係數 constants；人力排班寫 labor 供批次 4 損益使用。
- **批次 4｜銷售加值與結算**：加工建議＋行銷文案生成＋買家媒合＋溯源履歷（L）＋財務損益分析（L）
  - 全是批次 3 產出的消費者：加工讀 inventory/storage/yield，文案讀 price/trace，損益讀 cost/yield/labor/sales 並產出 seasons.v1——它是批次 5 三個工具的唯一資料源，所以必須在跨季/碳足跡/保險之前完成。溯源與損益是兩個 L，排同批但可並行。
- **批次 5｜經營管理與知識庫重工具**：跨季績效比較＋碳足跡＋學習充電站＋輪作／間作規劃＋土壤分析＋選種建議＋出口文件＋補助申請助理（L）＋保險諮詢
  - 跨季/碳足跡/保險依賴 seasons.v1（批次 4 才有）；選種依賴 rotation+soil；補助/出口/保險/學習站的主要工作量在靜態知識庫查證（桃園現行方案、通路名錄、課程庫），可與前面批次的開發並行蒐集、最後組裝。此批可再拆兩個 sprint。

## 二、關鍵使用者旅程（審這裡：情境對不對味）

- 主循環（種前→結算）：選種建議寫 season.variety → 播種時機讀 variety.days、寫 sow/transplant/harvest 日期並生成 season_id → 成本試算讀 fields 面積+season 採收月抓 AMIS 3年均價，寫 cost.v1(含 breakeven/cost_per_kg) → 生長期各工具 append logs.v1 → 採收時機讀 season 推窗口寫 harvest.v1 → 分級寫 grades+inventory → 定價讀 cost_per_kg 做成本地板、寫 price.v1 → 損益補登 sales.v1、讀 cost+yield+labor 結算寫 seasons.v1 → 跨季比較讀 seasons.* 歸因、寫回推定植月 hint 給下一輪播種時機。
- 颱風前夜：任一工具頁載入 → 共用 alerts.js 抓 open-meteo 寫 alerts.v1 → 全站置頂紅條 → 進氣象預警工具勾防護 checklist(寫 logs) → 若 season 定植 ≥78 天且 3 日內紅警 → 跳採收時機「搶收」卡 → 人力排班搶收模式(前2天人天×1.5) → 補助助理災前拍照存證 banner + 保險諮詢 B/C 分支(未保→救助準備 checklist、.ics 行事曆提醒)。
- 出貨的早晨：分級工具讀 harvest.v1 預填當批量、讀 spray.v1 檢查最早可採日(未過停藥期紅色擋關) → 存批寫 grades+inventory → 定價讀 latest_price×係數矩陣+cost 地板報三通路價、寫 price.v1 → 行銷文案讀 price+profile+trace 生成貼文 → 一鍵記 logs(採收 kg)。
- 盛產壓力（庫存決策）：保鮮儲存輸入庫溫寫 storage.v1(逐批 deadline) → 加工建議讀 inventory+storage(deadline≤2天優先)+yield.remaining(後續供給壓力)+AMIS 7日趨勢 → 3×3 矩陣出甲乙兩案、寫 processing.v1 → 文案生成促銷貼文 → 損益把加工收入計入 sales。
- 病蟲害處理鏈：巡田地圖紅格 →(?zone=C3)→ 症狀問答決策樹+天氣加權 → 確診寫 pest.v1(soilborne)+spray.v1(停藥期)+logs → 學習站讀 pest.last_query 置頂防治課 → 季末連作障礙讀 pest soilborne 計數+rotation → 高風險時輪作規劃/土壤分析出消毒卡 → 下季選種建議自動扣連作風險分。
- 季末盤點：連作障礙自動彙整(pest 土傳病、logs 採收÷面積 vs 3200×80%、readings pH 趨勢) → 決定續種(rotation +1 季、跳播種時機帶高風險旗標)或輪作(歸零並記作物) → 損益結算寫 seasons.v1 → 碳足跡補碳排子欄 → 跨季比較歸因（產量/時機/成本三分支）。

## 三、跨工具資料鍵（27 個，實作時的合約）

### `nzd.FJ3.profile.v1`
- **形狀**：{farm_name, owner, town, daily_ship_kg(預設200), channel_pref('批發'／'直銷'／'電商'), fixed_workers, updated_at} — 合併原 nzd_farm_profile / nzd_prefs / nzd_channel / nzd_last_pickup_text(移至 marketing)
- **誰寫**：溯源履歷(首次填農場檔)、加工建議(daily_ship_kg)、買家媒合(channel_pref)
- **誰讀**：溯源、文案生成、定價策略、人力排班

### `nzd.FJ3.fields.v1`
- **形狀**：[{id, name, area_fen, grid('2x2'／'3x3'／'4x4')}] — 合併原 nzd_field_list / nzd_farm_profile.grid / nzd_field.area_fen；MVP 允許只有一筆
- **誰寫**：輪作規劃(首次設定)、巡田地圖(grid)
- **誰讀**：選種、土壤分析、成本試算、補助快篩、產量預估、人力排班、碳足跡(面積加總)

### `nzd.FJ3.season.v1`
- **形狀**：{season_id('2026A'／'2026B'), variety{name,days,heat_tolerant}, sow_date, transplant_date, harvest_start, harvest_end, field_id, decided_at} — 合併原 nzd_variety_choice / nzd_sowing_plan / nzd_planting_date / nzd_farm_profile.plant_date / nzd_field.transplant_date / nzd.FJ3.plant.v1（定植日五個名字統一成一個）
- **誰寫**：選種建議(variety)、最佳播種時機(全部日期；season_id 在此生成)
- **誰讀**：成本試算、灌溉、施肥、氣象預警(近採收判斷)、採收時機、產量預估、人力排班、學習站、溯源、跨季比較(回推定植)

### `nzd.FJ3.rotation.v1`
- **形狀**：{field_id: [{season_id, crop, family, disease_count}]} — 合併原 nzd_rotation_history / nzd_rotation.seasons；連作季數一律由陣列推導、不另存 counter
- **誰寫**：輪作規劃(owner)、連作障礙工具(續種+1/輪作歸零)
- **誰讀**：選種建議(風險分)、土壤分析(消毒卡)、連作障礙、跨季比較(歸因)

### `nzd.FJ3.readings.v1`
- **形狀**：[{ts, type:'moisture'／'ph'／'ec'／'om'／'temp', value, field_id, zone?, actions?[]}] — 合併原 nzd_sensor_readings / nzd_soil_record（pH 只存這裡一份）
- **誰寫**：田間讀值判讀(owner)、土壤分析(pH/EC/OM+actions)
- **誰讀**：灌溉(最新土濕預填)、選種(最新pH)、連作障礙(pH趨勢)、施肥(改良動作)

### `nzd.FJ3.logs.v1`
- **形狀**：[{id, date, type:'澆水'／'施肥'／'噴藥'／'整枝'／'採收'／'除草'／'防災'／'巡田'／'病蟲害'／'其他', item?, note?, qty_kg?, amount?, labor_days?, zone?}] — 合併原 nzd_logs / nzd_field_log（溯源時間軸直接讀它，不再有第二本日誌）
- **誰寫**：作業日誌(owner CRUD)；灌溉/施肥/病蟲害/防災/巡田/讀值各工具完成按鈕 append
- **誰讀**：溯源履歷(時間軸)、連作障礙(採收累計)、產量預估(實收校正)、成本歸集(amount→costs)、人力(labor_days)

### `nzd.FJ3.pest.v1`
- **形狀**：{history:[{date, name, soilborne:bool, zone?}], last_query} — 合併原 nzd_pest_history / nzd.FJ3.pest.lastQuery
- **誰寫**：病蟲害症狀問答
- **誰讀**：連作障礙(soilborne計數)、輪作規劃、學習站(last_query置頂推課)

### `nzd.FJ3.spray.v1`
- **形狀**：[{date, chem_class, safe_days, earliest_harvest_date}] — 原 nzd_spray 擴為陣列，最早可採日取 max
- **誰寫**：病蟲害處置卡、作業日誌噴藥紀錄
- **誰讀**：採收時機/分級/定價(擋關紅提示)、溯源履歷(停藥期檢核)

### `nzd.FJ3.cost.v1`
- **形狀**：{season_id, area_fen, items:[{name,unit_cost,qty,subtotal}], total_cost, expected_qty, breakeven_price, expected_price, cost_per_kg} — 合併原 nzd_cost_plan / nzd_cost_result / nzd_cost_per_kg（三個名字指同一份成本，統一含 cost_per_kg 欄位）
- **誰寫**：成本試算
- **誰讀**：產量預估(毛利)、定價策略(成本地板)、損益分析、人力排班(面積fallback)、碳足跡、保險諮詢、跨季比較(成本項歸因)

### `nzd.FJ3.yield.v1`
- **形狀**：{season_id, total_kg, harvested_kg, remaining_kg, weekly_kg, avg_price, est_revenue, updated_at} — 合併原 nzd_yield_estimate / nzd_yield_forecast（銷售階段讀的 forecast 就是這份，weekly_kg=total/採收週數）
- **誰寫**：產量預估
- **誰讀**：加工建議(供給壓力)、定價(出貨量預填)、買家媒合、出口文件、人力排班、損益分析

### `nzd.FJ3.harvest.v1`
- **形狀**：{window_start, window_end, advanced_days, batches:[{label,dates[]}], best_days[], rush:bool, updated_at}
- **誰寫**：採收時機預測
- **誰讀**：分級(當批量預填)、產量預估(是否進採收期)、人力排班、保鮮(預告入庫)

### `nzd.FJ3.grades.v1`
- **形狀**：{batches:[{date, a_kg, b_kg, c_kg, price_used, channel}]} — 原 nzd_grade_batches；nzd_grade_split 不另存，由近 N 批加權推導為 getGradeSplit()
- **誰寫**：產品分級
- **誰讀**：產量預估(已採加總)、定價(預選等級)、買家媒合(等級分佈)、損益分析

### `nzd.FJ3.inventory.v1`
- **形狀**：{a_kg, b_kg, c_kg, updated_at} — 合併原 nzd_inventory / nzd_inventory_kg（scalar 一律用 a+b+c 加總取得，禁止第二把鑰匙）
- **誰寫**：產品分級(累加)、出貨紀錄(扣減)、加工決策(扣減)
- **誰讀**：保鮮儲存、加工建議、定價策略(800kg/40元門檻)、損益分析(期末庫存)

### `nzd.FJ3.storage.v1`
- **形狀**：[{date, method, temp, rh, ethylene:bool, grade, kg, est_days, deadline}]
- **誰寫**：保鮮儲存建議
- **誰讀**：加工建議(deadline≤2天必出清單)、行銷文案(今日必出清促銷)

### `nzd.FJ3.alerts.v1`
- **形狀**：{checked_at, active:[{date, type:'wind'／'heat'／'cold'／'rain', level:'red'／'yellow', value}], ack:[alert_id]} — 合併原 nzd_alerts_active / nzd_alerts_ack；由共用 alerts.js 寫入快取(TTL 1h)
- **誰寫**：共用模組 nzd_alerts.js（唯一寫入者）
- **誰讀**：全站置頂警示條、施肥(高溫加註)、播種日曆、採收搶收、人力搶收模式、補助災前banner、保險諮詢

### `nzd.FJ3.care.v1`
- **形狀**：{last_watered, fert:{last_applied, formula, next_date}} — 合併原 nzd_irrigation / nzd_fert_plan
- **誰寫**：灌溉工具、施肥工具
- **誰讀**：灌溉(間隔計算)、施肥(下次日)

### `nzd.FJ3.scan.v1`
- **形狀**：[{date, grid, scores:[{zone, leaf, missing, symptom, fruit, total}], avg}] — 原 nzd_field_scan
- **誰寫**：巡田健檢地圖
- **誰讀**：產量預估(缺株率下修)、連作障礙(健康指數)、病蟲害(?zone 預填)

### `nzd.FJ3.price.v1`
- **形狀**：{quotes:[{date, grade, channel, price, qty}]} — 原 nzd_price_quote
- **誰寫**：定價策略
- **誰讀**：行銷文案(售價預填)、損益分析(實際售價參考)

### `nzd.FJ3.sales.v1`
- **形狀**：[{date, kg, grade, channel, unit_price, buyer?}] — 出貨帳本體
- **誰寫**：損益分析(逐批補登)
- **誰讀**：損益分析、跨季比較

### `nzd.FJ3.labor.v1`
- **形狀**：{weeks:[{start, end, need_days, gap_days, wage}], total_wage, harvest_weeks}
- **誰寫**：人力排班
- **誰讀**：損益分析(臨時工資)、碳足跡(出貨週數)

### `nzd.FJ3.seasons.v1`
- **形狀**：{'<season_id>': {area_fen, total_kg, revenue, cost, profit, margin, avg_price, cost_per_kg, carbon?{total, intensity, grade, breakdown}}} — 合併原 nzd.FJ3.season.*.summary 與 nzd.FJ3.carbon.<seasonId>（一季一物件，碳排作為子欄位，避免動態 key 爆增）
- **誰寫**：損益分析(結算)、碳足跡(碳排子欄)、跨季比較(手動補登歷史季)
- **誰讀**：跨季比較、保險諮詢(收入基準)、碳足跡(產量分母)

### `nzd.FJ3.marketing.v1`
- **形狀**：{trace:{url_with_hash, completeness, harvest_safe}, matched_buyer:{name,type}, last_pickup_text, last_post:{platform,date}} — 合併原 nzd_trace / nzd_matched_buyer / nzd_last_pickup_text / nzd_last_post
- **誰寫**：溯源履歷、買家媒合、行銷文案
- **誰讀**：行銷文案(QR句)、出口文件(completeness≥0.8自動預勾履歷)、損益(銷售去向標註)

### `nzd.FJ3.export.v1`
- **形狀**：{market, checklist:{doc_id:bool}, ready_score} — 合併原 nzd_export_checklist / nzd_export_ready
- **誰寫**：出口文件輔助
- **誰讀**：買家媒合(ready_score≥0.8 才展開外銷貿易商)

### `nzd.FJ3.subsidy.v1`
- **形狀**：{answers:{insurance, land, area_fen, age_band, member, claimed_before}, checklists:{scheme_id:{doc_id:bool}}, updated_at} — 合併原 nzd_subsidy_profile / nzd_subsidy_checklist
- **誰寫**：補助申請助理
- **誰讀**：保險諮詢(災助流程互通)、氣象預警(深連結災前存證)

### `nzd.FJ3.insure.v1`
- **形狀**：{status:'none'／'facility'／'income', plan?, checklist:{item:bool}}
- **誰寫**：保險諮詢
- **誰讀**：氣象預警(未投保快捷入口)

### `nzd.FJ3.processing.v1`
- **形狀**：{date, decision, process_kg, fresh_kg, est_delta} — 原 nzd_processing_decision
- **誰寫**：加工建議
- **誰讀**：行銷文案(加工品貼文)、損益分析(加工收入)、定價(C級報價調整)

### `nzd.FJ3.learn.v1`
- **形狀**：{done:[course_id]}
- **誰寫**：學習充電站
- **誰讀**：學習充電站


## 四、整合審查抓到的風險（批次 1 會先解）

- 命名雙軌制：階段 1-4 用 nzd_*、階段 5 用 nzd.FJ3.*.v1，且同一概念多把鑰匙——定植日有 5 個名字（nzd_sowing_plan / nzd_farm_profile.plant_date / nzd_field.transplant_date / nzd_planting_date / nzd.FJ3.plant.v1）、成本 3 個、產量 2 個（yield_estimate vs yield_forecast）、庫存 2 個（object vs scalar）、日誌 2 本（nzd_logs vs nzd_field_log）。不統一直接開工，工具間接力全數斷鏈。
- 單田 vs 多田模型衝突：種前工具以 nzd_field_list 多田區為中心（輪作/土壤 per field_id），生長與採收工具假設單一田（farm_profile.plant_date、單一 grid）。建議 MVP 定為「多田區登記、單一當季作」：season.v1 綁一個 field_id，其餘工具不處理多季並行。
- 生育期分段三套不一致：施肥 0-25/26-55/56+、學習站 0-30/31-60/61-85/86-110、灌溉 0-25/26-55/56+——需抽成單一 phase(transplant_date) 共用函式，否則同一天兩工具說的期別不同。
- 採收提前規則三個版本：採收時機 h≥5→提前7天/3-4天→5天、人力排班 均溫≥27→固定提前6天、溯源履歷改窗口為 80~103 天——需統一 harvestWindow() 一處實作。
- 風速門檻單位與欄位混用：氣象預警用 wind_gusts_10m_max≥89km/h、播種/補助/人力用 wind_speed_10m_max≥24.5m/s（陣風 vs 平均風是不同量，同標「10級」會互相打架）——需明定：警戒採陣風、播種評級採平均風，並統一換算。
- 石灰用量兩套規則：土壤分析 (6.4−pH)/0.5×100kg 上限200 vs 讀值判讀固定「100-150kg」——同一 pH 5.6 會得到不同建議，需收斂為一個公式。
- 分級/通路係數（1.15/1.0/0.85、1.0/1.1/1.2）、800kg/40元加工門檻、3200kg/分等常數在至少 6 個工具規格內各自寫死——必須抽 constants.js，否則日後調整必然不同步。
- AMIS 資料假設風險：選種需 monthly 過去 36 個月、跨季需長期 yearly，實際 code_FJ3.json 的 monthly[] 長度未驗證；且 daily 末 7 筆含休市日可能不足 7 個交易日——所有均價計算需寫 fallback（有幾筆算幾筆並標註樣本數）。
- localStorage 本質限制：清瀏覽器資料/換手機即整季紀錄蒸發，對「季末結算」「保險理賠佐證」是致命傷——批次 1 就要做一鍵匯出/匯入 JSON 備份，並在日誌工具明示；同時 key 全帶 .v1 供未來 schema migration。
- 「推播」與 QR 的技術現實：靜態站的 Notification API 在 iOS Safari 幾乎不可用、.ics 匯入體驗因手機而異，UI 必須誠實標示「開頁才會檢查」；溯源 QR 把 base64 履歷塞 URL hash，整季日誌一長 QR 容量會爆——需壓縮（如 lz-string）或只嵌摘要+核心欄位。
- 靜態知識庫的時效責任：補助方案、保險費率、災害救助額度、加工/通路名錄、藥劑停藥期表全需人工查證且會過期——每份知識庫 JSON 必須帶 data_updated 日期並在 UI 顯示「資料截至 YYYY-MM」，藥劑停藥期尤其涉及食安，錯誤建議比沒有更糟。
- 寫入權責需要收斂：inventory 有分級累加、出貨扣減、加工扣減三個寫入者但規格未定義扣減時機（損益補登出貨時是否自動扣庫存？），不定清楚會出現庫存與出貨帳對不上的殭屍數字。

---

## 種前規劃

### 作物選種建議（難度 M）

**情境**：七月底這季牛蕃茄收完，阿明晚上坐在客廳滑手機看儀表板，發現這季價錢普普，猶豫下一季要繼續種同一支品種、換耐熱品種提早種，還是乾脆休一季。他打開選種建議，想要一個「下一季種什麼、幾月定植最划算」的明確答案。

**輸入**：1) 預計定植月份（下拉 1~12 月，預設＝下個月）；2) 田區（下拉，預設讀 nzd_field_list 第一筆）；3) 在意重點（單選：價格優先／穩定優先／省工優先，預設價格優先）。其餘全自動：連作史、土壤紀錄、行情皆自動載入，零手填。

**引擎**：
> 對靜態品種庫每支品種算總分（0~100）後排序：
> (1) 價格分 40%：定植月＋品種天數(85~110)推算採收月 → 取 AMIS monthly[] 過去 36 個月中該採收月的均價，對全年均價做 z-score → 映射 0~40 分；採收月若落在該品種歷年量最大月（monthly volume 峰值）再扣 5 分（撞產期）。
> (2) 氣候分 30%：靜態桃園月均溫表（寫死 12 筆：1月13.9°C…7月28.9°C…）比對品種適溫區間；生育期任一月均溫 >32 或 <16 → 該品種標紅；耐熱品種在 6~9 月定植加 10 分。另抓 open-meteo 16 日預報，若定植月就是本月且 16 日內有高溫≥35 或低溫≤12 預警日 → 顯示警告徽章。
> (3) 風險分 30%：讀 nzd_rotation_history — 該田區茄科連作 <2 季扣 0、2 季扣 8、≥3 季或病害≥2 次扣 20 並強制顯示「建議先看輪作規劃」；讀 nzd_soil_record 最新 pH，落在 6.0~6.8 之外扣 5；災損 yearly JSON 中定植~採收期跨颱風高發月（7~9月）扣 5。
> 品種庫欄位（寫死 5~8 支牛蕃茄品種）：{id, name, days, heat_tolerant:bool, disease_resist:[], fruit_g, note}。「省工優先」時 disease_resist 長度權重 ×1.5。

**輸出**：吉祥物：「下一季我推『耐熱一號』、8 月中定植——算起來 11 月底採收，往年那時一公斤平均 62 元，比現在好喔！」展開細節：前 3 名品種卡（每卡：適配分、預估採收月、該月 3 年均價、抗病註記、風險警示）＋一鍵「就種這支」按鈕寫入 nzd_variety_choice。

**資料源**：AMIS monthly[{key,price,volume}]、latest_price；災損 yearly JSON（月份分布）；open-meteo daily temperature_2m_max/min（僅本月定植時的近期預警）；靜態：品種庫、桃園月均溫表；localStorage: nzd_rotation_history、nzd_soil_record、nzd_field_list。

**串接**：讀 nzd_rotation_history（輪作工具存）、nzd_soil_record（土壤工具存）、nzd_field_list。寫 nzd_variety_choice = {variety, days, plant_month, expected_harvest_month, decided_at}——播種時機用它預填品種天數與目標月，成本試算用它預填採收月價格。

### 輪作／間作規劃（難度 M）

**情境**：阿明的東邊那塊田已經連種三季牛蕃茄，這季青枯病發了兩次、產量掉了兩成。收完清園那天下午，他蹲在田埂想：「這塊是不是該休了？休的話種什麼不會白繳地租？」打開輪作規劃想看每塊田的紅綠燈。

**輸入**：首次使用：田區設定（名稱、面積分數，最多 8 區）。每季收尾登記一次：該田區這季作物（下拉：牛蕃茄/其他茄科/豆科/禾本科/蔥蒜/葉菜/休耕）、有無病害（0/1/2+ 次，預設 0）。之後全自動：打開即顯示各田區燈號，無需再輸入。

**引擎**：
> 每田區取 nzd_rotation_history 最近紀錄往回數：茄科（番茄/茄子/辣椒/馬鈴薯視為同科，作物下拉映射 family 欄位）連續季數 n、近 3 季病害總次數 d。規則：n<2 且 d<2 → 綠燈「可續種」；n==2 或 d==1 → 黃燈「最後一季，下季務必輪作」；n>=3 或 d>=2 → 紅燈「強烈建議輪作或休耕＋土壤消毒」。
> 紅/黃燈時從靜態輪作庫出建議（每筆：{crop, family, benefit, season_fit[月], amis_code?}）：禾本科硬質玉米（打斷病原循環）、豆科毛豆（固氮，秋作）、青蔥/大蒜（抑菌）、休耕＋太陽能消毒（7~8 月覆膜曝曬 4 週，僅夏季顯示）。有 amis_code 的作物附「該作物近月均價」讓他評估收入替代性。
> 間作建議（綠燈田區顯示）：靜態 companion 表——羅勒/萬壽菊（驅粉蝨薊馬，畦邊每 3 株一棵）、青蔥（畦間）；禁忌：茴香、馬鈴薯（同科）。
> 下季模擬器：點某田區「如果下季種 X」→ 即時重算該選擇後的燈號。

**輸出**：吉祥物：「東田已經連種 3 季又生過 2 次病，這季讓它休息種毛豆吧，順便幫土補氮！」展開：田區卡列表（燈號、連作季數、病害數、建議行動），每張卡展開輪作候選（作物、好處白話一句、適種月、參考價）；「登記本季」按鈕在每季收尾時浮出提醒。

**資料源**：localStorage: nzd_field_list、nzd_rotation_history（本工具主要寫入者）；靜態：作物科別映射表、輪作候選庫、間作 companion/禁忌表；AMIS 其他作物 code JSON（輪作候選參考價，選配）。

**串接**：寫 nzd_field_list = [{id,name,area_fen}]、nzd_rotation_history = {field_id: [{season, crop, family, disease_count}]}。選種建議讀它扣連作風險分；土壤分析讀它決定是否建議消毒；成本試算讀 nzd_field_list 預填面積。

### 最佳播種時機（升級版）（難度 M）

**情境**：週日晚上，育苗盤和種子都買好了，阿明想在接下來兩週找一天播種。他不想再自己翻氣象 App 對溫度，打開工具就要看到「哪幾天可以播、哪天最好」，還想知道這批推到幾月採收、那時價錢通常怎樣。

**輸入**：無—自動載入。品種天數自動讀 nzd_variety_choice.days（無存檔則預設 95 天、可在進階展開改 85~110）；育苗期預設 30 天（可改 25~35）。唯一可選操作：點日曆上某天改指定播種日看推算結果。

**引擎**：
> fetch open-meteo forecast：latitude=24.99&longitude=121.30&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&forecast_days=16。
> 對每個候選日 d 評級：(a) 溫度：取 d 的 (max+min)/2 均溫，20~30 → 2 分；16~20 → 1 分；<16 或 >32 → 0 分（max≥32 也算 0）。(b) 雨量：sum(precipitation_sum[d..d+6])（不足 7 天用可得天數等比放大），<60mm → 2 分；60~120 → 1 分；>120 → 0 分。(c) 任一分為 0 → 「不建議」紅；總分 4 → 「理想」綠；否則「可播」黃。16 天全無綠 → 顯示黃色最高分日＋主因（例：連日雨量累積 135mm）。
> 預警疊加：wind_speed_10m_max ≥ 24.5 m/s(10級) 或 max≥35 或 min≤12 的日子在日曆標警示圖示。
> 行情推算：播種日 + 30(育苗) + days(定植後) → 採收起始日，區間 = 起始日往後 25 天；取採收區間所跨月份在 AMIS monthly[] 過去 3 年的均價與量，顯示「預計 11/25~12/20 採收，往年 12 月均價 58 元／日均量 X 公斤」。
> 存檔：點「就選這天」→ 寫 nzd_sowing_plan。

**輸出**：吉祥物：「這三天（週二到週四）都適合播種喔！挑週三最穩——推回來 12 月初採收，往年那時均價 58 元。」展開：16 天橫向日曆（綠/黃/紅圓點＋警示圖示）、選定日的時間軸（播種→約 X/X 定植→約 X/X 起採）、採收月行情小卡（3 年均價、與目前 latest_price 比較）。

**資料源**：open-meteo daily: temperature_2m_max/min, precipitation_sum, wind_speed_10m_max（16 日）；AMIS monthly[]、latest_price；localStorage: nzd_variety_choice。

**串接**：讀 nzd_variety_choice.days 預填生育天數。寫 nzd_sowing_plan = {sow_date, transplant_date, harvest_start, harvest_end, decided_at}——成本試算拿 harvest 月抓預期價；產量預估／採收窗口工具（他階段）拿定植日推採收；氣象預警工具在 sow_date 前一天可推提醒。

### 成本試算（升級版）（難度 S）

**情境**：決定下一季要種 6 分地的前一晚，阿明得先跟太太交代「要押多少錢下去、行情不好會不會賠」。他打開成本試算，希望數字大多已經幫他填好，只要調面積就能看到總投入、損益兩平價和三種行情下的結果。

**輸入**：面積（分，預設 nzd_field_list 面積加總，無則 6）；每分株數（預設 1800）；每分產量（預設 3200kg）；良率結構（A/B/C 預設 60/25/15%，滑桿）；單價項目表全部給預設（苗 8 元/株、肥料 4500 元/分、農藥資材 3000 元/分、地租 8000 元/分/季、水電 1500 元/分、雇工 1600 元/人天 × 採收高峰 20~28 人天/週 × 預估採收週數）；預期價格（自動＝nzd_sowing_plan 採收月的 AMIS 3 年均價，無存檔則 latest_price.price，可手動覆蓋）。上季存檔存在時全部項目沿用上季實填值。

**引擎**：
> 總成本 C = Σ(每分項目 × 面積) + 雇工(人天 × 工資)。總產量 Q = 面積 × 3200。加權單價 P = 預期價 × (0.60×1.15A + 0.25×1.0B + 0.15×0.85C 依良率滑桿即時重算，沿用分級係數 A1.15/B1.0/C0.85)。營收 R = Q × P；淨利 = R − C；兩平價 = C / Q。
> 三情境：P×0.8／P×1.0／P×1.2 各算淨利。
> 燈號：latest_price ≥ 兩平價×1.2 → 綠「現在行情有肉」；介於 1.0~1.2 → 黃；< 兩平價 → 紅「照現價會賠」。
> 每筆輸入 onChange 即時重算；「存檔」寫 nzd_cost_plan（含逐項明細，供季末實際 vs 預估比對）。

**輸出**：吉祥物：「6 分地這季大概要投 38 萬，照往年 11 月行情能賣 52 萬——只要一公斤賣得過 19.8 元就不會賠！」展開：成本圓餅（苗/肥/藥/工/租/水電）、三情境長條（悲觀/持平/樂觀淨利）、兩平價 vs 今日價燈號、逐項可編輯表格。

**資料源**：AMIS latest_price{price}、monthly[]（採收月 3 年均價）；靜態：預設成本單價表、分級係數 A1.15/B1.0/C0.85、1800 株/分、3200kg/分、20~28 人天/週；localStorage: nzd_field_list、nzd_sowing_plan、上季 nzd_cost_plan。

**串接**：讀 nzd_field_list（面積）、nzd_sowing_plan（採收月→預期價）、nzd_variety_choice（品名顯示）。寫 nzd_cost_plan = {season, area_fen, items[{name,unit_cost,qty,subtotal}], total_cost, expected_qty, breakeven_price, expected_price}——損益分析（收後階段）直接拿 total_cost 與 breakeven_price 對實際售價；加工決策的「價<40 且庫存>800kg」判斷可引用 breakeven 佐證。

### 土壤／地力分析（難度 M）

**情境**：翻耕整地前一週，阿明用農會買的簡易檢測組測了 pH 和 EC，拿著兩個數字蹲在田邊不知道「5.4 到底算差多少、石灰要撒幾包」。他打開土壤分析輸入讀值，要的是白話判讀和可以直接去資材行照買的清單。

**輸入**：田區（下拉自 nzd_field_list）；pH（數字，步進 0.1，必填）；EC dS/m（選填）；有機質 %（選填，有檢測報告才有）；檢測日期（預設今天）。前作與連作史自動讀 nzd_rotation_history，不用填。

**引擎**：
> 規則逐條判定，命中即產出一張「行動卡」：
> (1) pH < 6.0 → 偏酸：苦土石灰建議量 = (6.4 − pH) / 0.5 × 100 kg/分（四捨五入到 20kg），上限 200 kg/分並註明「一次最多施 200kg，兩週後複測」；6.0~6.8 → 合格綠勾；> 6.8 → 偏鹼：不施石灰，改施硫磺粉 20~40 kg/分或以有機質堆肥調節。
> (2) EC 有值且 > 1.2 → 鹽分累積警告：建議整地前大水淹灌洗鹽 1~2 次、減少化肥基肥 30%；> 2.0 → 紅色「先洗鹽再定植」。
> (3) 有機質 < 2% → 完熟堆肥 2 噸/分；2~3% → 1 噸/分；≥3% → 免補。
> (4) 讀 nzd_rotation_history：該田區茄科 ≥3 季或病害 ≥2 → 加卡「土壤消毒」：夏季（6~8 月，依當前月份判斷）建議太陽能消毒覆膜 4 週，其他季節建議淹水 3 週或休耕。
> (5) 基肥配方卡（恆顯示）：依「苗期低氮/開花鉀鈣硼/結果鉀鈣」原則給整地基肥＝低氮高磷配方，換算靜態資材表（台肥特 5 號 X kg/分 + 苦土石灰(若(1)命中) + 堆肥(若(3)命中)），追肥時程表列到開花/結果期。
> 歷次紀錄：同田區 pH/EC 折線圖（localStorage 全history），看得到「上次撒石灰後 pH 5.4→6.1」。

**輸出**：吉祥物：「東田有點酸（pH 5.4），整地時每分撒 200 公斤苦土石灰，兩週後再測一次就好！」展開：判定卡清單（每卡：問題白話、要買什麼、每分用量、換算此田區總量kg）、基肥＋追肥時程表、歷次 pH/EC 趨勢圖。

**資料源**：使用者手動輸入 pH/EC/有機質（誠實原則：無感測硬體，改手輸讀值）；靜態：石灰/硫磺/堆肥用量規則表、資材換算表、施肥階段原則（苗期低氮/開花鉀鈣硼/結果鉀鈣）、pH 6.0~6.8 門檻；localStorage: nzd_field_list、nzd_rotation_history。

**串接**：讀 nzd_field_list、nzd_rotation_history（觸發消毒建議）。寫 nzd_soil_record = {field_id: [{date, ph, ec, om, actions[]}]}——選種建議讀最新 pH 扣風險分；施肥提醒工具（生長期階段）讀 actions 排追肥時程；成本試算可把石灰/堆肥量帶入資材成本（進階串接）。

### 補助申請助理（難度 L）

**情境**：颱風季前，鄰田老張說他去年設施補助拿了快一半的錢，阿明晚上越想越不甘心，但一想到公文和資格就頭痛。他打開補助助理，想在十分鐘內知道「我到底能領哪些、缺什麼文件、去哪裡送件」，颱風真的來之前還想確認災損救助怎麼申請。

**輸入**：資格快篩 6 題（答一次存檔，之後免重填）：有無農保/農職保（是/否）；土地（自有/承租有約/承租無約）；耕作面積（分，預設讀 nzd_field_list 加總）；年齡區間（<45 / ≥45）；是否加入產銷班或農會會員（是/否）；近 3 年是否領過同類補助（是/否）。

**引擎**：
> 靜態方案庫（每筆欄位化：{id, name, category, requires:{insurance, land:['own','lease_doc'], min_area_fen, max_age?, member?}, amount_desc, window_desc, agency, docs:[], tips}），初版收錄：農業設施（溫網室）補助、小型農機補助、產銷履歷/有機驗證補助、農業保險保費補助（番茄可保品項）、天然災害現金救助＋低利貸款、青年農民專案（僅 <45 顯示）。
> 比對引擎：對每方案逐條檢查 requires vs 快篩答案 → 三態：全過＝「符合」綠；缺 1 項＝「差一步」黃（明示缺哪項＋補救法，例：承租無約 → 先辦耕作事實證明）；缺 ≥2＝「不符」灰（收合）。
> 災損救助特別邏輯：(a) 每次載入抓 open-meteo 16 日 wind_speed_10m_max，任一日 ≥ 24.5 m/s（10 級）→ 頁頂紅 banner「颱風要來了！救助要有『災前照片』——現在就去田裡拍：全景 1 張＋設施 2 張＋有定位資訊」；(b) 災損 yearly JSON 顯示「番茄近年災損紀錄」讓他知道這不是小機率；(c) 救助流程時間軸寫死：災後 → 拍照 → X 日內向公所申報 → 現勘 → 撥款。
> 文件 checklist：每方案 docs[] 逐項可勾選，勾選狀態存 localStorage；全勾 → 吉祥物「文件備齊，可以送件了！」＋窗口地址電話。

**輸出**：吉祥物：「你有 3 項補助符合資格！最快能申請的是保費補助——文件只差『存摺影本』一張。」展開：符合/差一步/不符 三區塊方案卡（額度、窗口、期間、tips 白話）、每案文件勾選清單與進度條、颱風預警時的災前存證 banner。

**資料源**：靜態：補助方案庫（資格欄位化、文件清單、窗口名錄、流程時間軸——需人工查證桃園市農業局/農糧署現行方案，標註資料更新日期）；open-meteo wind_speed_10m_max（10 級風預警觸發）；災損 yearly JSON；localStorage: nzd_field_list。

**串接**：讀 nzd_field_list（面積自動帶入快篩）。寫 nzd_subsidy_profile = {answers{}, updated_at} 與 nzd_subsidy_checklist = {scheme_id: {doc_id: bool}}——氣象預警工具（生長期階段）颱風觸發時可深連結到本工具的災前存證 banner；災後的災損回報工具讀 checklist 續辦救助流程。


---

## 生長管理

### 今天要澆水嗎（灌溉排程）（難度 M）

**情境**：清晨五點半，阿明起床準備下田，昨天半夜好像有下雨，他不確定今天還要不要澆水。打開工具，吉祥物直接告訴他澆或不澆，還順便看到未來一週哪幾天要澆。

**輸入**：土壤濕度 %（選填，預設自動帶入 nzd_sensor_readings 最新一筆土濕讀值）；上次澆水日（預設 nzd_irrigation.last_watered）；定植日（預設 nzd_farm_profile.plant_date，用來判斷生育期）。全部有預填，理想情況零輸入。

**引擎**：
> 決策順序（JS 規則）：(1) 若土濕輸入 ≥60% → 「不用澆」（並警告持續過濕傷根）。(2) open-meteo past_days=2 的 precipitation_sum 合計 ≥15mm → 「不用澆」。(3) 未來24h precipitation_sum ≥10mm → 「等雨，明天再看」。(4) 土濕 <40%，或距上次澆水天數 ≥ 生育期間隔（苗期0-25天:2日、開花26-55天:2日、結果56天起:1.5日，取整為每日檢查；當日 temperature_2m_max ≥32°C 時間隔一律 -1 日）→ 「今天清晨澆」（沿用『清晨澆』門檻，顯示建議時段 05:00-08:00）。(5) 其餘 → 「今天可不澆，明天再確認」。附 7 日澆水日曆：對未來7日逐日跑同一規則（用預報降雨與高溫），標出預計澆水日。

**輸出**：吉祥物：「昨晚下了 22mm 雨，今天不用澆，土讓它喘口氣！」展開細節：過去48h降雨、未來3日降雨/高溫、目前生育期與建議澆水間隔、7日澆水日曆條、【已澆水】按鈕（一鍵寫日誌）。

**資料源**：open-meteo daily: precipitation_sum, temperature_2m_max, past_days=2 + forecast_days=7（桃園 24.99,121.30）；localStorage: nzd_sensor_readings（土濕）、nzd_irrigation、nzd_farm_profile；靜態知識庫：生育期澆水間隔表、土濕 40-60% 門檻。

**串接**：讀 nzd_farm_profile.plant_date、nzd_sensor_readings 最新土濕；寫 nzd_irrigation.last_watered；按【已澆水】自動 append 一筆 {type:'澆水'} 到 nzd_logs（作業日誌工具可見）。

### 這期該施什麼肥（施肥計畫）（難度 M）

**情境**：週六早上阿明要去農會資材部買肥料，站在貨架前不知道該買哪一包、買多少。出門前打開工具，直接看到「現在是開花期，買鉀鈣硼，X 公斤」，截圖帶去給店員看。

**輸入**：定植日（預填 nzd_farm_profile.plant_date）；面積-分（預填 nzd_farm_profile.area_fen，預設 1 分）；上次施肥日與配方（預填 nzd_fert_plan）。

**引擎**：
> 生育期 = 定植後天數：0-25 苗期 / 26-55 開花期 / 56 起結果期（與採收 85-110 天窗口銜接）。配方規則（沿用門檻）：苗期低氮配方；開花期鉀+鈣+硼；結果期鉀+鈣。追肥間隔：苗期 10-14 天、開花期 7-10 天、結果期 7 天 → 由上次施肥日算出「下次施肥建議日」。用量 = 知識庫每分基準量 × 面積（分），以 1800株/分 為基準換算每株量。雨前防流失：open-meteo 未來48h precipitation_sum ≥25mm → 建議提前或延後到雨後，並明確標出「最晚週三施完，週四有大雨」。氣象預警工具若有高溫警報（≥35°C）→ 加註「高溫期避免重氮，加強鈣防臍腐」。

**輸出**：吉祥物：「現在是開花期第 12 天，這週補鉀鈣硼——週三前施完，週四要下大雨！」展開：配方表（成分、每分用量、你的總量、市價估算）、下次施肥日、施肥小抄（溝施/葉面噴施時機）、【已施肥】按鈕。

**資料源**：open-meteo daily precipitation_sum（未來7日）；localStorage: nzd_farm_profile, nzd_fert_plan；靜態知識庫：三階段配方表（品項、每分公斤數、參考單價）、1800株/分。

**串接**：讀 nzd_farm_profile；寫 nzd_fert_plan{last_applied,formula}；【已施肥】寫 nzd_logs{type:'施肥',品項,金額}，金額同步 append 到 nzd_costs.fertilizer 供成本試算/損益分析取用；讀氣象預警工具的當前警報旗標 nzd_alerts_active。

### 葉子怎麼了（病蟲害症狀問答）（難度 L）

**情境**：傍晚巡田，阿明發現一排植株下位葉出現褐色斑，心裡發毛但不知道是什麼病。蹲在田埂上打開工具，回答 3-4 個選擇題，對照典型照片確認，馬上知道嚴不嚴重、今晚要不要處理。誠實原則：不假裝有影像 AI，用症狀決策樹＋照片比對。

**輸入**：問答式（每題大按鈕單選）：(1) 哪個部位？葉/莖/果實/整株垂 (2) 長什麼樣？斑點/黃化/捲曲/白粉/腐爛水傷/看得到蟲 (3) 從哪裡開始？下位老葉先/頂部新葉先/隨機零星 (4) 近日天氣（自動帶入，不用答）：過去5日累積雨量與均溫濕度。

**引擎**：
> 加權決策樹：知識庫收錄牛蕃茄 12 種常見病蟲害（晚疫病、早疫病、青枯病、萎凋病、TYLCV病毒捲葉、白粉病、灰黴病、細菌性斑點、番茄夜蛾、銀葉粉蝨、潛葉蠅、二點葉蟎），每種一組症狀特徵向量（部位/型態/分布各給 0-3 分）。天氣加權：open-meteo past_days=5，連續降雨≥3日或累積≥50mm → 晚疫病/灰黴病 +2；均溫≥30°C 且無雨 → 葉蟎/粉蝨 +2；植株整株凋萎+高溫多濕 → 青枯病 +2。輸出總分前 3 名候選，各附 1-2 張典型症狀靜態照片讓使用者指認確認。確認後給處置卡：藥劑類別（寫作用機制群組非商品名）、安全採收間隔天數、非農藥措施（摘除病葉、黃色黏板等）、蔓延風險等級。青枯/萎凋等土傳病確診 → nzd_pest_history 記一次「土傳病」。

**輸出**：吉祥物：「最像晚疫病（連下三天雨最容易中）——比對一下照片，準的話今晚就要摘病葉，明天一早噴藥！」展開：前3候選＋照片、處置卡、安全採收間隔倒數（自動與作業日誌噴藥紀錄連動）、【確認就是它】按鈕。

**資料源**：open-meteo daily past_days=5: precipitation_sum, temperature_2m_mean, relative_humidity_2m_mean；靜態知識庫：12 種病蟲害特徵矩陣、典型照片（打包進站內 assets）、處置卡內容；localStorage: nzd_pest_history。

**串接**：確診寫 nzd_pest_history{date,name,soilborne:bool}（連作障礙工具讀土傳病次數）；同時寫 nzd_logs{type:'病蟲害'}；巡田健檢地圖的紅格可帶參數 ?zone=B2 跳進本工具預填位置；噴藥後的安全採收間隔寫 nzd_spray{earliest_harvest_date} 供採收/出貨工具擋關。

### 颱風要來了怎麼辦（氣象預警）（難度 M）

**情境**：颱風前一天晚上，新聞說明天暴風圈進入北台灣，阿明躺在床上滑手機，想知道自己桃園的田到底會多嚴重、今晚和明早該先做哪幾件事、要不要搶收。誠實原則：靜態站無法真推播，改為全站開頁即檢＋行事曆提醒＋開頁期間瀏覽器通知。

**輸入**：無—自動載入（座標固定桃園 24.99,121.30；進階摺疊區可微調四個門檻值）。

**引擎**：
> 抓 open-meteo 未來 14 日 daily，逐日對照四門檻：wind_gusts_10m_max ≥89 km/h（≈蒲福10級，24.5 m/s）→ 強風紅警；temperature_2m_max ≥35°C → 高溫警；temperature_2m_min ≤12°C → 低溫警；precipitation_sum ≥80mm/24h → 暴雨警。次一級黃警（風≥62km/h、雨≥50mm、溫≥33/≤14）提早提醒。每種警報綁一份防護 checklist（強風：加固支架綁枝、收防蟲網、近熟果先採；暴雨：清溝、疏果減重、備排水；高溫：拉遮陰網、清晨補灌、加鈣；低溫：畦面覆蓋、延後定植）。搶收判斷：若 nzd_farm_profile 定植日推算目前落在定植後 78 天以上（接近 85-110 採收窗）且 3 日內有紅警 → 額外跳「建議搶收近熟果」。推播替代三件套：(a) 全站每個工具頁載入時跑同一支 check，前方 3 日內有警報就顯示置頂警示條 (b) 一鍵下載 .ics（警報日前一天 20:00 提醒事件）加入手機行事曆 (c) 頁面開著時用 Notification API 發本機通知。

**輸出**：吉祥物：「後天陣風會到 10 級！今晚先做這 4 件事，近熟的果明天一早先採起來。」展開：未來 14 日逐日燈號表（風/雨/溫三欄）、對應 checklist（可勾選，勾完寫日誌）、【加入手機行事曆】、【去看採收分級】按鈕。

**資料源**：open-meteo daily forecast_days=14: wind_gusts_10m_max, wind_speed_10m_max, temperature_2m_max/min, precipitation_sum；localStorage: nzd_farm_profile（定植日→是否近採收）、nzd_alerts_ack（已讀去重，避免同一警報天天彈）；靜態知識庫：四類防護 checklist。

**串接**：check 函式抽成共用 nzd_alerts.js 讓所有工具頁引用，結果快取在 nzd_alerts_active（施肥/灌溉/播種工具讀它加註）；checklist 勾選寫 nzd_logs{type:'防災'}；搶收按鈕跳採收分級工具。

### 30 秒記工（作業日誌）（難度 M）

**情境**：晚上九點收工洗完澡，阿明躺在沙發回想今天做了什麼——澆水、噴了一次藥、採了 80 公斤。點三個大按鈕 30 秒記完。季末結算、申請產銷履歷或保險理賠時，翻出整季紀錄匯出。

**輸入**：快速按鈕：澆水/施肥/噴藥/整枝疏果/採收/除草/防災/其他；點選後展開該類型的 1-2 個選填欄：採收→公斤數、噴藥→藥劑名稱與類別、施肥→品項與金額、通用→工時人數；日期預設今天可改。

**引擎**：
> 核心是 CRUD＋衍生統計（全部純前端）：(1) 月曆檢視，每日顯示類型圖示。(2) 本月統計：各類次數、採收累計 kg、累計工時人天。(3) 噴藥安全採收倒數：噴藥紀錄的藥劑類別查知識庫安全間隔天數 → 算出「最早可採日」，未到期時全站採收相關工具顯示紅色擋關提示。(4) 人力預警：近 7 日工時 ≥ 門檻 20 人天且處於採收窗（定植後 85-110 天）→ 提示「進入採收高峰，每週約需 20-28 人天，先約好工班」。(5) 匯出 CSV（日期/類型/明細/數量/金額），欄位對齊產銷履歷紀錄需求。

**輸出**：吉祥物：「記好了！這個月你澆了 8 次水、採了 420 公斤，加油！」展開：月曆、本月統計卡、安全採收倒數（若有）、匯出 CSV 按鈕。

**資料源**：localStorage: nzd_logs（本工具是 owner）、nzd_spray、nzd_farm_profile；靜態知識庫：藥劑類別→安全採收間隔天數表、人力門檻 20-28 人天/週。

**串接**：全系統中樞：灌溉/施肥/病蟲害/防災/巡田工具的完成按鈕都 append 到 nzd_logs；採收累計 kg 供產量預估校正（實收 vs 3200kg/分基準）；施肥/噴藥金額同步 nzd_costs 供成本試算與損益分析；工時累計供人力成本計算。

### 量了然後呢（田間讀值判讀）（難度 S）

**情境**：阿明花三百塊買了插土式濕度計和 pH 筆，量出「pH 5.6」卻不知道這數字是好是壞。蹲在田裡把數字輸進去，馬上知道正不正常、要做什麼。誠實原則：不假裝有 IoT 自動串接，就是手動輸入讀值→門檻判讀＋趨勢。

**輸入**：讀值類型（土壤濕度%/土壤pH/EC mS·cm/棚溫°C）；數值；位置標籤選填（A區/B區…，沿用巡田工具的分區）。

**引擎**：
> 門檻判讀表（直接沿用+知識庫補充）：土濕 40-60% 綠燈；<40 黃燈「該澆水了」（連到灌溉工具）；>60 藍燈「太濕，注意根部病害與疫病」。pH 6.0-6.8 綠燈；<6.0 →「偏酸，每分地施苦土石灰約 100-150kg，兩週後複測」；>6.8 →「偏鹼，改施酸性肥/硫磺粉」。EC 2.0-3.5 綠燈；<2.0 肥不足、>4.0 鹽害風險建議大水淋洗。棚溫對照生育門檻（≥35 高溫警、≤12 低溫警、20-30 適溫）。趨勢：同類型讀值畫折線（近 90 天），pH 連續 2 筆超標 → 升級為「需土壤改良」並在連作工具亮旗。

**輸出**：吉祥物：「pH 5.6 偏酸囉！建議每分地撒 100 公斤苦土石灰，兩週後再量一次我幫你比。」展開：本次判讀燈號、建議行動、該類型歷史趨勢圖、複測提醒日。

**資料源**：localStorage: nzd_sensor_readings[]{ts,type,value,zone}（本工具是 owner）；靜態知識庫：pH/EC/土濕/溫度門檻表與改良資材對照。

**串接**：寫 nzd_sensor_readings：灌溉排程讀最新土濕自動預填、連作障礙工具讀 pH 趨勢；土濕黃燈的「去排澆水」按鈕直接跳灌溉工具；改良動作完成寫 nzd_logs。

### 巡田健檢地圖（九宮格走田版）（難度 M）

**情境**：週日上午例行巡田，阿明照工具指示把田當成九宮格，走一圈每格停 30 秒目測評分，回到家看到整片田的紅黃綠熱區圖——右下角那格連兩週變差，明天優先去處理。誠實原則：不假裝有無人機影像分析，改成結構化人工巡田評分。

**輸入**：田區網格大小（2×2/3×3/4×4，預設 3×3，存 nzd_farm_profile.grid）；每格四題點選：葉色（濃綠/淡綠/黃化）、缺株（0/1-3/4+ 株）、病徵（無/疑似/明顯）、結果量目測（多/中/少；未進入結果期則此題隱藏）。

**引擎**：
> 每格健康分 = 葉色(濃綠40/淡綠25/黃化10) + 病徵(無30/疑似15/明顯0) + 缺株(0株15/1-3株8/4+株0) + 結果量(多15/中10/少3)。格子上色：≥80 綠 / 60-79 黃 / <60 紅。跨週比較：與上一次同格分數差 ≤-15 → 標「惡化」箭頭；連續兩週惡化 → 置頂點名。空間規則：黃化格集中在同一邊列 → 提示「檢查該側溝渠排水/灌溉管末端水壓」；缺株率全田 >10% → 補植提醒；紅格且病徵明顯 → 一鍵跳病蟲害問答並帶入分區。全田平均分作為健康指數趨勢線。

**輸出**：吉祥物：「整片田 87 分，不錯喔！不過右下 C3 格連兩週變黃，明天先去那邊看看。」展開：九宮格熱區圖（點格看明細）、與上週對比、待辦建議清單、【C3 是什麼病？】跳轉按鈕。

**資料源**：localStorage: nzd_field_scan[]{date,grid,scores[]}（本工具 owner）、nzd_farm_profile；靜態知識庫：評分權重表、空間規則（邊列黃化→排水）。

**串接**：紅格跳病蟲害辨識工具（URL 帶 ?zone=C3 預填）；巡田完成寫 nzd_logs{type:'巡田'}；缺株率供產量預估下修（實際株數 = 1800×面積×(1-缺株率)）；健康指數供連作障礙工具參考。

### 下一季還能種嗎（連作障礙預防）（難度 S）

**情境**：十一月採收接近尾聲，阿明在盤算下一季：同一塊地已經連種番茄好幾季了，今年還中過一次青枯病。翻一下這工具，決定是續種、輪作還是休耕消毒。

**輸入**：同田區連作季數（預填 nzd_rotation.seasons，可改）；本季土傳病次數（自動從 nzd_pest_history 統計 soilborne:true 筆數，可改）；最近 pH（自動帶 nzd_sensor_readings）；本季每分產量（自動 = nzd_logs 採收累計 ÷ 面積）。

**引擎**：
> 主規則（沿用門檻）：連作 <2 季且土傳病 <2 次 → 低風險；連作 ≥3 季或土傳病 ≥2 次 → 高風險；其餘 → 中風險。加重信號（各 +1 級，最高到高風險）：每分產量 < 3200kg×80%；pH 漂出 6.0-6.8 且連續 2 筆。輸出對應行動方案（靜態知識庫）：低→可續種，建議施足量有機質+定期測pH；中→建議間隔一季輪作非茄科（推薦：水稻/玉米/十字花科，明列「不可：茄子、青椒、馬鈴薯」）；高→強烈建議 1-2 季輪作或休耕，附土壤處理選項卡（淹水休耕 4-6 週/夏季太陽能消毒覆膜 4 週/土壤添加資材）。使用者按【決定續種】→ nzd_rotation.seasons+1 並跳最佳播種時機工具；按【決定輪作】→ 重置 seasons=0 並記錄輪作作物。

**輸出**：吉祥物：「這塊地連種 3 季、又中過一次青枯病，下一季換種玉米或休耕淹水一個月比較保險喔！」展開：風險燈號與四項判斷依據（每項標明來源：自動統計/手動）、行動方案卡、【決定續種→看播種時機】/【決定輪作】按鈕。

**資料源**：localStorage: nzd_rotation（owner）、nzd_pest_history（土傳病計數）、nzd_sensor_readings（pH）、nzd_logs（採收累計）、nzd_farm_profile（面積）；靜態知識庫：3200kg/分基準、輪作作物表、土壤處理方案卡。

**串接**：讀病蟲害/讀值/日誌三個工具存的資料（本工具幾乎零輸入是靠它們餵）；寫 nzd_rotation；【決定續種】跳最佳播種時機工具並帶入「高風險提醒」旗標。


---

## 採收保鮮

### 採收時機預測（難度 M）

**情境**：桃園的阿明 4 月初定植了一批牛蕃茄，7 月中在儀表板看到價格不錯，想知道「我這批到底哪天可以開始採」；三天後氣象說有颱風接近，他晚上又打開這個工具，想確認要不要明天一早搶收轉色果。

**輸入**：定植日期（date，預填 localStorage nzd_field.transplant_date，首次填寫後自動存回）；目前果實狀態（單選：綠熟/轉色/半紅/全紅，預設「轉色」）；面積分數唯讀顯示（來自 nzd_field.area_fen）。其餘全自動：氣象與門檻不用手填。

**引擎**：
> 1) 基準窗口 = 定植日 +85 天 ~ +110 天。2) 抓 open-meteo（24.99,121.30）未來 16 日逐日資料，計未來 7 日中 temperature_2m_max ≥27°C 的天數 h：h≥5 → 窗口整體提前 7 天；3≤h≤4 → 提前 5 天；否則不調整。3) 逐日燈號（未來 7 日）：precipitation_sum ≥10mm → 「勿採」（濕果易爛）；temperature_2m_max ≥35 → 「避開中午、清晨採」；wind_speed_10m_max ≥89 km/h（≈蒲福 10 級）或 precipitation_sum ≥80mm → 「災害日」。4) 搶收判斷：若災害日落在今日起 3 天內 且 果實狀態 ∈ {轉色,半紅,全紅} → 輸出「提前搶收」警告，建議搶收日 = 災害日前最後一個非雨日。5) 批次計畫：窗口切三批（前 1/3 採轉色果、中 1/3 主力、後 1/3 尾批），每批配窗口內天氣最好的 2~3 天（無雨、<32°C 優先）。6) 今日狀態機：窗口未到 → 倒數 N 天；窗口內 → 「可採」+ 本週最佳採收日 top3；過窗口 → 「已過熟風險」提醒。

**輸出**：吉祥物：「再 12 天就進採收窗口囉！最近連日超過 27 度，建議提早 5 天、先採轉色果～」展開細節：①調整後窗口日期區間與提前原因 ②未來 7 日逐日「適採/勿採/災害」燈號列 ③三批次建議日期表 ④颱風搶收警告卡（有才顯示）。

**資料源**：open-meteo daily：temperature_2m_max、temperature_2m_min、precipitation_sum、wind_speed_10m_max、relative_humidity_2m_mean（forecast_days=16）；localStorage nzd_field{transplant_date, area_fen}；靜態門檻：85~110 天、≥27°C 提前 5~7 天、風≥10級、暴雨 24h≥80mm。

**串接**：讀 nzd_field（由成本試算/最佳播種時機寫入）。寫 nzd_harvest_plan = {window_start, window_end, advanced_days, batches:[{label,dates[]}], best_days[], rush_harvest:bool, updated_at}——供「產量預估」（判斷已進入採收期）、「人力排班」（採收日排人）、「保鮮／儲存建議」（預告入庫量）讀取。

### 產品分級建議（難度 S）

**情境**：早上 6 點採完 300 公斤，阿明在集貨棚邊分裝邊想：「這批到底要不要花工分 A/B/C？分了能多賣多少？」他打開工具，用滑桿抓一下各級比例，馬上看到用今天行情分級出貨比整批賤賣多賺多少。

**輸入**：今日採收量 kg（預填：nzd_harvest_plan 若在窗口內則預填 nzd_field.area_fen×3200÷批次數，否則預填上次紀錄）；分級方式二擇一：A. 比例滑桿 A/B/C %（預設取 nzd_grade_batches 歷史平均，無歷史則 70/20/10）；B. 症狀決策樹逐箱判（果形完整？→色澤均勻？→有外傷/裂果？→捏起來軟？）；出貨通路（單選：批發/直銷/電商，預設批發）；基準價 元/kg（自動帶 AMIS latest_price.price，可手改）。

**引擎**：
> 1) 決策樹分級：外傷明顯 OR 軟果 OR 裂果 → C；果形完整 AND 色澤均勻 AND 無外傷 → A；其餘 → B。2) 計價：P=基準價，通路係數 c=批發1.0/直銷1.1/電商1.2；單價 A=P×1.15×c、B=P×1.0×c、C=P×0.85×c。3) 比較：分級收入 = Σ(級別kg×級別單價) vs 不分級收入 = 總kg×P×c×0.95（混級折價 5%）→ 顯示差額。4) 警示規則：C 占比 >15% → 卡片提示「損耗偏高，看看保鮮／儲存建議」+「C 級量 ≥100kg 可考慮加工建議」；A 占比 >60% → 提示「品質好，試試電商/直銷通路加價」。5) 按「存這批」→ append 紀錄並累加庫存。

**輸出**：吉祥物：「今天這批分好級再走直銷，可以比整批混賣多賺 1,240 元喔！」展開：各級 kg／單價／金額三欄表、差額比較條、C 級去向建議（促銷/加工）、「存這批」按鈕與本季累計採收量。

**資料源**：AMIS code_FJ3.json：latest_price{price,date}；localStorage：nzd_grade_batches（歷史比例）、nzd_harvest_plan、nzd_field；靜態係數：品質 1.15/1.0/0.85、通路 1.0/1.1/1.2。

**串接**：讀 nzd_harvest_plan、AMIS 即時價。寫 nzd_grade_batches（append {date, a_kg, b_kg, c_kg, price_used, channel}）與 nzd_inventory{a_kg,b_kg,c_kg,updated_at}（累加）——「產量預估」用 nzd_grade_batches 加總已採量；「保鮮／儲存」「加工建議」讀 nzd_inventory；「定價策略」「損益分析」讀 price_used 與各級金額。

### 保鮮／儲存建議（難度 M）

**情境**：晚上 8 點，今天沒出完的 180 公斤要進冷藏庫，阿明拿溫度計量到庫溫 16 度、旁邊還堆著親戚寄放的香蕉。他打開工具輸入讀值，想知道要不要調溫、這批最晚哪天一定得出貨。

**輸入**：儲存方式（常溫棚/冷藏庫，預設冷藏庫）；實測庫溫 °C（數字，預設 12）；實測濕度 %（數字，預設 88，可留空）；果實狀態（綠熟/轉色/全紅，預設轉色）；入庫量 kg（預填 nzd_inventory 三級加總，可改）；同倉高乙烯水果（勾選：香蕉/蘋果/木瓜/無，預設無）。誠實原則：無 IoT，全部手動輸入讀值→判斷。

**引擎**：
> 1) 目標 10~13°C、85~90%RH。溫度判定：<10 → 「寒害風險（水浸斑）」建議調高；10~13 → OK；>13 → 過高警告。2) 可存天數估算（查表×折減）：基準天數 base = 綠熟21天/轉色14天/全紅8天（@10~13°C）；溫度折減：每高於 13°C 一度 ×0.9（複乘）；常溫棚用 open-meteo 未來 3 日 (max+min)/2 當庫溫，>25°C 時全紅僅 2~3 天。3) 濕度：<80% → ×0.85 並提示「覆膜/地面灑水加濕」；>92% → 提示「黴害風險，加強通風」。4) 高乙烯同倉勾選任一 → ×0.7 並輸出「隔離存放」警告。5) 出貨期限 = 今天 + floor(估算天數)，逐級（A/B/C 各自入庫日）算 deadline；期限 ≤2 天的量標紅。6) 操作 SOP 靜態卡：先分級再入庫、預冷、不疊超過 N 箱。

**輸出**：吉祥物：「庫溫 16 度太高了！降到 12 度這批可以多放 5 天～還有，香蕉搬出去啦！」展開：目標 vs 實測對照表、估計可存天數與「最晚 7/28 前出貨」期限卡、乙烯/濕度警告、入庫 SOP。

**資料源**：靜態知識庫：10~13°C/85~90%RH、各熟度基準存期表、乙烯折減 0.7；open-meteo daily temperature_2m_max/min（常溫棚估溫）；localStorage nzd_inventory。

**串接**：讀 nzd_inventory（產品分級寫入）。寫 nzd_storage_log（append {date, method, temp, rh, ethylene, est_days, deadline}）——「加工建議」讀 deadline ≤2 天的量直接列入建議加工/促銷；「行銷文案生成」可讀「今天必須出清」清單生成促銷貼文。

### 產量預估（升級版）（難度 M）

**情境**：採收前兩週，販運商打電話問阿明「你這季能交多少量」；他打開工具看預估總量報數字。之後每採一批他都在分級工具存檔，回來這裡看進度條：已採多少、還剩多少、剩的照最近行情大概值多少錢。

**輸入**：面積 分（預填 nzd_field.area_fen，預設 1）；定植日（預填 nzd_field.transplant_date）；株數/分（預設 1800）；生長狀況（差/普通/好 三選，預設普通）；已採收量：無—自動加總 nzd_grade_batches，唯讀顯示可展開明細。取代舊版「輸入面積和季節」的純手填。

**引擎**：
> 1) 基準量 Y0 = 面積 × 3200 kg/分 × 生長修正（差0.85/普通1.0/好1.1）×（株數/1800）。2) 天氣折減（open-meteo 未來 16 日）：temperature_2m_max ≥35°C 每日 −5%（上限 −15%，裂果/落果）；precipitation_sum ≥80mm 任一日 −15%；temperature_2m_min ≤12°C 且尚在結果期（定植 <85 天）任一日 −10%；總折減下限 0.6。Y = Y0 × (1−Σ折減)。3) 災損提醒：抓災損 yearly JSON，若當前月份屬歷年高災損月（7~9 月颱風季）→ 顯示「歷年同期番茄災損 X 噸」風險卡（僅提示不折算）。4) 進度：harvested = Σnzd_grade_batches kg；remaining = max(Y − harvested, 0)；進度條 %。5) 金額：近 4 週均價 p̄ = avg(AMIS weekly 最後 4 筆 price)；預估待收金額 = remaining × p̄；若 nzd_cost_result 存在 → 預估毛利 = (harvested+remaining)×p̄ − total_cost，毛利率一併算。

**輸出**：吉祥物：「這季估計還能採 2,400 公斤，照最近行情大約值 11 萬 4 千元喔！」展開：基準量與各項天氣折減明細、已採/剩餘進度條、近 4 週均價、預估待收金額與毛利（有成本檔才顯示）、颱風季災損風險卡。

**資料源**：open-meteo daily（max/min 溫、precipitation_sum）；AMIS code_FJ3.json weekly[{key,price}] 取末 4 筆；災損 yearly JSON（同期提醒）；localStorage：nzd_field、nzd_grade_batches、nzd_cost_result{total_cost}；靜態：3200kg/分、1800株/分。

**串接**：讀 nzd_field 與 nzd_cost_result（成本試算寫入）、nzd_grade_batches（分級寫入）、nzd_harvest_plan（判斷結果期/採收期）。寫 nzd_yield_estimate{total_kg, harvested_kg, remaining_kg, avg_price, est_revenue, updated_at}——「加工建議」讀 remaining_kg 評估供給壓力；「損益分析」「人力排班」直接取用。

### 加工建議（升級版）（難度 M）

**情境**：連日盛產，冷藏庫快滿了，阿明在儀表板看到批發價跌破 40 元。晚上盤點完，他打開工具想做一個決定：明天是照常鮮售，還是聯絡加工廠把一部分轉成番茄乾/醬料原料。

**輸入**：目前庫存 kg（預填 nzd_inventory 三級加總，可改）；C 級占比（無—自動由 nzd_inventory 算出）；今日批發價（無—自動帶 AMIS latest_price.price，可覆寫）；加工收購價 元/kg（預設 15，附靜態行情區間說明 12~18）；每日鮮售出貨能力 kg/日（預設 200，存回 nzd_prefs）。

**引擎**：
> 1) 3×3 決策矩陣：庫存 高>800/中400~800/低<400 × 價格 低<40/中40~50/高>50。核心規則：高庫存+低價 → 「優先加工」；低庫存+高價 → 「全部鮮售」；中間格 → 「部分加工」，建議加工量 = max(庫存 − 5×日出貨能力, 0)。2) 趨勢修正：AMIS daily 取末 7 筆算價格斜率，跌幅 ≥10% → 決策往「加工」方向升一級；漲幅 ≥10% → 降一級。3) 期限加權：nzd_storage_log 中 deadline ≤2 天的量，無條件列入「立即加工或促銷」清單（優先於矩陣）。4) 供給壓力：nzd_yield_estimate.remaining_kg > 庫存×2 → 提示「後面還有大量要進來，建議提高加工比例」。5) 兩案試算：甲案全鮮售 = Σ各級kg×分級價×(1−0.03×預估滯銷天數損耗)；乙案建議量加工 = 加工量×加工收購價 + 其餘鮮售——並排比金額。6) 靜態知識庫：加工品項（番茄乾/醬/汁）門檻與桃園在地代工通路名錄卡（名稱/最低量/聯絡方式）。

**輸出**：吉祥物：「庫存 900 公斤、行情跌到 38 元——建議先把 500 公斤轉加工，比硬撐鮮售多保住約 4,300 元喔！」展開：決策矩陣定位圖（標出你在哪一格）、甲乙兩案金額並排、期限快到必出清單、後續供給壓力提示、加工通路名錄。

**資料源**：AMIS code_FJ3.json：latest_price、daily[] 末 7 筆算趨勢；localStorage：nzd_inventory、nzd_storage_log、nzd_yield_estimate、nzd_prefs；靜態知識庫：門檻 800kg/40元、加工收購價區間、桃園加工通路名錄、每日損耗 3%。

**串接**：讀 nzd_inventory（分級）、nzd_storage_log（保鮮）、nzd_yield_estimate（產量預估）。寫 nzd_processing_decision{date, decision, process_kg, fresh_kg, est_delta}——「行銷文案生成」讀它生成促銷/加工品貼文；「損益分析」把加工收入納入營收；「定價策略」讀決策調整 C 級報價。


---

## 銷售市場

### 定價策略建議（今天賣多少）（難度 M）

**情境**：清晨五點半，阿田哥採完兩百斤牛蕃茄準備裝車，販運商在LINE上問「今天什麼價？」。他打開儀表板看到最新拍賣價，但不確定自己的A級貨該報多少、直銷攤要不要調價，於是點開定價工具，30秒拿到三個通路各自的建議報價。

**輸入**：品質等級 A/B/C（預設A，若分級助手有存 nzd_grade_split 則預選佔比最高等級）；通路 批發/直銷/電商（預設讀 localStorage nzd_channel，無則批發）；今日出貨量 kg（選填，預填 nzd_yield_forecast 的週產量/7）；目前庫存 kg（預填 nzd_inventory_kg）。行情價全自動載入，不用手填。

**引擎**：
> 1) 基準價 base = latest_price.price（FJ3 JSON，每15分更新）。2) 建議價 = base × 品質係數(A 1.15 / B 1.0 / C 0.85) × 通路係數(批發 1.0 / 直銷 1.1 / 電商 1.2)，四捨五入到整數元。3) 趨勢判斷：t = (base − avg(daily 近7筆price)) / avg7；t ≥ +0.05 → 「行情偏高，建議今天出」；t ≤ −0.05 且庫存可冷藏(10~13°C、85~90%RH) → 「行情走低，可存放的貨建議等2~3天」；其餘 → 「行情平穩，照建議價出」。4) 成本地板：讀 nzd_cost_per_kg（成本試算存檔），若建議價 < 成本×1.1 → 紅色警告「這個價低於成本一成內，要出貨嗎？」。5) 加工分流規則：if nzd_inventory_kg > 800 && base < 40 → 額外建議「庫存超過800kg且價格跌破40元，C級貨建議走加工（連到買家媒合的加工廠清單）」。6) 市場比較：用 market_compare.markets_price[] 找出本月均價最高的市場，若比整體均價高 ≥5% 顯示「○○市場這個月價格比較好」。

**輸出**：吉祥物：「今天A級批發建議報 52 元，行情比上週高一點，放心出貨喔！」展開細節：三通路×三等級的 3×3 建議價矩陣、近7日價格 sparkline、成本地板線（若有存檔）、各市場本月均價排行、加工分流提示（觸發時）。一鍵「存這次報價」寫入 localStorage。

**資料源**：code_FJ3.json：latest_price{date,price}、daily[{key,price,volume}]近7筆、market_compare{month,markets_volume[],markets_price[]}；localStorage：nzd_cost_per_kg（成本試算）、nzd_inventory_kg（儲存管理）、nzd_grade_split（分級助手）、nzd_channel（買家媒合）；靜態知識庫：品質/通路係數表、加工門檻(800kg/40元)。

**串接**：讀：nzd_cost_per_kg（成本試算存）、nzd_yield_forecast（產量預估存）、nzd_inventory_kg、nzd_grade_split、nzd_channel。寫：nzd_price_quote = {date, grade, channel, price, qty} → 供行銷文案生成預填售價、供損益分析當實際售價紀錄。

### 溯源履歷生成（一頁生產履歷卡）（難度 L）

**情境**：週六市集，一位帶小孩的媽媽問阿田哥「你的蕃茄有沒有噴藥？有履歷嗎？」。他當場答不清楚，回家晚上打開溯源工具，把這季的定植、施肥、用藥紀錄整理成一張帶QR碼的履歷卡，下週印出來貼在攤位上，客人掃碼就能看完整時間軸。

**輸入**：農場基本檔（農場名、負責人、鄉鎮，首次填寫後存 nzd_farm_profile 永久預填）；定植日期（預填最佳播種時機工具存的 nzd_planting_date）；田間紀錄快速新增：日期＋類型（施肥/用藥/灌溉/整枝/採收）＋內容，用藥時從靜態藥劑表下拉選（自動帶停藥天數）；採收日期（預填定植日+85~110天區間中點）。

**引擎**：
> 1) 時間軸組裝：把 nzd_field_log[] 依日期排序渲染成垂直時間軸。2) 安全採收檢核：對每筆用藥紀錄，if 用藥日期 + 該藥停藥天數 > 採收日期 → 紅色警告「○月○日用的△△還在停藥期內，安全採收日要到○月○日」，此檢核不通過則履歷卡加註待確認、不給下載。3) 生育期合理性：採收日−定植日 若不在 85~110 天（近期7日均溫≥27°C 時區間下修為 80~103，均溫取 open-meteo past_days 日高低溫平均）→ 提示「天數怪怪的，確認一下日期」。4) 產出：Canvas 繪製一頁履歷卡（農場資訊＋品種牛蕃茄＋定植/採收日＋管理摘要＋QR碼），QR 用內嵌純JS qrcode 產生，內容為本頁URL + '#' + base64(履歷JSON)，掃碼者開啟同一靜態頁即從 hash 還原顯示，零後端。5) 下載PNG／列印CSS。

**輸出**：吉祥物：「履歷卡做好了！用藥都過了停藥期，可以安心給客人掃喔！」細節：可下載的履歷卡PNG（含QR）、完整田間時間軸、安全採收檢核結果（每筆用藥的停藥期倒數）、TGAP欄位完成度（已填8/12項）。

**資料源**：localStorage：nzd_farm_profile、nzd_planting_date（播種時機工具）、nzd_field_log[]（與病蟲害/施肥工具共用的田間日誌，格式 {date,type,item,note}）；open-meteo 24.99,121.30 daily temperature_2m_max/min（past_days=7，判斷高溫提早採收）；靜態知識庫：常用蕃茄藥劑停藥期表、TGAP履歷欄位清單。

**串接**：讀：nzd_planting_date（最佳播種時機存）、nzd_field_log[]（施肥計算器/病蟲害決策樹寫入的紀錄直接進時間軸）。寫：nzd_trace = {url_with_hash, completeness, harvest_safe:bool} → 行銷文案生成嵌入QR連結、出口文件輔助讀 completeness 當「有無履歷」判斷。

### 買家媒合（我的貨可以賣去哪）（難度 M）

**情境**：產量預估告訴阿田哥下個月會多收 2000 公斤，固定配合的販運商一週最多只吃 1500。晚上他躺在沙發滑手機打開媒合工具，輸入多出來的量，工具依到手價排出「桃園農會超市 > 三重果菜市場 > 電商寄倉」三條路和聯絡方式。

**輸入**：每週可供貨量 kg（預填 nzd_yield_forecast/4）；等級分佈 A/B/C %（預填 nzd_grade_split，無則 60/30/10）；配送方式：自己送（可接受車程 30/60/90 分鐘）/ 對方到貨收（預設自己送60分）；通路偏好複選：拍賣市場/超市農會/餐飲團膳/電商/加工廠/外銷貿易商（預設全選）。

**引擎**：
> 純規則配對，跑靜態通路名錄（每筆含：名稱、型態、最低供貨量kg/週、收購等級、抽成或運費%、距桃園車程分、聯絡與申請方式）：1) 硬篩：供貨量 ≥ 通路最低量、等級有交集（電商只收A、加工廠收C、拍賣A+B）、車程 ≤ 可接受值（到貨收則跳過）。2) 到手價估算：est = 市場價 × 通路係數(批發1.0/直銷1.1/電商1.2，加工廠固定收購價寫死名錄) × (1 − 抽成%)，其中拍賣市場的市場價用 market_compare.markets_price[] 對應該市場本月均價，非拍賣通路用 latest_price.price。3) 排序：依 est × min(可供量, 通路吃貨量) 的週營收估算降冪。4) 特例：若 nzd_export_ready ≥ 0.8 才顯示外銷貿易商群組，否則收合並註明「先完成出口文件輔助的清單」。

**輸出**：吉祥物：「多的2000公斤有地方去！桃園農會超市到手價最好，先打這支電話問問～」細節：排序後的通路卡片（預估到手價/週營收、最低量門檻、要求等級、聯絡電話與申請步驟）、各拍賣市場本月價量對照表、被篩掉的通路及原因（「量不夠300kg/週」）。點「就走這條」寫入預設通路。

**資料源**：靜態知識庫：北部通路名錄約20筆（台北一二市、三重、桃園果菜市場、農會超市、直銷站、團膳商、電商平台、加工廠、外銷貿易商，含門檻與抽成）；code_FJ3.json：latest_price、market_compare.markets_price[]/markets_volume[]；localStorage：nzd_yield_forecast、nzd_grade_split、nzd_export_ready。

**串接**：讀：nzd_yield_forecast（產量預估存）、nzd_grade_split（分級助手存）、nzd_export_ready（出口文件輔助存）。寫：nzd_channel = 使用者選定的通路型態 → 定價策略建議的預設通路；nzd_matched_buyer = {name,type} → 損益分析標註銷售去向。

### 行銷文案生成（貼文小幫手）（難度 M）

**情境**：週五晚上八點，阿田嫂要在自家FB粉專和社區LINE群發週末直銷預告，盯著螢幕十分鐘打不出第一句。她打開貼文小幫手，勾「當日現採」「產地直送」，價格已自動帶入今早存的直銷價55元，按一下生成，挑了三個版本裡最順眼的，複製貼上就發出去了。

**輸入**：用途：FB貼文/LINE群組短訊/蝦皮商品描述/紙箱貼標（預設FB）；賣點複選：當日現採/產地直送/牛蕃茄厚肉多汁/有生產履歷/低於市場價（最後一項僅在真的低於行情時可勾）；售價與單位（預填 nzd_price_quote 的直銷價）；取貨方式文字（預填上次輸入 nzd_last_pickup_text）；語氣：親切/促銷/簡潔（預設親切）。

**引擎**：
> 模板填空生成，無LLM：1) 模板庫：每個 用途×語氣 組合預寫 2~3 個骨架（FB約80~120字、LINE約40字、蝦皮含規格條列、貼標僅兩行），槽位如 {農場名}{售價}{採收描述}{取貨}{天氣哏}{行情哏}。2) 槽位填值：農場名取 nzd_farm_profile；採收描述依今天日期＝「今早現採」；天氣哏由 open-meteo 未來2日決定——高溫≥33°C→「大太陽晒紅的」、有雨→「趁雨前搶收的」、否則省略。3) 誠實檢核：「低於市場價」勾選時計算 (latest_price×1.1 − 售價)/latest_price，僅當售價確實低於直銷行情價≥5% 才生成「比市場便宜X%」句，否則灰掉不可勾並提示原因。4) 履歷嵌入：若 nzd_trace 存在且 harvest_safe，自動附「掃QR看生產履歷」句與連結。5) 每次生成 3 個候選，逐一「一鍵複製」，emoji 開關。

**輸出**：吉祥物：「幫你寫好三個版本，第一個最像你平常講話的口氣！」細節：三張候選文案卡（各附複製鈕）、已套用的槽位值一覽（點錯可改）、被擋下的宣稱及原因（「你的價沒有低於行情，這句不能用喔」）。

**資料源**：靜態知識庫：4用途×3語氣的模板骨架庫（約30個）＋賣點句庫；localStorage：nzd_farm_profile、nzd_price_quote（定價工具）、nzd_trace（溯源工具）、nzd_last_pickup_text；code_FJ3.json latest_price（驗證比價宣稱）；open-meteo 24.99,121.30 未來2日 temperature_2m_max、precipitation_sum（天氣哏）。

**串接**：讀：nzd_price_quote（定價策略存的售價）、nzd_farm_profile 與 nzd_trace（溯源工具存）。寫：nzd_last_pickup_text（下次預填）、nzd_last_post = {platform,date}（僅自用，避免重複發文提醒）。

### 出口文件輔助（外銷行不行）（難度 M）

**情境**：一位做日本線的貿易商在產銷班群組問「有沒有人牛蕃茄能穩定供貨外銷？」。阿田哥心動又心虛——不知道外銷要準備什麼、划不划算。他打開外銷工具選「日本」，工具告訴他日本均價比國內高多少、還缺哪三份文件、各要去哪個單位辦。

**輸入**：目的市場下拉：日本/香港/新加坡/韓國（預設日本）；預計供貨量 kg/月（預填 nzd_yield_forecast）；已備條件勾選清單（產銷履歷TGAP、農藥殘留檢驗報告、包裝場登錄…，其中「有生產履歷」自動依 nzd_trace.completeness ≥ 0.8 預勾，其餘讀上次存檔 nzd_export_checklist）。

**引擎**：
> 1) 划算判斷：從 trade JSON 取該國近3年出口值/出口量 → 平均外銷單價 NT$/kg；比值 r = 外銷單價 / latest_price.price；r ≥ 1.3 →「明顯較好」、1.1~1.3 →「略好，扣掉檢驗與運費可能只打平」、<1.1 →「不建議，國內賣就好」。2) 文件決策樹（靜態，每市場一份）：日本＝檢疫證明＋殘留檢驗（列日本較嚴的代表性藥劑項目）＋包裝標示；香港/新加坡＝較簡清單；韓國＝需供果園登錄；每項附主管單位（防檢署/農糧署/公證檢驗機構）、辦理方式、預估工作天與官方連結。3) 準備度 score = 已勾項數/該市場所需項數；score=1 → 「文件齊了，可以回貿易商」；否則列出缺項的下一步（「先送殘留檢驗，約7個工作天」）。4) 量門檻檢核：供貨量 < 該市場最低併櫃量（靜態值）→ 提示「量不足以自己出，建議透過貿易商併櫃」。

**輸出**：吉祥物：「日本的價錢比國內好三成，但你還缺殘留檢驗報告，先辦這個！」細節：外銷vs國內單價對比條、該市場文件清單（已備打勾/缺項標紅＋辦理單位連結）、近3年對該國出口量值折線、準備度進度條、下一步行動一句話。

**資料源**：trade JSON（歷年對各國出口量/出口值，換算平均單價 NT$/kg）；code_FJ3.json latest_price（國內比較基準）；靜態知識庫：四市場文件決策樹（文件名、主管單位、官方連結、最低併櫃量、代表性殘留標準差異）；localStorage：nzd_export_checklist、nzd_trace.completeness、nzd_yield_forecast。

**串接**：讀：nzd_trace（溯源履歷存，自動認定履歷完備）、nzd_yield_forecast（產量預估存）。寫：nzd_export_checklist（勾選進度）、nzd_export_ready = score → 買家媒合用它決定是否顯示外銷貿易商群組。


---

## 經營管理

### 財務損益分析（這季到底賺多少）（難度 L）

**情境**：6 月底，桃園蘆竹的阿宏出完最後一批牛蕃茄，晚上坐在客廳翻著一疊出貨單，想知道這季扣掉成本到底賺了多少、明年該不該續種第二季。他打開損益分析，發現成本和產量都已經自動帶入，只要補登幾筆出貨就看到答案。

**輸入**：全部可自動預填：總生產成本與面積（讀 nzd.FJ3.cost.v1，成本試算存檔）、總產量 kg（讀 nzd.FJ3.yield.v1，產量預估存檔）。出貨紀錄逐批輸入：{日期(預設今天), 公斤數, 品級 A/B/C(預設A), 通路 批發/直銷/電商(預設批發), 單價 元/kg(預設=該日 AMIS daily 價 × 品質係數 × 通路係數)}。懶人模式一鍵「用行情估算」：總產量 × 出貨月份 monthly 均價加權。額外成本手填：臨時工資(預填自 nzd.FJ3.labor.v1)、運費、包材(預設 0)。

**引擎**：
> 收入 = Σ(批次kg × 單價)；單價預設 = AMIS 當日價 × 品質係數{A:1.15, B:1.0, C:0.85} × 通路係數{批發:1.0, 直銷:1.1, 電商:1.2}。總成本 = 生產成本 + 臨時工資 + 運費 + 包材。毛利 = 收入 − 總成本；每公斤成本 = 總成本 ÷ 總出貨kg = 損益兩平價；毛利率 = 毛利/收入。判斷分支：毛利率 ≥ 0.30 →「豐收季」；0.10~0.30 →「有賺但普通」；0~0.10 →「打平邊緣」；< 0 →「虧損」。附加規則：(1) 平均實收單價 < 同期 AMIS monthly 均價 × 0.92 → 提示「你賣得比行情低 8% 以上」，並即時模擬改直銷(×1.1)/電商(×1.2)的毛利差；(2) 期末未售庫存 > 800kg 且 latest_price < 40 → 觸發既有加工門檻，建議轉加工；(3) 結算時把 {seasonId, 面積, 總產量, 收入, 成本, 毛利, 毛利率, 均價, 每公斤成本} 寫入 nzd.FJ3.season.<YYYY-春／秋>.summary。

**輸出**：吉祥物：「這季每公斤成本 28 元、平均賣 45 元，整季賺了 8 萬 4，比打平價多 17 元喔！」展開細節：收入−成本瀑布圖、每公斤成本線 vs 目前 AMIS 行情線（低於成本線標紅）、逐批出貨表、通路模擬器（拖動 A/B/C 比例與通路看毛利變化）、「存成本季結算」按鈕。

**資料源**：AMIS：latest_price.price、daily[].price、monthly[].price（同期均價比較）。localStorage 讀：nzd.FJ3.cost.v1、nzd.FJ3.yield.v1、nzd.FJ3.labor.v1、nzd.FJ3.sales.v1（出貨紀錄本體）。靜態知識庫：品質/通路係數表、加工門檻。

**串接**：讀：成本試算(nzd.FJ3.cost.v1)、產量預估(nzd.FJ3.yield.v1)、人力排班(nzd.FJ3.labor.v1 的工資小計)。寫：nzd.FJ3.sales.v1（出貨帳）、nzd.FJ3.season.<id>.summary（給跨季績效比較、碳足跡強度分母、保險的收入基準用）。

### 採收人力排班（要叫幾個工人）（難度 M）

**情境**：定植後第 75 天晚上，阿宏看儀表板知道行情不錯，估計兩週後開始採收，正要打電話約長期配合的班底，但不確定高峰週到底要叫幾個人、預算多少、哪幾天會下雨不能採。他打開排班工具，8 週的人力表直接排好。

**輸入**：定植日期（預填自 nzd.FJ3.plant.v1，播種時機工具存檔；無則手選）、面積 分（預填自 nzd.FJ3.cost.v1）、預估總產量 kg（預填自 nzd.FJ3.yield.v1，fallback = 面積 × 3200kg/分）、每人每日採收量（預設 150 kg/人日）、自家固定人手（預設 2 人）、日薪（預設 1200 元/人日）。

**引擎**：
> 採收窗起點 = 定植日 + 85 天，迄點 = +110 天；若 open-meteo 未來 7 日 temperature_2m_max 均值 ≥ 27°C → 起點提前 6 天（沿用「≥27°C 提早 5~7 天」門檻）。產量按 8 週鐘形曲線分配：[5,10,18,22,20,13,8,4]%。每週需求人天 = ceil(週產量 ÷ 150)；並以既有門檻 clamp：高峰週人天限制在 20~28 × (面積/5分) 區間內，超出即以上限計並提示。缺工 = max(0, 需求人天 − 固定人手×6)；週工資 = 缺工 × 1200。天氣疊加（僅涵蓋預報期 16 天內）：precipitation_sum ≥ 10mm 的日子標「不宜採收」，該日人天平移到最近晴日；windspeed_10m_max ≥ 24.5 m/s(10級) 或 24h 降雨 ≥ 80mm → 觸發「搶收模式」：把預警日前 2 天的人天需求 ×1.5 並置頂警示。輸出存 nzd.FJ3.labor.v1 = {weeks:[{起訖, 需求人天, 缺工, 工資}], 總工資}。

**輸出**：吉祥物：「下下週開始採！高峰在第 3 週，要多找 3 個人、臨時工預算大約 2 萬 2 喔。」展開細節：8 週長條圖（需求人天 vs 自家人力線）、每週缺工與工資表、未來 16 天雨天/搶收標記、一鍵複製「約工訊息」文字模板（含日期與人數，LINE 貼給工頭）。

**資料源**：open-meteo（24.99,121.30）daily：temperature_2m_max、precipitation_sum、windspeed_10m_max，forecast_days=16。localStorage 讀：nzd.FJ3.plant.v1、nzd.FJ3.cost.v1、nzd.FJ3.yield.v1。靜態知識庫：150kg/人日、20~28 人天/週門檻、預警門檻。

**串接**：讀：最佳播種時機（定植日）、成本試算（面積）、產量預估（總量）。寫：nzd.FJ3.labor.v1 → 損益分析自動帶入臨時工資項；搶收警示與氣象預警工具共用同一組門檻函式。

### 跨季績效比較（哪一季比較划算）（難度 M）

**情境**：1 月農閒，阿宏在規劃今年要種一季還是兩季，想起去年春作好像比秋作累但賺得少，卻說不出差在哪。他打開跨季比較，兩季的存檔自動並排，一眼看出秋作贏在 11 月的好價錢。

**輸入**：無—自動載入所有 nzd.FJ3.season.*.summary 存檔（由損益分析結算時寫入）。可手動補登歷史季：{季名, 面積, 總產量, 總收入, 總成本}（給還沒用過損益工具的舊季資料）。

**引擎**：
> 每季計算 5 指標：每分產量 = 總產量/面積（對照常態 3200kg/分，<85% 標紅）、每公斤成本、毛利、毛利率、售價溢價率 = 該季均價 ÷ 同期 AMIS monthly 均價 − 1。差異歸因決策樹（比較最好 vs 最差季）：／每分產量差／ > 15% →「產量問題」，若 nzd.FJ3.rotation.v1 顯示 ≥3 季連作或病害 ≥2 次則加註「可能是連作障礙」；／溢價率差／ > 10% →「賣的時機/通路問題」，畫出該季 AMIS 月價曲線並標出最高價月，建議下季出貨對準該月回推定植日（+85~110 天反算）；／每公斤成本差／ > 10% →「成本問題」，列出 cost.v1 中差額最大的成本項。趨勢：有 ≥3 季時對毛利率做最小平方法線性回歸，斜率 < 0 且連續 2 季下滑 → 顯示警語。

**輸出**：吉祥物：「去年秋作每分地多賺 1 萬 2，主要是趕上 11 月的好價錢，今年秋作可以把定植抓在 8 月中喔！」展開細節：各季並排成績單卡片（5 指標紅綠標）、毛利率趨勢折線、歸因說明區塊、「回推定植日」按鈕直接帶參數跳轉播種時機工具。

**資料源**：localStorage 讀：nzd.FJ3.season.*.summary、nzd.FJ3.cost.v1（成本項明細）、nzd.FJ3.rotation.v1（若連作工具有存）。AMIS：monthly[]、yearly[]（同期均價與長期基準）。靜態知識庫：3200kg/分常態產量、85~110 天採收窗。

**串接**：讀：損益分析的季結算存檔（本工具的資料全部來自它）、連作紀錄。寫：nzd.FJ3.compare.hint = {建議定植月} → 播種時機工具開啟時讀取並預設目標月份。

### 碳足跡計算機（我的蕃茄多低碳）（難度 S）

**情境**：農會通知產銷履歷加值申請可以附碳排資料，直銷客人也開始問「低碳」標示。週末下午，阿宏拿著肥料袋和台電帳單坐下來，十分鐘填完五個欄位，拿到一頁可以印出來附件的碳足跡報告。

**輸入**：面積 分（預填自 nzd.FJ3.cost.v1）、複合肥用量 kg/季（預設 = 面積 × 120kg/分）、用電度數/季（預設 = 面積 × 180 度/分，可改）、用水噸數/季（預設 = 面積 × 250 噸/分）、運輸：單程距離 km（預設 30）× 每週趟數（預設 2）× 出貨週數（預設 8，預填自 labor.v1 的採收週數）、總產量 kg（預填自 season summary 或 yield.v1）。

**引擎**：
> 排放 = 肥料 kg × 3.0（複合肥含 N2O，kgCO2e/kg）+ 度數 × 0.494（台電係數）+ 水噸 × 0.156 + 距離×趟數×週數×2 × 0.25（小貨車 kgCO2e/km，來回）。碳強度 = 總排放 ÷ 總產量 kg。分級門檻：< 0.5 kgCO2e/kg →「低碳」；0.5~0.9 →「一般」（露天蕃茄參考區間）；> 0.9 →「偏高」。減碳建議規則（按占比觸發）：肥料占比 > 50% → 建議土壤檢測後分次施肥（連結施肥工具）；用電 > 25% → 改清晨滴灌、避開尖峰；運輸 > 20% → 併車共運或改就近通路（直銷 ×1.1 順帶更賺，連損益模擬）。結果存 nzd.FJ3.carbon.<seasonId> = {分項, 總量, 強度, 等級}。

**輸出**：吉祥物：「你家蕃茄每公斤碳排 0.62 公斤，算一般水準，肥料就占了六成，改分次施肥最有感喔！」展開細節：四分項圓餅（肥料/用電/用水/運輸）、碳強度 vs 參考區間刻度尺、逐條減碳建議、「下載一頁報告」（列印友善版，附計算式與係數出處，給產銷履歷/農會用）。

**資料源**：靜態知識庫：排放係數表（複合肥 3.0、電 0.494、水 0.156、貨車 0.25 kgCO2e/km）與蕃茄碳強度參考區間。localStorage 讀：nzd.FJ3.cost.v1（面積）、nzd.FJ3.yield.v1 / nzd.FJ3.season.*.summary（產量）、nzd.FJ3.labor.v1（出貨週數）。

**串接**：讀：成本試算、產量預估/損益季結算、人力排班。寫：nzd.FJ3.carbon.<seasonId> → 跨季績效比較加一欄「碳強度」逐季比。建議區塊帶參數連到施肥工具與損益通路模擬。

### 學習充電站（現在該學什麼）（難度 S）

**情境**：晚上收工，阿宏剛用病蟲害工具查完葉子上的褐斑判定疑似晚疫病，滑到工具箱看到學習站亮著紅點：一支 12 分鐘的晚疫病防治影片，和週六桃園農改場的實體課。農閒的 12 月再打開，推的變成有機驗證與補助申請課。

**輸入**：無—自動載入。可選主題 chips 手動切換：病蟲害/土壤肥培/溫網室設施/行銷直銷/驗證標章/補助申請。

**引擎**：
> 規則推薦引擎，對靜態課程庫每筆算分後排序取前 5：score = 主題命中×3 + 生長階段命中×2 + 免費×1 + 一週內開課×1。三個訊號源：(1) 生長階段 = 由 nzd.FJ3.plant.v1 定植日推算 phase（0~30 育苗、31~60 開花、61~85 結果、86~110 採收、其他=休耕），phase→課程 tag 映射寫死（開花→肥培鉀鈣硼、採收→分級儲運、休耕→驗證與補助）；(2) 事件觸發 = 讀 nzd.FJ3.pest.lastQuery（病蟲害工具存的最近查詢病名）直接命中該病名 tag 置頂；open-meteo 有預警成立（風≥10級/高溫≥35/低溫≤12/雨≥80mm）→ 置頂防災整備文；(3) 月份 = 12~2 月推證照/驗證/補助課。課程庫為內建 JSON 40~60 筆：{title, provider(農民學院/桃園區農改場/農業易遊網/YT 頻道), url, format(線上影片/線上課/實體課), duration, tags[], phase[], free, dates[]}，實體課過期自動隱藏。

**輸出**：吉祥物：「最近在查晚疫病齁？這支 12 分鐘的防治影片先看，週六農改場還有實體課，離你 20 分鐘車程喔！」展開細節：推薦卡片清單（來源標章/時長/免費標/開課日）、主題 chips、已看打勾（存 nzd.FJ3.learn.done[]，看完的不再推）。

**資料源**：靜態課程知識庫 JSON（內建 40~60 筆，含農民學院與桃園農改場連結）。localStorage 讀：nzd.FJ3.plant.v1、nzd.FJ3.pest.lastQuery、nzd.FJ3.learn.done。open-meteo：預警判斷用 daily 高低溫/降雨/風速。

**串接**：讀：播種時機（定植日→階段）、病蟲害決策樹（lastQuery，需請病蟲害工具寫入此 key）、氣象預警共用門檻函式。寫：nzd.FJ3.learn.done[]。無下游消費者。

### 農業保險諮詢（保險與災助怎麼辦）（難度 M）

**情境**：颱風海上警報發布的晚上，儀表板預警亮紅，阿宏想起隔壁老王去年颱風後領了理賠，急著想知道自己現在保還來不來得及、沒保的話災後能領什麼。工具誠實告訴他：這次來不及了，但今晚先拍照存證，災後 48 小時內通報公所還能申請天災救助。

**輸入**：面積 分（預填自 nzd.FJ3.cost.v1）、設施類型：露天/簡易網室/溫室（預設露天）、投保狀態：未保/設施保險/收入保障型（預設未保，讀 nzd.FJ3.insure.v1 記憶）、上季收入（預填自 nzd.FJ3.season.*.summary，收入保障型試算用）。

**引擎**：
> 先算預警旗標 alert = open-meteo 未來 7 日任一日（windspeed_10m_max ≥ 24.5m/s 或 precipitation_sum ≥ 80mm）。決策樹四分支：(A) 未保 + 無預警 → 依設施推薦：溫室/網室→農業設施保險（保費補助 50%，試算 = 面積 × 費率表元/分 × 0.5）；露天→說明蕃茄目前無專屬品項保單，主推「農業天然災害現金救助」制度說明（番茄每公頃救助額，知識庫值）+ 設施改良補助入口。(B) 未保 + 預警中 → 誠實告知「警報期間停止受理投保，這次來不及」，直接切到救助準備模式：災前全園拍照存證清單（4 角度+受損前對照）、災後 48 小時內向公所通報、申請文件 checklist（存摺/身分證/土地清冊或租約/現場照片）。(C) 已保 + 預警中 → 理賠準備 checklist + 保單公司通報電話。(D) 已保 + 無預警 → 保單健檢：對照災損 yearly JSON 算「近 5 年番茄年均災損次數與金額」，期望損失 vs 年保費，比值 > 1 顯示「保值得」。所有 checklist 可打勾，狀態存 nzd.FJ3.insure.v1。

**輸出**：吉祥物：「颱風快來了，這次投保來不及囉！今晚先把田拍照存證，災後 48 小時內去公所通報，才領得到救助金喔。」展開細節：情境對應的行動 checklist（可打勾）、方案比較表（保費/補助/理賠條件）、文件清單、公所農業課與農會保險窗口電話（桃園各區，靜態名錄）。

**資料源**：靜態知識庫：保險方案與費率表、天災救助額度與申請流程、文件清單、桃園區公所/農會聯絡名錄。災損 yearly JSON（歷年番茄災損頻率與金額）。open-meteo：風速/降雨預警。localStorage 讀：nzd.FJ3.cost.v1、nzd.FJ3.season.*.summary。

**串接**：讀：成本試算（面積）、損益分析（收入基準）、與氣象預警工具共用 alert 判斷函式。寫：nzd.FJ3.insure.v1 = {status, plan, checklist 進度} → 氣象預警工具在預警成立時可讀它顯示「你尚未投保，點我看災助準備」快捷入口。
