// Rendu du dashboard HTML autonome. Utilisé par scripts/build-report.mjs (fichier)
// et par l'app Next.js à la racine du dépôt (route « / »).

import fs from 'node:fs';
import path from 'node:path';
import { buildContext } from './metrics.mjs';

/** Vérifie la structure minimale d'un dataset. Retourne la liste des erreurs (vide si valide). */
export function validateDataset(ds) {
  const errs = [];
  if (!ds?.meta?.shop?.name) errs.push('meta.shop.name manquant');
  if (!Array.isArray(ds?.weeks) || !ds.weeks.length) errs.push('weeks[] vide ou absent');
  for (const w of ds?.weeks || []) {
    for (const k of ['id', 'year', 'week', 'start', 'end', 'traffic', 'sales', 'costs']) if (w[k] == null) errs.push(`${w.id || '?'} : champ "${k}" manquant`);
    if (errs.length > 10) break;
  }
  return errs;
}

/**
 * Construit le HTML du dashboard.
 * @param {object} o
 * @param {object} o.dataset   dataset normalisé (references/data-schema.md)
 * @param {Array}  [o.notes]   analyses rédigées [{ week, title, author, date, body }]
 * @param {string} [o.week]    semaine affichée par défaut (sinon la dernière)
 * @param {string} o.skillDir  chemin absolu du dossier ecommerce-reporting (gabarit, polices, logo)
 * @param {string} [o.page]    section seule à afficher (mode multi-pages) : overview, mix, profit, sales, acquisition, customers.
 *                             Absent = fichier unique avec toutes les sections.
 * @param {object} [o.pages]   URL de chaque section en mode multi-pages, ex. { overview: '/', mix: '/repartition' }
 */
export const SECTIONS = ['overview', 'mix', 'profit', 'sales', 'acquisition', 'customers'];
export const SECTION_LABELS = { overview: "Vue d'ensemble", mix: 'Répartition', profit: 'Rentabilité', sales: 'Ventes', acquisition: 'Acquisition', customers: 'Clients' };

export function renderDashboard({ dataset, notes = [], week, skillDir, page, pages }) {
  if (page && !SECTIONS.includes(page)) throw new Error(`Section inconnue : ${page} (attendu : ${SECTIONS.join(', ')})`);
  const errs = validateDataset(dataset);
  if (errs.length) throw new Error(`Dataset invalide (voir references/data-schema.md) :\n  - ${errs.join('\n  - ')}`);
  const defaultWeek = week || dataset.weeks[dataset.weeks.length - 1].id;
  const ctx = buildContext(dataset, defaultWeek);
  const list = (Array.isArray(notes) ? notes : [notes]).map((n) => ({ ...n, week: n.week || defaultWeek }));

  const read = (...p) => fs.readFileSync(path.join(skillDir, ...p));
  const template = read('templates', 'dashboard.html').toString('utf8');
  const fontsCss = read('assets', 'fonts', 'geist-fontface.css').toString('utf8');
  const logoUri = 'data:image/png;base64,' + read('assets', 'ab-arts-logo.png').toString('base64');
  const metricsSrc = read('scripts', 'lib', 'metrics.mjs').toString('utf8').replace(/^export\s+/gm, '');

  const payload = JSON.stringify({ dataset, notes: list, defaultWeek, generatedAt: new Date().toISOString(), page: page || null, pages: page ? pages || {} : {} })
    .replace(/</g, String.fromCharCode(92) + 'u003c'); // empêche une chaîne « </script> » de fermer la balise

  const title = page
    ? `${dataset.meta.shop.name} · ${SECTION_LABELS[page]} · S${ctx.week.week} ${ctx.week.year}`
    : `${dataset.meta.shop.name} · Reporting S${ctx.week.week} ${ctx.week.year}`;
  const html = template
    .replace('<body>', () => (page ? `<body data-page="${page}">` : '<body>'))
    .replace('__TITLE__', () => escapeHtml(title))
    .replace('/*__FONTS__*/', () => fontsCss)
    .replaceAll('__LOGO_DATA_URI__', () => logoUri)
    .replace('/*__METRICS_LIB__*/', () => metricsSrc)
    .replace('__REPORT_DATA__', () => payload);

  return { html, week: ctx.week, notes: list };
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
