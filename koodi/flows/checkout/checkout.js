import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  BASE_URL,
  DEBUG,
  DRY_RUN_CHECKOUT,
  GOVERNORATES,
} from '../../config.js';
import {
  apiRequest,
  buildHeaders,
  parseJson,
  pickLanguage,
  randomIntBetween,
  randomItem,
} from '../../helpers/http.js';
import {
  koodiCheckoutSuccessRate,
  koodiOrdersCreated,
  koodiOutOfStockCount,
  recordMetrics,
} from '../../metrics.js';
import { clearCustomerSession, ensureCustomerSession } from '../auth/session.js';

/**
 * End-to-End Checkout flow (default 15 peak VUs = 10% of 150 VUs):
 * View product -> Clear cart -> Add item -> Get cart -> Calculate checkout -> Place COD order -> Inspect order.
 */
export function runCheckoutFlow(data, opts = {}) {
  const { skipSleep = false } = opts;
  const variant = randomItem(data?.inStockVariants);
  if (!variant) {
    koodiCheckoutSuccessRate.add(false);
    if (!skipSleep) sleep(3);
    return;
  }

  const session = ensureCustomerSession('checkout');
  if (!session) {
    koodiCheckoutSuccessRate.add(false);
    if (!skipSleep) sleep(3);
    return;
  }

  const lang = pickLanguage();
  const governorate = randomItem(GOVERNORATES) || 'baghdad';
  let flowOk = true;

  group('Checkout: Cart, Calculate, Submit COD Order & Verify', () => {
    // 1. Inspect product details
    const detailCall = apiRequest(
      'GET',
      `/api/v1/products/${variant.productId}`,
      null,
      session.token,
      'product_details',
      { lang, flow: 'checkout', expectedStatuses: [200] }
    );
    if (!detailCall.passed) flowOk = false;

    if (!skipSleep) sleep(randomIntBetween(1, 2));

    // 2. Ensure a clean single-item cart before checkout
    apiRequest('DELETE', '/api/v1/cart', null, session.token, 'cart_clear', {
      lang,
      flow: 'checkout',
      expectedStatuses: [200],
    });

    // 3. Add item to cart
    const addRes = http.post(
      `${BASE_URL}/api/v1/cart/items`,
      JSON.stringify({
        productVariantId: variant.productVariantId,
        quantity: 1,
      }),
      {
        headers: buildHeaders(session.token, lang),
        tags: { endpoint: 'cart_add', flow: 'checkout', auth: 'bearer' },
      }
    );

    if (addRes.status === 401) {
      clearCustomerSession();
      recordMetrics(addRes, 'cart_add', false);
      flowOk = false;
      return;
    }

    const addOutOfStock =
      (addRes.status === 400 || addRes.status === 409) &&
      typeof addRes.body === 'string' &&
      addRes.body.toLowerCase().includes('stock');

    if (addOutOfStock) {
      koodiOutOfStockCount.add(1);
      const handled = check(addRes, {
        'checkout cart_add: out-of-stock non-5xx': (r) => r.status < 500,
      });
      recordMetrics(addRes, 'cart_add', handled);
      return;
    }

    const addBody = parseJson(addRes);
    const addOk = check(addRes, {
      'checkout cart_add: status 200': (r) => r.status === 200,
      'checkout cart_add: ApiResponse status=true': () =>
        addBody !== null && addBody.status === true,
    });
    recordMetrics(addRes, 'cart_add', addOk);
    if (!addOk) {
      flowOk = false;
      return;
    }

    if (!skipSleep) sleep(randomIntBetween(1, 2));

    // 4. Fetch cart
    const getCall = apiRequest('GET', '/api/v1/cart', null, session.token, 'cart_get', {
      lang,
      flow: 'checkout',
      expectedStatuses: [200],
    });
    if (!getCall.passed) flowOk = false;

    if (!skipSleep) sleep(randomIntBetween(2, 4));

    // 5. Calculate checkout price & shipping fee
    const calcCall = apiRequest(
      'POST',
      '/api/v1/orders/checkout/calculate',
      { governorate },
      session.token,
      'checkout_calculate',
      { lang, flow: 'checkout', expectedStatuses: [200] }
    );
    if (!calcCall.passed) flowOk = false;

    if (DRY_RUN_CHECKOUT) {
      apiRequest('DELETE', '/api/v1/cart', null, session.token, 'cart_clear', {
        lang,
        flow: 'checkout',
        expectedStatuses: [200],
      });
      return;
    }

    if (!skipSleep) sleep(randomIntBetween(2, 5));

    // 6. Place COD order
    const orderPayload = {
      customerName: session.fullName,
      customerPhone: session.phoneNumber,
      governorate,
      shippingAddress: 'Karrada Outer St, Building 12, Load Test Delivery',
      paymentMethod: 'cod',
    };

    const createRes = http.post(
      `${BASE_URL}/api/v1/orders/checkout`,
      JSON.stringify(orderPayload),
      {
        headers: buildHeaders(session.token, lang),
        tags: { endpoint: 'checkout_create', flow: 'checkout', auth: 'bearer' },
      }
    );

    const createBody = parseJson(createRes);
    const errorCode = String(createBody?.errorCode || '').toUpperCase();
    const bodyLower =
      typeof createRes.body === 'string' ? createRes.body.toLowerCase() : '';
    const isOutOfStockConflict =
      (createRes.status === 400 || createRes.status === 409) &&
      (errorCode.includes('STOCK') ||
        bodyLower.includes('stock') ||
        bodyLower.includes('مخزون'));

    if (isOutOfStockConflict) {
      koodiOutOfStockCount.add(1);
      const handled = check(createRes, {
        'checkout_create: out-of-stock non-5xx': (r) => r.status < 500,
      });
      recordMetrics(createRes, 'checkout_create', handled);
      return;
    }

    const createdOrderId = createBody?.data?.orderId || createBody?.data?.id || null;
    const createOk = check(createRes, {
      'checkout_create: status 201': (r) => r.status === 201,
      'checkout_create: ApiResponse status=true': () =>
        createBody !== null && createBody.status === true,
      'checkout_create: returned orderId': () => Boolean(createdOrderId),
    });

    if (DEBUG && !createOk) {
      console.error(
        `[FAIL] POST /api/v1/orders/checkout -> ${createRes.status}: ${String(createRes.body).slice(0, 400)}`
      );
    }

    recordMetrics(createRes, 'checkout_create', createOk);

    if (createOk && createdOrderId) {
      koodiOrdersCreated.add(1);

      if (!skipSleep) sleep(randomIntBetween(1, 2));

      // 7. Inspect created order confirmation
      const detailsCall = apiRequest(
        'GET',
        `/api/v1/orders/${createdOrderId}`,
        null,
        session.token,
        'order_details',
        { lang, flow: 'checkout', expectedStatuses: [200] }
      );
      if (!detailsCall.passed) flowOk = false;
    } else {
      flowOk = false;
    }
  });

  koodiCheckoutSuccessRate.add(flowOk);
  if (!skipSleep) sleep(randomIntBetween(2, 5));
}
