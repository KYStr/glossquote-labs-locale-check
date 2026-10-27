# 技術契約 — 翻譯檔缺漏檢查
這是規格，Node24與瀏覽器原生ESM，零runtime/dev依賴，禁止npm install。正式站純靜態。

## 模組與介面
public/index.html、en/index.html、404.html、_headers、styles/app.css、js/app.mjs、js/controller.mjs、js/locales/zh-Hant.mjs與en.mjs；純核心於js/core/：parse-locale.mjs、placeholders.mjs、compare.mjs、session.mjs。test/*.test.mjs；scripts/check.mjs、build.mjs、serve.mjs；package.json/private/type module/engines>=24。
parseLocale(text) -> {leaves:[{path:string[],value:string}],warnings}; compareLocales(reference,target,{syntax}) -> {issues,counts}; extractVariables(text,syntax) -> Map<string,number>。固定error.code，不在error塞原字串。
核心不引用DOM、File、storage、network或console。controller擁有FileReader/bitmap/BlobURL與generation，不在核心塞副作用。

## 確定算法及資料契約
JSON 必須自行使用有界遞迴下降 parser 或獨立token掃描搭配JSON.parse，解碼字串後同一object內以Set拒絕重複key（包含a與\u0061）。不能單用JSON.parse而遺失重複key。所有key以Map或無prototype容器儲存，拒__proto__/constructor/prototype；string葉可空，空object合法但不能冒充string葉。最大depth32（root是1）、每key200 UTF16、string16384、5000葉、10000屬性、原UTF8 1MiB。拒未配對surrogate。型別只object或string，array/null/number/bool一律TYPE錯，並顯示所在path只作文字。
以JSON.stringify(path array)作內部識別，不能用'.'join。比較reference葉集合與target葉集合；如果某path在另一側為object，標type-conflict且其子樹缺漏不重複灌報，規則寫入測試。缺key=missing、多key=extra，變數按大小寫敏感多重集合計missingVariables/extraVariables。single模式只認{name}、double只認{{name}}；name為ASCII [A-Za-z_][A-Za-z0-9_]*。不支援ICU、%s、巢狀plural，不將不認識括號冒稱成功：對含未匹配或其他括號語法的葉加UNSUPPORTED_PLACEHOLDER_SYNTAX warning，仍保留可檢查其他key的結果。單模式不得把{{name}}中的內層當單變數。空翻譯、與原文相同都只是review warning，不算確認缺陷。
差異依參考葉原遍歷順序，extra依target順序。所有filter僅切可見，不改下載完整report。同步核心但UI按檢查才運算；可用worker與單一jobId，若同步實作則無假取消。來源/語法改動立即清空結果及可下載性。

## 共同狀態與失效
idle→editing→running（僅async）→ready/error；來源/設定input同步revision++、停用下載/複製、清輸出；cancel終止worker/reader，晚到generation不可restore。pagehide清資源。未知exception轉固定雙語錯誤碼，不回顯raw stack或輸入。保留明確的unsupported安全退出。
可引用既有兄弟工具作唯讀研究，但本工具必須複製自己需要且經審查的模組並帶測試，不runtime import兄弟工具。

## 工具鏈
scripts/check.mjs實驗ESM語法、public靜態allowlist、雙語結構、安全禁止項；純regex只初步掃描不作安全證明。build拒symlink/junction/unknownfile，只複製public封閉清單到dist，舊未知輸出不任意刪除。serve只loopback 127.0.0.1:4232，GET/HEAD，精確MIME/path/Host與404/405，不能提供workspace。M1不啟動serve。
來源UTF8，文本匯出UTF8無BOM、JSON兩空格LF尾LF。結構化資料匯入依工具自訂exact schema與上限，危險prototype不能進object assignment。下載無公式CSV（如需報告用TXT/JSON，避免發明CSV防護承諾）。
