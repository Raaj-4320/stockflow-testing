import test from 'node:test';
import assert from 'node:assert/strict';

import { Product } from '../types';
import { buildInventoryDataSheets } from '../services/importExcel';

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prd-1',
  barcode: 'SKU-1001',
  name: 'Cotton Shirt',
  description: 'Regular fit cotton shirt',
  buyPrice: 250,
  sellPrice: 499,
  stock: 20,
  image: 'https://example.com/image.jpg',
  category: 'Apparel',
  totalPurchase: 30,
  totalSold: 10,
  variants: ['S', 'M'],
  colors: ['Red', 'Blue'],
  stockByVariantColor: [
    { variant: 'S', color: 'Red', stock: 7, buyPrice: 240, sellPrice: 499, totalPurchase: 12, totalSold: 5 },
    { variant: 'M', color: 'Blue', stock: 13, buyPrice: 255, sellPrice: 520, totalPurchase: 18, totalSold: 5 },
  ],
  ...overrides,
});

test('inventory data sheets include product-level variants/colors and row-level variant inventory details', () => {
  const { inventoryRows, variantInventoryRows } = buildInventoryDataSheets([makeProduct()]);

  assert.equal(inventoryRows.length, 1);
  assert.equal(inventoryRows[0]['Variants'], 'S, M');
  assert.equal(inventoryRows[0]['Colors'], 'Red, Blue');

  assert.equal(variantInventoryRows.length, 2);
  assert.deepEqual(
    variantInventoryRows.map(row => ({
      variant: row['Variant'],
      color: row['Color'],
      stock: row['Current Stock'],
    })),
    [
      { variant: 'S', color: 'Red', stock: 7 },
      { variant: 'M', color: 'Blue', stock: 13 },
    ],
  );
});

test('inventory data sheets still emit a default variant row for non-combination products', () => {
  const { inventoryRows, variantInventoryRows } = buildInventoryDataSheets([
    makeProduct({
      id: 'prd-2',
      variants: [],
      colors: [],
      stockByVariantColor: [],
      stock: 8,
      totalPurchase: 12,
      totalSold: 4,
    }),
  ]);

  assert.equal(inventoryRows[0]['Variants'], 'No Variant');
  assert.equal(inventoryRows[0]['Colors'], 'No Color');
  assert.deepEqual(variantInventoryRows[0], {
    'Product ID': 'prd-2',
    'Barcode': 'SKU-1001',
    'Product Name': 'Cotton Shirt',
    'Category': 'Apparel',
    'Variant': 'No Variant',
    'Color': 'No Color',
    'Current Stock': 8,
    'Buy Price': 250,
    'Sell Price': 499,
    'Total Purchase': 12,
    'Total Sold': 4,
  });
});
