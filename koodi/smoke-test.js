import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, PUBLIC_ENDPOINTS } from './config.js';
import { recordMetrics } from './metrics.js';
import { discoverCatalogData } from './helpers/catalog.js';
import { runCartFlow } from './flows/cart/cart.js';
import { runCheckoutFlow } from './flows/checkout/checkout.js';

export const options = {
  vus: 1,
  iterations: 2,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    koodi_success_rate: ['rate>0.95'],
    koodi_cart_success_rate: ['rate>0.95'],
    koodi_checkout_success_rate: ['rate>0.95'],
  },
};

export function setup() {
  return discoverCatalogData();
}

export default function (data) {
  for (const endpoint of PUBLIC_ENDPOINTS) {
    const res = http.get(`${BASE_URL}${endpoint.path}`, {
      tags: { endpoint: endpoint.name, flow: 'smoke_public' },
    });

    const passed = check(res, {
      'status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
    });

    recordMetrics(res, endpoint.name, passed);
    sleep(0.2);
  }

  // Verify 1 complete cart cycle and 1 complete checkout cycle cleanly
  runCartFlow(data, { skipSleep: true });
  runCheckoutFlow(data, { skipSleep: true });
}
