import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractId } from '../../helpers/http.js';

/**
 * Public Market Endpoints (no auth required):
 * - GET /market/home
 * - GET /market/products
 *
 * @returns {{ productId: string|number|null }}
 */
export function runPublicFlow() {
  let productId = null;

  group('Public: Market Endpoints', () => {
    apiRequest('GET', `${API_PREFIX}/market/home`, null, null, 'public_home');

    const productsRes = apiRequest(
      'GET',
      `${API_PREFIX}/market/products`,
      null,
      null,
      'public_products'
    );

    productId = extractId(productsRes);
  });

  return { productId };
}

export default function () {
  runPublicFlow();
}
