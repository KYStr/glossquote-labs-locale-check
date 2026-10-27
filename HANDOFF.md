# 翻譯檔缺漏檢查：M1 交接

2026-10-23（Asia/Taipei）。M1 T00→T04 本地候選已實作、離線 gates 通過，待主代理親自驗收。這不是已上線版本，也未通過外部驗收。配置請求 gpt-6.1-sol/max；實際 backend 未獨立確認。

|範圍|實際狀態|
|---|---|
|雙語可操作候選／真實 JSON、TXT Blob 產物|IMPLEMENTED；已做 Node 與離線 mock 接線驗證|
|Node 24／test／check／build|PASS；最後同一來源 41/41 tests，3 命令 exit 0|
|真瀏覽器 B01–B05／原生／真機|NOT_RUN_USER_FOCUS_INCIDENT（必要後續 gate）|
|GitHub|NOT_PUBLISHED_M2_NOT_AUTHORIZED|
|Cloudflare／雙語首頁|NOT_DEPLOYED_M3_OWNER_PRIMARY|
|外部驗收|NOT_RUN|

## 實際功能與差異

從尚未實作的規格資料夾建立完整零依賴靜態工具：繁中 `/index.html` 與英文 `/en/index.html` 各有完整說明、限制、錯誤、結果及 FAQ。初始輸入與輸出空白。自填／選擇 UTF-8 JSON 檔、選擇單或雙括號語法後才運算；假資料必須明確載入，若已有內容，先在頁內確認取代。

有界遞迴下降 parser 按原始遍歷順序保留路徑，以解碼後 Set 拒絕同物件重複 key。只允許物件／字串葉；拒絕危險 key、未配對 surrogate 與全部指定上限。內部使用 JSON path segment 陣列識別，不用點號串接，不將使用者 key 賦值到物件。空物件可接受且可辨識型別衝突。

逐路徑列 missing、extra、type-conflict、變數多重集合差異；同原文與空翻譯只是 warning。不支援／未配對括號有明確 review warning，single 不誤讀 double 內層。型別衝突子樹不重複灌報 missing/extra，仍標記子葉的未支援語法。差異依參考順序、多餘 key 依翻譯順序。篩選與 50 項分頁只影響可見列。

同步核心無假取消。讀檔才有取消；所有讀取綁 revision/generation，快速重選、輸入、clear、pagehide 均使晚到結果失效。覆蓋已有欄位先確認；拒絕或取消保留原內容。輸入／語法改動同步清除舊報告、可選文字與下載狀態。

JSON/TXT 為真實完整 UTF-8 Blob bytes，固定 ASCII 檔名、JSON 兩空格/LF/尾 LF/無 BOM。控制器統一擁有 URL，每格式最多一個，替換／失效／clear／pagehide 撤銷，點擊後保留最多 30 秒。下載能力失敗保留可選完整報告，不操作 clipboard。不使用帳戶、storage、使用者內容 URL、網路、遠端資源或輸入記錄。

預覽一律 noindex/nofollow，無正式 canonical/sitemap；首頁固定同語系 glossquote.com 連結，語言切換不帶資料且明示未匯出內容會遺失。沒有啟動 server/browser、截圖、CUA 或任何桌面操作。

## 變更檔案與範圍

新增 29 個 implementation/source 檔案，改寫本 HANDOFF；`dist/**` 的 13 個檔案只由 build 生成。沒有改六份規格、AGENTS、docs、兄弟工具、共享首頁／看板、根目錄或舊驗收包。

- 根檔：`package.json`、`.gitignore`、`TASK-ENTRY.md`。
- 公開資產 13 檔：`public/index.html`、`public/en/index.html`、`public/404.html`、`public/_headers`、`public/styles/app.css`；`public/js/app.mjs`、`controller.mjs`、`locales/zh-Hant.mjs`、`locales/en.mjs`；`core/parse-locale.mjs`、`placeholders.mjs`、`compare.mjs`、`session.mjs`。
- 工具鏈 8 檔：`scripts/files.mjs`、`check.mjs`、`build.mjs`、`serve.mjs`、`run-gates.mjs`、`write-pages.mjs`、`write-example-evidence.mjs`、`verify-candidate.mjs`。
- 測試／mock 5 檔：`test/core.test.mjs`、`controller.test.mjs`、`toolchain.test.mjs`、`ui-contract.test.mjs`、`mock-dom.mjs`。
- 本輪證據僅 [evidence/m1](evidence/m1/README.md)。沒有建立額外使用者交付 ZIP；由主代理合併單一 archive。

