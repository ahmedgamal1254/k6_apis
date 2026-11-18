export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Public endpoints that do not require authentication/login
export const PUBLIC_ENDPOINTS = [
  { name: 'home', path: '/' },
  { name: 'health', path: '/health' },
  // Add your public Kenzi routes/API endpoints below:
  // { name: 'products', path: '/api/public/products' },
  // { name: 'categories', path: '/api/public/categories' },
];

export const LOAD_STAGES = [
  { duration: '30s', target: 10 }, // Ramp up to 10 VUs
  { duration: '1m', target: 25 },  // Ramp up to 25 VUs
  { duration: '1m', target: 25 },  // Hold 25 VUs (steady load)
  { duration: '30s', target: 0 },  // Ramp down to 0 VUs
];

export const THRESHOLDS = {
  http_req_failed: ['rate<0.05'],       // < 5% failed requests
  http_req_duration: ['p(95)<1000'],    // 95% of requests < 1000ms
  kenzi_success_rate: ['rate>0.95'],    // > 95% custom success rate
  kenzi_req_duration: ['p(95)<1000'],   // 95% custom duration < 1000ms
};
