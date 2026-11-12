// Calculs des indicateurs du reporting hebdomadaire.
// Ce fichier est la SOURCE UNIQUE des calculs : il est importé par kpi.mjs (Node)
// et injecté tel quel dans le dashboard HTML par build-report.mjs (les mots-clés
// « export » sont retirés). Il ne doit donc contenir aucun import et rester compatible navigateur.

export const COST_LABELS = {
  cogs: "Coût d'achat des marchandises vendues",
  shipping: 'Transport (envois et retours)',
  packaging: 'Emballages',
  payment_fees: 'Frais de paiement',
  marketing: {
    google_ads: 'Google Ads',
    meta_ads: 'Meta Ads',
    influence: 'Influence & réseaux sociaux',
    emailing: 'Outil e-mailing',
    affiliation: "Commissions d'affiliation",
  },
  fixed: {
    salaries: 'Salaires & charges sociales',
    rent: 'Loyer & charges (atelier-stock)',
    software: 'Logiciels & abonnements',
    content: 'Shooting photo & contenus',
    accounting: 'Honoraires comptables',
    insurance: 'Assurances',
    other: 'Frais divers',
  },
  depreciation: 'Amortissements',
};

export function sumValues(o) {
  let s = 0;
  for (const k in o) s += Number(o[k]) || 0;
  return s;
}

export function pct(a, b) {
  if (a == null || b == null || !isFinite(a) || !isFinite(b) || b === 0) return null;
  return a / b - 1;
}

export function ratio(a, b) {
  if (a == null || b == null || !b) return null;
  return a / b;
}

function addInto(target, src) {
  for (const k in src) {
    const v = src[k];
    if (v == null) continue;
    if (typeof v === 'number') target[k] = (target[k] || 0) + v;
    else if (typeof v === 'object' && !Array.isArray(v)) addInto((target[k] = target[k] || {}), v);
  }
}

function mergeRows(weeks, field, key) {
  const map = new Map();
  for (const w of weeks) {
    for (const row of w[field] || []) {
      const id = row[key];
      if (!map.has(id)) map.set(id, {});
      const acc = map.get(id);
      for (const k in row) {
        if (typeof row[k] === 'number') acc[k] = (acc[k] || 0) + row[k];
        else if (acc[k] === undefined) acc[k] = row[k];
      }
    }
  }
  return [...map.values()];
}

/** Agrège plusieurs semaines en une « semaine synthétique » de même forme. */
export function aggregateWeeks(weeks) {
  if (!weeks.length) return null;
  const out = { id: `${weeks[0].id}…${weeks[weeks.length - 1].id}`, weeksCount: weeks.length, traffic: {}, sales: {}, costs: {}, budget: {} };
  let budgetMissing = false;
  for (const w of weeks) {
    addInto(out.traffic, w.traffic);
    addInto(out.sales, w.sales);
    addInto(out.costs, w.costs);
    if (w.budget?.net_ht == null) budgetMissing = true;
    else out.budget.net_ht = (out.budget.net_ht || 0) + w.budget.net_ht;
  }
  if (budgetMissing) out.budget.net_ht = null;
  out.categories = mergeRows(weeks, 'categories', 'name');
  out.channels = mergeRows(weeks, 'channels', 'key');
  out.countries = mergeRows(weeks, 'countries', 'code');
  out.products = mergeRows(weeks, 'products', 'sku');
  return out;
}

