import { sleep } from 'k6';
import {
  BASE_URL,
  ENDPOINT_REGISTRY,
  LOAD_STAGES,
  RUN_REGISTER,
  TARGET_VUS,
  THRESHOLDS,
} from './config.js';
import { runLoginFlow } from './flows/auth/login.js';
import { runRegisterFlow } from './flows/auth/register.js';
import { runPublicFlow } from './flows/public/public.js';
import { runMixesFlow } from './flows/mixes/mixes.js';
import { runCartFlow } from './flows/cart/cart.js';
import { runAddressesFlow } from './flows/addresses/addresses.js';
import { runOrdersFlow } from './flows/orders/orders.js';

export const options = {
  stages: LOAD_STAGES,
  thresholds: THRESHOLDS,
  noCookiesReset: false,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

export default function () {
  // 1. Public market & lookup endpoints
  const { productId, governorateId, cityId } = runPublicFlow();

  // 2. Auth flow (2FA / SMS)
  let token = null;
  if (RUN_REGISTER) {
    const reg = runRegisterFlow();
    token = reg.token;
  }
  if (!token) {
    token = runLoginFlow();
  }

  // 3. Mixes endpoints
  runMixesFlow(token);

  // 4. Cart endpoints
  runCartFlow(token, { productId });

  // 5. Addresses endpoints (create, list, make-default, update)
  const { addressId } = runAddressesFlow(token, { governorateId, cityId });

  // 6. Orders endpoints (calculate-shipping, create, list, show)
  runOrdersFlow(token, addressId);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'beeto-load-summary.json': JSON.stringify(data, null, 2),
    'beeto-endpoints-report.csv': buildCsvReport(data),
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
  const successRate = fmtNum((m.beeto_success_rate?.values?.rate ?? 0) * 100);
  const checksPass = m.checks?.values?.passes ?? 0;
  const checksFail = m.checks?.values?.fails ?? 0;
  const dataRecvMB = fmtNum((m.data_received?.values?.count ?? 0) / (1024 * 1024));
  const dataSentKB = fmtNum((m.data_sent?.values?.count ?? 0) / 1024);

  const lines = [
    '',
    '========================================================================================================',
    `                     Beeto k6 Load Test - Detailed Report (${TARGET_VUS} Concurrent Users)                     `,
    '========================================================================================================',
    `Target Base URL : ${BASE_URL}`,
    `Register Flow   : ${RUN_REGISTER ? 'Enabled (3-step 2FA/SMS)' : 'Disabled (2-step 2FA/SMS Login only)'}`,
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

  for (const ep of ENDPOINT_REGISTRY) {
    const durMetric = m[`ep_${ep.name}_duration`];
    const errCount = m[`ep_${ep.name}_errors`]?.values?.count ?? 0;
    if ((durMetric?.values?.count ?? 0) > 0 || errCount > 0) {
      lines.push(`${buildTrendRow(ep.name, durMetric)} ${pad(errCount, 5)}`);
    }
  }

  lines.push(
    '========================================================================================================',
    'Saved: beeto-load-summary.json, beeto-endpoints-report.csv',
    ''
  );

  return lines.join('\n');
}

function buildCsvReport(data) {
  const m = data.metrics || {};
  const header = 'endpoint,method,path,count,min_ms,med_ms,avg_ms,p90_ms,p95_ms,p99_ms,max_ms,errors';
  const rows = [header];

  for (const ep of ENDPOINT_REGISTRY) {
    const v = m[`ep_${ep.name}_duration`]?.values || {};
    const err = m[`ep_${ep.name}_errors`]?.values?.count ?? 0;
    rows.push(
      [
        ep.name,
        ep.method,
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
      ].join(',')
    );
  }

  return rows.join('\n') + '\n';
}
