import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './files.mjs';

const content = {
  'zh-Hant': {
    title: '翻譯檔缺漏檢查｜本機處理工具 - GlossQuote', h1: '翻譯檔缺漏檢查',
    description: '網站上線前有兩份語系JSON，想一次找出漏翻、額外key及被翻壞的插值變數，免使用者看到空白或{name}。 使用 翻譯檔缺漏檢查，在瀏覽器本地整理資料並取得可下載成果。',
    home: 'https://glossquote.com/index.html', alternate: '/en/index.html', altLabel: 'English', altLang: 'en',
    skip: '跳至工作區', nav: '工具導覽', homeLabel: '所有工具', preview: '本地候選預覽',
    intro: '在網站上線前，對照參考與翻譯 JSON，找出缺漏、多餘 key、型別衝突及插值變數差異，下載待修報告。',
    privacy: '資料只留在本頁記憶體；不會上傳或自動保存。切換語言或離開本頁會失去未匯出資料。',
    sourceHeading: '對照兩份語系檔', sample: '載入假資料範例', sampleHint: '範例為虛構資料；已有內容時會先確認取代。',
    reference: '參考 JSON', target: '翻譯 JSON', choose: '選擇 JSON 檔', clearField: '清除此欄',
    sourceHelp: '貼上文字，或自行選擇 UTF-8 JSON 檔。每份最多 1 MiB、5,000 個字串。',
    syntax: '插值變數語法', single: '單括號 {name}', double: '雙括號 {{name}}',
    syntaxHelp: '擇一檢查；名稱區分大小寫，出現次數也要相同。只支援 ASCII 字母／底線開頭及數字；不支援 ICU、plural 或 %s。未識別的括號會提醒人工確認。',
    check: '檢查翻譯', clearAll: '清除整個頁面', cancelRead: '取消讀取',
    initial: '加入資料開始：貼上兩份 JSON，或載入標示的假資料範例。',
    confirmHeading: '確認取代內容', confirm: '取代此欄內容', keep: '保留原內容',
    confirmExample: '範例將取代兩個欄位，並將語法改為單括號。原內容不會自動保存。', confirmExampleButton: '以假資料取代兩欄',
    result: '差異報告', missing: '缺漏 key', extra: '多餘 key', types: '型別衝突', variables: '變數差異', review: '人工確認',
    filter: '顯示項目', filters: [['all', '全部差異與提醒'], ['needs-fix', '只看待修（不含提醒）'], ['missing', '缺漏 key'], ['extra', '多餘 key'], ['type-conflict', '型別衝突'], ['variables', '變數差異'], ['review', '人工確認提醒']],
    filterHelp: '篩選只影響下方清單。空譯文、同原文與不支援語法是提醒，不算已確認錯誤。',
    tableLabel: '可水平捲動的差異清單', caption: '依參考原順序列出差異；多餘 key 依翻譯順序附於後方。',
    issue: '項目與說明', path: '路徑分段', referenceText: '參考文字', targetText: '翻譯文字',
    previous: '上一頁', next: '下一頁', exportHeading: '取得完整報告', json: '下載 JSON', txt: '下載 TXT',
    exportHelp: '兩種格式都包含完整報告，不受篩選影響。UTF-8、無 BOM；固定檔名。TXT 使用固定欄位名稱與錯誤碼，便於交接。',
    reportSummary: '展開完整 JSON 文字（可自行選取）', reportLabel: '完整 JSON 報告文字', selectText: '選取完整報告',
    limitHeading: '格式與限制', limits: '根節點必須是物件，葉節點只能是字串。空物件合法；只比較字串葉，不將空物件當成字串。每份最多 32 層物件（根計 1）、10,000 個屬性；每個 key 最多 200、每個字串最多 16,384 個 UTF-16 code units。重複 key（含解碼後重複）、危險 key、未配對 surrogate、陣列、null、數字與布林值會拒絕整份輸入。',
    paths: '路徑以獨立分段識別，例如 ["a.b"] 與 ["a","b"] 不相同。字串與物件衝突時只列父路徑，其子樹不重複列缺漏／多餘。數字型 key 依原始輸入順序保留。',
    localLimits: '使用裝置記憶體處理；超過限制會停止。清除僅清本頁資料與下載連結，不會刪除已下載檔案，也不承諾安全抹除瀏覽器或系統記憶體。',
    faq: '常見問題', faqs: [
      ['這能判斷翻譯品質嗎？', '不能；它核對欄位、字串與明確支援的插值變數，不判斷語意。'],
      ['支援 ICU 嗎？', '首版不支援 ICU；不認識的括號語法列為待人工確認。%s 不屬於本工具的變數語法。'],
      ['同原文代表漏翻嗎？', '不一定，品牌名與數字可能應保留；只提供提醒。空譯文也只列提醒，請依情境判斷。'],
    ],
    noScript: '必須啟用 JavaScript 與原生模組才能在本機檢查；目前所有操作停用。資料不會改用雲端處理。',
    boot: '正在準備本機檢查功能。若此訊息持續顯示，請使用支援原生模組、TextEncoder 與 TextDecoder 的瀏覽器；不會改用雲端。',
    footer: 'Gloss Tools by GlossQuote · 預覽版本，尚待瀏覽器驗收',
  },
  en: {
    title: 'Translation file completeness checker | GlossQuote', h1: 'Translation file completeness checker',
    description: 'Translation file completeness checker in your browser. Review the result and export it locally without uploading your input.',
    home: 'https://glossquote.com/en/index.html', alternate: '/index.html', altLabel: '繁體中文', altLang: 'zh-Hant',
    skip: 'Skip to workspace', nav: 'Tool navigation', homeLabel: 'All tools', preview: 'Local candidate preview',
    intro: 'Before a website launch, compare a reference locale JSON with its translation. Find missing and extra keys, type conflicts and broken placeholders, then download a report of what needs attention.',
    privacy: 'Input stays in this page’s memory; it is not uploaded or automatically saved. Switching languages or leaving the page discards data you have not exported.',
    sourceHeading: 'Compare two locale files', sample: 'Load fictional example', sampleHint: 'This example uses fictional data. Existing content requires replacement confirmation.',
    reference: 'Reference JSON', target: 'Translation JSON', choose: 'Choose a JSON file', clearField: 'Clear this field',
    sourceHelp: 'Paste text or choose your own UTF-8 JSON file. Each input: up to 1 MiB and 5,000 strings.',
    syntax: 'Placeholder syntax', single: 'Single braces {name}', double: 'Double braces {{name}}',
    syntaxHelp: 'Choose one syntax. Names are case sensitive and occurrence counts must match. Names start with an ASCII letter or underscore and may include digits. ICU, plural and %s are not supported. Unknown braces are flagged for manual review.',
    check: 'Check translations', clearAll: 'Clear the whole page', cancelRead: 'Cancel file read',
    initial: 'Add data to begin: paste both JSON files or load the labeled fictional example.',
    confirmHeading: 'Confirm replacement', confirm: 'Replace this field', keep: 'Keep existing content',
    confirmExample: 'The example will replace both fields and switch to single-brace syntax. Existing content will not be automatically saved.', confirmExampleButton: 'Replace both fields with example',
    result: 'Difference report', missing: 'Missing keys', extra: 'Extra keys', types: 'Type conflicts', variables: 'Variable differences', review: 'Review warnings',
    filter: 'Show items', filters: [['all', 'All differences and warnings'], ['needs-fix', 'Only differences to fix'], ['missing', 'Missing keys'], ['extra', 'Extra keys'], ['type-conflict', 'Type conflicts'], ['variables', 'Variable differences'], ['review', 'Review warnings']],
    filterHelp: 'Filters affect only the list below. Empty translations, unchanged text and unsupported syntax are warnings, not confirmed errors.',
    tableLabel: 'Horizontally scrollable difference list', caption: 'Differences follow reference order. Extra keys follow translation order at the end.',
    issue: 'Issue and explanation', path: 'Path segments', referenceText: 'Reference text', targetText: 'Translation text',
    previous: 'Previous page', next: 'Next page', exportHeading: 'Get the complete report', json: 'Download JSON', txt: 'Download TXT',
    exportHelp: 'Both formats contain the complete report, regardless of filters. UTF-8 without BOM and fixed filenames. TXT uses stable field names and error codes for handoff.',
    reportSummary: 'Expand complete JSON text (select it to save manually)', reportLabel: 'Complete JSON report text', selectText: 'Select complete report',
    limitHeading: 'Format and limits', limits: 'The root must be an object and leaves must be strings. Empty objects are valid; only string leaves are compared, so empty objects are not treated as strings. Each input: 32 object levels (root = 1), 10,000 properties, 200 UTF-16 code units per key and 16,384 per string. Duplicate decoded keys, unsafe keys, unpaired surrogates, arrays, null, numbers and booleans reject the entire input.',
    paths: 'Paths use independent segments: ["a.b"] differs from ["a","b"]. A string/object conflict is listed at the parent path; descendant missing/extra keys are suppressed. Numeric-looking keys keep their original input order.',
    localLimits: 'Processing uses device memory and stops at the limits. Clear removes this page’s data and download links, not files already downloaded. It does not promise secure erasure of browser or system memory.',
    faq: 'Frequently asked questions', faqs: [
      ['Does this assess translation quality?', 'No. It checks keys and supported placeholder syntax, not linguistic quality.'],
      ['Is ICU supported?', 'No. Unsupported brace syntax is flagged for review. %s is not a supported placeholder syntax.'],
      ['Is unchanged text an error?', 'No. Names and numbers may intentionally match; this is a review warning. Empty translations are also warnings for you to assess in context.'],
    ],
    noScript: 'Enable JavaScript and native modules to check locally. All actions are currently disabled. Processing will not switch to a cloud service.',
    boot: 'Preparing local checking. If this message remains, use a browser with native modules, TextEncoder and TextDecoder. There is no cloud fallback.',
    footer: 'Gloss Tools by GlossQuote · Preview awaiting browser acceptance',
  },
};
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
for (const [language, c] of Object.entries(content)) {
  const sourceField = (side, label) => `<section class="source-field" aria-labelledby="${side}-label">
<div class="field-heading"><label id="${side}-label" for="${side}">${label}</label><button id="${side}-clear" type="button" class="quiet" disabled>${c.clearField}</button></div>
<textarea id="${side}" rows="11" spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="source-help ${side}-error" disabled></textarea>
<div class="file-field"><label for="${side}-file">${c.choose}</label><input id="${side}-file" type="file" accept=".json,application/json" aria-describedby="source-help ${side}-error" disabled></div>
<p id="${side}-error" class="field-error" hidden></p></section>`;
  const html = `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta name="description" content="${escape(c.description)}">
<title>${escape(c.title)}</title>
<link rel="stylesheet" href="/styles/app.css">
<script type="module" src="/js/app.mjs"></script>
</head>
<body>
<a class="skip-link" href="#workspace">${c.skip}</a>
<header class="topbar"><a class="brand" href="${c.home}">Gloss Tools <span>by GlossQuote</span></a><nav aria-label="${c.nav}"><a href="${c.home}">${c.homeLabel}</a><a href="${c.alternate}" lang="${c.altLang}" hreflang="${c.altLang}" aria-describedby="privacy">${c.altLabel}</a></nav></header>
<main id="workspace">
<div class="intro"><p class="preview">${c.preview}</p><h1>${c.h1}</h1><p>${c.intro}</p><p id="privacy" class="muted">${c.privacy}</p></div>
<p id="boot-notice" class="notice">${c.boot}</p><noscript><p class="notice">${c.noScript}</p></noscript>
<form id="check-form" novalidate>
<div class="section-heading"><h2>${c.sourceHeading}</h2><button id="load-example" type="button" class="secondary" aria-describedby="sample-help" disabled>${c.sample}</button></div>
<p id="sample-help" class="muted small">${c.sampleHint}</p><p id="source-help" class="muted">${c.sourceHelp}</p>
<div class="sources">${sourceField('reference', c.reference)}${sourceField('target', c.target)}</div>
<div class="settings"><div><label for="syntax">${c.syntax}</label><select id="syntax" aria-describedby="syntax-help settings-error" disabled><option value="single">${c.single}</option><option value="double">${c.double}</option></select></div><p id="syntax-help" class="muted small">${c.syntaxHelp}</p></div>
<p id="settings-error" class="field-error" hidden></p>
<div class="actions"><button id="check" type="submit" class="primary" disabled>${c.check}</button><button id="clear-all" type="button" class="quiet" disabled>${c.clearAll}</button><button id="cancel-read" type="button" class="secondary" hidden>${c.cancelRead}</button></div>
</form>
<section id="import-confirm" class="notice" aria-labelledby="import-heading" hidden><h2 id="import-heading">${c.confirmHeading}</h2><p id="import-message"></p><div class="actions"><button id="accept-import" class="primary" type="button">${c.confirm}</button><button id="keep-import" class="secondary" type="button">${c.keep}</button></div></section>
<section id="example-confirm" class="notice" aria-labelledby="example-heading" hidden><h2 id="example-heading">${c.confirmHeading}</h2><p>${c.confirmExample}</p><div class="actions"><button id="accept-example" class="primary" type="button">${c.confirmExampleButton}</button><button id="keep-example" class="secondary" type="button">${c.keep}</button></div></section>
<p id="status" class="status" role="status" aria-live="polite" aria-atomic="true">${c.initial}</p>
<section id="results" aria-labelledby="results-heading" hidden>
<div class="section-heading"><h2 id="results-heading">${c.result}</h2></div>
<dl class="counts"><div><dt>${c.missing}</dt><dd id="count-missing">0</dd></div><div><dt>${c.extra}</dt><dd id="count-extra">0</dd></div><div><dt>${c.types}</dt><dd id="count-types">0</dd></div><div><dt>${c.variables}</dt><dd id="count-variables">0</dd></div><div><dt>${c.review}</dt><dd id="count-review">0</dd></div></dl>
<div class="filter-line"><label for="filter">${c.filter}</label><select id="filter" aria-describedby="filter-help" disabled>${c.filters.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></div><p id="filter-help" class="muted small">${c.filterHelp}</p>
<p id="visible-count" class="small"></p><p id="no-matches" class="notice" hidden></p>
<div id="table-region" class="table-region" role="region" aria-label="${c.tableLabel}" tabindex="0"><table><caption>${c.caption}</caption><thead><tr><th scope="col">${c.issue}</th><th scope="col">${c.path}</th><th scope="col">${c.referenceText}</th><th scope="col">${c.targetText}</th></tr></thead><tbody id="issue-rows"></tbody></table></div>
<div class="pagination"><button id="previous-page" type="button" disabled>${c.previous}</button><span id="page-label"></span><button id="next-page" type="button" disabled>${c.next}</button></div>
<section class="exports" aria-labelledby="export-heading"><h3 id="export-heading">${c.exportHeading}</h3><p class="muted small">${c.exportHelp}</p><div class="actions"><button id="download-json" type="button" class="secondary" disabled>${c.json}</button><button id="download-txt" type="button" class="secondary" disabled>${c.txt}</button></div><p id="export-status" role="status" class="small"></p>
<details id="full-report"><summary>${c.reportSummary}</summary><label for="report-text">${c.reportLabel}</label><textarea id="report-text" rows="10" readonly spellcheck="false"></textarea><button id="select-report" type="button" disabled>${c.selectText}</button></details></section>
</section>
<section class="help" aria-labelledby="limits-heading"><h2 id="limits-heading">${c.limitHeading}</h2><p>${c.limits}</p><p>${c.paths}</p><p>${c.localLimits}</p><h2>${c.faq}</h2>${c.faqs.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</section>
</main><footer>${c.footer}</footer>
</body>
</html>
`;
  await writeFile(join(ROOT, 'public', language === 'en' ? 'en/index.html' : 'index.html'), html, 'utf8');
}
console.log('Wrote both static preview pages from fixed local copy.');
