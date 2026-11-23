import {
  ALL_ENDPOINTS,
  BASE_URL,
  CART_LOAD_STAGES,
  CART_VUS,
  CHECKOUT_LOAD_STAGES,
  CHECKOUT_VUS,
  DRY_RUN_CHECKOUT,
  THRESHOLDS,
} from './config.js';
import { discoverCatalogData } from './helpers/catalog.js';
import { buildCsvReport, buildDetailedSummary } from './helpers/summary.js';
import { runCartFlow } from './flows/cart/cart.js';
import { runCheckoutFlow } from './flows/checkout/checkout.js';

const effectiveCartVUs = CART_VUS > 0 ? CART_VUS : 30;
const effectiveCheckoutVUs = CHECKOUT_VUS > 0 ? CHECKOUT_VUS : 15;

function buildCheckoutScenarios() {
  const scenarios = {};

  if (CART_VUS !== 0) {
    scenarios.cart_load = {
      executor: 'ramping-vus',
      exec: 'runCartScenario',
      stages: CART_LOAD_STAGES,
      gracefulRampDown: '20s',
    };
  }

  scenarios.checkout_load = {
    executor: 'ramping-vus',
    exec: 'runCheckoutScenario',
    stages: CHECKOUT_LOAD_STAGES,
    gracefulRampDown: '20s',
  };

  return scenarios;
}

function buildCheckoutThresholds() {
  const active = {
    http_req_failed: THRESHOLDS.http_req_failed,
    koodi_success_rate: THRESHOLDS.koodi_success_rate,
    'http_req_duration{scenario:checkout_load}':
      THRESHOLDS['http_req_duration{scenario:checkout_load}'],
    koodi_checkout_success_rate: THRESHOLDS.koodi_checkout_success_rate,
  };

  if (CART_VUS !== 0) {
    active['http_req_duration{scenario:cart_load}'] =
      THRESHOLDS['http_req_duration{scenario:cart_load}'];
    active.koodi_cart_success_rate = THRESHOLDS.koodi_cart_success_rate;
  }

  return active;
}

export const options = {
  scenarios: buildCheckoutScenarios(),
  thresholds: buildCheckoutThresholds(),
  noCookiesReset: false,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

export function setup() {
  console.log(
    `[k6 checkout-test] BASE_URL=${BASE_URL} | cart=${CART_VUS === 0 ? 0 : effectiveCartVUs} | checkout=${effectiveCheckoutVUs} | DRY_RUN_CHECKOUT=${DRY_RUN_CHECKOUT}`
  );
  return discoverCatalogData();
}

export function runCartScenario(data) {
  runCartFlow(data);
}

export function runCheckoutScenario(data) {
  runCheckoutFlow(data);
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
      title: `Koodi k6 Cart & Checkout Test (${CART_VUS === 0 ? 0 : effectiveCartVUs} Cart / ${effectiveCheckoutVUs} Checkout)`,
      savedFiles: summaryFiles,
    }),
  };
}
