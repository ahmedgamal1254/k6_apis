import { group } from 'k6';
import { API_PREFIX, TEST_PHONE } from '../../config.js';
import { apiRequest, extractOtp, extractToken } from '../../helpers/http.js';

/**
 * 2-Step Login Flow (2FA / SMS OTP):
 * 1. POST /auth/login -> triggers SMS OTP
 * 2. POST /auth/verify-login -> verifies OTP and returns Bearer access_token
 *
 * @param {string} [phone]
 * @returns {string|null} Bearer access token
 */
export function runLoginFlow(phone = TEST_PHONE) {
  let token = null;

  group('Auth: Login (2FA / SMS)', () => {
    const loginRes = apiRequest(
      'POST',
      `${API_PREFIX}/auth/login`,
      { phone },
      null,
      'auth_login'
    );

    const code = extractOtp(loginRes);

    const verifyRes = apiRequest(
      'POST',
      `${API_PREFIX}/auth/verify-login`,
      { phone, code },
      null,
      'auth_verify_login',
      {
        'has access_token': (r) => Boolean(extractToken(r)),
      }
    );

    token = extractToken(verifyRes);
  });

  return token;
}

export default function () {
  runLoginFlow();
}
