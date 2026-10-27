# 翻譯檔缺漏檢查 產品規格
這是規格；實際狀態見[HANDOFF](HANDOFF.md)。

## 使用者與工作
網站上線前有兩份語系JSON，想一次找出漏翻、額外key及被翻壞的插值變數，免使用者看到空白或{name}。
使用者拿到：以參考JSON對照翻譯JSON，路徑級缺漏/多餘/型別/變數差異報告，可選只看待修並下載JSON/TXT。。核心工作在一個頁面完成，不引導去其他產品才能完成基本流程。

## 可觀察需求
- FR-01 來源與界線：每份1MiB、5000葉節點、深度32；僅object和string葉，禁止array/null/number/bool，拒解碼後重複key與__proto__等危險key但不可賦值prototype。路徑以segment陣列識別避免含點key碰撞。變數語法明確只{{name}}或{name}兩種使用者擇一，不冒稱支援ICU；每個葉比較變數多重集合，空翻譯與等原文僅warning且不視為必錯。
- FR-02 核心結果：按[TECHNICAL](TECHNICAL.md)精確演算法產生真實結果，沒有亂數假資料、只示範不可用按鈕或隱藏缺項。數字與文字規則不能自行猜測。
- FR-03 初始空頁，明確載入標示的假例子才能出現示例。主要工作可自填與清除，出錯指向欄位並保留可修改來源，舊成功輸出立即失效。
- FR-04 使用者每次更改來源、設定、匯入/匯出模式，先同步清除已準備的結果與可下載/複製狀態。所有非同步讀取與生成帶generation，晚到結果丟棄並釋放資源。同步小量運算不顯示假取消。
- FR-05 下載是真正本地產物，固定安全ASCII檔名，不使用使用者文字組路徑。Blob URL由controller單一擁有，替換/clear/pagehide撤銷；點下載後至少容許瀏覽器接管再撤銷，最遲30秒。複製僅明確點按且成功Promise才顯示成功，拒絕有可選文字替代。
- FR-06 輸入只記憶體，無storage/history/query/network/log/telemetry/遠端資源。明確語言切換會失去本頁未匯出資料。禁止以本機處理宣稱完全安全抹除或所有裝置支援。
- FR-07 繁中與英文完整功能、錯誤、結果、FAQ對應；各自靜態index.html與en/index.html。低性能裝置安全退出，無雲端fallback。
- FR-08 鍵盤可完成核心流程，320px/200%縮放不遺失操作，所有欄位有label，狀態非僅顏色，下載/匯入確認頁內不叫OS dialog作測試。
- FR-09 文字只textContent/value；輸出HTML只固定模板escape，不執行輸入。控制字元/Unicode/大小/schema邊界見技術契約，整份拒絕不得偷偷丟壞列。
- FR-10 完成M1不等於release。M2必要browser驗收後由原對話公開GitHub，主代理hosting/雙語首頁整合，再待外部複驗。

## 精確例子
參考{"a":{"x":"Hi {name}"},"b":"B"}，翻譯{"a":{"x":"嗨 {user}"},"c":"C"}=>missing b/extra c/變數name缺user多。a.b literal key不等nested a→b。

## 非目標
無帳戶/多人同步/自動寄送/自動保存/雲端分析；不讀本機其他檔案、不接外部服務。特定格式與語意限制見TECHNICAL，不偷偷擴充。資料或來源實際消失前有相應確認（清除整個頁面可明確按清除，不假稱可復原）。
