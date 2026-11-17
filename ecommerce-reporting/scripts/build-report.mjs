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
import { renderDashboard } from './lib/render.mjs';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
if (!args.dataset) fail('Option --dataset requise (chemin vers dataset.json)');

const datasetPath = path.resolve(args.dataset);
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const notes = args.notes ? JSON.parse(fs.readFileSync(path.resolve(args.notes), 'utf8')) : [];

let result;
try {
  result = renderDashboard({ dataset, notes, week: args.week, skillDir });
} catch (e) {
  fail(e.message);
}
const { html, week } = result;

const outFile = path.resolve(args.out || path.join(path.dirname(datasetPath), `dashboard-${week.id}.html`));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`✔ Dashboard écrit : ${outFile} (${kb} Ko)`);
console.log(`  Semaine affichée par défaut : ${week.id} (${week.start} → ${week.end})${result.notes.length ? ` · ${result.notes.length} note(s) d'analyse` : ''}`);

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
