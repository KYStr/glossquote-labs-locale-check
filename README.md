# 翻譯檔缺漏檢查
這是規格，實際進度以[HANDOFF](HANDOFF.md)為準。需求是假設，尚未經使用者訪談驗證。

使用情境：網站上線前有兩份語系JSON，想一次找出漏翻、額外key及被翻壞的插值變數，免使用者看到空白或{name}。

完整成果：以參考JSON對照翻譯JSON，路徑級缺漏/多餘/型別/變數差異報告，可選只看待修並下載JSON/TXT。

難度中；瀏覽器原生ESM、Node24測試、零依賴，不上傳、不需帳戶。M1雙語本地候選；真瀏覽器和發布是後續獨立gate。先讀[AGENTS](AGENTS.md)、[PRODUCT](PRODUCT.md)、[TECHNICAL](TECHNICAL.md)、[UX-SEO](UX-SEO.md)、[ACCEPTANCE](ACCEPTANCE.md)、[TASKS](TASKS.md)。
T00建立命令後執行npm test / npm run check / npm run build。未獲主代理指令不可啟動server/browser或公開。不要以範例資料代替真正操作。
