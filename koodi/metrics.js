import { Counter, Gauge, Rate, Trend } from 'k6/metrics';
import { ALL_ENDPOINTS } from './config.js';

export const koodiReqDuration = new Trend('koodi_req_duration', true);
export const koodiTtfb = new Trend('koodi_ttfb', true);
export const koodiSuccessRate = new Rate('koodi_success_rate');
export const koodiErrorCount = new Counter('koodi_error_count');
export const koodiTotalRequests = new Counter('koodi_total_requests');
export const koodiActiveVUs = new Gauge('koodi_active_vus');

// Cart & Checkout funnel metrics
export const koodiOrdersCreated = new Counter('koodi_orders_created');
export const koodiOutOfStockCount = new Counter('koodi_out_of_stock_count');
export const koodiCartSuccessRate = new Rate('koodi_cart_success_rate');
export const koodiCheckoutSuccessRate = new Rate('koodi_checkout_success_rate');

export const endpointDurations = {};
export const endpointErrors = {};

for (const ep of ALL_ENDPOINTS) {
  endpointDurations[ep.name] = new Trend(`ep_${ep.name}_duration`, true);
  endpointErrors[ep.name] = new Counter(`ep_${ep.name}_errors`);
}

/**
 * Record global and per-endpoint k6 metrics.
 * @param {import('k6/http').RefinedResponse} res
 * @param {string} endpointName
 * @param {boolean} passed
 */
export function recordMetrics(res, endpointName, passed) {
  const tags = { endpoint: endpointName };

  koodiTotalRequests.add(1, tags);
  koodiReqDuration.add(res.timings.duration, tags);
  koodiTtfb.add(res.timings.waiting, tags);
  koodiSuccessRate.add(passed, tags);
  koodiActiveVUs.add(__VU);

  if (endpointDurations[endpointName]) {
    endpointDurations[endpointName].add(res.timings.duration);
  }

  if (!passed) {
    koodiErrorCount.add(1, tags);
    if (endpointErrors[endpointName]) {
      endpointErrors[endpointName].add(1);
    }
  }
}