此工具資料夾在現有根 Git 中為 untracked，因此 tracked `git diff` 沒有可聲稱的提交差異；已以逐檔 bytes/SHA manifest 固定實際來源。source commit／reviewed commit／released commit 均為 NONE，未建分支、提交或推送。

## 實際驗證

Node `v24.14.0`。所有 npm 子程序以 `shell:false`、`windowsHide:true` 執行，不安裝套件。

|最後命令|exit|結果|
|---|---:|---|
|`npm test`|0|41 tests、41 pass、0 fail、0 skipped|
|`npm run check`|0|13 public 資產、ESM 語法、零依賴、雙語結構／labels、靜態安全掃描與 noindex／headers|
|`npm run build`|0|封閉 public 清單到 dist；拒未知來源／舊未知輸出／symlink／junction|
|`node scripts/write-example-evidence.mjs`|0|實際 controller 產生 4 個假輸入／輸出檔與手寫精確 counts 對照|

最後紀錄：[T04-summary.json](evidence/m1/T04-summary.json)、[T04-test.log](evidence/m1/T04-test.log)、[T04-check.log](evidence/m1/T04-check.log)、[T04-build.log](evidence/m1/T04-build.log)。[逐項驗收](evidence/m1/acceptance.md)將 Node／離線 mock 與 browser gates 分開。

T00 scaffold 3 命令 PASS；T01 核心 PASS；T02 完整 UI PASS；T03 當時 35 tests/check/build PASS；T04 在同一最終來源執行 41 tests/check/build PASS。保留兩個已修正失敗：T01 首輪 BOM 錯誤分類不符預期；T02 首輪 regex 掃描誤把 UI 的 import 字串當外部 import。修正後通過，歷史 FAIL 未刪除或冒寫 PASS。

核心涵蓋 A01–A12 的手寫精確期望及 UTF-8 bytes／深度／key／字串／葉／屬性上限；控制器涵蓋晚到成功／錯誤、取消／重選／確認、strict UTF-8、下載 bytes／固定檔名／URL 上限與撤銷／錯誤回復。兩語實際 app 的離線 mock 驗證事件接線與文字寫入，沒有 layout、真 browser permissions、Network 或 Storage 能力，不能冒充 B01–B05。

Windows guard 在長測試前、中途與結束執行，User/Machine PATH SHA／type／length／ephemeral count 與完整 Environment fingerprint 全部一致。User PATH：ExpandString、834 chars、0 ephemeral；Machine：String、1227 chars、0 ephemeral。完整 SHA 見 [before](evidence/m1/environment-before.json)、[after T03](evidence/m1/environment-after-T03.json)、[after](evidence/m1/environment-after.json)。沒有持久環境或 Git 設定寫入。

## 固定來源與真實產物

最終 implementation 29 檔，共 **140,288 bytes**。前後來源完全一致；[逐檔 SHA-256](evidence/m1/T04-source-after.json) 的 manifest SHA-256：

`6b687da57f9ef8008eca2db1a62e80dbbd800552025b731e606cfca1e9ac1a86`

本 manifest 含所有執行碼／測試／生成腳本與 TASK-ENTRY，排除會填入結果的 HANDOFF 與 evidence，避免自我雜湊。含文件的完整獨立來源另見 [source-all-manifest.json](evidence/m1/source-all-manifest.json)；13 份唯讀契約於 final gates 前固定並驗證未變。dist **13 檔、68,446 bytes**，逐 byte 與 public 相同；見 [dist-manifest.json](evidence/m1/dist-manifest.json) 與 [candidate-verification.json](evidence/m1/candidate-verification.json)。

