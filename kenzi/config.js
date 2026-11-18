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
export const BASE_URL = __ENV.BASE_URL || dotEnv.BASE_URL || 'http://localhost:5180';

// Public Kenzi API endpoints (no login / [AllowAnonymous])
export const PUBLIC_ENDPOINTS = [
  { name: 'health', path: '/health' },
  { name: 'home', path: '/api/home' },
  { name: 'trusted_users', path: '/api/home/trusted-users' },
  { name: 'landing', path: '/api/landing' },
  { name: 'app_center_settings', path: '/api/app/settings/center' },
  { name: 'app_gallery', path: '/api/app/gallery' },
  { name: 'app_reels', path: '/api/app/reels' },
  { name: 'services', path: '/api/services' },
  { name: 'catalog_departments', path: '/api/catalog/departments' },
  { name: 'catalog_categories', path: '/api/catalog/categories' },
  { name: 'catalog_services', path: '/api/catalog/services' },
  { name: 'catalog_search', path: '/api/catalog/search' },
  { name: 'packages', path: '/api/packages' },
  { name: 'suggested', path: '/api/suggested' },
  { name: 'specialists', path: '/api/specialists' },
  { name: 'about', path: '/api/about' },
  { name: 'terms_and_conditions', path: '/api/terms-and-conditions' },
  { name: 'app_config', path: '/api/config' },
  { name: 'medical_profile_options', path: '/api/medical-profile/options' },
];

export const LOAD_STAGES = [
  { duration: '30s', target: 10 }, // Ramp up to 10 VUs
  { duration: '3m', target: 25 },  // Ramp up to 25 VUs
  { duration: '3m', target: 25 },  // Hold 25 VUs (steady load)
  { duration: '3m', target: 50 },  // Ramp up to 50 VUs
  { duration: '3m', target: 50 },  // Hold 50 VUs (steady load)
  { duration: '3m', target: 100 }, // Ramp up to 100 VUs
  { duration: '3m', target: 100 }, // Hold 100 VUs (steady load)
  { duration: '5m', target: 150 }, 
  { duration: '5m', target: 200},
  { duration: '5m', target: 250},
  { duration: '1m', target: 10},
  { duration: '30s', target: 0 },  // Ramp down to 0 VUs
];

export const THRESHOLDS = {
  http_req_failed: ['rate<0.05'],       // < 5% failed requests
  http_req_duration: ['p(95)<1000'],    // 95% of requests < 1000ms
  kenzi_success_rate: ['rate>0.95'],    // > 95% custom success rate
  kenzi_req_duration: ['p(95)<1000'],   // 95% custom duration < 1000ms
};
