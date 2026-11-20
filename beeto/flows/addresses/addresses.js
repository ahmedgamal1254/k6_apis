import { group } from 'k6';
import { API_PREFIX } from '../../config.js';
import { apiRequest, extractId } from '../../helpers/http.js';

/**
 * Addresses Endpoints:
 * - POST /addresses (create address)
 * - GET /addresses (list addresses)
 * - GET /addresses/{id} (show single address)
 *
 * @param {string|null} token
 * @returns {{ addressId: string|number|null }}
 */
export function runAddressesFlow(token) {
  let addressId = null;

  group('Addresses: Create, List & Show', () => {
    const createRes = apiRequest(
      'POST',
      `${API_PREFIX}/addresses`,
      {
        title: `Home VU-${__VU}`,
        city_id: 1,
        area_id: 1,
        street: '10 Test Street',
        building: '5',
        floor: '2',
        apartment: '4',
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
        'GET',
        `${API_PREFIX}/addresses/${addressId}`,
        null,
        token,
        'addresses_show'
      );
    }
  });

  return { addressId };
}