假資料範例的參考／翻譯各 6 字串，產生 missing 1、extra 1、type conflict 1、variables 2、review 2；errors 5、缺變數次數 2、多變數次數 1。即使 UI filter=missing，兩格式仍是完整 7 項報告：

|實際產物|bytes|SHA-256|
|---|---:|---|
|[locale-check-report.json](evidence/m1/example-output/locale-check-report.json)|2092|`ee91c29a00454ec81baa727ee371f6f622b0b8c31c084030a0993c5864337a09`|
|[locale-check-report.txt](evidence/m1/example-output/locale-check-report.txt)|1107|`f0f51a6a303973a489556479d5bc27f646809f9a53368bfcba071d4d20b867c9`|

這是離線真 Blob bytes 與 Node 檔案證據，不代表實際瀏覽器下載已成功。所有資料為虛構。

## 待主代理與限制

主代理先檢視實際來源並獨立驗收，再以已確認真正隔離機制補 B01–B05。不得用使用者桌面或 hidden IAB 試驗隔離。鍵盤／focus／讀屏、320px／200%／真機、完整 Network／Storage、選檔權限／原生下載及實際 HTTP headers／404 均為 **NOT_RUN_USER_FOCUS_INCIDENT**。

M2 未放行前不公開 GitHub；後續指定獨立 public repo 為 `KYStr/glossquote-labs-locale-check`。M3 部署與雙語首頁由主代理負責，這輪沒有動作或 hosting URL。外驗前不標完整工具完成。

本工具不判斷語意與翻譯品質，不支援 ICU、plural 或 %s；只有明確單／雙括號語法，空翻譯和同原文需人工判斷。同步有界運算仍須實際低效能裝置驗證；超限會拒絕整份。這些是既定範圍，沒有未解規格衝突或新增權限要求。

## M1B 追加交接：B20-RP-52（2026-10-23）

本輪依 `.runs/batch20-release-prep-2026-10-23/TASK.md` 完成有界離線發布準備。M1 原文與舊 evidence 保留；本輪現況以此追加與 [M1B-RELEASE.md](M1B-RELEASE.md) 為準。配置請求 gpt-6.1-sol/max，backend 未獨立確認。M1B 本地 gates 通過，待主代理回收、獨立驗證；**不是 browser PASS、M2 公開放行或已部署版本**。

### 實際 diff

新增 5 個來源檔：`scripts/release.mjs`、`scripts/release-html.mjs`、`scripts/m1b-gates.mjs`、`test/release.test.mjs`、`M1B-RELEASE.md`。修改原 `package.json` 僅加 build:release/check:release、`.gitignore` 僅加 release-artifacts/、`test/toolchain.test.mjs` 僅將暫存／安全清理目錄移到 evidence/m1b；本 TASK-ENTRY/HANDOFF 僅追加本輪紀錄。既有 test/check/build/dev 指令保持原值；沒有安裝套件或改 runtime/public。

新增產物只在 `release-artifacts/site/**`（15 檔）及 sibling `release-artifacts/manifest.json`；本輪證據只在 [evidence/m1b](evidence/m1b/README.md)。**90 個受保護既有檔案逐檔 hash 不變**，包含 public、原 dist、全部 M1 evidence、唯讀契約與說明。實際前後逐檔差異見 [scope-diff.json](evidence/m1b/scope-diff.json)，來源原文 prefix、允許路徑與 byte 驗證見 [candidate-verification.json](evidence/m1b/candidate-verification.json)。沒有變更兄弟工具／首頁／看板／根目錄。

### 候選行為與防護

預定 origin 固定為 `https://locale-check.glossquote.com`，slug `locale-check`；不讀環境或 CLI URL，無部署／上傳／認證路徑。兩語 HTML 只改 head 的 robots／canonical／hreflang；保留完整 body、候選文案、標題與說明。每頁自指 canonical，zh-Hant/en/x-default 互返；中文為 fallback，meta robots index,follow。robots.txt、sitemap.xml 精確列預定站址，只有兩個 canonical，沒有 lastmod。

