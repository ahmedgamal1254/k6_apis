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
export const BASE_URL = __ENV.BASE_URL || dotEnv.BASE_URL || 'https://koodiapi.sumt.net';

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

// Main load profile: up to 50 users
export const PUBLIC_LOAD_STAGES = [
  { duration: '30s', target: 15 }, // Warm up to 15 VUs
  { duration: '1m', target: 35 },  // Ramp up to 35 VUs
  { duration: '2m', target: 50 },  // Peak load at 50 VUs
  { duration: '1m', target: 50 },  // Hold 50 VUs
  { duration: '12m', target: 100 }, 
  { duration: '12m', target: 150 }, 
  { duration: '12m', target: 175 }, 
  // { duration: '3m', target: 200},  
  // { duration: '5m', target: 250},
  { duration: '1m', target: 10},
  { duration: '30s', target: 0 },  // Ramp down to 0 VUs
];

export const THRESHOLDS = {
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<1500'],
  koodi_success_rate: ['rate>0.95'],
  koodi_req_duration: ['p(95)<1500'],
};
