import { Counter, Gauge, Rate, Trend } from 'k6/metrics';
import { ENDPOINT_REGISTRY } from './config.js';

export const beetoReqDuration = new Trend('beeto_req_duration', true);
export const beetoTtfb = new Trend('beeto_ttfb', true);
export const beetoSuccessRate = new Rate('beeto_success_rate');
export const beetoErrorCount = new Counter('beeto_error_count');
export const beetoTotalRequests = new Counter('beeto_total_requests');
export const beetoActiveVUs = new Gauge('beeto_active_vus');

export const endpointDurations = {};
export const endpointErrors = {};

for (const ep of ENDPOINT_REGISTRY) {
  endpointDurations[ep.name] = new Trend(`ep_${ep.name}_duration`, true);
  endpointErrors[ep.name] = new Counter(`ep_${ep.name}_errors`);
}

/**
 * Record global and per-endpoint k6 metrics for a response.
 * @param {import('k6/http').RefinedResponse} res
 * @param {string} endpointName
 * @param {boolean} passed
 */
export function recordMetrics(res, endpointName, passed) {
  const tags = { endpoint: endpointName };

  beetoTotalRequests.add(1, tags);
  beetoReqDuration.add(res.timings.duration, tags);
  beetoTtfb.add(res.timings.waiting, tags);
  beetoSuccessRate.add(passed, tags);
  beetoActiveVUs.add(__VU);

  if (endpointDurations[endpointName]) {
    endpointDurations[endpointName].add(res.timings.duration);
  }

  if (!passed) {
    beetoErrorCount.add(1, tags);
    if (endpointErrors[endpointName]) {
      endpointErrors[endpointName].add(1);
    }
  }
}