原 `_headers` 在 public 已存在；正式候選直接保留全部 CSP／privacy/security 常數與格式，僅 X-Robots-Tag 改 index, follow。未新增／放寬 connect-src、script-src、blob/data 或其他規則。404 保留原 noindex meta；所有 JS/CSS/其他非 SEO 資產與 M1 逐 byte 一致。這些是離線檔案，不是實際 hosting headers、404 或網路測試證明。

build/check 固定 M1 的 13 個 public source pins，檢查來源封閉清單、未知檔／空目錄、symlink/junction/hardlink、既有輸出完整性，再產生預期 bytes。checker 不信任 manifest 自述，重新計算 source 與整個 site；asset＋manifest 甚至 source/asset/manifest 一起竄改也會被舊 pins 拒絕。manifest 固定 schemaVersion 1／release-candidate／origin／toolSlug／files／sourceFiles，所有 path/bytes/SHA 排序且無重複、無時間／隨機／絕對路徑。

沒有遞迴刪除或覆寫未知／修改過的產物。首次只 exclusive create；相同合法輸入重建僅驗證、不寫入，確定性及 mtime 保留在測試中驗證。既有產物不完整或污染就停止，保留待主代理判斷恢復。pins 不能拿來自動接受未審核的未來 runtime；同權限外部同時寫入仍須協調，本工具不是 OS 層鎖或獨立安全稽核。

### 實際命令與證據

Node `v24.14.0`。先完成針對性 `node --test test/release.test.mjs`：exit 0，17 tests／17 pass／0 fail；之後固定最終來源，依本輪要求只執行一次完整命令組：

|命令|exit|實際結果|
|---|---:|---|
|`npm test`|0|58 tests、58 pass、0 fail、0 skipped；原 41 加 17 發布準備測試|
|`npm run check`|0|原 preview 結構／安全與新增 ESM 工具鏈語法通過|
|`npm run build:release`|0|建立 15 檔、69,502 bytes 的獨立 release-candidate site|
|`npm run check:release`|0|重新計算預期產物、固定來源與 manifest；無寫入|

紀錄：[final-summary.json](evidence/m1b/final-summary.json)、[test](evidence/m1b/final-test.log)、[check](evidence/m1b/final-check.log)、[build release](evidence/m1b/final-build-release.log)、[check release](evidence/m1b/final-check-release.log)。測試負例全部在 evidence/m1b 的假副本，驗 resolved 絕對路徑在本輪 fixture 目錄內後清理。沒有對真 root 刪除／修改負例，也沒執行原 preview build，原 dist 與 M1 證據不變。

Windows guard 在本輪前／完整命令後執行：兩次 PASS，HKCU/HKLM PATH hash、registry type、length、ephemeral count 與全 Environment fingerprint 完全一致；詳 [before](evidence/m1b/environment-before.json)／[after](evidence/m1b/environment-after.json)。所有測試子程序 shell:false/windowsHide:true；無持久 Windows／Git／gh/auth 變更，無憑證讀取、安裝、費用、server/browser 或桌面操作。

### 固定 hashes

最終 gates 的來源清單 **47 檔、239,990 bytes**，前後一致，排除可追加結果的 HANDOFF 與 dist/evidence/生成產物；[source-after](evidence/m1b/final-source-after.json) SHA-256：

`6becbbeaa3b4e21ce385e609ce32d38b1ef4429a64929c9b16158e9e487809f8`

release 原輸入：**13 檔、68,446 bytes**，與 M1 public pins 相同。獨立 site：**15 檔、69,502 bytes**。sibling manifest：**4,384 bytes**，SHA-256：

`f305e391cc3c4c923cf080e7ce5d49380d5b1940e5a69a13877fd579dfa0d87c`

