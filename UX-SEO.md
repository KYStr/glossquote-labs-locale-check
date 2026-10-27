# 工作區與雙語SEO
這是規格，Product App模式，遵守[設計系統](docs/DESIGN-SYSTEM.md)。
左右來源textarea各有選檔與清除；下方語法選擇、檢查翻譯；摘要列missing/extra/variables/review；可過濾差異表，path以分段視覺顯示。手機上下來源、diff局部橫捲。

```text
桌面：工具名 / 語言 / 返回首頁
      [來源與相鄰設定] [主要工作畫布或結果]
      [欄位錯誤/限制] [明確產出動作]
手機：工具名 → 來源/設定 → 主動作 → 結果 → 匯出
```
初始「加入資料開始 / Add data to begin」；進行「處理中，可取消 / Processing, you can cancel」（只async）；空結果「沒有符合的項目 / No matching items」；invalid「請修正標示欄位，舊結果已清除 / Fix the marked fields; the previous result has been cleared」；不支援顯示必要能力與停止。單一primary action隨階段變化，禁多層等高卡片/巨型hero。真人資料不預填。
鍵盤順序依實際工作；44px觸控、兩層focus、正常字4.5:1、控制邊3:1。320px周邊重排，表格/畫布可具名局部捲動；200%/reduced motion。所有日期/數字含必要單位、結果長字容錯。labels/錯誤/id兩語對照，勿靠placeholder。

## 真實文案
繁中title：翻譯檔缺漏檢查｜本機處理工具 - GlossQuote
繁中H1：翻譯檔缺漏檢查
繁中description：網站上線前有兩份語系JSON，想一次找出漏翻、額外key及被翻壞的插值變數，免使用者看到空白或{name}。 使用 翻譯檔缺漏檢查，在瀏覽器本地整理資料並取得可下載成果。
English title: Translation file completeness checker | GlossQuote
English H1: Translation file completeness checker
English description: Translation file completeness checker in your browser. Review the result and export it locally without uploading your input.
工具說明必須以PRODUCT的完整使用情境與結果翻譯，不只翻按鈕。至少以下FAQ兩語可見：
### 這能判斷翻譯品質嗎？
不能；它核對欄位、字串與明確支援的插值變數，不判斷語意。

### Does this assess translation quality?
No. It checks keys and supported placeholder syntax, not linguistic quality.

### 支援 ICU 嗎？
首版不支援 ICU；不認識的括號語法列為待人工確認。

### Is ICU supported?
No. Unsupported brace syntax is flagged for review.

### 同原文代表漏翻嗎？
不一定，品牌名與數字可能應保留；只提供提醒。

### Is unchanged text an error?
No. Names and numbers may intentionally match; this is a review warning.

## Preview與正式
M1 robots noindex,nofollow，無production canonical/sitemap，不能偽造live。首頁固定https://glossquote.com/index.html / https://glossquote.com/en/index.html；切換/en/index.html及/index.html不附任何輸入。domain候選locale-check.glossquote.com，不是已部署網址。
M2/M3主代理放行後production每頁自指canonical；hreflang zh-Hant/en/x-default（fallback繁中）互返，robots/sitemap精確兩網址，title/description/H1各語，SoftwareApplication JSON-LD只寫可見真實能力無rating。CSP default-src self; connect-src none; frame-ancestors none、nosniff、no-referrer等依release契約，實際HTTP再驗。沒有analytics/font/CDN。未知路徑真404不是首頁200。
