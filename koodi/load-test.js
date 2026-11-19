import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  AUTH_ENDPOINTS,
  BASE_URL,
  PUBLIC_ENDPOINTS,
  PUBLIC_LOAD_STAGES,
  THRESHOLDS,
} from './config.js';
import { recordMetrics } from './metrics.js';

export const options = {
  scenarios: {
    // Main focus: up to 50 users hitting public catalog/home/products APIs
    public_load: {
      executor: 'ramping-vus',
      exec: 'runPublicFlow',
      stages: PUBLIC_LOAD_STAGES,
      gracefulRampDown: '30s',
    },
    // Light background check on register + login (1 VU every ~5s, not the focus)
    auth_light: {
      executor: 'constant-vus',
      exec: 'runAuthFlow',
      vus: 1,
      duration: '5m',
      gracefulStop: '10s',
    },
  },
  thresholds: THRESHOLDS,
  noCookiesReset: false,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

export function runPublicFlow() {
  for (const endpoint of PUBLIC_ENDPOINTS) {
    group(`Public: ${endpoint.name}`, () => {
      const res = http.get(`${BASE_URL}${endpoint.path}`, {
        tags: { endpoint: endpoint.name, flow: 'public' },
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

    // sleep(0.5);
  }
}

export function runAuthFlow() {
  const uniqueSuffix = `${Date.now().toString().slice(-6)}${__VU}${__ITER % 100}`;
  const phoneNumber = `+964770${uniqueSuffix.padStart(7, '0').slice(0, 7)}`;
  const password = 'K6TestUser!2026';
  const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };

  group('Auth: register (light)', () => {
    const payload = JSON.stringify({
      fullName: `K6 Load User ${__VU}-${__ITER}`,
      phoneNumber,
      email: `k6_${uniqueSuffix}@test.local`,
      password,
    });

    const res = http.post(`${BASE_URL}/api/v1/auth/register`, payload, {
      headers: jsonHeaders,
      tags: { endpoint: 'auth_register', flow: 'auth' },
    });

    const passed = check(res, {
      'register status is 2xx/409': (r) => (r.status >= 200 && r.status < 300) || r.status === 409,
    });

    recordMetrics(res, 'auth_register', passed);
  });

  // sleep(0.5);

  group('Auth: login (light)', () => {
    const payload = JSON.stringify({ phoneNumber, password });

    const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
      headers: jsonHeaders,
      tags: { endpoint: 'auth_login', flow: 'auth' },
    });

    const passed = check(res, {
      'login status is 2xx': (r) => r.status >= 200 && r.status < 300,
    });

    recordMetrics(res, 'auth_login', passed);
  });

  // sleep(3);
}

export function handleSummary(data) {
  return {
    'koodi-load-summary.json': JSON.stringify(data, null, 2),
    'koodi-endpoints-report.csv': buildCsvReport(data),
    stdout: buildDetailedSummary(data),
  };
}

function fmtMs(val) {
  return val !== undefined && val !== null ? `${Number(val).toFixed(2)}ms` : '-';
}

function fmtNum(val) {
  return val !== undefined && val !== null ? Number(val).toFixed(2) : '0.00';
}

function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function buildTrendRow(label, metric) {
  const v = metric?.values || {};
  return [
    pad(label, 26),
    pad(v.count ?? 0, 7),
    pad(fmtMs(v.min), 10),
    pad(fmtMs(v.med), 10),
    pad(fmtMs(v.avg), 10),
    pad(fmtMs(v['p(90)']), 10),
    pad(fmtMs(v['p(95)']), 10),
    pad(fmtMs(v['p(99)']), 10),
    pad(fmtMs(v.max), 10),
  ].join(' ');
}

function buildDetailedSummary(data) {
  const m = data.metrics || {};
  const reqs = m.http_reqs?.values?.count ?? 0;
  const rps = fmtNum(m.http_reqs?.values?.rate);
  const failedRate = fmtNum((m.http_req_failed?.values?.rate ?? 0) * 100);
  const successRate = fmtNum((m.koodi_success_rate?.values?.rate ?? 0) * 100);
  const checksPass = m.checks?.values?.passes ?? 0;
  const checksFail = m.checks?.values?.fails ?? 0;
  const dataRecvMB = fmtNum((m.data_received?.values?.count ?? 0) / (1024 * 1024));
  const dataSentKB = fmtNum((m.data_sent?.values?.count ?? 0) / 1024);

  const lines = [
    '',
    '========================================================================================================',
    '                        Koodi k6 Load Test (50 VUs Public + Light Register/Login)                       ',
    '========================================================================================================',
    `Target Base URL : ${BASE_URL}`,
    `Total Requests  : ${reqs} (${rps} req/s) | Checks: ${checksPass} passed, ${checksFail} failed`,
    `Success Rate    : ${successRate}% | Failed Rate: ${failedRate}%`,
    `Network Traffic : Received ${dataRecvMB} MB | Sent ${dataSentKB} KB`,
    '--------------------------------------------------------------------------------------------------------',
    [
      pad('Global Metric', 26),
      pad('Count', 7),
      pad('Min', 10),
      pad('Med', 10),
      pad('Avg', 10),
      pad('P90', 10),
      pad('P95', 10),
      pad('P99', 10),
      pad('Max', 10),
    ].join(' '),
    '--------------------------------------------------------------------------------------------------------',
    buildTrendRow('http_req_duration', m.http_req_duration),
    buildTrendRow('http_req_waiting (TTFB)', m.http_req_waiting),
    buildTrendRow('http_req_connecting', m.http_req_connecting),
    buildTrendRow('http_req_receiving', m.http_req_receiving),
    buildTrendRow('iteration_duration', m.iteration_duration),
    '--------------------------------------------------------------------------------------------------------',
    [
      pad('Endpoint', 26),
      pad('Count', 7),
      pad('Min', 10),
      pad('Med', 10),
      pad('Avg', 10),
      pad('P90', 10),
      pad('P95', 10),
      pad('P99', 10),
      pad('Max', 10),
      pad('Err', 5),
    ].join(' '),
    '--------------------------------------------------------------------------------------------------------',
  ];

  for (const ep of [...PUBLIC_ENDPOINTS, ...AUTH_ENDPOINTS]) {
    const durMetric = m[`ep_${ep.name}_duration`];
    const errCount = m[`ep_${ep.name}_errors`]?.values?.count ?? 0;
    lines.push(`${buildTrendRow(ep.name, durMetric)} ${pad(errCount, 5)}`);
  }

  lines.push(
    '========================================================================================================',
    'Saved: koodi-load-summary.json, koodi-endpoints-report.csv',
    ''
  );

  return lines.join('\n');
}

function buildCsvReport(data) {
  const m = data.metrics || {};
  const header = 'endpoint,path,count,min_ms,med_ms,avg_ms,p90_ms,p95_ms,p99_ms,max_ms,errors';
  const rows = [header];

  for (const ep of [...PUBLIC_ENDPOINTS, ...AUTH_ENDPOINTS]) {
    const v = m[`ep_${ep.name}_duration`]?.values || {};
    const err = m[`ep_${ep.name}_errors`]?.values?.count ?? 0;
    rows.push([
      ep.name,
      ep.path,
      v.count ?? 0,
      fmtNum(v.min),
      fmtNum(v.med),
      fmtNum(v.avg),
      fmtNum(v['p(90)']),
      fmtNum(v['p(95)']),
      fmtNum(v['p(99)']),
      fmtNum(v.max),
      err,
    ].join(','));
  }

  return rows.join('\n') + '\n';
}
