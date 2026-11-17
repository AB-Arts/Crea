// « / » : vue d'ensemble du dashboard, générée au build (page statique sur Vercel).
import { renderReport, htmlResponse } from '../lib/reporting.mjs';

export const dynamic = 'force-static';

export function GET() {
  return htmlResponse(renderReport('overview').html);
}
