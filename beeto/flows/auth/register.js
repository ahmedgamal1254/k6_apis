import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractOtp, extractToken } from '../../helpers/http.js';

/**
 * Generate a unique Egyptian mobile number per VU and iteration for registration.
 * Format: 010 + 8 digits
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
 * 1. POST /auth/register -> sends phone & triggers SMS OTP
 * 2. POST /auth/verify-register -> verifies SMS OTP
 * 3. POST /auth/complete-register -> completes user profile & returns access_token
 *
 * @param {string} [phone]
 * @returns {{ phone: string, token: string|null }}
 */
export function runRegisterFlow(phone = buildUniquePhone()) {
  let token = null;

  group('Auth: Register (3-Step 2FA / SMS)', () => {
    // Step 1: Initiate registration & send SMS OTP
    const regRes = apiRequest(
      'POST',
      `${API_PREFIX}/auth/register`,
      {
        phone,
        name: `K6 User ${__VU}-${__ITER}`,
      },
      null,
      'auth_register'
    );

    const code = extractOtp(regRes);

    // Step 2: Verify SMS OTP
    const verifyRes = apiRequest(
      'POST',
      `${API_PREFIX}/auth/verify-register`,
      {
        phone,
        code,
      },
      null,
      'auth_verify_register'
    );

    token = extractToken(verifyRes);

    // Step 3: Complete registration (profile / password / finalize)
    const completeRes = apiRequest(
      'POST',
      `${API_PREFIX}/auth/complete-register`,
      {
        phone,
        name: `K6 User ${__VU}-${__ITER}`,
        email: `k6_${__VU}_${__ITER}@example.test`,
      },
      token,
      'auth_complete_register'
    );

    token = extractToken(completeRes) || token;
  });

  return { phone, token };
}

export default function () {
  runRegisterFlow();
}
