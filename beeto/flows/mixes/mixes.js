import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractId, parseJson } from '../../helpers/http.js';

/**
 * Extract first available ingredient IDs from GET /mixes/ingredients response.
 * @param {import('k6/http').RefinedResponse} res
 * @returns {{ volume_id: string|number, use_type_id: string|number, scent_id: string|number }}
 */
function pickIngredientIds(res) {
  const body = parseJson(res);
  const data = body?.data || body || {};
  const volumes = data.volumes || data.sizes || [];
  const useTypes = data.use_types || data.useTypes || data.types || [];
  const scents = data.scents || data.fragrances || [];

  return {
    volume_id: String(volumes[0]?.id ?? '3'),
    use_type_id: String(useTypes[0]?.id ?? '15'),
    scent_id: String(scents[0]?.id ?? '7'),
  };
}

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
    const ingRes = apiRequest(
      'GET',
      `${API_PREFIX}/mixes/ingredients`,
      null,
      token,
      'mixes_ingredients'
    );

    const { volume_id, use_type_id, scent_id } = pickIngredientIds(ingRes);

    const createRes = apiRequest(
      'POST',
      `${API_PREFIX}/mixes`,
      {
        name: 'جركن صابون خلطتك الخاصة',
        volume_id,
        use_type_id,
        scent_id,
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
