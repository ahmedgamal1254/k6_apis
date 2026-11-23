import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, DEBUG } from '../../config.js';
import {
  apiRequest,
  buildHeaders,
  parseJson,
  pickLanguage,
  randomIntBetween,
  randomItem,
} from '../../helpers/http.js';
import {
  koodiCartSuccessRate,
  koodiOutOfStockCount,
  recordMetrics,
} from '../../metrics.js';
import { clearCustomerSession, ensureCustomerSession } from '../auth/session.js';

/**
 * Stateful Cart flow:
 * GET product details -> POST /cart/items -> GET /cart -> PUT /cart/items/{id} -> DELETE /cart/items/{id}
 */
export function runCartFlow(data, opts = {}) {
  const { skipSleep = false } = opts;
  const variant = randomItem(data?.inStockVariants);
  if (!variant) {
    koodiCartSuccessRate.add(false);
    if (!skipSleep) sleep(2);
    return;
  }

  const session = ensureCustomerSession('cart');
  if (!session) {
    koodiCartSuccessRate.add(false);
    if (!skipSleep) sleep(2);
    return;
  }

  const lang = pickLanguage();
  let flowOk = true;

  group('Cart: Browse, Add, Read, Update & Remove', () => {
    // 1. Inspect product details
    const detailCall = apiRequest(
      'GET',
      `/api/v1/products/${variant.productId}`,
      null,
      session.token,
      'product_details',
      { lang, flow: 'cart', expectedStatuses: [200] }
    );
    if (!detailCall.passed) flowOk = false;

    if (!skipSleep) sleep(randomIntBetween(1, 2));

    // 2. Add variant to cart
    const addRes = http.post(
      `${BASE_URL}/api/v1/cart/items`,
      JSON.stringify({
        productVariantId: variant.productVariantId,
        quantity: 1,
      }),
      {
        headers: buildHeaders(session.token, lang),
        tags: { endpoint: 'cart_add', flow: 'cart', auth: 'bearer' },
      }
    );

    if (addRes.status === 401) {
      clearCustomerSession();
      recordMetrics(addRes, 'cart_add', false);
      flowOk = false;
      return;
    }

    const addBody = parseJson(addRes);
    const isOutOfStock =
      (addRes.status === 400 || addRes.status === 409) &&
      typeof addRes.body === 'string' &&
      addRes.body.toLowerCase().includes('stock');

    if (isOutOfStock) {
      koodiOutOfStockCount.add(1);
      const handled = check(addRes, {
        'cart_add: out-of-stock non-5xx': (r) => r.status < 500,
      });
      recordMetrics(addRes, 'cart_add', handled);
      return;
    }

    const addOk = check(addRes, {
      'cart_add: status 200': (r) => r.status === 200,
      'cart_add: ApiResponse status=true': () =>
        addBody !== null && addBody.status === true,
    });
    if (DEBUG && !addOk) {
      console.error(
        `[FAIL] POST /api/v1/cart/items -> ${addRes.status}: ${String(addRes.body).slice(0, 400)}`
      );
    }
    recordMetrics(addRes, 'cart_add', addOk);
    if (!addOk) flowOk = false;

    if (!skipSleep) sleep(randomIntBetween(1, 2));

    // 3. Get cart
    const getCall = apiRequest('GET', '/api/v1/cart', null, session.token, 'cart_get', {
      lang,
      flow: 'cart',
      expectedStatuses: [200],
    });
    if (!getCall.passed) flowOk = false;

    const cartData = getCall.body?.data || addBody?.data;
    const items = Array.isArray(cartData?.items) ? cartData.items : [];
    const matchedItem =
      items.find((it) => it?.variant?.id === variant.productVariantId) || items[0];
    const cartItemId = matchedItem?.id || null;

    if (cartItemId) {
      if (!skipSleep) sleep(randomIntBetween(1, 2));

      // 4. Update item quantity
      const updateCall = apiRequest(
        'PUT',
        `/api/v1/cart/items/${cartItemId}`,
        { quantity: 2 },
        session.token,
        'cart_update',
        { lang, flow: 'cart', expectedStatuses: [200] }
      );
      if (!updateCall.passed) flowOk = false;

      if (!skipSleep) sleep(randomIntBetween(1, 2));

      // 5. Remove item to keep test cart clean
      const delCall = apiRequest(
        'DELETE',
        `/api/v1/cart/items/${cartItemId}`,
        null,
        session.token,
        'cart_delete',
        { lang, flow: 'cart', expectedStatuses: [200] }
      );
      if (!delCall.passed) flowOk = false;
    } else {
      apiRequest('DELETE', '/api/v1/cart', null, session.token, 'cart_clear', {
        lang,
        flow: 'cart',
        expectedStatuses: [200],
      });
    }
  });

  koodiCartSuccessRate.add(flowOk);
  if (!skipSleep) sleep(randomIntBetween(1, 3));
}
