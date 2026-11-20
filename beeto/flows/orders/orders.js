import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractId } from '../../helpers/http.js';

/**
 * Orders Endpoints (under /store/orders):
 * - POST /store/orders/calculate-shipping
 * - POST /store/orders (checkout / make order)
 * - GET /store/orders (list orders)
 * - GET /store/orders/{id} (show single order)
 *
 * @param {string|null} token
 * @param {string|number|null} [addressId]
 * @returns {{ orderId: string|number|null }}
 */
export function runOrdersFlow(token, addressId = 1) {
  let orderId = null;

  group('Orders: Calculate Shipping, Create, List & Show', () => {
    apiRequest(
      'POST',
      `${API_PREFIX}/store/orders/calculate-shipping`,
      {
        address_id: addressId || 1,
      },
      token,
      'orders_calculate_shipping'
    );

    const createRes = apiRequest(
      'POST',
      `${API_PREFIX}/store/orders`,
      {
        address_id: addressId || 1,
        payment_method: 'cod',
      },
      token,
      'orders_create'
    );

    orderId = extractId(createRes);

    const listRes = apiRequest(
      'GET',
      `${API_PREFIX}/store/orders`,
      null,
      token,
      'orders_list'
    );

    const showOrderId = extractId(listRes) || orderId;

    if (showOrderId) {
      apiRequest(
        'GET',
        `${API_PREFIX}/store/orders/${showOrderId}`,
        null,
        token,
        'orders_show'
      );
    }
  });

  return { orderId };
}