每個 site/source 檔案的 bytes/SHA 見 [release manifest](release-artifacts/manifest.json)。包含追加 HANDOFF 的完整來源另見 [source-all-manifest.json](evidence/m1b/source-all-manifest.json)；最終 scope／source／artifact／環境回收比對由 `node scripts/m1b-gates.mjs verify` 產生 [candidate-verification.json](evidence/m1b/candidate-verification.json)，避免把 HANDOFF 自身 hash 寫回自己。

### 未驗與下一步

主代理後續 browser 驗收應使用 **`tool-projects/52-locale-check/release-artifacts/site/`**，不是原 noindex dist。B01–B05、實際視覺／鍵盤／讀屏／320px／200%／原生檔案與下載／真機／Network／Storage／hosting HTTP headers 與 404 仍全部 **NOT_RUN_USER_FOCUS_INCIDENT**。

GitHub **NOT_RUN_M2_NOT_AUTHORIZED**；Cloudflare／正式雙語首頁 **NOT_DEPLOYED**；外驗 **NOT_RUN**。這輪沒有 source/reviewed/released commit；沒有另建 ZIP，由主代理整合單一交付包。無新增產品決策或權限需求；待主代理獨立回收判定及既定 browser／M2／M3 gate。若未來來源需改或碰到污染輸出，另設有界修正，不能在此流程靜默改 public、更新 pins 或刪輸出。


## B20-52-M2A：發布候選準備（2026-10-27）

依主代理本輪明確指示完成 **M2A 本地候選，待 M2B**。本節更新 M1B 的現況，前文與原 evidence 保持歷史原文。requested gpt-6.1-sol/max，實際 backend 未獨立確認；未委派／另開 chat，未 browser/server／native／clipboard 操作，未推送、部署、讀憑證、安裝或修改持久 Windows／Git/auth。完整證據與重現見 [evidence/m2a/README.md](evidence/m2a/README.md)。

### 實際 diff 與保留範圍

新增 `wrangler.jsonc`、`scripts/release-config.mjs`、`test/release-m2a.test.mjs`；修改 `scripts/release.mjs`、`scripts/release-html.mjs`、`test/release.test.mjs`；HANDOFF 僅追加，其他新證據只在 `evidence/m2a/**`。public、所有 runtime JS/CSS、dist、全部原 evidence/m1 與 evidence/m1b 未改。唯讀契約、規格、package、原說明、兄弟工具及共享路徑保持原 bytes。

正式候選設定沿用 tool 42 current assets-only：`glossquote-locale-check`、compatibility_date `2026-10-24`、custom domain `locale-check.glossquote.com`、workers_dev/preview_urls/send_metrics false；observability、logs、invocation_logs、traces 全 false。無 main/bindings/vars/env；assets.directory `./release-artifacts/site`，run_worker_first false，html_handling/not_found_handling `none`，build 為 `node scripts/release.mjs build`。發布 build/check 固定整份設定 bytes，未知欄位、重複 key、錯誤日期／domain、行為擴張、缺失或 indirect 設定都拒絕。使用 workers-best-practices 的檢查方法，依明確專案契約保留日期與關閉記錄，不引入技能建議的 runtime/logs。

release HTML 僅移除兩語 intro 各一個精確候選 paragraph，footer 各一個精確替換為 `<footer>Gloss Tools by GlossQuote</footer>`。原 head SEO／CSP／其餘 body 與資產對照舊 release 完全不變。新增 `_redirects` 三條 301：`/ /index.html 301`、`/en /en/index.html 301`、`/en/ /en/index.html 301`，固定 LF 與末尾 LF，納入封閉 manifest。

原 release-artifacts 先逐檔驗證，再確認來源／目的 resolved 絕對路徑都在工具 52 內，整個 rename 至 [evidence/m2a/previous-release](evidence/m2a/previous-release/manifest.json)：**16 檔、73,886 bytes 原 bytes/SHA 全保留**，原 manifest SHA `f305e391cc3c4c923cf080e7ce5d49380d5b1940e5a69a13877fd579dfa0d87c`。沒有刪除或覆寫舊產物，release 原拒絕覆寫規則保留；新候選由 exclusive create 建立。

### 驗證與固定 hashes

