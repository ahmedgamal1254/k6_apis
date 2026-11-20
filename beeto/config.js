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

export const BASE_URL = __ENV.BASE_URL || dotEnv.BASE_URL || 'http://localhost:8000';
export const API_PREFIX = __ENV.API_PREFIX || dotEnv.API_PREFIX || '/api/v1';
export const LANGUAGE = __ENV.LANGUAGE || dotEnv.LANGUAGE || 'ar';
export const TEST_PHONE = __ENV.TEST_PHONE || dotEnv.TEST_PHONE || '01014548796';
export const TEST_OTP = __ENV.TEST_OTP || dotEnv.TEST_OTP || '123456';
export const TARGET_VUS = Number(__ENV.VUS || dotEnv.VUS || 20);
export const RUN_REGISTER = String(__ENV.RUN_REGISTER || dotEnv.RUN_REGISTER || 'false').toLowerCase() === 'true';

export const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-Language': LANGUAGE,
};

// All tracked endpoint names & paths (used by metrics.js and handleSummary)
export const ENDPOINT_REGISTRY = [
  // Login (2 endpoints - 2FA SMS)
  { name: 'auth_login', method: 'POST', path: `${API_PREFIX}/auth/login` },
  { name: 'auth_verify_login', method: 'POST', path: `${API_PREFIX}/auth/verify-login` },

  // Register (3 endpoints - 2FA SMS)
  { name: 'auth_register', method: 'POST', path: `${API_PREFIX}/auth/register` },
  { name: 'auth_verify_register', method: 'POST', path: `${API_PREFIX}/auth/verify-register` },
  { name: 'auth_complete_register', method: 'POST', path: `${API_PREFIX}/auth/complete-register` },

  // Public endpoints
  { name: 'public_home', method: 'GET', path: `${API_PREFIX}/market/home` },
  { name: 'public_products', method: 'GET', path: `${API_PREFIX}/market/products` },

  // Mixes endpoints
  { name: 'mixes_ingredients', method: 'GET', path: `${API_PREFIX}/mixes/ingredients` },
  { name: 'mixes_create', method: 'POST', path: `${API_PREFIX}/mixes` },
  { name: 'mixes_list', method: 'GET', path: `${API_PREFIX}/mixes` },

  // Cart endpoints
  { name: 'cart_show', method: 'GET', path: `${API_PREFIX}/cart` },
  { name: 'cart_add', method: 'POST', path: `${API_PREFIX}/cart` },
  { name: 'cart_update', method: 'PUT', path: `${API_PREFIX}/cart/{id}` },
  { name: 'cart_delete', method: 'DELETE', path: `${API_PREFIX}/cart/{id}` },

  // Addresses endpoints
  { name: 'addresses_create', method: 'POST', path: `${API_PREFIX}/addresses` },
  { name: 'addresses_list', method: 'GET', path: `${API_PREFIX}/addresses` },
  { name: 'addresses_show', method: 'GET', path: `${API_PREFIX}/addresses/{id}` },

  // Orders endpoints
  { name: 'orders_create', method: 'POST', path: `${API_PREFIX}/orders` },
  { name: 'orders_list', method: 'GET', path: `${API_PREFIX}/orders` },
  { name: 'orders_show', method: 'GET', path: `${API_PREFIX}/orders/{id}` },
];

export const LOAD_STAGES = [
  { duration: '20s', target: TARGET_VUS }, // Ramp up to 20 concurrent users
  { duration: '2m', target: TARGET_VUS },  // Hold 20 concurrent users
  { duration: '15s', target: 0 },          // Ramp down
];

export const THRESHOLDS = {
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<1500'],
  beeto_success_rate: ['rate>0.95'],
  beeto_req_duration: ['p(95)<1500'],
};
