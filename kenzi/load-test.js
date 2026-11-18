import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, PUBLIC_ENDPOINTS, LOAD_STAGES, THRESHOLDS } from './config.js';
import { recordMetrics } from './metrics.js';

export const options = {
  stages: LOAD_STAGES,
  thresholds: THRESHOLDS,
  noCookiesReset: false, // Ensure clean, unauthenticated requests
};

export default function () {
  for (const endpoint of PUBLIC_ENDPOINTS) {
    group(`Public: ${endpoint.name}`, () => {
      const url = `${BASE_URL}${endpoint.path}`;
      const res = http.get(url, {
        tags: { endpoint: endpoint.name, auth: 'none' },
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

    sleep(1);
  }
}

export function handleSummary(data) {
  return {
    'kenzi-load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const reqs = data.metrics.http_reqs?.values?.count ?? 0;
  const failedRate = ((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2);
  const p95 = (data.metrics.http_req_duration?.values?.['p(95)'] ?? 0).toFixed(2);
  const avg = (data.metrics.http_req_duration?.values?.avg ?? 0).toFixed(2);
  const successRate = ((data.metrics.kenzi_success_rate?.values?.rate ?? 0) * 100).toFixed(2);

  return [
    '',
    '=== Kenzi k6 Load Test Summary (No Login) ===',
    `Target Base URL : ${BASE_URL}`,
    `Total Requests  : ${reqs}`,
    `Failed Rate     : ${failedRate}%`,
    `Success Rate    : ${successRate}%`,
    `Avg Duration    : ${avg} ms`,
    `P95 Duration    : ${p95} ms`,
    '=============================================',
    '',
  ].join('\n');
}
