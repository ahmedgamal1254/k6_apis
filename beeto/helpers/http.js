import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, DEBUG, DEFAULT_HEADERS, TEST_OTP } from '../config.js';
import { recordMetrics } from '../metrics.js';

/**
 * Build request headers, optionally including Bearer token.
 * @param {string|null} token
 * @returns {Record<string, string>}
 */
export function buildHeaders(token = null) {
  if (!token) {
    return { ...DEFAULT_HEADERS };
  }
  return {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Safely parse JSON response body.
 * @param {import('k6/http').RefinedResponse} res
 * @returns {any|null}
 */
export function parseJson(res) {
  try {
    return res.json();
  } catch (_) {
    return null;
  }
}

/**
 * Extract Bearer access token from common API response shapes.
 * @param {import('k6/http').RefinedResponse} res
 * @returns {string|null}
 */
export function extractToken(res) {
  const body = parseJson(res);
  if (!body) return null;
  return (
    body?.data?.access_token ||
    body?.data?.token ||
    body?.access_token ||
    body?.token ||
    null
  );
}

/**
 * Extract OTP from dev/test response if returned, otherwise use TEST_OTP.
 * @param {import('k6/http').RefinedResponse} res
 * @returns {string}
 */
export function extractOtp(res) {
  const body = parseJson(res);
  return String(
    body?.data?.otp ||
      body?.data?.code ||
      body?.otp ||
      body?.code ||
      TEST_OTP
  );
}

/**
 * Extract a resource ID from common API response shapes.
 * @param {import('k6/http').RefinedResponse} res
 * @returns {string|number|null}
 */
export function extractId(res) {
  const body = parseJson(res);
  if (!body) return null;
  if (Array.isArray(body?.data) && body.data.length > 0) {
    return body.data[0]?.id ?? null;
  }
  if (Array.isArray(body?.data?.data) && body.data.data.length > 0) {
    return body.data.data[0]?.id ?? null;
  }
  if (Array.isArray(body?.data?.items) && body.data.items.length > 0) {
    return body.data.items[0]?.id ?? null;
  }
  if (Array.isArray(body?.data?.products) && body.data.products.length > 0) {
    return body.data.products[0]?.id ?? null;
  }
  return body?.data?.id ?? body?.id ?? null;
}

/**
 * Execute an HTTP request, run standard checks, and record custom metrics.
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path
 * @param {object|null} payload
 * @param {string|null} token
 * @param {string} endpointName
 * @param {Record<string, (r: import('k6/http').RefinedResponse) => boolean>} extraChecks
 * @returns {import('k6/http').RefinedResponse}
 */
export function apiRequest(method, path, payload, token, endpointName, extraChecks = {}) {
  const url = `${BASE_URL}${path}`;
  const params = {
    headers: buildHeaders(token),
    tags: {
      endpoint: endpointName,
      auth: token ? 'bearer' : 'none',
    },
  };

  const body = payload !== null && payload !== undefined ? JSON.stringify(payload) : null;
  const res = http.request(method, url, body, params);

  const checks = {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'body is not empty': (r) => r.body && r.body.length > 0,
    ...extraChecks,
  };

  const passed = check(res, checks);
  if (DEBUG && !passed) {
    console.error(`[FAIL] ${method} ${path} -> ${res.status}: ${String(res.body).slice(0, 500)}`);
  }
  recordMetrics(res, endpointName, passed);
  return res;
}
