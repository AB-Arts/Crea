#!/usr/bin/env node
// Résumé chiffré d'une semaine, pour rédiger l'analyse (notes.json) ou répondre à une question.
//
// Usage :
//   node scripts/kpi.mjs --dataset <dataset.json> [--week 2026-W45] [--json]

import fs from 'node:fs';
import path from 'node:path';
import { buildContext, makeFormat, pct } from './lib/metrics.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.dataset) fail('Option --dataset requise');
const ds = JSON.parse(fs.readFileSync(path.resolve(args.dataset), 'utf8'));
let ctx;
try { ctx = buildContext(ds, args.week || null); } catch (e) { fail(e.message); }

if (args.json) {
  const { series, last13, ...rest } = ctx;
  process.stdout.write(JSON.stringify({ ...rest, trend13: last13.map((w) => ({ id: w.id, net: w.t.net, orders: w.t.orders, ebit: w.t.ebit, mer: w.t.mer })) }, null, 2));
  process.exit(0);
}

const f = makeFormat(ds.meta.shop.locale, ds.meta.shop.currency);
const { cur, prev, ly, ytd, ytdLy } = ctx;
const line = (label, v, p, l, fmt = f.eur, kind = 'pct') => {
  const d = (b) => (b == null ? '–' : kind === 'pts' ? f.pts(v - b) : f.delta(pct(v, b)));
  return `  ${label.padEnd(30)} ${String(fmt(v)).padStart(14)}   S-1 ${d(p).padStart(9)}   N-1 ${d(l).padStart(9)}`;
};
const out = [];
out.push(`${ds.meta.shop.name} — semaine ${ctx.week.id} (${ctx.week.start} → ${ctx.week.end})${ctx.week.event ? ` · ${ctx.week.event}` : ''}`);
out.push(`Source : ${ds.meta.source?.type === 'fake' ? 'données factices' : ds.meta.source?.type}`);
out.push('');
out.push('Ventes');
out.push(line('CA net HT', cur.net, prev?.net, ly?.net));
out.push(`  ${'Objectif semaine'.padEnd(30)} ${String(f.eur(cur.budget)).padStart(14)}   écart ${cur.budget ? f.delta(pct(cur.net, cur.budget)) : '–'}`);
out.push(line('Commandes', cur.orders, prev?.orders, ly?.orders, f.int));
out.push(line('Panier moyen HT', cur.aov, prev?.aov, ly?.aov, f.eur2));
out.push(line('Sessions', cur.sessions, prev?.sessions, ly?.sessions, f.int));
out.push(line('Taux de conversion', cur.conversion, prev?.conversion, ly?.conversion, (x) => f.pct(x, 2), 'pts'));
out.push(line('Taux de retour', cur.returnRate, prev?.returnRate, ly?.returnRate, f.pct, 'pts'));
out.push(line('Remise moyenne', cur.discountRate, prev?.discountRate, ly?.discountRate, f.pct, 'pts'));
out.push('');
out.push('Rentabilité');
out.push(line('Marge brute', cur.grossMargin, prev?.grossMargin, ly?.grossMargin));
out.push(line('Taux de marge brute', cur.gmRate, prev?.gmRate, ly?.gmRate, f.pct, 'pts'));
out.push(line('Marketing', cur.marketing, prev?.marketing, ly?.marketing));
out.push(line('MER (CA net / marketing)', cur.mer, prev?.mer, ly?.mer, f.dec1));
out.push(line("Résultat d'exploitation", cur.ebit, prev?.ebit, ly?.ebit));
out.push(line("Marge d'exploitation", cur.ebitRate, prev?.ebitRate, ly?.ebitRate, f.pct, 'pts'));
out.push('');
out.push(`Cumul ${ctx.week.year} : CA net ${f.eur(ytd.net)} (${ytd.budget ? f.delta(pct(ytd.net, ytd.budget)) : '–'} vs objectif, ${ytdLy ? f.delta(pct(ytd.net, ytdLy.net)) : '–'} vs N-1) · résultat ${f.eur(ytd.ebit)} (${f.pct(ytd.ebitRate)})`);
if (ctx.annualBudget) out.push(`Objectif annuel ${f.eur(ctx.annualBudget)} : ${f.pct(ytd.net / ctx.annualBudget)} atteint`);
out.push('');
out.push('Catégories (CA net, vs N-1, marge, retours)');
for (const c of ctx.categories) out.push(`  ${c.name.padEnd(22)} ${f.eur(c.net).padStart(10)}  ${f.delta(c.vsLy).padStart(9)}  marge ${f.pct(c.gmRate)}  retours ${f.pct(c.returnRate)}`);
out.push('');
out.push('Canaux (sessions, commandes, CA, ROAS)');
for (const ch of ctx.channels) out.push(`  ${ch.name.padEnd(28)} ${f.int(ch.sessions).padStart(7)}  ${f.int(ch.orders).padStart(5)}  ${f.eur(ch.revenue).padStart(10)}  ${ch.roas ? `${f.dec1(ch.roas)}×` : '–'}`);
out.push('');
out.push('Top 5 produits');
ctx.products.slice(0, 5).forEach((p, i) => out.push(`  ${i + 1}. ${p.name} (${p.category}) — ${f.int(p.units)} u. · ${f.eur(p.revenue)}`));
out.push('');
out.push('Faits marquants automatiques');
for (const it of ctx.insights) out.push(`  [${it.level}] ${it.text}`);
console.log(out.join('\n'));

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) o[key] = true;
      else { o[key] = next; i++; }
    }
  }
  return o;
}
function fail(msg) { console.error(`✖ ${msg}`); process.exit(1); }
