import test from 'node:test';
import assert from 'node:assert/strict';

const buildUseStoreCreditValue = ({ isReturnMode, safeUseStoreCredit }) => (
  !isReturnMode ? safeUseStoreCredit : false
);

test('create-customer / regular checkout can omit store-credit context safely', () => {
  const value = buildUseStoreCreditValue({ isReturnMode: false, safeUseStoreCredit: false });
  assert.equal(value, false);
});

test('return flow never carries store-credit usage flag', () => {
  const value = buildUseStoreCreditValue({ isReturnMode: true, safeUseStoreCredit: true });
  assert.equal(value, false);
});

test('sale flow carries explicit toggle only', () => {
  assert.equal(buildUseStoreCreditValue({ isReturnMode: false, safeUseStoreCredit: true }), true);
});
