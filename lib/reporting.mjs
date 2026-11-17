// Chargement du rapport servi par l'app Next.js.
// La source est configurable par variables d'environnement (Vercel > Settings > Environment Variables) :
//   REPORTING_DATASET  chemin du dataset.json (défaut : l'exemple démo, données factices)
//   REPORTING_NOTES    chemin du fichier d'analyses (défaut : l'analyse démo de la semaine 45)
//   REPORTING_WEEK     semaine affichée par défaut (défaut : la dernière du dataset)
// Plus tard, un connecteur réel (Shopify, WooCommerce…) produira le même dataset.json.

import fs from 'node:fs';
import path from 'node:path';
import { renderDashboard } from '../ecommerce-reporting/scripts/lib/render.mjs';

const ROOT = process.cwd();
export const SKILL_DIR = path.join(ROOT, 'ecommerce-reporting');
const DEFAULT_DATASET = 'ecommerce-reporting/examples/demo-mode/dataset.json';
const DEFAULT_NOTES = 'ecommerce-reporting/examples/demo-mode/notes-2026-W45.json';

export function loadDataset() {
  // Chemin choisi par variable d'environnement : les fichiers nécessaires sont déclarés
  // dans next.config.mjs (outputFileTracingIncludes), inutile de tracer tout le projet.
  const file = path.resolve(/*turbopackIgnore: true*/ ROOT, process.env.REPORTING_DATASET || DEFAULT_DATASET);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadNotes() {
  const file = path.resolve(/*turbopackIgnore: true*/ ROOT, process.env.REPORTING_NOTES || DEFAULT_NOTES);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

/** Une URL par section du dashboard. */
export const PAGES = {
  overview: '/',
  mix: '/repartition',
  profit: '/rentabilite',
  sales: '/ventes',
  acquisition: '/acquisition',
  customers: '/clients',
};

/** Section correspondant à un segment d'URL (« repartition » → « mix »), ou null. */
export function sectionFromSlug(slug) {
  const entry = Object.entries(PAGES).find(([, url]) => url === `/${slug}`);
  return entry ? entry[0] : null;
}

/** HTML d'une section (mode multi-pages), ou du dashboard complet si `page` est absent. */
export function renderReport(page) {
  return renderDashboard({
    dataset: loadDataset(),
    notes: loadNotes(),
    week: process.env.REPORTING_WEEK || undefined,
    skillDir: SKILL_DIR,
    page,
    pages: page ? PAGES : undefined,
  });
}

export function htmlResponse(html) {
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
