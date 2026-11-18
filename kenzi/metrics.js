import { Counter, Gauge, Rate, Trend } from 'k6/metrics';
import { PUBLIC_ENDPOINTS } from './config.js';

export const kenziReqDuration = new Trend('kenzi_req_duration', true);
export const kenziTtfb = new Trend('kenzi_ttfb', true);
export const kenziSuccessRate = new Rate('kenzi_success_rate');
export const kenziErrorCount = new Counter('kenzi_error_count');
export const kenziTotalRequests = new Counter('kenzi_total_requests');
export const kenziActiveVUs = new Gauge('kenzi_active_vus');

// Per-endpoint metrics so handleSummary has full min/med/avg/p90/p95/p99/max for each API
export const endpointDurations = {};
export const endpointErrors = {};

for (const ep of PUBLIC_ENDPOINTS) {
  endpointDurations[ep.name] = new Trend(`ep_${ep.name}_duration`, true);
  endpointErrors[ep.name] = new Counter(`ep_${ep.name}_errors`);
}

/**
 * Record global and per-endpoint k6 metrics for a response without login/auth.
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

  if (endpointDurations[endpointName]) {
    endpointDurations[endpointName].add(res.timings.duration);
  }

  if (!passed) {
    kenziErrorCount.add(1, tags);
    if (endpointErrors[endpointName]) {
      endpointErrors[endpointName].add(1);
    }
  }
}
