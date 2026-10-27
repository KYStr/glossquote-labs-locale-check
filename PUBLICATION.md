# 翻譯檔缺漏檢查｜公開來源候選

這份獨立來源由 B20-52-M2B 放行公開，包含兩語工具、全部離線測試、正式發布設定與必要虛構樣本／歷史 manifest。這是來源發布；Cloudflare、正式首頁與外部驗證是後續里程碑。`locale-check.glossquote.com` 是預定自訂網域，此文件不代表已部署。

使用 Node.js 24+，零 runtime/dev 依賴，不需要 npm install：

```text
npm test
npm run check
npm run build
npm run build:release
npm run check:release
```

`build` 產生 noindex 預覽 dist；`build:release` 產生 release-artifacts/site 及 sibling manifest。發布 manifest 的審核副本在 [evidence/publication/release-manifest.json](evidence/publication/release-manifest.json)，預期 SHA-256 為 `a154c17c7d7e287cde77063a37100412bcbcf1f6defcc5feeb07111380706cfe`。正式站產物只包含 site，不包含 scripts/tests/docs/evidence。建置不執行上傳或認證。

所有測試檔案及其嵌入假資料完整保留，範例 controller 的四份假輸入／輸出及 manifest 亦保留。來源中的歷史 T00–T04／M1B 輔助腳本與 HANDOFF 記錄的是先前里程碑；當前重現請執行上列五個指令，無須重建歷史 gate。歷史必要 manifest 逐 byte 保存，機器環境／Git 設定 fingerprint、browser/process/profile 報告、執行紀錄與 scratch 留在原工作區，不屬於本公開來源。

原 HANDOFF、M1B 說明與規格保持原 bytes，所以其中早期「尚未 M2 放行」是歷史狀態；本文件記錄後續 M2B 授權。公開來源以外的完整驗證證據由主代理持有，舊文件中的本機 evidence 連結不保證全部包含在公開版本。

主代理在真正隔離 Chromium 145 的既有候選合併結果為 37 PASS／11 NOT_RUN，`prohibited=[]`、最終 cleanup PASS。本公開動作不啟動 browser/native/UI，不把離線測試視為新的 browser 驗證；實際讀檔取消、中文重選競態、hidden-state、200% zoom、原生／assistive、未知 404／live hosting 等十一項未驗仍保留。此版本等待後續主要驗收與外部審查，尚未宣稱完整工具完成。
