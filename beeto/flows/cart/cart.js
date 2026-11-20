import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, parseJson } from '../../helpers/http.js';

/**
 * Extract first regular_products cart item ID from GET /cart or POST /cart/add response.
 * @param {import('k6/http').RefinedResponse} res
 * @returns {string|number|null}
 */
function extractCartItemId(res) {
  const body = parseJson(res);
  const regular = body?.data?.regular_products;
  if (Array.isArray(regular) && regular.length > 0) {
    return regular[0]?.id ?? null;
  }
  return body?.data?.id ?? body?.id ?? null;
}

/**
 * Cart Endpoints:
 * - POST /cart/add (add product to cart)
 * - GET /cart (show cart)
 * - PUT /cart/update/{id} (update item quantity)
 * - DELETE /cart/remove/{id} (optional item removal)
 *
 * @param {string|null} token
 * @param {{ productId?: string|number|null, removeAfterUpdate?: boolean }} [opts]
 * @returns {{ cartItemId: string|number|null }}
 */
export function runCartFlow(token, opts = {}) {
  let cartItemId = null;
  const { productId = 1, removeAfterUpdate = false } = opts;

  group('Cart: Add, Show, Update', () => {
    const addRes = apiRequest(
      'POST',
      `${API_PREFIX}/cart/add`,
      {
        product_id: productId || 1,
        quantity: 1,
      },
      token,
      'cart_add'
    );

    cartItemId = extractCartItemId(addRes);

    const showRes = apiRequest(
      'GET',
      `${API_PREFIX}/cart`,
      null,
      token,
      'cart_show'
    );

    if (!cartItemId) {
      cartItemId = extractCartItemId(showRes);
    }

    if (cartItemId) {
      apiRequest(
        'PUT',
        `${API_PREFIX}/cart/update/${cartItemId}`,
        { quantity: 2 },
        token,
        'cart_update'
      );

      if (removeAfterUpdate) {
        apiRequest(
          'DELETE',
          `${API_PREFIX}/cart/remove/${cartItemId}`,
          null,
          token,
          'cart_remove'
        );
      }
    }
  });

  return { cartItemId };
}
