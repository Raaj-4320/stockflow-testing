import { readFileSync } from 'fs';
import * as path from 'path';

import { CustomersRepository } from '../../src/modules/customers/customers.repository';
import { FinanceService } from '../../src/modules/finance/finance.service';
import { TransactionsRepository } from '../../src/modules/transactions/transactions.repository';

type ParityFixture = {
  storeId: string;
  window: { dateFrom: string; dateTo: string };
  customers: Array<{
    name: string;
    phone: string;
    email: string | null;
    notes: string | null;
    dueBalance: number;
    storeCreditBalance: number;
  }>;
  transactions: Array<{
    type: 'sale' | 'payment' | 'return';
    transactionDate: string;
    settlement: {
      cashPaid: number;
      onlinePaid: number;
      creditDue: number;
      storeCreditUsed: number;
      paymentMethod: 'mixed' | 'cash' | 'online' | 'return';
    };
    totals: {
      subtotal: number;
      discount: number;
      tax: number;
      grandTotal: number;
    };
  }>;
  expected: {
    summary: {
      grossSales: number;
      salesReturns: number;
      netSales: number;
      cashIn: number;
      cashOut: number;
      onlineIn: number;
      onlineOut: number;
      creditDueNet: number;
    };
    paymentMix: {
      inflowTotal: number;
      outflowTotal: number;
      netOverall: number;
    };
    semantics: {
      expensesSource: 'unavailable';
      sessionsSource: 'unavailable';
    };
  };
};

const loadFixture = (): ParityFixture => {
  const filePath = path.resolve(
    __dirname,
    '..',
    'fixtures',
    'finance',
    'finance_parity_read_scenario_v1.json',
  );
  return JSON.parse(readFileSync(filePath, 'utf8')) as ParityFixture;
};

describe('Finance parity harness scaffold', () => {
  test('frozen read scenario remains stable for phase 4B semantics', async () => {
    const fixture = loadFixture();

    const transactionsRepository = new TransactionsRepository();
    const customersRepository = new CustomersRepository();
    const financeService = new FinanceService(transactionsRepository, customersRepository);

    for (const customerInput of fixture.customers) {
      await customersRepository.create(fixture.storeId, customerInput);
    }

    for (const transactionInput of fixture.transactions) {
      await transactionsRepository.create(fixture.storeId, {
        type: transactionInput.type,
        transactionDate: transactionInput.transactionDate,
        lineItems: [],
        settlement: transactionInput.settlement,
        customer: { customerId: null, customerName: 'Parity Customer', customerPhone: '+1-555-7777' },
        totals: transactionInput.totals,
        metadata: { source: 'pos', note: null, createdBy: null },
      });
    }

    const summary = await financeService.getSummary(fixture.storeId, fixture.window);
    const paymentMix = await financeService.getPaymentMix(fixture.storeId, fixture.window);

    expect(summary.totals).toMatchObject(fixture.expected.summary);
    expect(paymentMix.inflow.total).toBe(fixture.expected.paymentMix.inflowTotal);
    expect(paymentMix.outflow.total).toBe(fixture.expected.paymentMix.outflowTotal);
    expect(paymentMix.net.overall).toBe(fixture.expected.paymentMix.netOverall);

    expect(summary.dataSources.expenses).toBe(fixture.expected.semantics.expensesSource);
    expect(summary.dataSources.cashSessions).toBe(fixture.expected.semantics.sessionsSource);
    expect(summary.semantics.definition).toContain('Transaction-settlement window summary');
  });
});