Node v24.14.0。一次最終受影響命令組：`node --test test/release.test.mjs test/release-m2a.test.mjs` **50 tests／50 PASS／0 FAIL／0 skipped，exit 0**；`npm run check`、`npm run build:release`、`npm run check:release` 均 exit 0。測試含 allowlisted notices／設定封閉負例、轉址錯誤目的地／額外或缺少行／缺檔／錯 status／CRLF／末尾 LF，以及 coherent asset＋manifest tamper 拒絕且不覆寫。fixture 只在 m2a，清理前驗 resolved 路徑。

沿用未變動的原產品 41 項與 M1B 全套 58 PASS 證據，未重跑無關測試；沒有把離線測試標作 browser。實際命令與 log 見 [gates-1.json](evidence/m2a/gates-1.json)。Windows guard before/after 兩次 PASS、報告逐 byte 相同，涵蓋 HKCU/HKLM PATH hash/type/length/ephemeral entries、TEMP/TMP 與全 Environment fingerprint。首次包裝判讀錯誤、未改環境與正確重取結果詳 [attempt-notes.md](evidence/m2a/attempt-notes.md)。

固定 gates 來源：**50 檔、254,622 bytes**，排除追加 HANDOFF／evidence／dist／產物；前後完全一致，清單 SHA `07fbc9d1fccee32421c5db3efedad5ea6b27e919e92f8c72d1d57d3598daf705`。包含本追加 HANDOFF 的完整來源 hash 另存 [source-all-manifest.json](evidence/m2a/source-all-manifest.json)，不回寫自參照。

新版 site **16 檔、69,401 bytes**；sibling manifest **4,526 bytes**，合計 17 檔、73,927 bytes。新 manifest SHA：`a154c17c7d7e287cde77063a37100412bcbcf1f6defcc5feeb07111380706cfe`。原 public 輸入仍 13 檔、68,446 bytes。wrangler.jsonc 651 bytes／SHA `a670caf454981e3cfdc2e6bb092fbb7437192d71ffa3fe46506ee6dcb09b9ddf`；_redirects 65 bytes／SHA `9e47a2579b08f461b1124de1e42a1bde7a79ca29d77401104f6f432d8be90e1e`。

逐檔範圍與候選驗證見 [scope-diff.json](evidence/m2a/scope-diff.json)、[artifact-diff.json](evidence/m2a/artifact-diff.json)、[candidate-verification.json](evidence/m2a/candidate-verification.json)。release 相較舊版只變兩語 HTML、manifest，另加 `_redirects`；舊 evidence 與其他 release 資產 bytes 不變。

### 主代理 browser 回收及未驗項

主代理已實際以隔離 Chromium 145 執行 r2：35 PASS／11 NOT_RUN／2 FAIL（XML viewer 污染）；r3 僅 B05＋B03 兩語重驗 4 PASS。按 ID＋language 合併 **37 PASS／11 NOT_RUN／0 FAIL**，`prohibited=[]`，兩輪最後 parent-cleanup PASS。原失敗結果、原 cleanup-job 的歷史觀察、r3 成果與 parent-cleanup 分開保留；本對話只讀明確 report 並複製原 bytes，沒有查 profile、重跑 browser 或程序操作。見 [primary-browser-reference.json](evidence/m2a/primary-browser-reference.json)。

這是舊 f305e391 候選的主代理證據，本輪核心／runtime 未變；不宣稱本輪提示／新增 redirects 已經 browser/live 驗收。十一項 NOT_RUN 保留：實際讀檔取消、中文重選競態、hidden-state 觀察、200% zoom、原生／assistive、未知 404／live hosting；每 ID／語言與原原因皆見證據。

GitHub **NOT_RUN_M2B_PENDING**；Cloudflare／正式雙語首頁 **NOT_DEPLOYED**；外驗 **NOT_RUN**。沒有 source/reviewed/released commit，正式 domain 是預定設定，非已驗上線網址。待主代理獨立回收與 M2B；本對話不自行 push/deploy，也不另建 ZIP。沒有新增產品範圍、依賴或權限需求。
