// Une page par section : /repartition, /rentabilite, /ventes, /acquisition, /clients.
// Toutes générées au build ; toute autre adresse renvoie une 404.
import { PAGES, renderReport, sectionFromSlug, htmlResponse } from '../../lib/reporting.mjs';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(PAGES)
    .filter((url) => url !== '/')
    .map((url) => ({ section: url.slice(1) }));
}

export async function GET(_request, { params }) {
  const { section: slug } = await params;
  const section = sectionFromSlug(slug);
  if (!section) return new Response('Page introuvable', { status: 404 });
  return htmlResponse(renderReport(section).html);
}
