#!/usr/bin/env node
// Génère un dataset hebdomadaire FACTICE (dataset.json) à partir d'un profil boutique.
// Le dataset suit le schéma décrit dans references/data-schema.md : un vrai connecteur
// (Shopify, WooCommerce, PrestaShop…) devra produire exactement la même structure.
//
// Usage :
//   node scripts/generate-fake-data.mjs --profile profiles/demo-mode.json [--out <dossier>] [--to 2026-W45]

import fs from 'node:fs';
import path from 'node:path';
import { generateDataset } from './lib/fake-generator.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.profile) fail('Option --profile requise (ex. --profile profiles/demo-mode.json)');

const profilePath = path.resolve(args.profile);
const P = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
if (!P.fake) fail(`Le profil ${profilePath} n'a pas de section "fake" : impossible de générer des données factices.`);
const outDir = path.resolve(args.out || path.join(process.cwd(), 'reporting-output', P.slug));

const { dataset, fixedScale } = generateDataset(P, { to: args.to, from: args.from });
const finalWeeks = dataset.weeks;

fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'dataset.json');
fs.writeFileSync(outFile, JSON.stringify(dataset, null, 1));

// Résumé console pour vérifier le calibrage
const last52 = finalWeeks.slice(-52);
const n = sum(last52, (w) => w.sales.net_ht);
const gm = sum(last52, (w) => w.sales.net_ht - w.costs.cogs);
const ebit = sum(last52, (w) => w.sales.net_ht - variableCosts(w) - sumObj(w.costs.fixed) - w.costs.depreciation);
const orders = sum(last52, (w) => w.sales.orders);
const eur = (x) => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(x);
console.log(`✔ Dataset factice écrit : ${outFile}`);
console.log(`  ${finalWeeks.length} semaines (${dataset.meta.period.from} → ${dataset.meta.period.to})`);
console.log(`  52 dernières semaines : CA net HT ${eur(n)} · marge brute ${(gm / n * 100).toFixed(1)} % · résultat d'exploitation ${eur(ebit)} (${(ebit / n * 100).toFixed(1)} %) · ${orders} commandes`);
console.log(`  Frais fixes calibrés ×${fixedScale.toFixed(2)}`);

function variableCosts(w) {
  return w.costs.cogs + w.costs.shipping + w.costs.packaging + w.costs.payment_fees + sumObj(w.costs.marketing);
}
function sum(list, f) { return list.reduce((a, x) => a + f(x), 0); }
function sumObj(o) { return Object.values(o).reduce((a, b) => a + b, 0); }

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

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}
