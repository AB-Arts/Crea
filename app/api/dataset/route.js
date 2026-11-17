// Données brutes du dashboard (même dataset.json), pour un export ou une intégration.
import { loadDataset } from '../../../lib/reporting.mjs';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(loadDataset());
}
