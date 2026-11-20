import { group } from 'k6';
import { API_PREFIX, TEST_PHONE } from '../../config.js';
import { apiRequest, extractId } from '../../helpers/http.js';

/**
 * Addresses Endpoints:
 * - POST /addresses (create address)
 * - GET /addresses (list addresses)
 * - POST /addresses/{id}/make-default (set default address)
 * - PUT /addresses/{id} (update address)
 *
 * @param {string|null} token
 * @param {{ governorateId?: string|number|null, cityId?: string|number|null, phone?: string }} [opts]
 * @returns {{ addressId: string|number|null }}
 */
export function runAddressesFlow(token, opts = {}) {
  let addressId = null;
  const { governorateId = 1, cityId = 1, phone = TEST_PHONE } = opts;

  group('Addresses: Create, List, Make Default & Update', () => {
    const createRes = apiRequest(
      'POST',
      `${API_PREFIX}/addresses`,
      {
        governorate_id: governorateId || 1,
        city_id: cityId || 1,
        address: `10 Test Street, VU-${__VU}`,
        phone,
        lat: 30.0444,
        lon: 31.2357,
        is_default: true,
      },
      token,
      'addresses_create'
    );

    addressId = extractId(createRes);

    const listRes = apiRequest(
      'GET',
      `${API_PREFIX}/addresses`,
      null,
      token,
      'addresses_list'
    );

    if (!addressId) {
      addressId = extractId(listRes);
    }

    if (addressId) {
      apiRequest(
        'POST',
        `${API_PREFIX}/addresses/${addressId}/make-default`,
        {},
        token,
        'addresses_make_default'
      );

      apiRequest(
        'PUT',
        `${API_PREFIX}/addresses/${addressId}`,
        {
          address: `10 Updated Street, VU-${__VU}`,
        },
        token,
        'addresses_update'
      );
    }
  });

  return { addressId };
}
