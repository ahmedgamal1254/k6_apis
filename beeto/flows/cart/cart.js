import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractId } from '../../helpers/http.js';

/**
 * Cart Endpoints:
 * - POST /cart (add product or mix)
 * - GET /cart (show cart)
 * - PUT /cart/{id} (update item quantity)
 * - DELETE /cart/{id} (optional item removal)
 *
 * @param {string|null} token
 * @param {{ productId?: string|number|null, mixId?: string|number|null, removeAfterUpdate?: boolean }} [opts]
 * @returns {{ cartItemId: string|number|null }}
 */
export function runCartFlow(token, opts = {}) {
  let cartItemId = null;
  const { productId = 1, mixId = null, removeAfterUpdate = false } = opts;

  group('Cart: Add, Show, Update', () => {
    const addPayload = mixId
      ? { mix_id: mixId, quantity: 1 }
      : { product_id: productId || 1, quantity: 1 };

    const addRes = apiRequest(
      'POST',
      `${API_PREFIX}/cart`,
      addPayload,
      token,
      'cart_add'
    );

    cartItemId = extractId(addRes);

    const showRes = apiRequest(
      'GET',
      `${API_PREFIX}/cart`,
      null,
      token,
      'cart_show'
    );

    if (!cartItemId) {
      cartItemId = extractId(showRes);
    }

    if (cartItemId) {
      apiRequest(
        'PUT',
        `${API_PREFIX}/cart/${cartItemId}`,
        { quantity: 2 },
        token,
        'cart_update'
      );

      if (removeAfterUpdate) {
        apiRequest(
          'DELETE',
          `${API_PREFIX}/cart/${cartItemId}`,
          null,
          token,
          'cart_delete'
        );
      }
    }
  });

  return { cartItemId };
}
