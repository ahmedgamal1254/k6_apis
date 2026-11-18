# Kenzi k6 Load & Metrics Tests (Without Login)

This folder contains k6 load testing scripts and custom metrics for public Kenzi endpoints (no authentication/login required).

## Files
- `config.js`: Base URL, public endpoints, load stages, and pass/fail thresholds.
- `metrics.js`: Custom k6 metrics (`kenzi_req_duration`, `kenzi_ttfb`, `kenzi_success_rate`, `kenzi_error_count`, `kenzi_total_requests`, `kenzi_active_vus`).
- `smoke-test.js`: Quick 1-VU check to verify endpoints before load testing.
- `load-test.js`: Ramping load test that records custom metrics and saves a JSON report to `results/load-summary.json`.

## Usage

1. Edit `config.js` to add your public endpoints in `PUBLIC_ENDPOINTS`.
2. Run the smoke test:
   ```powershell
   cd D:\k6\kenzi
   k6 run -e BASE_URL=https://your-kenzi-url.com smoke-test.js
   ```
3. Run the load test:
   ```powershell
   cd D:\k6\kenzi
   mkdir results -Force
   k6 run -e BASE_URL=https://your-kenzi-url.com load-test.js
   ```
4. Optional — export raw metrics to JSON or CSV:
   ```powershell
   k6 run -e BASE_URL=https://your-kenzi-url.com --out json=results/metrics.json load-test.js
   k6 run -e BASE_URL=https://your-kenzi-url.com --out csv=results/metrics.csv load-test.js
   ```