/** Indicateurs à plat pour une semaine (réelle ou agrégée). */
export function totals(w) {
  if (!w) return null;
  const s = w.sales, t = w.traffic, c = w.costs;
  const marketing = sumValues(c.marketing || {});
  const fixed = sumValues(c.fixed || {});
  const logistics = (c.shipping || 0) + (c.packaging || 0);
  const grossMargin = s.net_ht - c.cogs;
  const variable = logistics + (c.payment_fees || 0) + marketing;
  const contribution = grossMargin - variable;
  const ebitda = contribution - fixed;
  const ebit = ebitda - (c.depreciation || 0);
  return {
    id: w.id,
    list: s.list_ht,
    discounts: s.discounts,
    gross: s.gross_ht,
    returns: s.returns,
    net: s.net_ht,
    vat: s.vat,
    ttc: s.ttc,
    orders: s.orders,
    units: s.units,
    returnedOrders: s.returned_orders,
    newCustomers: s.new_customers,
    returningCustomers: s.returning_customers,
    sessions: t.sessions,
    addToCart: t.add_to_cart,
    checkouts: t.checkouts,
    cogs: c.cogs,
    grossMargin,
    shipping: c.shipping,
    packaging: c.packaging,
    logistics,
    paymentFees: c.payment_fees,
    marketing,
    marketingDetail: c.marketing || {},
    variable,
    contribution,
    fixed,
    fixedDetail: c.fixed || {},
    ebitda,
    depreciation: c.depreciation || 0,
    ebit,
    budget: w.budget?.net_ht ?? null,
    aov: ratio(s.gross_ht, s.orders),
    conversion: ratio(s.orders, t.sessions),
    cartRate: ratio(t.add_to_cart, t.sessions),
    returnRate: ratio(s.returns, s.gross_ht),
    discountRate: ratio(s.discounts, s.list_ht),
    gmRate: ratio(grossMargin, s.net_ht),
    contributionRate: ratio(contribution, s.net_ht),
    ebitdaRate: ratio(ebitda, s.net_ht),
    ebitRate: ratio(ebit, s.net_ht),
    marketingRate: ratio(marketing, s.net_ht),
    mer: ratio(s.net_ht, marketing),
    cac: ratio(marketing, s.new_customers),
    upt: ratio(s.units, s.orders),
    returningShare: ratio(s.returning_customers, s.orders),
  };
}

export function weekIndex(ds, id) {
  return ds.weeks.findIndex((w) => w.id === id);
}

export function sameWeekLastYear(ds, w) {
  return ds.weeks.find((x) => x.year === w.year - 1 && x.week === w.week) || null;
}

