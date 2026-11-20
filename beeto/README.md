# Beeto k6 Load & Flow Tests (20 Concurrent Users)

Modular k6 test suite for **Beeto** covering 2FA/SMS login & registration, public market endpoints, mixes, cart, addresses, and orders.

## Folder Structure

```text
D:\k6\beeto
├── .env / .env.example          # Base URL, test phone, test OTP (2FA/SMS), VUs
├── config.js                    # Endpoint registry, 20-VU load stages, thresholds
├── metrics.js                   # Global & per-endpoint k6 metrics
├── smoke-test.js                # 1-VU end-to-end sanity check
├── load-test.js                 # 20-concurrent-user E2E load test + JSON/CSV reports
├── helpers/
│   └── http.js                  # Shared HTTP request wrapper, token/OTP/ID extractors
└── flows/
    ├── auth/
    │   ├── login.js             # 2-step 2FA/SMS login (/auth/login -> /auth/verify-login)
    │   └── register.js          # 3-step 2FA/SMS register (/auth/register -> verify -> complete)
    ├── public/
    │   └── public.js            # /market/home, /market/products
    ├── mixes/
    │   └── mixes.js             # /mixes/ingredients, POST /mixes, GET /mixes
    ├── cart/
    │   └── cart.js              # POST /cart, GET /cart, PUT /cart/{id}, DELETE /cart/{id}
    ├── addresses/
    │   └── addresses.js         # POST /addresses, GET /addresses, GET /addresses/{id}
    └── orders/
        └── orders.js            # POST /orders, GET /orders, GET /orders/{id}
```

## Configuration

Edit `.env` (or pass `-e KEY=VALUE` on the CLI):

- `BASE_URL`: Target API base URL (default: `http://localhost:8000`)
- `API_PREFIX`: API prefix (default: `/api/v1`)
- `TEST_PHONE`: Phone number for login (default: `01014548796`)
- `TEST_OTP`: Test/bypass SMS OTP code for 2FA (default: `123456`; if the API returns `data.otp` or `data.code`, it is extracted automatically)
- `VUS`: Concurrent virtual users (default: `20`)
- `RUN_REGISTER`: Set `true` to run the 3-step registration flow before login fallback (default: `false`)

## Usage

```powershell
cd D:\k6\beeto
mkdir results -Force

# 1. Quick 1-VU smoke test (full E2E flow)
k6 run smoke-test.js

# 2. Smoke test including 3-step 2FA/SMS registration
k6 run -e RUN_REGISTER=true smoke-test.js

# 3. 20-concurrent-user load test (outputs results/beeto-load-summary.json & .csv)
k6 run load-test.js

# 4. Run individual auth flows standalone
k6 run flows/auth/login.js
k6 run flows/auth/register.js
```
