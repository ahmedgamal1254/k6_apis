import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, DEBUG, LANGUAGES } from '../config.js';
import { recordMetrics } from '../metrics.js';

export function randomItem(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickLanguage() {
  return randomItem(LANGUAGES) || 'ar';
}

export function buildHeaders(token = null, lang = 'ar', extra = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Language': lang,
    ...extra,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function parseJson(res) {
  if (!res || !res.body) return null;
  try {
    return res.json();
  } catch (_) {
    return null;
  }
}

export function extractItems(body) {
  if (!body || !body.data) return [];
  if (Array.isArray(body.data.items)) return body.data.items;
  if (Array.isArray(body.data)) return body.data;
  return [];
}

/**
 * Execute an HTTP request against BASE_URL, run checks, and record endpoint metrics.
 */
export function apiRequest(method, path, payload, token, endpointName, opts = {}) {
  const {
    lang = 'en',
    flow = 'funnel',
    expectedStatuses = null,
    requireApiTrue = true,
    responseCallback = null,
    skipMetrics = false,
  } = opts;

  const url = `${BASE_URL}${path}`;
  const params = {
    headers: buildHeaders(token, lang),
    tags: {
      endpoint: endpointName,
      flow,
      auth: token ? 'bearer' : 'none',
    },
  };

  if (responseCallback) {
    params.responseCallback = responseCallback;
  }

  const body =
    payload !== null && payload !== undefined ? JSON.stringify(payload) : null;
  const res = http.request(method, url, body, params);
  const parsed = parseJson(res);

  const checks = {
    [`${endpointName}: status ok`]: (r) =>
      Array.isArray(expectedStatuses) && expectedStatuses.length > 0
        ? expectedStatuses.includes(r.status)
        : r.status >= 200 && r.status < 300,
    [`${endpointName}: body non-empty`]: (r) => Boolean(r.body && r.body.length > 0),
  };

  if (requireApiTrue) {
    checks[`${endpointName}: ApiResponse status=true`] = () =>
      parsed !== null && parsed.status === true;
  }

  const passed = check(res, checks);

  if (DEBUG && !passed) {
    console.error(
      `[FAIL] ${method} ${path} -> ${res.status}: ${String(res.body).slice(0, 500)}`
    );
  }

  if (!skipMetrics) {
    recordMetrics(res, endpointName, passed);
  }

  return { res, body: parsed, passed };
}
