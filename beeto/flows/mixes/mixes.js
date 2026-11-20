import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractId } from '../../helpers/http.js';

/**
 * Mixes Endpoints:
 * - GET /mixes/ingredients
 * - POST /mixes (authenticated)
 * - GET /mixes (authenticated)
 *
 * @param {string|null} token
 * @returns {{ mixId: string|number|null }}
 */
export function runMixesFlow(token) {
  let mixId = null;

  group('Mixes: Ingredients, Create & List', () => {
    apiRequest(
      'GET',
      `${API_PREFIX}/mixes/ingredients`,
      null,
      token,
      'mixes_ingredients'
    );

    const createRes = apiRequest(
      'POST',
      `${API_PREFIX}/mixes`,
      {
        name: 'جركن صابون خلطتك الخاصة',
        volume_id: '3',
        use_type_id: '15',
        scent_id: '7',
        quantity: 1,
      },
      token,
      'mixes_create'
    );

    mixId = extractId(createRes);

    const listRes = apiRequest(
      'GET',
      `${API_PREFIX}/mixes`,
      null,
      token,
      'mixes_list'
    );

    if (!mixId) {
      mixId = extractId(listRes);
    }
  });

  return { mixId };
}
