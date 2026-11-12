#!/usr/bin/env node
// Exporte un dataset.json en classeur Excel (.xlsx) prêt à importer dans Google Sheets.
// Les chiffres sont calculés par scripts/lib/metrics.mjs : ils sont identiques au dashboard.
// Aucune dépendance : le fichier .xlsx (zip + XML) est écrit à la main.
//
// Usage : node scripts/export-xlsx.mjs --dataset <dataset.json> [--out reporting-data.xlsx]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { totals, COST_LABELS } from './lib/metrics.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.dataset) fail('Option --dataset requise');
const datasetPath = path.resolve(args.dataset);
const ds = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const outFile = path.resolve(args.out || path.join(path.dirname(datasetPath), `${ds.meta.shop.slug}-reporting-data.xlsx`));
const catalog = new Map(ds.meta.catalog.map((p) => [p.sku, p]));

// Formats : 0 texte/entier, E euros, P pourcentage, D décimal, I entier
const S = { text: 0, head: 1, eur: 2, pct: 3, int: 4, dec: 5, title: 6 };

const mkKeys = Object.keys(ds.weeks[0].costs.marketing);
const fxKeys = Object.keys(ds.weeks[0].costs.fixed);

// --- Onglet Hebdo -----------------------------------------------------------
const weekly = [];
const wCols = [
  ['Semaine', (w) => w.id, S.text], ['Année', (w) => w.year, S.int], ['N° semaine', (w) => w.week, S.int],
  ['Début', (w) => w.start, S.text], ['Fin', (w) => w.end, S.text], ['Événement', (w) => w.event || '', S.text],
  ['Sessions', (w, t) => t.sessions, S.int], ['Ajouts au panier', (w, t) => t.addToCart, S.int], ['Paiements initiés', (w, t) => t.checkouts, S.int],
  ['Commandes', (w, t) => t.orders, S.int], ['Articles vendus', (w, t) => t.units, S.int], ['Commandes retournées', (w, t) => t.returnedOrders, S.int],
  ['Nouveaux clients', (w, t) => t.newCustomers, S.int], ['Clients récurrents', (w, t) => t.returningCustomers, S.int],
  ['Ventes HT prix catalogue', (w, t) => t.list, S.eur], ['Remises', (w, t) => t.discounts, S.eur], ['Ventes HT après remises', (w, t) => t.gross, S.eur],
  ['Retours', (w, t) => t.returns, S.eur], ['CA net HT', (w, t) => t.net, S.eur], ['TVA', (w, t) => t.vat, S.eur], ['Encaissé TTC', (w, t) => t.ttc, S.eur],
  ['Objectif CA net HT', (w, t) => t.budget, S.eur],
  ["Coût d'achat marchandises", (w, t) => t.cogs, S.eur], ['Marge brute', (w, t) => t.grossMargin, S.eur],
  ['Transport', (w, t) => t.shipping, S.eur], ['Emballages', (w, t) => t.packaging, S.eur], ['Frais de paiement', (w, t) => t.paymentFees, S.eur],
  ...mkKeys.map((k) => [`Marketing · ${COST_LABELS.marketing[k] || k}`, (w, t) => t.marketingDetail[k] || 0, S.eur]),
  ['Marketing total', (w, t) => t.marketing, S.eur], ['Marge sur coûts variables', (w, t) => t.contribution, S.eur],
  ...fxKeys.map((k) => [`Frais fixes · ${COST_LABELS.fixed[k] || k}`, (w, t) => t.fixedDetail[k] || 0, S.eur]),
  ['Frais fixes total', (w, t) => t.fixed, S.eur], ['EBITDA', (w, t) => t.ebitda, S.eur], ['Amortissements', (w, t) => t.depreciation, S.eur],
  ["Résultat d'exploitation", (w, t) => t.ebit, S.eur],
  ['Panier moyen HT', (w, t) => t.aov, S.eur], ['Taux de conversion', (w, t) => t.conversion, S.pct], ['Taux de retour', (w, t) => t.returnRate, S.pct],
  ['Remise moyenne', (w, t) => t.discountRate, S.pct], ['Taux de marge brute', (w, t) => t.gmRate, S.pct], ["Marge d'exploitation", (w, t) => t.ebitRate, S.pct],
  ['Marketing / CA net', (w, t) => t.marketingRate, S.pct], ['MER (CA net / marketing)', (w, t) => t.mer, S.dec], ['CAC', (w, t) => t.cac, S.eur],
  ['Articles par commande', (w, t) => t.upt, S.dec],
];
weekly.push(wCols.map((c) => [c[0], S.head]));
for (const w of ds.weeks) { const t = totals(w); weekly.push(wCols.map((c) => [c[1](w, t), c[2]])); }

