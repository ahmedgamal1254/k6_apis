import { BASE_URL } from '../config.js';

export function fmtMs(val) {
  return val !== undefined && val !== null ? `${Number(val).toFixed(2)}ms` : '-';
}

export function fmtNum(val) {
  return val !== undefined && val !== null ? Number(val).toFixed(2) : '0.00';
}

export function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

export function buildTrendRow(label, metric) {
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

export function buildDetailedSummary(data, endpoints, reportCfg) {
  const { title, savedFiles } = reportCfg;
  const m = data.metrics || {};
  const reqs = m.http_reqs?.values?.count ?? 0;
  const rps = fmtNum(m.http_reqs?.values?.rate);
  const failedRate = fmtNum((m.http_req_failed?.values?.rate ?? 0) * 100);
  const successRate = fmtNum((m.koodi_success_rate?.values?.rate ?? 0) * 100);
  const cartRate = fmtNum((m.koodi_cart_success_rate?.values?.rate ?? 0) * 100);
  const checkoutRate = fmtNum((m.koodi_checkout_success_rate?.values?.rate ?? 0) * 100);
  const ordersCreated = m.koodi_orders_created?.values?.count ?? 0;
  const outOfStockCount = m.koodi_out_of_stock_count?.values?.count ?? 0;
  const checksPass = m.checks?.values?.passes ?? 0;
  const checksFail = m.checks?.values?.fails ?? 0;
  const dataRecvMB = fmtNum((m.data_received?.values?.count ?? 0) / (1024 * 1024));
  const dataSentKB = fmtNum((m.data_sent?.values?.count ?? 0) / 1024);

  const lines = [
    '',
    '========================================================================================================',
    `  ${title}`,
    '========================================================================================================',
    `Target Base URL : ${BASE_URL}`,
    `Total Requests  : ${reqs} (${rps} req/s) | Checks: ${checksPass} passed, ${checksFail} failed`,
    `Global Success  : ${successRate}% | HTTP Failed Rate: ${failedRate}%`,
    `Funnel Metrics  : Cart Success=${cartRate}% | Checkout Success=${checkoutRate}% | Orders Created=${ordersCreated} | Out-of-Stock=${outOfStockCount}`,
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

  for (const ep of endpoints) {
    const durMetric = m[`ep_${ep.name}_duration`];
    const errCount = m[`ep_${ep.name}_errors`]?.values?.count ?? 0;
    if ((durMetric?.values?.count ?? 0) > 0 || errCount > 0) {
      lines.push(`${buildTrendRow(ep.name, durMetric)} ${pad(errCount, 5)}`);
    }
  }

  lines.push(
    '========================================================================================================',
    `Saved: ${savedFiles.join(', ')}`,
    ''
  );

  return lines.join('\n');
}

export function buildCsvReport(data, endpoints) {
  const m = data.metrics || {};
  const header = 'endpoint,path,count,min_ms,med_ms,avg_ms,p90_ms,p95_ms,p99_ms,max_ms,errors';
  const rows = [header];

  for (const ep of endpoints) {
    const v = m[`ep_${ep.name}_duration`]?.values || {};
    const err = m[`ep_${ep.name}_errors`]?.values?.count ?? 0;
    rows.push(
      [
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
      ].join(',')
    );
  }

  return rows.join('\n') + '\n';
}
