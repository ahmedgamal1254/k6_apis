import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, PUBLIC_ENDPOINTS } from './config.js';
import { recordMetrics } from './metrics.js';

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    kenzi_success_rate: ['rate>0.95'],
  },
};

export default function () {
  for (const endpoint of PUBLIC_ENDPOINTS) {
    const res = http.get(`${BASE_URL}${endpoint.path}`, {
      tags: { endpoint: endpoint.name, auth: 'none' },
    });

    const passed = check(res, {
      'status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
    });

    recordMetrics(res, endpoint.name, passed);
    sleep(0.5);
  }
}
