const EPSILON = 1e-9;

export const toSafeNumber = (value: number) => (Number.isFinite(value) ? value : 0);

export const normalizeMoney = (value: number) => {
  const safe = toSafeNumber(value);
  return Math.round((safe + Number.EPSILON) * 100) / 100;
};

export const roundByHalfRule = (value: number) => {
  const normalized = normalizeMoney(value);
  const sign = normalized < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(normalized) + 0.5);
};

const roundTo = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((toSafeNumber(value) + EPSILON) * factor) / factor;
};

export const formatMoneyPrecise = (value: number) => {
  const rounded = roundTo(value, 2);
  return rounded.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const formatMoneyWhole = (value: number) => {
  const rounded = roundByHalfRule(value);
  return rounded.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  });
};

export const roundMoneyWhole = (value: number) => roundByHalfRule(value);

export const formatINRPrecise = (value: number) => `₹${formatMoneyPrecise(value)}`;

export const formatINRWhole = (value: number) => `₹${formatMoneyWhole(value)}`;

export const formatMoneyFixed2 = (value: number) => roundTo(value, 2).toFixed(2);

export const formatMoneyRounded = (value: number) => formatMoneyWhole(value);
