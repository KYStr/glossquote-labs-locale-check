# 驗收契約
這是規格，未執行項不能預填PASS。需求對照[PRODUCT](PRODUCT.md)。
|案例|需求|輸入/步驟|精確預期|層級|
|---|---|---|---|---|
|A01 同一檔案|FR-01/02/04/09|{"x":"Hi {name}"}對同內容，single|0error/0missing/0extra；same-source warning可有1|Node純核心/假controller；非真browser|
|A02 錯變數|FR-01/02/04/09|{"x":"Hi {name}"}對{"x":"嗨 {user}"}|缺name1，多user1，path["x"]|Node純核心/假controller；非真browser|
|A03 多次使用|FR-01/02/04/09|{x} {x}對{x}|缺x1|Node純核心/假controller；非真browser|
|A04 空譯文|FR-01/02/04/09|{"x":"Hi"}對{"x":""}|warning empty；非missing|Node純核心/假controller；非真browser|
|A05 解碼後重複|FR-01/02/04/09|{"a":"1","\u0061":"2"}|DUPLICATE_KEY|Node純核心/假controller；非真browser|
|A06 路徑碰撞|FR-01/02/04/09|{"a.b":"X","a":{"b":"Y"}}|2不同path，不覆蓋|Node純核心/假controller；非真browser|
|A07 型別衝突|FR-01/02/04/09|ref{"a":"x"},target{"a":{"b":"y"}}|a type-conflict，不另列a.b extra|Node純核心/假controller；非真browser|
|A08 惡意key|FR-01/02/04/09|{"__proto__":"x"}|UNSAFE_KEY；Object.prototype未變|Node純核心/假controller；非真browser|
|A09 深度界線|FR-01/02/04/09|root計1，32層/33層|32接受/33 DEPTH_LIMIT|Node純核心/假controller；非真browser|
|A10 Unicode|FR-01/02/04/09|{"x":"\ud800"}|INVALID_UNICODE|Node純核心/假controller；非真browser|
|A11 雙括號|FR-01/02/04/09|{{name}} single/double|single unsupported警告且0variables/double name1|Node純核心/假controller；非真browser|
|A12 完整輸出|FR-01/02/04/09|filter只missing後下載|仍含extra/variable完整issues|Node純核心/假controller；非真browser|

## 必要M1 gate
Node24+；npm test含上述精確期望且expected不可由被測實作生成。npm run check真查結構與安全；npm run build真產物；source前後hash一致，實際證據寫evidence/m1。反例須確認錯輸入拒絕且成功結果失效。所有測試假資料，不讀個人文件；不得裝套件或啟動瀏覽器。

## 必要browser/release gate（目前NOT_RUN_USER_FOCUS_INCIDENT）
- B01 兩語真實輸入→主要操作→預覽→本地下載，下載byte內容符合核心且使用者可拿走使用。
- B02 成功後改來源/設定與錯值，舊輸出立即失效；快速重選/clear/cancel不復活。
- B03 惡意文字只文字，Network完整初載/操作/隱藏/離頁、同源/cdn-cgi/rum均核對；Storage前後無使用者資料。
- B04 鍵盤完整流程、焦點不受遮擋、讀屏label/status、320px、200%、mobile真機、權限拒絕、下載/列印原生行為獨立記錄。
- B05 中文英文切換與首頁互連、正式canonical/hreflang/x-default/robots/sitemap/安全HTTP與真404。
只用主代理確認真正隔離機制，禁止CUA/hidden-IAB/桌面/native/key/IME/clipboard測試。Node假DOM/Canvas/Audio與靜態檔不能冒充B01–05。手動NOT_RUN授權不等必要release gate全免除。
