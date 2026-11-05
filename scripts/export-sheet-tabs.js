/**
 * Read tabs of the CityMETER Hospital research sheet from its HTML view, cell by cell as displayed, into the files
 * scripts/build-data.py reads (`--tabs DIR`): one `{name, gid, ncols, rows}` JSON per tab, rows[0] = the header.
 *
 * Why: the research master (≈ 42,000 rows × 62 columns in 02_FACILITIES) is larger than Drive's spreadsheet export
 * allows, so the build reads the sheet's published HTML view instead — the same cells a reader sees, in the owner's
 * own signed-in browser. Nothing is sent anywhere: the result is shown in the page for copying.
 *
 * Use (2026-11-05 read): open the sheet's HTML view (…/htmlview) in the browser that can open the sheet, paste this
 * file into the developer console, then run `await exportTabs()` (every tab below) or
 * `await exportTabs([['12_IDENTITY_LINKS', 120031]])`. Each tab appears as a <pre data-tab="NAME"> holding
 * base64(gzip(JSON)); decode with `base64 -d | gunzip > NAME.json`. scripts/build-data.py records each tab's SHA-256
 * (canonical JSON of its rows) in data/hospitals.json `meta.tabs`, so a re-read can be compared with the release.
 *
 * The HTML view is fetched per tab from the same origin (`htmlview/sheet?headers=false&gid=…`) and parsed with
 * DOMParser under a Trusted Types policy (the page enforces Trusted Types). Frozen-pane spacer cells are skipped;
 * a line break in a cell reads as \n and a non-breaking space as a space; trailing empty rows are dropped; every row
 * is padded to the widest row. The summary prints each tab's SHA-256 the way scripts/build-data.py computes it
 * (JSON of the rows, no spaces), to compare with `meta.tabs` of the release.
 */
const TABS = [
  ['02_FACILITIES', 103], ['99_SOURCE_OBSERVATIONS', 0], ['08_ACCREDITATION', 109], ['11_PRICE_BASKET', 110031],
  ['13_SERVICE_PROFILE', 130031], ['15_SERVICE_FRAMEWORK', 150031], ['10_SOURCES', 111022], ['01_BRANDS', 102],
  ['03_AREA_SUMMARY', 104], ['12_IDENTITY_LINKS', 120031],
];

function cellText(td) {
  for (const br of td.querySelectorAll('br')) br.replaceWith('\n');
  return td.textContent.replace(/\u00a0/g, ' ');
}

const sha256 = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

async function readTab(gid) {
  const policy = window.trustedTypes?.createPolicy?.(`tab-export-${gid}-${Date.now()}`, {createHTML: s => s});
  const response = await fetch(`htmlview/sheet?headers=false&gid=${gid}`, {credentials: 'include'});
  if (!response.ok) throw new Error(`gid ${gid}: HTTP ${response.status}`);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(policy ? policy.createHTML(html) : html, 'text/html');
  const table = doc.querySelector('table.waffle');
  if (!table) throw new Error(`gid ${gid}: no sheet table`);
  const rows = [...table.querySelectorAll('tbody tr')]
    .map(tr => [...tr.querySelectorAll('td')].filter(td => !td.classList.contains('freezebar-cell')).map(cellText));
  while (rows.length && rows.at(-1).every(c => c === '')) rows.pop();
  const ncols = Math.max(0, ...rows.map(r => r.length));
  for (const r of rows) while (r.length < ncols) r.push('');
  return {gid, ncols, rows};
}

async function gzipBase64(text) {
  const buffer = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

async function exportTabs(list = TABS) {
  const summary = [];
  for (const [name, gid] of list) {
    const tab = await readTab(gid);
    const pre = document.createElement('pre');
    pre.dataset.tab = name;
    pre.textContent = await gzipBase64(JSON.stringify({name, ...tab}));
    document.body.append(pre);
    summary.push({name, gid, rows: tab.rows.length - 1, columns: tab.ncols, sha256: await sha256(JSON.stringify(tab.rows)), base64: pre.textContent.length});
  }
  console.table(summary);
  return summary;
}

if (typeof window !== 'undefined') Object.assign(window, {exportTabs, readTab});
