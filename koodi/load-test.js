import http from 'k6/http';
import { check, group } from 'k6';
import {
  ALL_ENDPOINTS,
  AUTH_VUS,
  BASE_URL,
  CART_LOAD_STAGES,
  CART_VUS,
  CHECKOUT_LOAD_STAGES,
  CHECKOUT_VUS,
  DRY_RUN_CHECKOUT,
  PUBLIC_ENDPOINTS,
  PUBLIC_LOAD_STAGES,
  THRESHOLDS,
} from './config.js';
import { recordMetrics } from './metrics.js';
import { discoverCatalogData } from './helpers/catalog.js';
import { buildCsvReport, buildDetailedSummary } from './helpers/summary.js';
import { runCartFlow } from './flows/cart/cart.js';
import { runCheckoutFlow } from './flows/checkout/checkout.js';

function buildScenarios() {
  const scenarios = {
    // Main focus: up to 150 VUs hitting public catalog/home/products APIs
    public_load: {
      executor: 'ramping-vus',
      exec: 'runPublicFlow',
      stages: PUBLIC_LOAD_STAGES,
      gracefulRampDown: '30s',
    },
  };

  // Cart shoppers: proportional ramp peaking at CART_VUS (default 30 = 20% of 150)
  if (CART_VUS > 0) {
    scenarios.cart_load = {
      executor: 'ramping-vus',
      exec: 'runCartScenario',
      stages: CART_LOAD_STAGES,
      gracefulRampDown: '30s',
    };
  }

  // Checkout buyers: proportional ramp peaking at CHECKOUT_VUS (default 15 = 10% of 150)
  if (CHECKOUT_VUS > 0) {
    scenarios.checkout_load = {
      executor: 'ramping-vus',
      exec: 'runCheckoutScenario',
      stages: CHECKOUT_LOAD_STAGES,
      gracefulRampDown: '30s',
    };
  }

  // Light background check on register + login
  if (AUTH_VUS > 0) {
    scenarios.auth_light = {
      executor: 'constant-vus',
      exec: 'runAuthFlow',
      vus: AUTH_VUS,
      duration: '7m',
      gracefulStop: '10s',
    };
  }

  return scenarios;
}

function buildThresholds() {
  const active = {
    http_req_failed: THRESHOLDS.http_req_failed,
    http_req_duration: THRESHOLDS.http_req_duration,
    koodi_success_rate: THRESHOLDS.koodi_success_rate,
    koodi_req_duration: THRESHOLDS.koodi_req_duration,
    'http_req_duration{scenario:public_load}':
      THRESHOLDS['http_req_duration{scenario:public_load}'],
  };

  if (CART_VUS > 0) {
    active['http_req_duration{scenario:cart_load}'] =
      THRESHOLDS['http_req_duration{scenario:cart_load}'];
    active.koodi_cart_success_rate = THRESHOLDS.koodi_cart_success_rate;
  }

  if (CHECKOUT_VUS > 0) {
    active['http_req_duration{scenario:checkout_load}'] =
      THRESHOLDS['http_req_duration{scenario:checkout_load}'];
    active.koodi_checkout_success_rate = THRESHOLDS.koodi_checkout_success_rate;
  }

  return active;
}

export const options = {
  scenarios: buildScenarios(),
  thresholds: buildThresholds(),
  noCookiesReset: false,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

export function setup() {
  console.log(
    `[k6 load] BASE_URL=${BASE_URL} | Peak VUs: public=150, cart=${CART_VUS}, checkout=${CHECKOUT_VUS}, auth_light=${AUTH_VUS} | DRY_RUN_CHECKOUT=${DRY_RUN_CHECKOUT}`
  );
  return discoverCatalogData();
}

export function runPublicFlow() {
  for (const endpoint of PUBLIC_ENDPOINTS) {
    group(`Public: ${endpoint.name}`, () => {
      const res = http.get(`${BASE_URL}${endpoint.path}`, {
        tags: { endpoint: endpoint.name, flow: 'public' },
        headers: {
          Accept: 'application/json, text/html, */*',
        },
      });

      const passed = check(res, {
        'status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
        'response body not empty': (r) => r.body && r.body.length > 0,
      });

      recordMetrics(res, endpoint.name, passed);
    });
  }
}

export function runCartScenario(data) {
  runCartFlow(data);
}

export function runCheckoutScenario(data) {
  runCheckoutFlow(data);
}

export function runAuthFlow() {
  const uniqueSuffix = `${Date.now().toString().slice(-6)}${__VU}${__ITER % 100}`;
  const phoneNumber = `+964770${uniqueSuffix.padStart(7, '0').slice(0, 7)}`;
  const password = 'K6TestUser!2026';
  const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };

  group('Auth: register (light)', () => {
    const payload = JSON.stringify({
      fullName: `K6 Load User ${__VU}-${__ITER}`,
      phoneNumber,
      email: `k6_${uniqueSuffix}@test.local`,
      password,
    });

    const res = http.post(`${BASE_URL}/api/v1/auth/register`, payload, {
      headers: jsonHeaders,
      tags: { endpoint: 'auth_register', flow: 'auth' },
      responseCallback: http.expectedStatuses(201, 409),
    });

    const passed = check(res, {
      'register status is 2xx/409': (r) =>
        (r.status >= 200 && r.status < 300) || r.status === 409,
    });

    recordMetrics(res, 'auth_register', passed);
  });

  group('Auth: login (light)', () => {
    const payload = JSON.stringify({ phoneNumber, password });

    const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
      headers: jsonHeaders,
      tags: { endpoint: 'auth_login', flow: 'auth' },
    });

    const passed = check(res, {
      'login status is 2xx': (r) => r.status >= 200 && r.status < 300,
    });

    recordMetrics(res, 'auth_login', passed);
  });
}

export function handleSummary(data) {
  const summaryFiles = [
    'koodi-load-summary.json',
    'koodi-endpoints-report.csv',
  ];

  return {
    'koodi-load-summary.json': JSON.stringify(data, null, 2),
    'koodi-endpoints-report.csv': buildCsvReport(data, ALL_ENDPOINTS),
    stdout: buildDetailedSummary(data, ALL_ENDPOINTS, {
      title: `Koodi k6 Load Test (150 Public / ${CART_VUS} Cart / ${CHECKOUT_VUS} Checkout / ${AUTH_VUS} Auth)`,
      savedFiles: summaryFiles,
    }),
  };
}
