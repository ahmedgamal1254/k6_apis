import { sleep } from 'k6';
import {
  ALL_ENDPOINTS,
  ASYNC_CART_VUS,
  ASYNC_CHECKOUT_VUS,
  ASYNC_MODE,
  BASE_URL,
  CHECKOUT_DURATION,
  DRY_RUN_CHECKOUT,
  ORDER_PERCENTAGE,
  THRESHOLDS,
  TOTAL_VUS,
} from './config.js';
import { discoverCatalogData } from './helpers/catalog.js';
import { buildCsvReport, buildDetailedSummary } from './helpers/summary.js';
import { runCartFlow } from './flows/cart/cart.js';
import { runCheckoutFlow } from './flows/checkout/checkout.js';

export const options = {
  scenarios: {
    // 50% of VUs making orders asynchronously
    checkout_orders: {
      executor: 'constant-vus',
      exec: 'runCheckoutScenario',
      vus: ASYNC_CHECKOUT_VUS, // 13 VUs (~50%)
      duration: CHECKOUT_DURATION,
      gracefulStop: '15s',
    },
    // 50% of VUs performing cart operations asynchronously
    cart_shoppers: {
      executor: 'constant-vus',
      exec: 'runCartScenario',
      vus: ASYNC_CART_VUS, // 12 VUs (~50%)
      duration: CHECKOUT_DURATION,
      gracefulStop: '15s',
    },
  },
  thresholds: {
    http_req_failed: THRESHOLDS.http_req_failed,
    koodi_success_rate: THRESHOLDS.koodi_success_rate,
    'http_req_duration{scenario:checkout_orders}': ['p(95)<2500'],
    'http_req_duration{scenario:cart_shoppers}': ['p(95)<1500'],
    koodi_checkout_success_rate: THRESHOLDS.koodi_checkout_success_rate,
    koodi_cart_success_rate: THRESHOLDS.koodi_cart_success_rate,
  },
  noCookiesReset: false,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

export function setup() {
  console.log(
    `[k6 checkout-test] BASE_URL=${BASE_URL} | Total VUs=${TOTAL_VUS} (Async) | Checkout VUs=${ASYNC_CHECKOUT_VUS} (~${ORDER_PERCENTAGE}%) | Cart VUs=${ASYNC_CART_VUS} | Duration=${CHECKOUT_DURATION} | DRY_RUN_CHECKOUT=${DRY_RUN_CHECKOUT}`
  );
  return discoverCatalogData();
}

export function runCheckoutScenario(data) {
  runCheckoutFlow(data, { skipSleep: ASYNC_MODE });
  if (ASYNC_MODE) sleep(0.1);
}

export function runCartScenario(data) {
  runCartFlow(data, { skipSleep: ASYNC_MODE });
  if (ASYNC_MODE) sleep(0.1);
}

export function handleSummary(data) {
  const summaryFiles = [
    'koodi-checkout-summary.json',
    'koodi-checkout-report.csv',
  ];

  return {
    'koodi-checkout-summary.json': JSON.stringify(data, null, 2),
    'koodi-checkout-report.csv': buildCsvReport(data, ALL_ENDPOINTS),
    stdout: buildDetailedSummary(data, ALL_ENDPOINTS, {
      title: `Koodi k6 Async Load Test (Total: ${TOTAL_VUS} VUs | Orders: ${ASYNC_CHECKOUT_VUS} [50%] | Cart: ${ASYNC_CART_VUS} [50%])`,
      savedFiles: summaryFiles,
    }),
  };
}
