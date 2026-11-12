// Générateur de données factices (cœur), utilisable en Node et dans un navigateur.
import { mulberry32, makeNoise } from './rng.mjs';
import { weekRange, weeksInYear, isoWeekStart } from './weeks.mjs';

export function generateDataset(P, opts = {}) {
  const F = { ...P.fake };
  if (!P.fake) throw new Error('Profil sans section fake : impossible de générer des données factices.');
  if (opts.to) F.to = opts.to;
  if (opts.from) F.from = opts.from;
const weeks = weekRange(F.from, F.to);
const lastYear = weeks[weeks.length - 1].year;
const round2 = (x) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------------------
// Calibrage en trois passes (même graine à chaque passe → même « forme » de données) :
//   1. demande brute → on mesure le CA net des 52 dernières semaines ;
//   2. on met à l'échelle pour atteindre annual_net_revenue ;
//   3. on ajuste les frais fixes pour viser target_operating_margin.
// ---------------------------------------------------------------------------
const pass1 = generate(1, 1);
const scale = F.annual_net_revenue / sumLast52(pass1, (w) => w.sales.net_ht);
const pass2 = generate(scale, 1);

const net52 = sumLast52(pass2, (w) => w.sales.net_ht);
const contribution52 = sumLast52(pass2, (w) => w.sales.net_ht - variableCosts(w));
const fixed52 = sumLast52(pass2, (w) => sumObj(w.costs.fixed));
const dep52 = sumLast52(pass2, (w) => w.costs.depreciation);
let fixedScale = 1;
if (F.target_operating_margin != null) {
  const neededFixed = contribution52 - dep52 - F.target_operating_margin * net52;
  fixedScale = neededFixed / fixed52;
  if (fixedScale < 0.3 || fixedScale > 3) {
    console.warn(`⚠ Calibrage des frais fixes extrême (×${fixedScale.toFixed(2)}). Revoir les coûts variables ou la marge visée dans le profil.`);
  }
  fixedScale = Math.max(0.05, fixedScale);
}
const finalWeeks = generate(scale, fixedScale);
attachBudget(finalWeeks);

const dataset = {
  meta: {
    schema_version: 1,
    shop: pick(P, ['slug', 'name', 'tagline', 'sector', 'currency', 'locale', 'vat_rate']),
    source: { type: 'fake', seed: F.seed, generated_at: new Date().toISOString(), generator: 'generate-fake-data.mjs' },
    period: { from: finalWeeks[0].id, to: finalWeeks[finalWeeks.length - 1].id },
    alerts: P.alerts || {},
    budget: P.budget || {},
    catalog: F.products.map((p) => pick(p, ['sku', 'name', 'category', 'price_ht'])),
  },
  weeks: finalWeeks,
};
  return { dataset, fixedScale };

// ---------------------------------------------------------------------------

function generate(revenueScale, fixedCostScale) {
  const rand = mulberry32(F.seed);
  const noise = makeNoise(rand);
  const lastIdx = weeks.length - 1;
  const vc = F.variable_costs;

  return weeks.map((wk, i) => {
    const ev = eventFor(wk.week);
    const trend = Math.pow(1 + F.growth_yoy, (i - lastIdx) / 52);
    const demand = F.monthly_seasonality[wk.month] * ev.uplift * trend * noise(F.noise);
    const gross = revenueScale * demand * 1000; // CA HT après remises, avant retours
    const d = ev.discount;

    // --- Catégories --------------------------------------------------------
    const catW = F.categories.map((c) => c.share * F.season_profiles[c.season][wk.month] * noise(0.06));
    const catWSum = catW.reduce((a, b) => a + b, 0);
    let list = 0, discounts = 0, returns = 0, net = 0, cogs = 0;
    const productRows = [];
    const categories = F.categories.map((c, ci) => {
      const g = gross * (catW[ci] / catWSum);
      const l = g / (1 - d);
      const rr = Math.min(0.6, c.return_rate * (d >= 0.2 ? 1.08 : 1) * noise(0.1));
      const r = g * rr;
      const nt = g - r;
      const marginRate = 1 - (1 - c.list_margin) / (1 - d);
      const cg = nt * (1 - marginRate);
      list += l; discounts += l - g; returns += r; net += nt; cogs += cg;

      // Produits de la catégorie
      const prods = F.products.filter((p) => p.category === c.name);
      const pw = prods.map((p) => p.weight * noise(0.15));
      const pwSum = pw.reduce((a, b) => a + b, 0) || 1;
      let units = 0;
      prods.forEach((p, pi) => {
        const rev = g * (pw[pi] / pwSum);
        const u = Math.max(0, Math.round(rev / (p.price_ht * (1 - d))));
        units += u;
        productRows.push({ sku: p.sku, units: u, revenue_ht: round2(rev) });
      });
      return { name: c.name, gross_ht: round2(g), discounts: round2(l - g), returns: round2(r), net_ht: round2(nt), cogs: round2(cg), units };
    });

    // --- Commandes, trafic, clients -----------------------------------------
    const aov = F.avg_order_value_ht * ev.aov * noise(0.03);
    const orders = Math.max(1, Math.round(gross / aov));
    const units = categories.reduce((a, c) => a + c.units, 0);
    const returnedOrders = Math.round(orders * (returns / gross) * 1.15);
    const cr = F.conversion_rate * ev.conversion * noise(0.05);
    const sessions = Math.round(orders / cr);
    const checkouts = Math.round(orders / (F.checkout_completion * noise(0.03)));
    const addToCart = Math.round(checkouts / (F.cart_to_checkout * noise(0.03)));
    const newShare = clamp(F.new_customer_share * (ev.uplift > 1.3 ? 1.1 : 1) * noise(0.04), 0.3, 0.9);
    const newCustomers = Math.round(orders * newShare);

    // --- Canaux d'acquisition & marketing -----------------------------------
    const marketing = {};
    for (const ch of F.channels) if (ch.cost.line) marketing[ch.cost.line] = 0;
    const chW = F.channels.map((ch) => ch.share * noise(0.08) * (ch.cost.type === 'cpc' && ev.uplift > 1.2 ? 1.15 : 1));
    const chWSum = chW.reduce((a, b) => a + b, 0);
    const chSessions = chW.map((w) => Math.round(sessions * (w / chWSum)));
    const chOrdW = F.channels.map((ch, ci) => chSessions[ci] * ch.conversion);
    const chOrdSum = chOrdW.reduce((a, b) => a + b, 0);
    const chOrders = splitInt(orders, chOrdW.map((w) => w / chOrdSum));
    const channels = F.channels.map((ch, ci) => {
      const rev = gross * (chOrdW[ci] / chOrdSum);
      let spend = 0;
      if (ch.cost.type === 'cpc') spend = chSessions[ci] * ch.cost.value * (ev.cpc || 1) * noise(0.05);
      else if (ch.cost.type === 'monthly') spend = (ch.cost.value * 12) / 52;
      else if (ch.cost.type === 'commission') spend = rev * ch.cost.value;
      if (ch.cost.line) marketing[ch.cost.line] += spend;
      return { key: ch.key, name: ch.name, sessions: chSessions[ci], orders: chOrders[ci], revenue_ht: round2(rev), spend: round2(spend) };
    });
    for (const k of Object.keys(marketing)) marketing[k] = round2(marketing[k]);

    // --- Pays ------------------------------------------------------------------
    const coW = F.countries.map((c) => c.share * noise(0.07));
    const coSum = coW.reduce((a, b) => a + b, 0);
    const coOrders = splitInt(orders, coW.map((w) => w / coSum));
    const countries = F.countries.map((c, ci) => ({ code: c.code, name: c.name, orders: coOrders[ci], revenue_ht: round2(gross * (coW[ci] / coSum)) }));

    // --- Coûts ----------------------------------------------------------------
    const yearFactor = wk.year < lastYear ? (F.fixed_costs_prev_year_factor ?? 1) : 1;
    const fixed = {};
    for (const [k, v] of Object.entries(F.fixed_costs_annual)) fixed[k] = round2((v / 52) * fixedCostScale * yearFactor);

    return {
      id: wk.id,
      year: wk.year,
      week: wk.week,
      start: wk.start,
      end: wk.end,
      event: ev.name,
      traffic: { sessions, add_to_cart: addToCart, checkouts },
      sales: {
        list_ht: round2(list),
        discounts: round2(discounts),
        gross_ht: round2(gross),
        returns: round2(returns),
        net_ht: round2(net),
        vat: round2(gross * P.vat_rate),
        ttc: round2(gross * (1 + P.vat_rate)),
        orders,
        units,
        returned_orders: returnedOrders,
        new_customers: newCustomers,
        returning_customers: orders - newCustomers,
      },
      costs: {
        cogs: round2(cogs),
        shipping: round2(orders * vc.shipping_per_order + returnedOrders * vc.shipping_per_return),
        packaging: round2(orders * vc.packaging_per_order),
        payment_fees: round2(gross * (1 + P.vat_rate) * vc.payment_fee_rate + orders * vc.payment_fee_fixed),
        marketing,
        fixed,
        depreciation: round2(F.depreciation_annual / 52),
      },
      budget: { net_ht: null },
      categories,
      channels,
      countries,
      products: productRows,
    };
  });
}

/** Objectif hebdomadaire = budget annuel réparti selon la saisonnalité attendue (sans bruit). */
function attachBudget(list) {
  const years = [...new Set(list.map((w) => w.year))];
  for (const y of years) {
    const annual = P.budget?.[y];
    if (!annual) continue;
    const n = weeksInYear(y);
    const expected = {};
    let total = 0;
    for (let wn = 1; wn <= n; wn++) {
      const start = isoWeekStart(y, wn);
      const month = new Date(start.getTime() + 3 * 86400000).getUTCMonth();
      const e = F.monthly_seasonality[month] * eventFor(wn).uplift;
      expected[wn] = e;
      total += e;
    }
    for (const w of list) if (w.year === y) w.budget.net_ht = round2((annual * expected[w.week]) / total);
  }
}

function eventFor(week) {
  for (const e of F.events || []) {
    const k = e.weeks.indexOf(week);
    if (k >= 0) return { name: e.name, uplift: e.uplift[k] ?? e.uplift[0], discount: e.discount ?? F.base_discount, conversion: e.conversion ?? 1, aov: e.aov ?? 1, cpc: e.cpc ?? 1 };
  }
  return { name: null, uplift: 1, discount: F.base_discount, conversion: 1, aov: 1, cpc: 1 };
}

function variableCosts(w) {
  return w.costs.cogs + w.costs.shipping + w.costs.packaging + w.costs.payment_fees + sumObj(w.costs.marketing);
}
function sumLast52(list, f) { return sum(list.slice(-52), f); }
function sum(list, f) { return list.reduce((a, x) => a + f(x), 0); }
function sumObj(o) { return Object.values(o).reduce((a, b) => a + b, 0); }
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
function pick(o, keys) { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; }

/** Répartit un entier selon des parts, en conservant la somme exacte. */
function splitInt(total, shares) {
  const raw = shares.map((s) => s * total);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]]++;
  return out;
}
}
