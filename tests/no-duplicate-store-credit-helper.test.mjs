import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = ['pages/Sales.tsx', 'pages/BarcodeSales.tsx'];

for (const file of files) {
  test(`${file} does not locally declare or import getAvailableStoreCredit`, () => {
    const source = fs.readFileSync(file, 'utf8');

    assert.equal(/\bconst\s+getAvailableStoreCredit\b/.test(source), false, 'local helper declaration found');
    assert.equal(/\bfunction\s+getAvailableStoreCredit\b/.test(source), false, 'function helper declaration found');
    assert.equal(/\bimport\s+\{[^}]*\bgetAvailableStoreCredit\b[^}]*\}/m.test(source), false, 'forbidden import symbol found');
    assert.equal(/\bas\s+getAvailableStoreCredit\b/.test(source), false, 'forbidden alias import found');
  });
}
