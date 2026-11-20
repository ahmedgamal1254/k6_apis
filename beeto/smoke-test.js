import { sleep } from 'k6';
import { RUN_REGISTER } from './config.js';
import { runLoginFlow } from './flows/auth/login.js';
import { runRegisterFlow } from './flows/auth/register.js';
import { runPublicFlow } from './flows/public/public.js';
import { runMixesFlow } from './flows/mixes/mixes.js';
import { runCartFlow } from './flows/cart/cart.js';
import { runAddressesFlow } from './flows/addresses/addresses.js';
import { runOrdersFlow } from './flows/orders/orders.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    beeto_success_rate: ['rate>0.95'],
  },
};

export default function () {
  // 1. Public endpoints (no auth)
  const { productId } = runPublicFlow();
  sleep(0.5);

  // 2. Auth flow: Register (3 endpoints, 2FA/SMS) or Login (2 endpoints, 2FA/SMS)
  let token = null;
  if (RUN_REGISTER) {
    const reg = runRegisterFlow();
    token = reg.token;
    sleep(0.5);
  }
  if (!token) {
    token = runLoginFlow();
    sleep(0.5);
  }

  // 3. Mixes endpoints
  const { mixId } = runMixesFlow(token);
  sleep(0.5);

  // 4. Cart endpoints
  runCartFlow(token, { productId, mixId });
  sleep(0.5);

  // 5. Addresses endpoints (create, list, show)
  const { addressId } = runAddressesFlow(token);
  sleep(0.5);

  // 6. Orders endpoints (create, list, show)
  runOrdersFlow(token, addressId);
}