// --- Onglets détaillés (format long) ----------------------------------------
const long = (head, fn) => [head.map((h) => [h, S.head]), ...ds.weeks.flatMap(fn)];
const categories = long(['Semaine', 'Catégorie', 'Ventes HT après remises', 'Remises', 'Retours', 'CA net HT', "Coût d'achat", 'Marge brute', 'Taux de marge brute', 'Taux de retour', 'Articles'],
  (w) => w.categories.map((c) => [[w.id, S.text], [c.name, S.text], [c.gross_ht, S.eur], [c.discounts, S.eur], [c.returns, S.eur], [c.net_ht, S.eur], [c.cogs, S.eur], [c.net_ht - c.cogs, S.eur], [c.net_ht ? (c.net_ht - c.cogs) / c.net_ht : null, S.pct], [c.gross_ht ? c.returns / c.gross_ht : null, S.pct], [c.units, S.int]]));
const channels = long(['Semaine', 'Canal', 'Sessions', 'Commandes', 'Conversion', 'CA HT', 'Dépense', 'ROAS', 'Coût par commande'],
  (w) => w.channels.map((c) => [[w.id, S.text], [c.name, S.text], [c.sessions, S.int], [c.orders, S.int], [c.sessions ? c.orders / c.sessions : null, S.pct], [c.revenue_ht, S.eur], [c.spend, S.eur], [c.spend ? c.revenue_ht / c.spend : null, S.dec], [c.spend && c.orders ? c.spend / c.orders : null, S.eur]]));
const countries = long(['Semaine', 'Code', 'Pays', 'Commandes', 'CA HT'],
  (w) => w.countries.map((c) => [[w.id, S.text], [c.code, S.text], [c.name, S.text], [c.orders, S.int], [c.revenue_ht, S.eur]]));
const products = long(['Semaine', 'SKU', 'Produit', 'Catégorie', 'Unités', 'CA HT'],
  (w) => w.products.map((p) => [[w.id, S.text], [p.sku, S.text], [catalog.get(p.sku)?.name || p.sku, S.text], [catalog.get(p.sku)?.category || '', S.text], [p.units, S.int], [p.revenue_ht, S.eur]]));
const catalogSheet = [['SKU', 'Produit', 'Catégorie', 'Prix HT'].map((h) => [h, S.head]), ...ds.meta.catalog.map((p) => [[p.sku, S.text], [p.name, S.text], [p.category, S.text], [p.price_ht, S.eur]])];

// --- Lisez-moi -----------------------------------------------------------------
const src = ds.meta.source || {};
const readme = [
  [[`${ds.meta.shop.name} · données du reporting e-commerce`, S.title]],
  [[src.type === 'fake' ? 'DONNÉES FACTICES générées pour tester le dashboard. Aucune donnée réelle.' : `Source : ${src.type}`, S.text]],
  [[`Période : ${ds.meta.period.from} → ${ds.meta.period.to} · ${ds.weeks.length} semaines ISO (lundi → dimanche)`, S.text]],
  [[`Exporté le ${new Date().toISOString().slice(0, 10)} depuis dataset.json (mêmes calculs que le dashboard HTML)`, S.text]],
  [['', S.text]],
  [['Onglet', S.head], ['Contenu', S.head]],
  [['Hebdo', S.text], ['Une ligne par semaine : trafic, ventes, compte de résultat complet et ratios', S.text]],
  [['Catégories', S.text], ['Une ligne par semaine et par catégorie', S.text]],
  [['Canaux', S.text], ["Une ligne par semaine et par canal d'acquisition", S.text]],
  [['Pays', S.text], ['Une ligne par semaine et par pays', S.text]],
  [['Produits', S.text], ['Une ligne par semaine et par produit', S.text]],
  [['Catalogue', S.text], ['Liste des produits et prix HT', S.text]],
  [['Objectifs', S.text], ['Budget annuel de CA net HT', S.text]],
  [['', S.text]],
  [['Définition', S.head], ['Calcul', S.head]],
  [['CA net HT', S.text], ['Ventes HT après remises − retours', S.text]],
  [['Marge brute', S.text], ["CA net HT − coût d'achat des marchandises vendues", S.text]],
  [['Marge sur coûts variables', S.text], ['Marge brute − transport − emballages − frais de paiement − marketing', S.text]],
  [['EBITDA', S.text], ['Marge sur coûts variables − frais fixes', S.text]],
  [["Résultat d'exploitation", S.text], ['EBITDA − amortissements', S.text]],
  [['Panier moyen HT', S.text], ['Ventes HT après remises ÷ commandes', S.text]],
  [['Taux de conversion', S.text], ['Commandes ÷ sessions', S.text]],
  [['Taux de retour', S.text], ['Retours ÷ ventes HT après remises', S.text]],
  [['MER', S.text], ['CA net HT ÷ dépenses marketing', S.text]],
  [['CAC', S.text], ['Dépenses marketing ÷ nouveaux clients', S.text]],
];
const budget = [['Année', 'Objectif CA net HT'].map((h) => [h, S.head]), ...Object.entries(ds.meta.budget || {}).map(([y, v]) => [[Number(y), S.int], [v, S.eur]])];

