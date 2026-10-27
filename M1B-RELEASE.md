# M1B：離線發布候選

這是 2026-10-23 的離線發布準備，**未上線、未完成 browser gate、不是 M2 公開放行**。原 M1 功能及 preview 保持不變；頁面仍明示候選／尚待瀏覽器驗收。配置請求 gpt-6.1-sol/max；不以自述確認 backend。

預定 origin：`https://locale-check.glossquote.com`；toolSlug：`locale-check`。它是程式固定常數，不讀環境／CLI origin，不能視為已部署網址。沒有 Cloudflare、認證、上傳、GitHub 或部署命令。

## 重現

使用 Node 24+；不需要 npm install。於本工具資料夾執行：

```text
npm test
npm run check
npm run build:release
npm run check:release
```

新增命令精確對應 `node scripts/release.mjs build` 與 `node scripts/release.mjs check`。無參數、未知模式或多參數均失敗，無隱含部署。原 `test/check/build/dev` 保留；`build` 仍產生 noindex 的 `dist/`，本輪因 public 未變，沿用 M1 preview，不重建 dist。

## 產物與驗收位置

- **待 browser 驗收的獨立 site 目錄：[release-artifacts/site/](release-artifacts/site/index.html)。** 繁中 `index.html`、英文 `en/index.html`。
- 審核清單：[release-artifacts/manifest.json](release-artifacts/manifest.json)，在 site 外；部署根目錄若未來獲放行應是 site，不能包含 manifest、scripts、tests、docs 或 evidence。
- 預覽仍是 `public/` 與原 `dist/`。原 `serve.mjs` 指向 dist，不能用它的舊 preview 冒充這份 release 候選驗收。本輪沒有啟動 serve 或任何瀏覽器；後續只由主代理以已審核隔離機制使用 site。

site 為原封閉 public 清單 13 檔加 `robots.txt`／`sitemap.xml`（原有 `_headers` 去重，共 15 檔）。僅兩語 HTML head 的 robots／canonical／hreflang 與 `_headers` 的 X-Robots-Tag 變更；runtime JS、CSS、404 及頁面 body 與 M1 逐 byte 相同。

兩頁各有唯一自指 canonical（`/index.html`、`/en/index.html`），zh-Hant/en/x-default 互返，x-default 為中文，robots `index,follow`。robots.txt 精確指向預定 origin 的 sitemap；sitemap 只列兩個 canonical，沒有捏造 lastmod。404 保留原 noindex meta。`_headers` 沿用 public 原完整 CSP、privacy/security headers，只將 `X-Robots-Tag: noindex, nofollow` 改成 `index, follow`；這是靜態設定，**不是實際 hosting HTTP 證明**。

## 防護與失敗處理

`release.mjs` 固定 M1 的 13 個來源 bytes/SHA-256 pins，先拒絕來源改動、未知檔／目錄、symlink／junction／hardlink，再重建 expected bytes。check 不只相信 manifest：重新計算全部預期 HTML、headers、robots、sitemap 與 runtime bytes，核對完整 sourceFiles/files、固定 origin、schema 與 mode；資產＋manifest 甚至來源一起修改仍無法通過舊 pins。

建立前完整檢查來源及既有輸出。第一次只用 exclusive create；合法相同輸入重建只驗證、不寫入。被改動、不完整或無法識別的既有輸出會停止，**不覆蓋、不遞迴刪除，也不自動修復**。若 I/O 中斷留部分新產物，保留現況交主代理決定恢復方式。未來 runtime/public 變更必須另有審核，不能為通過檢查自行更新 pins。

manifest 固定 schemaVersion 1、mode release-candidate、origin、toolSlug、排序且不重複的 files/sourceFiles；每檔 path/bytes/sha256，路徑相對且不含本機絕對路徑、時間或隨機值。檢查器不是作業系統層檔案鎖或獨立安全稽核；同步外部寫入仍應停止協調。

## 尚缺 gate

B01–B05 真瀏覽器、視覺／320px／200%／鍵盤／讀屏、原生檔案與下載、真機、完整 Network／Storage、實際 HTTP headers／404，均 **NOT_RUN_USER_FOCUS_INCIDENT**。不使用 Node 或靜態 SEO 檢查替代。GitHub、Cloudflare 與正式雙語首頁均未操作；仍需主代理獨立驗收與後續明確里程碑放行。

本輪完整命令、環境與 scope 固定證據在 [evidence/m1b](evidence/m1b/README.md)；實際最後結果與 hashes 追加於 [HANDOFF](HANDOFF.md)。主代理負責整合單一交付 ZIP，此對話不另建交付包。
