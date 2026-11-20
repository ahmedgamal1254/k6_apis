import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractId } from '../../helpers/http.js';

/**
 * Public Market & Lookup Endpoints (no auth required):
 * - GET /market/home
 * - GET /market/categories
 * - GET /market/brands
 * - GET /market/products
 * - GET /governorates
 * - GET /cities
 * - GET /config
 *
 * @returns {{ productId: string|number|null, governorateId: string|number|null, cityId: string|number|null }}
 */
export function runPublicFlow() {
  let productId = null;
  let governorateId = null;
  let cityId = null;

  group('Public: Market & Lookup Endpoints', () => {
    apiRequest('GET', `${API_PREFIX}/market/home`, null, null, 'public_home');
    apiRequest('GET', `${API_PREFIX}/market/categories`, null, null, 'public_categories');
    apiRequest('GET', `${API_PREFIX}/market/brands`, null, null, 'public_brands');

    const productsRes = apiRequest(
      'GET',
      `${API_PREFIX}/market/products`,
      null,
      null,
      'public_products'
    );
    productId = extractId(productsRes);

    const govRes = apiRequest('GET', `${API_PREFIX}/governorates`, null, null, 'public_governorates');
    governorateId = extractId(govRes);

    const cityRes = apiRequest('GET', `${API_PREFIX}/cities`, null, null, 'public_cities');
    cityId = extractId(cityRes);

    apiRequest('GET', `${API_PREFIX}/config`, null, null, 'public_config');
  });

  return { productId, governorateId, cityId };
}

export default function () {
  runPublicFlow();
}
