// Construction des onglets du classeur de données (Node et navigateur).
import { totals, COST_LABELS } from './metrics.mjs';

// Styles de cellule : 0 texte · 1 en-tête · 2 euros · 3 % · 4 entier · 5 décimal · 6 titre
export const S = { text: 0, head: 1, eur: 2, pct: 3, int: 4, dec: 5, title: 6 };

export function buildSheets(ds) {
const catalog = new Map(ds.meta.catalog.map((p) => [p.sku, p]));

const mkKeys = Object.keys(ds.weeks[0].costs.marketing);
const fxKeys = Object.keys(ds.weeks[0].costs.fixed);

// --- Onglet Hebdo -----------------------------------------------------------
const weekly = [];
const wCols = [
  ['Semaine', (w) => w.id, S.text], ['Année', (w) => w.year, S.text], ['N° semaine', (w) => w.week, S.text],
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
const budget = [['Année', 'Objectif CA net HT'].map((h) => [h, S.head]), ...Object.entries(ds.meta.budget || {}).map(([y, v]) => [[Number(y), S.text], [v, S.eur]])];

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
  return sheets;
}
