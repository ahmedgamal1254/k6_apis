import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

export const kenziReqDuration = new Trend('kenzi_req_duration', true);
export const kenziTtfb = new Trend('kenzi_ttfb', true);
export const kenziSuccessRate = new Rate('kenzi_success_rate');
export const kenziErrorCount = new Counter('kenzi_error_count');
export const kenziTotalRequests = new Counter('kenzi_total_requests');
export const kenziActiveVUs = new Gauge('kenzi_active_vus');

/**
 * Record custom k6 metrics for a response without login/auth.
 * @param {import('k6/http').RefinedResponse} res
 * @param {string} endpointName
 * @param {boolean} passed
 */
export function recordMetrics(res, endpointName, passed) {
  const tags = { endpoint: endpointName };

  kenziTotalRequests.add(1, tags);
  kenziReqDuration.add(res.timings.duration, tags);
  kenziTtfb.add(res.timings.waiting, tags);
  kenziSuccessRate.add(passed, tags);
  kenziActiveVUs.add(__VU);

  if (!passed) {
    kenziErrorCount.add(1, tags);
  }
}
