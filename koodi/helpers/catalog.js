import http from 'k6/http';
import { BASE_URL } from '../config.js';
import { buildHeaders, extractItems, parseJson } from './http.js';

/**
 * Discovers real product IDs, explore products, and in-stock variant IDs once in setup().
 */
export function discoverCatalogData() {
  const headers = buildHeaders(null, 'en');

  const productsRes = http.get(
    `${BASE_URL}/api/v1/products?page=1&size=50&inStock=true`,
    { headers, tags: { endpoint: 'setup_products', flow: 'setup' } }
  );
  const exploreRes = http.get(
    `${BASE_URL}/api/v1/catalog/explore?page=1&size=20`,
    { headers, tags: { endpoint: 'setup_explore', flow: 'setup' } }
  );

  const products = extractItems(parseJson(productsRes));
  const exploreProducts = extractItems(parseJson(exploreRes));

  const productIds = [];
  const seenProductIds = {};

  for (const item of [...products, ...exploreProducts]) {
    if (item && item.id && !seenProductIds[item.id]) {
      seenProductIds[item.id] = true;
      productIds.push(item.id);
    }
  }

  const inStockVariants = [];
  const seenVariantIds = {};

  for (const item of [...products, ...exploreProducts]) {
    if (item && Array.isArray(item.variants)) {
      for (const v of item.variants) {
        const available =
          typeof v.availableStock === 'number' ? v.availableStock : 0;
        if (
          v &&
          v.id &&
          (v.inStock === true || available > 0) &&
          !seenVariantIds[v.id]
        ) {
          seenVariantIds[v.id] = true;
          inStockVariants.push({
            productId: item.id,
            productVariantId: v.id,
            sku: v.sku || '',
            availableStock: available,
          });
        }
      }
    }
  }

  // Query individual product details (up to 25 products) to gather in-stock variants
  const sampleIds = productIds.slice(0, 25);
  for (const pid of sampleIds) {
    if (inStockVariants.length >= 60) break;

    const detailRes = http.get(`${BASE_URL}/api/v1/products/${pid}`, {
      headers,
      tags: { endpoint: 'setup_product_details', flow: 'setup' },
    });
    const detail = parseJson(detailRes)?.data;
    const variants = Array.isArray(detail?.variants) ? detail.variants : [];

    for (const v of variants) {
      const available =
        typeof v.availableStock === 'number' ? v.availableStock : 0;
      if (
        v &&
        v.id &&
        (v.inStock === true || available > 0) &&
        !seenVariantIds[v.id]
      ) {
        seenVariantIds[v.id] = true;
        inStockVariants.push({
          productId: pid,
          productVariantId: v.id,
          sku: v.sku || '',
          availableStock: available,
        });
      }
    }
  }

  console.log(
    `[k6 setup] BASE_URL=${BASE_URL} | products=${productIds.length} | inStockVariants=${inStockVariants.length}`
  );

  return {
    productIds,
    inStockVariants,
  };
}
