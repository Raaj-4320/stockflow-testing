import test from 'node:test';
import assert from 'node:assert/strict';

const toPaise = (amount) => Math.round(amount * 100);
const fromPaise = (paise) => Number((paise / 100).toFixed(2));

const settleReturn = ({ due, returnAmount }) => {
  const duePaise = Math.max(0, toPaise(due));
  const returnPaise = Math.max(0, toPaise(returnAmount));
  const applied = Math.min(duePaise, returnPaise);
  const excess = returnPaise - applied;
  return {
    appliedToDue: fromPaise(applied),
    excess: fromPaise(excess),
    finalDue: fromPaise(duePaise - applied)
  };
};

const applyCreditToSale = ({ credit, saleTotal }) => {
  const creditPaise = Math.max(0, toPaise(credit));
  const salePaise = Math.max(0, toPaise(saleTotal));
  const applied = Math.min(creditPaise, salePaise);
  return {
    applied: fromPaise(applied),
    remainingCredit: fromPaise(creditPaise - applied),
    payable: fromPaise(salePaise - applied)
  };
};

test('partial pay then return greater than due produces expected credit', () => {
  const initialDue = 2058;
  const payment = 1900;
  const remainingDue = initialDue - payment;
  const settlement = settleReturn({ due: remainingDue, returnAmount: 315 });

  assert.equal(remainingDue, 158);
  assert.equal(settlement.appliedToDue, 158);
  assert.equal(settlement.excess, 157);
  assert.equal(settlement.finalDue, 0);
});

test('future sale can use credit partially and fully', () => {
  const partial = applyCreditToSale({ credit: 157, saleTotal: 1890 });
  assert.equal(partial.applied, 157);
  assert.equal(partial.remainingCredit, 0);
  assert.equal(partial.payable, 1733);

  const full = applyCreditToSale({ credit: 400, saleTotal: 250 });
  assert.equal(full.applied, 250);
  assert.equal(full.remainingCredit, 150);
  assert.equal(full.payable, 0);
});

test('decimal rounding is stable in paise', () => {
  const settlement = settleReturn({ due: 110, returnAmount: 157.50 });
  assert.equal(settlement.appliedToDue, 110);
  assert.equal(settlement.excess, 47.5);
  assert.equal(settlement.finalDue, 0);

  const useCredit = applyCreditToSale({ credit: 47.5, saleTotal: 100.25 });
  assert.equal(useCredit.applied, 47.5);
  assert.equal(useCredit.remainingCredit, 0);
  assert.equal(useCredit.payable, 52.75);
});
