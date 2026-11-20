import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractId } from '../../helpers/http.js';

/**
 * Orders Endpoints:
 * - POST /orders (make order)
 * - GET /orders (list orders)
 * - GET /orders/{id} (show single order)
 *
 * @param {string|null} token
 * @param {string|number|null} [addressId]
 * @returns {{ orderId: string|number|null }}
 */
export function runOrdersFlow(token, addressId = 1) {
  let orderId = null;

  group('Orders: Create, List & Show', () => {
    const createRes = apiRequest(
      'POST',
      `${API_PREFIX}/orders`,
      {
        address_id: addressId || 1,
        payment_method: 'cash',
        notes: `k6 load test VU ${__VU} iter ${__ITER}`,
      },
      token,
      'orders_create'
    );

    orderId = extractId(createRes);

    const listRes = apiRequest(
      'GET',
      `${API_PREFIX}/orders`,
      null,
      token,
      'orders_list'
    );

    if (!orderId) {
      orderId = extractId(listRes);
    }

    if (orderId) {
      apiRequest(
        'GET',
        `${API_PREFIX}/orders/${orderId}`,
        null,
        token,
        'orders_show'
      );
    }
  });

  return { orderId };
}
