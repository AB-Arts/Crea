// Page d'accueil : le dashboard HTML autonome, généré au moment du build (page statique sur Vercel).
import { renderReport } from '../lib/reporting.mjs';

export const dynamic = 'force-static';

export function GET() {
  const { html } = renderReport();
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
