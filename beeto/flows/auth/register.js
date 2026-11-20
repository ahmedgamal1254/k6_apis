import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractOtp, extractToken } from '../../helpers/http.js';

/**
 * Generate a unique Egyptian mobile number per VU and iteration for registration.
 * Matches regex: /^(01)[0-5]{1}[0-9]{8}$/
 * @returns {string}
 */
export function buildUniquePhone() {
  const vuPart = String(__VU).padStart(3, '0').slice(-3);
  const iterPart = String(__ITER).padStart(3, '0').slice(-3);
  const randPart = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `010${vuPart}${iterPart}${randPart}`;
}

/**
 * 3-Step Registration Flow (2FA / SMS OTP):
 * 1. POST /auth/register/send-otp -> sends phone & triggers SMS OTP
 * 2. POST /auth/register/verify-otp -> verifies 6-digit SMS OTP
 * 3. POST /auth/register/complete -> completes user profile & returns access_token
 *
 * @param {string} [phone]
 * @returns {{ phone: string, token: string|null }}
 */
export function runRegisterFlow(phone = buildUniquePhone()) {
  let token = null;

  group('Auth: Register (3-Step 2FA / SMS)', () => {
    // Step 1: Send SMS OTP
    const regRes = apiRequest(
      'POST',
      `${API_PREFIX}/auth/register/send-otp`,
      { phone },
      null,
      'auth_register_send_otp'
    );

    const code = extractOtp(regRes);

    // Step 2: Verify SMS OTP
    const verifyRes = apiRequest(
      'POST',
      `${API_PREFIX}/auth/register/verify-otp`,
      { phone, code },
      null,
      'auth_register_verify_otp'
    );

    token = extractToken(verifyRes);

    // Step 3: Complete registration (only if new user; existing user already got token in step 2)
    if (!token) {
      const completeRes = apiRequest(
        'POST',
        `${API_PREFIX}/auth/register/complete`,
        {
          phone,
          code,
          name: `K6 User ${__VU}-${__ITER}`,
          lat: 30.0444,
          lon: 31.2357,
          email: `k6_${__VU}_${__ITER}_${Date.now()}@example.test`,
        },
        null,
        'auth_register_complete',
        {
          'has access_token': (r) => Boolean(extractToken(r)),
        }
      );

      token = extractToken(completeRes);
    }
  });

  return { phone, token };
}

export default function () {
  runRegisterFlow();
}
