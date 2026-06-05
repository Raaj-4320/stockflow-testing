export const PRODUCT_NAME_FALLBACK = 'not set yet';
export const PRODUCT_CATEGORY_FALLBACK = 'not set yet';
export const PRODUCT_OPTIONAL_TEXT_FALLBACK = '-';

export const safeText = (value: unknown, fallback = ''): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

export const safeLower = (value: unknown): string => String(value ?? '').toLowerCase();

export const getProductName = (product: { name?: unknown } | null | undefined): string =>
  safeText(product?.name, PRODUCT_NAME_FALLBACK);

export const getProductCategory = (product: { category?: unknown } | null | undefined): string =>
  safeText(product?.category, PRODUCT_CATEGORY_FALLBACK);

export const getProductBarcode = (product: { barcode?: unknown } | null | undefined, fallback = PRODUCT_OPTIONAL_TEXT_FALLBACK): string =>
  safeText(product?.barcode, fallback);

export const getProductDescription = (product: { description?: unknown } | null | undefined, fallback = PRODUCT_OPTIONAL_TEXT_FALLBACK): string =>
  safeText(product?.description, fallback);

export const getProductHsn = (product: { hsn?: unknown } | null | undefined, fallback = PRODUCT_OPTIONAL_TEXT_FALLBACK): string =>
  safeText(product?.hsn, fallback);

export const getProductSearchText = (product: any): string => [
  product?.name,
  product?.category,
  product?.barcode,
  product?.hsn,
  product?.description,
  product?.sku,
  Array.isArray(product?.variants) ? product.variants.join(' ') : '',
  Array.isArray(product?.colors) ? product.colors.join(' ') : '',
].map((value) => safeText(value)).filter(Boolean).join(' ');

export const getProductAuditSample = (products: Array<{ id?: unknown; name?: unknown; category?: unknown }> = []) =>
  products.slice(0, 3).map((product) => ({
    id: product.id,
    name: getProductName(product),
    category: getProductCategory(product),
  }));
