#!/usr/bin/env node
// Construit le dashboard HTML autonome (un seul fichier, sans dépendance) à partir d'un dataset.json.
//
// Usage :
//   node scripts/build-report.mjs --dataset <chemin/dataset.json> [--week 2026-W45] [--notes notes.json] [--out rapport.html]
//
// --notes : fichier JSON optionnel contenant l'analyse rédigée (par Claude ou un humain) :
//   [{ "week": "2026-W45", "title": "Analyse de la semaine", "author": "…", "date": "2026-11-12", "body": "Texte, listes « - », **gras**" }]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext } from './lib/metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
if (!args.dataset) fail('Option --dataset requise (chemin vers dataset.json)');

const datasetPath = path.resolve(args.dataset);
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
validate(dataset);

const week = args.week || dataset.weeks[dataset.weeks.length - 1].id;
let ctx;
try { ctx = buildContext(dataset, week); } catch (e) { fail(e.message); }

let notes = [];
if (args.notes) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(args.notes), 'utf8'));
  notes = Array.isArray(raw) ? raw : [raw];
  for (const n of notes) if (!n.week) n.week = week;
}

const template = fs.readFileSync(path.join(here, '..', 'templates', 'dashboard.html'), 'utf8');
const metricsSrc = fs.readFileSync(path.join(here, 'lib', 'metrics.mjs'), 'utf8').replace(/^export\s+/gm, '');

const payload = JSON.stringify({ dataset, notes, defaultWeek: week, generatedAt: new Date().toISOString() })
  .replace(/</g, String.fromCharCode(92) + 'u003c'); // empêche une chaîne « </script> » de fermer la balise

const title = `${dataset.meta.shop.name} · Reporting S${ctx.week.week} ${ctx.week.year}`;
const html = template
  .replace('__TITLE__', () => escapeHtml(title))
  .replace('/*__METRICS_LIB__*/', () => metricsSrc)
  .replace('__REPORT_DATA__', () => payload);

const outFile = path.resolve(args.out || path.join(path.dirname(datasetPath), `dashboard-${week}.html`));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`✔ Dashboard écrit : ${outFile} (${kb} Ko)`);
console.log(`  Semaine affichée par défaut : ${week} (${ctx.week.start} → ${ctx.week.end})${notes.length ? ` · ${notes.length} note(s) d'analyse` : ''}`);

// ---------------------------------------------------------------------------
function validate(ds) {
  const errs = [];
  if (!ds.meta?.shop?.name) errs.push('meta.shop.name manquant');
  if (!Array.isArray(ds.weeks) || !ds.weeks.length) errs.push('weeks[] vide ou absent');
  for (const w of ds.weeks || []) {
    for (const k of ['id', 'year', 'week', 'start', 'end', 'traffic', 'sales', 'costs']) if (w[k] == null) errs.push(`${w.id || '?'} : champ "${k}" manquant`);
    if (errs.length > 10) break;
  }
  if (errs.length) fail(`Dataset invalide (voir references/data-schema.md) :\n  - ${errs.join('\n  - ')}`);
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

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
