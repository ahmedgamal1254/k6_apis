import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, DEBUG, TEST_PASSWORD, TEST_PHONE } from '../../config.js';
import { buildHeaders, parseJson } from '../../helpers/http.js';
import { recordMetrics } from '../../metrics.js';

let cachedSession = null;

function buildVuPhone(scenarioTag) {
  if (TEST_PHONE) {
    return String(TEST_PHONE).trim();
  }
  // Valid Iraqi E.164 mobile format (+964 770 [1|2]XXXXXX) per PhoneNumberValidator
  const scenarioDigit = scenarioTag === 'checkout' ? '2' : '1';
  const vuPart = String(__VU % 1000000).padStart(6, '0');
  return `+964770${scenarioDigit}${vuPart}`;
}

export function clearCustomerSession() {
  cachedSession = null;
}

/**
 * Ensures the current VU holds a valid customer JWT token from POST /api/v1/auth/login.
 * Note: /auth/register returns a placeholder token; /auth/login returns the real JWT
 * accepted by [Authorize] endpoints (/api/v1/cart, /api/v1/orders).
 */
export function ensureCustomerSession(scenarioTag = 'cart') {
  if (cachedSession && cachedSession.token) {
    return cachedSession;
  }

  const phoneNumber = buildVuPhone(scenarioTag);
  const password = TEST_PASSWORD || 'K6TestUser!2026';
  const fullName = `Koodi ${scenarioTag} VU ${__VU}`;

  if (!TEST_PHONE) {
    const regRes = http.post(
      `${BASE_URL}/api/v1/auth/register`,
      JSON.stringify({ fullName, phoneNumber, password }),
      {
        headers: buildHeaders(null, 'en'),
        tags: { endpoint: 'auth_register', flow: scenarioTag },
        responseCallback: http.expectedStatuses(201, 409),
      }
    );

    const regOk = check(regRes, {
      'auth register ok or conflict': (r) => r.status === 201 || r.status === 409,
    });
    recordMetrics(regRes, 'auth_register', regOk);
  }

  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ phoneNumber, password }),
    {
      headers: buildHeaders(null, 'en'),
      tags: { endpoint: 'auth_login', flow: scenarioTag },
    }
  );

  const loginBody = parseJson(loginRes);
  const accessToken = loginBody?.data?.accessToken || null;
  const loginOk = check(loginRes, {
    'auth login status 200': (r) => r.status === 200,
    'auth login issued JWT token': () => Boolean(accessToken),
  });
  recordMetrics(loginRes, 'auth_login', loginOk);

  if (DEBUG && !loginOk) {
    console.error(
      `[AUTH FAIL] POST /api/v1/auth/login -> ${loginRes.status}: ${String(loginRes.body).slice(0, 400)}`
    );
  }

  if (!loginOk || !accessToken) {
    return null;
  }

  cachedSession = {
    token: accessToken,
    userId: loginBody?.data?.userId || null,
    phoneNumber: loginBody?.data?.phoneNumber || phoneNumber,
    fullName: loginBody?.data?.fullName || fullName,
  };

  return cachedSession;
}
