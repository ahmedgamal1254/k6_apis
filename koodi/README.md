# Koodi k6 Load & Funnel Tests

Load and concurrency testing suite for **Koodi API** inside `D:\k6\koodi`, with realistic separation between public product exploration (`150` VUs peak), stateful shopper carts (`30` VUs peak), and checkout orders (`15` VUs peak):

## Scenarios & Default Funnel Ratio
- **`public_load` (up to 150 VUs):** 15 public browse/search/catalog endpoints (`/health`, `/api/v1/home*`, `/api/v1/catalog*`, `/api/v1/products`).
- **`cart_load` (`CART_VUS=30`, 20% of 150):** Authentic cart lifecycle (`GET /api/v1/products/{id}` -> `POST /api/v1/cart/items` -> `GET /api/v1/cart` -> `PUT /api/v1/cart/items/{id}` -> `DELETE /api/v1/cart/items/{id}`).
- **`checkout_load` (`CHECKOUT_VUS=15`, 10% of 150):** Full purchase flow (`POST /api/v1/cart/items` -> `GET /api/v1/cart` -> `POST /api/v1/orders/checkout/calculate` -> `POST /api/v1/orders/checkout` COD -> `GET /api/v1/orders/{orderId}`).
- **`auth_light` (`AUTH_VUS=10`):** Background register/login verification.

*(توزيع واقعي للأحمال: 150 مستخدم لتصفح واستكشاف المنتجات، يقابلهم 30 للسلة و15 فقط لإتمام الطلب الفعلي في الـ Checkout.)*

## Files
- `config.js`: Reads `.env` / `__ENV`, endpoints registry, proportional `scaleStages()`, and per-scenario thresholds.
- `metrics.js`: Per-endpoint trends/errors plus `koodi_orders_created`, `koodi_out_of_stock_count`, `koodi_cart_success_rate`, and `koodi_checkout_success_rate`.
- `helpers/http.js`: Unified HTTP helper + envelope validation.
- `helpers/catalog.js`: Discovers active products and in-stock variant IDs dynamically inside `setup()`.
- `helpers/summary.js`: Generates detailed console metrics, JSON summaries, and CSV endpoint reports.
- `flows/auth/session.js`: Registers idempotent test numbers (`+9647701xxxxxx` / `+9647702xxxxxx`) and logs in via `/api/v1/auth/login` for valid Bearer JWTs.
- `flows/cart/cart.js`: Shopper cart flow.
- `flows/checkout/checkout.js`: End-to-end checkout flow with `DRY_RUN_CHECKOUT` support and graceful out-of-stock handling.

## Run Commands (PowerShell)
```powershell
cd D:\k6\koodi

# 1. 25 VUs Async Load Test (50% Making Orders + 50% Cart Shoppers)
k6 run checkout-test.js

# 2. Run against VPS or custom URL
k6 run -e BASE_URL=http://api.koodi.top checkout-test.js

# 3. Dry-run (Calculates pricing & places orders without stock reservation)
k6 run -e DRY_RUN_CHECKOUT=true checkout-test.js

# 4. Custom VUs and Duration (e.g. 50 VUs for 5 minutes, 50% orders)
k6 run -e VUS=50 -e DURATION=5m checkout-test.js

# 5. Smoke test (Quick 1-VU sanity check)
k6 run smoke-test.js

# 6. Full 150-VU funnel test
k6 run load-test.js
```

Override `BASE_URL` or VU counts anytime in `.env` or via `-e BASE_URL=https://...`.
