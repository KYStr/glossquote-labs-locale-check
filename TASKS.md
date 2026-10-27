# B20-52 M1任務
這是完整本地候選的有界里程碑，尚未實作。原功能chat gpt-6.1-sol/max；不自行再委派。T00..T04必要前置通過即可在同輪接續，主代理結尾整合驗收。

Allowed paths（每項只在此工具）：package.json、.gitignore、public/**、scripts/**、test/**、HANDOFF.md、TASK-ENTRY.md、evidence/m1/**；dist/**僅build生成。禁止修改這六份規格/AGENTS/docs、兄弟工具、root、共享首頁/看板/舊證據；主代理不與owner並改。若規格錯誤，回報具體衝突與建議，不自行放寬。

T00 建scaffold：讀全部規格與AGENTS。建立上列package/scripts/test、最小disabled初始化雙語HTML。node --version，建立後npm test/check/build。不得引用不存在命令。check/build有反例可拒違規檔。通過後T01。
T01 核心：依TECHNICAL各純函式與ACCEPTANCE精確案例實作。只改core/test/HANDOFF證據。npm test及check。邊界先驗且不要只做happy path。通過後T02。
T02 完整UI：雙語app/controller/locales/html/css，接實際core與使用者輸入、來源編輯/預覽/清除/匯出。實作PRODUCT全部基本流程，不只顯示範例結果。Node契約與mock僅按scope記錄；browser NOT_RUN。npm test/check/build。通過後T03。
T03 輸出與競態：實作下載、匯入確認（若產品需要）、generation/cancel/cleanup、壞輸入恢復、兩語errors及FAQ，增加必要回歸。npm test/check/build。原生另待驗。通過後T04。
T04 固定候選：最終完整npm test、npm run check、npm run build對同一來源，記files bytes/SHA/actual command exit/pass/fail/NOT_RUN於evidence/m1和HANDOFF；在final回報實際修改、結果、風險和下一步，交主代理。不要只交計畫，不自己做M2。

停止條件：缺依賴/安裝/付費/憑證/未知persistent環境drift/要碰其他owner或桌面/browser，或同問題兩輪沒有進展，停止相依部分並回報；保留可獨立進行工作。長測試前後現有environment guard；所有子程序shell:false windowsHide、絕不改User/Machine PATH。

M1完成不等發布。M2主代理必要browser驗收後讓此原chat獨立public GitHub（KYStr/glossquote-labs-locale-check），不得globalauth/config寫入且前後Gitguard；M3主代理免費部署與首頁/看板；M4外驗後原chat返工。不得自動跳階段、輪詢或冒稱全產品通過。
