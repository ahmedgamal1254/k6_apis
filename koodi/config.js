function loadEnv() {
  const env = {};
  try {
    const raw = open('./.env');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch (_) {
    // .env is optional; fall back to __ENV or default
  }
  return env;
}

const dotEnv = loadEnv();

function getEnvValue(key, fallback) {
  if (__ENV[key] !== undefined && __ENV[key] !== '') return __ENV[key];
  if (dotEnv[key] !== undefined && dotEnv[key] !== '') return dotEnv[key];
  return fallback;
}

function parseIntEnv(key, fallback) {
  const raw = getEnvValue(key, undefined);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseBoolEnv(key, fallback = false) {
  const raw = getEnvValue(key, undefined);
  if (raw === undefined) return fallback;
  return String(raw).trim().toLowerCase() === 'true';
}

export const BASE_URL = String(getEnvValue('BASE_URL', 'https://koodiapi.sumt.net')).replace(/\/+$/, '');
export const CART_VUS = parseIntEnv('CART_VUS', 30);
export const CHECKOUT_VUS = parseIntEnv('CHECKOUT_VUS', 15);
export const AUTH_VUS = parseIntEnv('AUTH_VUS', 10);
export const DRY_RUN_CHECKOUT = parseBoolEnv('DRY_RUN_CHECKOUT', false);
export const DEBUG = parseBoolEnv('DEBUG', false);
export const TEST_PHONE = getEnvValue('TEST_PHONE', '');
export const TEST_PASSWORD = getEnvValue('TEST_PASSWORD', 'K6TestUser!2026');

// Dedicated Async Checkout / Order Load Configuration (Default 25 VUs total, 50% Orders)
export const TOTAL_VUS = parseIntEnv('VUS', 25);
export const ORDER_PERCENTAGE = parseIntEnv('ORDER_PERCENTAGE', parseIntEnv('ORDER_PERCENT', 50));
export const ASYNC_MODE = parseBoolEnv('ASYNC_MODE', true);
export const CHECKOUT_DURATION = getEnvValue('DURATION', '3m');
export const ASYNC_CHECKOUT_VUS = Math.round(TOTAL_VUS * (ORDER_PERCENTAGE / 100)); // 13 VUs (50% making orders)
export const ASYNC_CART_VUS = Math.max(0, TOTAL_VUS - ASYNC_CHECKOUT_VUS); // 12 VUs (50% cart/browse)

export const LANGUAGES = ['ar', 'en', 'ku'];
export const GOVERNORATES = ['baghdad', 'erbil', 'basra', 'sulaymaniyah', 'najaf'];

// Main focus: Public Koodi API endpoints (no login required)
export const PUBLIC_ENDPOINTS = [
  { name: 'health', path: '/health' },
  { name: 'home', path: '/api/v1/home' },
  { name: 'home_banners', path: '/api/v1/home/banners' },
  { name: 'home_categories', path: '/api/v1/home/categories' },
  { name: 'home_new_arrivals', path: '/api/v1/home/new-arrivals' },
  { name: 'home_best_sellers', path: '/api/v1/home/best-sellers' },
  { name: 'home_recommended', path: '/api/v1/home/recommended' },
  { name: 'home_similar_vibes', path: '/api/v1/home/similar-vibes' },
  { name: 'home_explore', path: '/api/v1/home/explore' },
  { name: 'home_offers', path: '/api/v1/home/offers' },
  { name: 'catalog_categories', path: '/api/v1/catalog/categories' },
  { name: 'catalog_search', path: '/api/v1/catalog/search' },
  { name: 'catalog_explore', path: '/api/v1/catalog/explore' },
  { name: 'catalog_outfits', path: '/api/v1/catalog/outfits' },
  { name: 'products', path: '/api/v1/products' },
];

// Secondary light endpoints (tested lightly, not the main load focus)
export const AUTH_ENDPOINTS = [
  { name: 'auth_register', path: '/api/v1/auth/register' },
  { name: 'auth_login', path: '/api/v1/auth/login' },
];

// Stateful shopper cart endpoints (tested at CART_VUS, default 30 peak = 20% of 150)
export const CART_ENDPOINTS = [
  { name: 'product_details', path: '/api/v1/products/{id}' },
  { name: 'cart_add', path: '/api/v1/cart/items' },
  { name: 'cart_get', path: '/api/v1/cart' },
  { name: 'cart_update', path: '/api/v1/cart/items/{id}' },
  { name: 'cart_delete', path: '/api/v1/cart/items/{id}' },
  { name: 'cart_clear', path: '/api/v1/cart' },
];

// Transaction checkout endpoints (tested at CHECKOUT_VUS, default 15 peak = 10% of 150)
export const CHECKOUT_ENDPOINTS = [
  { name: 'checkout_calculate', path: '/api/v1/orders/checkout/calculate' },
  { name: 'checkout_create', path: '/api/v1/orders/checkout' },
  { name: 'order_details', path: '/api/v1/orders/{id}' },
];

export const ALL_ENDPOINTS = [
  ...PUBLIC_ENDPOINTS,
  ...AUTH_ENDPOINTS,
  ...CART_ENDPOINTS,
  ...CHECKOUT_ENDPOINTS,
];

// Main load profile: up to 150 public VUs
export const PUBLIC_LOAD_STAGES = [
  { duration: '30s', target: 15 }, // Warm up to 15 VUs
  { duration: '12m', target: 35 },  // Ramp up to 35 VUs
  { duration: '25m', target: 50 },  // Peak load at 50 VUs
  { duration: '25m', target: 50 },  // Hold 50 VUs
  // { duration: '1m', target: 100 },
  // { duration: '1m', target: 150 },
  // { duration: '6m', target: 175 },
  // { duration: '3m', target: 200 },
  // { duration: '5m', target: 250 },
  { duration: '12m', target: 10 },
  { duration: '30s', target: 0 },  // Ramp down to 0 VUs
];

export function scaleStages(baseStages, peakTarget, basePeak = 150) {
  if (peakTarget <= 0) {
    return [{ duration: '1s', target: 0 }];
  }
  return baseStages.map((stage) => ({
    duration: stage.duration,
    target:
      stage.target <= 0
        ? 0
        : Math.max(1, Math.round((stage.target / basePeak) * peakTarget)),
  }));
}

export const CART_LOAD_STAGES = scaleStages(PUBLIC_LOAD_STAGES, CART_VUS, 150);
export const CHECKOUT_LOAD_STAGES = scaleStages(PUBLIC_LOAD_STAGES, CHECKOUT_VUS, 150);

export const THRESHOLDS = {
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<1500'],
  koodi_success_rate: ['rate>0.95'],
  koodi_req_duration: ['p(95)<1500'],
  'http_req_duration{scenario:public_load}': ['p(95)<1500'],
  'http_req_duration{scenario:cart_load}': ['p(95)<1200'],
  'http_req_duration{scenario:checkout_load}': ['p(95)<2000'],
  koodi_cart_success_rate: ['rate>0.95'],
  koodi_checkout_success_rate: ['rate>0.95'],
};