/** Contexte complet du rapport pour une semaine donnée. */
export function buildContext(ds, id) {
  const idx = id ? weekIndex(ds, id) : ds.weeks.length - 1;
  if (idx < 0) throw new Error(`Semaine ${id} absente du dataset (${ds.meta.period.from} → ${ds.meta.period.to})`);
  const w = ds.weeks[idx];
  const prevW = ds.weeks[idx - 1] || null;
  const lyW = sameWeekLastYear(ds, w);
  const ytdWeeks = ds.weeks.filter((x) => x.year === w.year && x.week <= w.week);
  const ytdLyWeeks = ds.weeks.filter((x) => x.year === w.year - 1 && x.week <= w.week);
  const last52 = ds.weeks.slice(Math.max(0, idx - 51), idx + 1);
  const last13 = ds.weeks.slice(Math.max(0, idx - 12), idx + 1);

  const cur = totals(w);
  const prev = totals(prevW);
  const ly = totals(lyW);
  const ytd = totals(aggregateWeeks(ytdWeeks));
  const ytdLy = ytdLyWeeks.length ? totals(aggregateWeeks(ytdLyWeeks)) : null;
  const annualBudget = ds.meta.budget?.[w.year] ?? null;

  const catalog = new Map((ds.meta.catalog || []).map((p) => [p.sku, p]));
  const byKey = (list, key) => new Map((list || []).map((r) => [r[key], r]));

  const prevCats = byKey(prevW?.categories, 'name');
  const lyCats = byKey(lyW?.categories, 'name');
  const categories = w.categories
    .map((c) => ({
      name: c.name,
      net: c.net_ht,
      units: c.units,
      share: ratio(c.net_ht, cur.net),
      gmRate: ratio(c.net_ht - c.cogs, c.net_ht),
      returnRate: ratio(c.returns, c.gross_ht),
      vsPrev: pct(c.net_ht, prevCats.get(c.name)?.net_ht),
      vsLy: pct(c.net_ht, lyCats.get(c.name)?.net_ht),
    }))
    .sort((a, b) => b.net - a.net);

  const prevCh = byKey(prevW?.channels, 'key');
  const channels = w.channels
    .map((ch) => ({
      key: ch.key,
      name: ch.name,
      sessions: ch.sessions,
      sessionShare: ratio(ch.sessions, cur.sessions),
      orders: ch.orders,
      conversion: ratio(ch.orders, ch.sessions),
      revenue: ch.revenue_ht,
      spend: ch.spend,
      roas: ch.spend ? ch.revenue_ht / ch.spend : null,
      cpa: ch.spend && ch.orders ? ch.spend / ch.orders : null,
      vsPrev: pct(ch.revenue_ht, prevCh.get(ch.key)?.revenue_ht),
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const prevCo = byKey(prevW?.countries, 'code');
  const countries = w.countries
    .map((co) => ({ code: co.code, name: co.name, orders: co.orders, revenue: co.revenue_ht, share: ratio(co.revenue_ht, cur.gross), vsPrev: pct(co.revenue_ht, prevCo.get(co.code)?.revenue_ht) }))
    .sort((a, b) => b.revenue - a.revenue);

  const prevProd = byKey(prevW?.products, 'sku');
  const products = w.products
    .map((p) => {
      const meta = catalog.get(p.sku) || {};
      return { sku: p.sku, name: meta.name || p.sku, category: meta.category || '', units: p.units, revenue: p.revenue_ht, vsPrev: pct(p.revenue_ht, prevProd.get(p.sku)?.revenue_ht) };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const series = last52.map((x) => {
    const t = totals(x);
    const lyx = sameWeekLastYear(ds, x);
    return { id: x.id, week: x.week, year: x.year, start: x.start, end: x.end, event: x.event, t, lyNet: lyx ? lyx.sales.net_ht : null };
  });

  const ctx = {
    shop: ds.meta.shop,
    source: ds.meta.source,
    alerts: ds.meta.alerts || {},
    week: { id: w.id, year: w.year, week: w.week, start: w.start, end: w.end, event: w.event, index: idx },
    cur,
    prev,
    ly,
    ytd,
    ytdLy,
    annualBudget,
    categories,
    channels,
    countries,
    products,
    series,
    last13: last13.map((x) => ({ id: x.id, week: x.week, t: totals(x), channels: x.channels })),
  };
  ctx.insights = buildInsights(ctx);
  return ctx;
}

// ---------------------------------------------------------------------------
// Formatage (fr-BE par défaut)
// ---------------------------------------------------------------------------
export function makeFormat(locale = 'fr-BE', currency = 'EUR') {
  const eur0 = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
  const eur2 = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dec1 = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dec2 = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const f = {
    eur: (x) => (x == null ? '–' : eur0.format(x)),
    eur2: (x) => (x == null ? '–' : eur2.format(x)),
    eurCompact: (x) => (x == null ? '–' : Math.abs(x) >= 10000 ? `${compact.format(x)} €` : eur0.format(x)),
    int: (x) => (x == null ? '–' : int.format(x)),
    pct: (x, d = 1) => (x == null ? '–' : `${(d === 2 ? dec2 : dec1).format(x * 100)} %`),
    delta: (x) => (x == null ? '–' : `${x > 0 ? '+' : x < 0 ? '−' : '±'}${dec1.format(Math.abs(x * 100))} %`),
    pts: (x) => (x == null ? '–' : `${x > 0 ? '+' : x < 0 ? '−' : '±'}${dec1.format(Math.abs(x * 100))} pt`),
    dec1: (x) => (x == null ? '–' : dec1.format(x)),
    dec2: (x) => (x == null ? '–' : dec2.format(x)),
    date: (iso, opts = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)),
  };
  return f;
}

// ---------------------------------------------------------------------------
// Faits marquants automatiques (règles simples, complétées par l'analyse de Claude)
// ---------------------------------------------------------------------------
export function buildInsights(ctx) {
  const f = makeFormat(ctx.shop?.locale, ctx.shop?.currency);
  const a = ctx.alerts || {};
  const { cur, prev, ly } = ctx;
  const out = [];
  const vsPrev = pct(cur.net, prev?.net);
  const vsLy = pct(cur.net, ly?.net);

  let headline = `CA net HT de ${f.eur(cur.net)}`;
  const parts = [];
  if (vsPrev != null) parts.push(`${f.delta(vsPrev)} vs S-1`);
  if (vsLy != null) parts.push(`${f.delta(vsLy)} vs même semaine N-1`);
  if (parts.length) headline += ` (${parts.join(', ')})`;
  if (ctx.week.event) headline += `, semaine marquée par « ${ctx.week.event} »`;
  out.push({ level: vsLy == null ? 'info' : vsLy >= 0 ? 'good' : 'warning', text: `${headline}.` });

  if (cur.budget) {
    const gap = pct(cur.net, cur.budget);
    out.push({ level: gap >= 0 ? 'good' : gap > -0.1 ? 'warning' : 'critical', text: `Objectif hebdomadaire ${gap >= 0 ? 'dépassé' : 'manqué'} de ${f.delta(gap).replace(/^[+−±]/, '')} (${f.eur(cur.net)} pour ${f.eur(cur.budget)} visés).` });
  }

  if (ctx.ytd?.budget) {
    const g = pct(ctx.ytd.net, ctx.ytd.budget);
    out.push({ level: g >= 0 ? 'good' : g > -0.05 ? 'warning' : 'critical', text: `Cumul annuel : ${f.eur(ctx.ytd.net)}, soit ${f.delta(g)} vs objectif cumulé${ctx.ytdLy ? ` et ${f.delta(pct(ctx.ytd.net, ctx.ytdLy.net))} vs N-1` : ''}.` });
  }

  const withLy = ctx.categories.filter((c) => c.vsLy != null);
  if (withLy.length >= 2) {
    const best = withLy.reduce((m, c) => (c.vsLy > m.vsLy ? c : m));
    const worst = withLy.reduce((m, c) => (c.vsLy < m.vsLy ? c : m));
    out.push({ level: 'info', text: `Catégorie la plus dynamique : ${best.name} (${f.delta(best.vsLy)} vs N-1). La plus en retrait : ${worst.name} (${f.delta(worst.vsLy)}).` });
  }

  if (ctx.products[0]) out.push({ level: 'info', text: `Meilleure vente : ${ctx.products[0].name} (${f.int(ctx.products[0].units)} unités, ${f.eur(ctx.products[0].revenue)}).` });

  if (a.return_rate_max != null && cur.returnRate > a.return_rate_max) out.push({ level: 'warning', text: `Taux de retour à ${f.pct(cur.returnRate)}, au-dessus du seuil de ${f.pct(a.return_rate_max, 0)}.` });

  if (a.gross_margin_min != null && cur.gmRate < a.gross_margin_min) out.push({ level: 'warning', text: `Marge brute à ${f.pct(cur.gmRate)} (seuil ${f.pct(a.gross_margin_min, 0)}) : remises moyennes de ${f.pct(cur.discountRate)} sur la semaine.` });

  if (cur.ebit < 0) out.push({ level: 'critical', text: `Résultat d'exploitation négatif cette semaine : ${f.eur(cur.ebit)}.` });
  else if (a.operating_margin_min != null && cur.ebitRate < a.operating_margin_min) out.push({ level: 'warning', text: `Marge d'exploitation de ${f.pct(cur.ebitRate)}, sous le seuil de ${f.pct(a.operating_margin_min, 0)}.` });

  if (a.mer_min != null && cur.mer != null && cur.mer < a.mer_min) out.push({ level: 'warning', text: `Rentabilité marketing faible : ${f.dec1(cur.mer)} € de CA net pour 1 € investi (seuil ${a.mer_min}).` });

  if (prev && a.conversion_drop_pct != null) {
    const c = pct(cur.conversion, prev.conversion);
    if (c != null && c <= -a.conversion_drop_pct) out.push({ level: 'warning', text: `Taux de conversion en baisse : ${f.pct(cur.conversion, 2)} (${f.delta(c)} vs S-1).` });
  }
  return out;
}
