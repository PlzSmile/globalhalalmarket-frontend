import { Market, ProductCompliance } from '../../core/models/compliance';

/**
 * SAMPLE data for the UI preview only. Replaced by GET /api/v1/compliance in the tracker milestone.
 */
export const SAMPLE_MARKETS: readonly Market[] = [
  { slug: 'indonesia', name: 'Indonesia', authority: 'BPJPH', flag: '🇮🇩' },
  { slug: 'malaysia', name: 'Malaysia', authority: 'JAKIM', flag: '🇲🇾' },
  { slug: 'uae', name: 'UAE', authority: 'MoIAT', flag: '🇦🇪' },
];

export const SAMPLE_PRODUCTS: readonly ProductCompliance[] = [
  {
    id: 1, name: 'Chicken sausage 500g', sku: 'CS-500',
    cells: [
      { market: 'indonesia', status: 'red', reason: 'Gelatin: certifier not recognised by BPJPH' },
      { market: 'malaysia', status: 'green', reason: null },
      { market: 'uae', status: 'green', reason: null },
    ],
  },
  {
    id: 2, name: 'Beef burger 4-pack', sku: 'BB-4',
    cells: [
      { market: 'indonesia', status: 'amber', reason: 'Spice mix: certificate expires in 20 days' },
      { market: 'malaysia', status: 'green', reason: null },
      { market: 'uae', status: 'amber', reason: 'Spice mix: certificate expires in 20 days' },
    ],
  },
  {
    id: 3, name: 'Vegetable samosa 12', sku: 'VS-12',
    cells: [
      { market: 'indonesia', status: 'green', reason: null },
      { market: 'malaysia', status: 'green', reason: null },
      { market: 'uae', status: 'green', reason: null },
    ],
  },
];
