# Koodi k6 Load & Metrics Tests

Load testing suite for **Koodi API** (`https://koodiapi.sumt.net`) up to **50 VUs**:
- **Main focus (`public_load`):** Up to 50 ramping VUs hitting 15 public endpoints (`/health`, `/api/v1/home*`, `/api/v1/catalog*`, `/api/v1/products`).
- **Light auth check (`auth_light`):** 1 VU running `POST /api/v1/auth/register` and `POST /api/v1/auth/login` lightly in the background.

## Run
```powershell
cd D:\k6\koodi
k6 run smoke-test.js
k6 run load-test.js
```
Override `BASE_URL` anytime with `-e BASE_URL=https://...` or edit `.env`.
