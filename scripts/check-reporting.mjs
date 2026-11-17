#!/usr/bin/env node
// Contrôle avant déploiement : le dataset est valide et le dashboard se génère.
// Usage : npm run check   (lit les mêmes variables d'environnement que l'app)
import { loadDataset, renderReport } from '../lib/reporting.mjs';
import { validateDataset } from '../ecommerce-reporting/scripts/lib/render.mjs';

try {
  const ds = loadDataset();
  const errs = validateDataset(ds);
  if (errs.length) throw new Error(`Dataset invalide :\n  - ${errs.join('\n  - ')}`);
  const { html, week, notes } = renderReport('overview');
  const leftovers = html.match(/__[A-Z_]+__|\/\*__[A-Z_]+__\*\//g);
  if (leftovers) throw new Error(`Marqueurs non remplacés dans le HTML : ${[...new Set(leftovers)].join(', ')}`);
  console.log(`✔ Reporting prêt : ${ds.meta.shop.name} · ${ds.weeks.length} semaines · semaine par défaut ${week.id} · ${notes.length} analyse(s) · ${(html.length / 1024).toFixed(0)} Ko`);
  if (ds.meta.source?.type === 'fake') console.log('  Source : données factices (démo).');
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exit(1);
}
