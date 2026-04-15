import { CreateProductDto, CreateProductStockRowDto } from '../../../contracts/v1/products/create-product.dto';
import { UpdateProductDto } from '../../../contracts/v1/products/update-product.dto';

const normalizeText = (value: string): string => value.trim();

const dedupeStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of values.map(normalizeText).filter(Boolean)) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }

  return out;
};

const normalizeStockRows = (rows: CreateProductStockRowDto[] | undefined): CreateProductStockRowDto[] => {
  if (!rows) return [];

  const merged = new Map<string, CreateProductStockRowDto>();

  for (const row of rows) {
    const variant = normalizeText(row.variant);
    const color = normalizeText(row.color);
    const key = `${variant.toLowerCase()}::${color.toLowerCase()}`;
    const existing = merged.get(key);

    if (existing) {
      existing.stock += row.stock;
    } else {
      merged.set(key, { variant, color, stock: row.stock });
    }
  }

  return [...merged.values()];
};

export const normalizeCreatePayload = (payload: CreateProductDto): CreateProductDto => {
  const variants = dedupeStrings(payload.variants ?? []);
  const colors = dedupeStrings(payload.colors ?? []);
  const rows = normalizeStockRows(payload.stockByVariantColor);

  for (const row of rows) {
    if (!variants.some((v) => v.toLowerCase() === row.variant.toLowerCase())) {
      variants.push(row.variant);
    }
    if (!colors.some((c) => c.toLowerCase() === row.color.toLowerCase())) {
      colors.push(row.color);
    }
  }

  return {
    ...payload,
    name: normalizeText(payload.name),
    barcode: normalizeText(payload.barcode),
    category: normalizeText(payload.category),
    imageUrl: payload.imageUrl?.trim(),
    variants,
    colors,
    stockByVariantColor: rows,
  };
};

export const normalizeUpdatePayload = (payload: UpdateProductDto): UpdateProductDto => {
  const next: UpdateProductDto = { ...payload };

  if (next.name !== undefined) next.name = normalizeText(next.name);
  if (next.barcode !== undefined) next.barcode = normalizeText(next.barcode);
  if (next.category !== undefined) next.category = normalizeText(next.category);
  if (next.imageUrl !== undefined) next.imageUrl = next.imageUrl.trim();
  if (next.variants !== undefined) next.variants = dedupeStrings(next.variants);
  if (next.colors !== undefined) next.colors = dedupeStrings(next.colors);
  if (next.stockByVariantColor !== undefined) {
    next.stockByVariantColor = normalizeStockRows(next.stockByVariantColor);

    const variants = next.variants ? [...next.variants] : [];
    const colors = next.colors ? [...next.colors] : [];

    for (const row of next.stockByVariantColor) {
      if (!variants.some((v) => v.toLowerCase() === row.variant.toLowerCase())) {
        variants.push(row.variant);
      }
      if (!colors.some((c) => c.toLowerCase() === row.color.toLowerCase())) {
        colors.push(row.color);
      }
    }

    if (variants.length > 0) next.variants = dedupeStrings(variants);
    if (colors.length > 0) next.colors = dedupeStrings(colors);
  }

  return next;
};
