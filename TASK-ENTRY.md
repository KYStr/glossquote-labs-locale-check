# B20-52-M1：翻譯檔缺漏檢查

配置請求：gpt-6.1-sol / max；實際 backend 未獨立確認。範圍僅本工具 TASKS.md 允許路徑。未開新對話、未委派、未啟動 server/browser、未讀憑證、未安裝依賴、未推送或部署。

完成定義：T00→T04 順序通過，兩語候選可接收自填 JSON 與選檔，產生完整差異報告及本地 JSON/TXT；固定來源的 Node/check/build 與環境 guard 有證據。瀏覽器 gate 交主代理，不以離線測試代替。

介面模式：Product App。上線前校對兩份語系 JSON，最重要物件為路徑級差異報告。低風險本機運算；匯入覆蓋已有內容先頁內確認，改來源立即失效舊結果。

常用：左右來源、語法、檢查。相鄰：各來源清除/選檔，結果摘要/過濾/下載。進階：完整可選報告、精確限制與 FAQ。只用系統字體與共用 semantic tokens。

```text
桌面：工具 / 語言 / 首頁
      參考 JSON             翻譯 JSON
      語法選擇 / 檢查 / 清除
      摘要 → 過濾 → 路徑差異表 → 完整下載
手機：參考 → 翻譯 → 設定/檢查 → 摘要 → 局部捲動差異表 → 下載
```

M1 預覽 noindex；無正式 canonical/sitemap。來源與報告僅當頁記憶體；語言切換明示未匯出資料將遺失。同步核心無假取消；只有讀檔有取消。原生 dialog、下載真瀏覽器、鍵盤/縮放/320px/讀屏/Network/Storage 均待真正隔離驗收。

## B20-RP-52：M1B 離線發布準備（2026-10-23）

本輪精確契約已完整讀 `.runs/batch20-release-prep-2026-10-23/TASK.md`。只在 package/.gitignore/scripts/test/HANDOFF/TASK-ENTRY/M1B-RELEASE/evidence/m1b/release-artifacts 範圍工作；public、dist、舊 M1 evidence 與唯讀契約保持原 bytes。M1B 不改產品功能、不新增依賴／服務、不啟動 serve/browser、不推送／部署、不變更持久 Windows/Git/auth 或讀憑證；不委派或新建對話。

可觀察結果：固定 `https://locale-check.glossquote.com` 與 slug，獨立 site／manifest，完整兩語 SEO／robots／sitemap，原安全 headers／runtime bytes，重建確定、tamper/source/路徑與 CLI 負例，最後一次完整 npm test/check/build:release/check:release 與 source/環境前後對照。必要 browser gates 繼續 NOT_RUN_USER_FOCUS_INCIDENT。暫存負例僅在 evidence/m1b copy，原 M1 測試暫存也移到本輪範圍。

配置請求沿用 gpt-6.1-sol/max；backend 身分未獨立確認。發布候選與 M2／M3 放行分開記錄。詳細重現與 site 驗收目錄見 M1B-RELEASE.md。