const sheets = [
  { name: 'Lisez-moi', rows: readme, widths: [34, 90], freeze: false },
  { name: 'Hebdo', rows: weekly, widths: wCols.map((c, i) => (i < 6 ? (i === 5 ? 16 : 12) : 16)), freeze: true, freezeCols: 1 },
  { name: 'Catégories', rows: categories, widths: [11, 20, 16, 12, 12, 14, 14, 14, 12, 12, 10], freeze: true },
  { name: 'Canaux', rows: channels, widths: [11, 28, 11, 11, 11, 13, 12, 9, 14], freeze: true },
  { name: 'Pays', rows: countries, widths: [11, 7, 14, 11, 13], freeze: true },
  { name: 'Produits', rows: products, widths: [11, 9, 32, 20, 9, 12], freeze: true },
  { name: 'Catalogue', rows: catalogSheet, widths: [9, 32, 20, 11], freeze: true },
  { name: 'Objectifs', rows: budget, widths: [10, 20], freeze: true },
];

fs.writeFileSync(outFile, buildXlsx(sheets));
console.log(`✔ Classeur écrit : ${outFile}`);
for (const s of sheets) console.log(`  ${s.name.padEnd(11)} ${String(s.rows.length - 1).padStart(5)} lignes`);

// ===========================================================================
function buildXlsx(sheets) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const col = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const files = {};
  files['[Content_Types].xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  files['_rels/.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  files['xl/workbook.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
  files['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  // Styles : 0 normal · 1 en-tête (blanc sur sombre) · 2 euros · 3 % · 4 entier · 5 décimal · 6 titre (ember)
  files['xl/styles.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;€&quot;"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="0.00"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FFE34D00"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF100E0C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  sheets.forEach((s, si) => {
    const rowsXml = s.rows.map((row, ri) => `<row r="${ri + 1}">${row.map(([v, st], ci) => {
      const ref = `${col(ci)}${ri + 1}`;
      if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return st ? `<c r="${ref}" s="${st}"/>` : '';
      if (typeof v === 'number') return `<c r="${ref}" s="${st}"><v>${Math.round(v * 1e6) / 1e6}</v></c>`;
      return `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const fc = s.freezeCols || 0;
    const pane = s.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ${fc ? `xSplit="${fc}" ` : ''}ySplit="1" topLeftCell="${col(fc)}2" activePane="${fc ? 'bottomRight' : 'bottomLeft'}" state="frozen"/></sheetView></sheetViews>` : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const cols = `<cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
    files[`xl/worksheets/sheet${si + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${rowsXml}</sheetData>${s.freeze ? `<autoFilter ref="A1:${col(s.rows[0].length - 1)}${s.rows.length}"/>` : ''}</worksheet>`;
  });
  return zip(files);
}

function zip(files) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(0, 10); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(0, 12); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) o[argv[i].slice(2)] = true; else { o[argv[i].slice(2)] = n; i++; } }
  return o;
}
function fail(msg) { console.error(`✖ ${msg}`); process.exit(1); }
