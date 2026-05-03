import { readFileSync } from 'fs';
import * as path from 'path';

import { CashSessionsRepository } from '../../src/modules/cash-sessions/cash-sessions.repository';
import { CashSessionsService } from '../../src/modules/cash-sessions/cash-sessions.service';
import { CustomersRepository } from '../../src/modules/customers/customers.repository';
import { ExpensesRepository } from '../../src/modules/expenses/expenses.repository';
import { ExpensesService } from '../../src/modules/expenses/expenses.service';
import { FinanceArtifactsRepository } from '../../src/modules/finance-artifacts/finance-artifacts.repository';
import { FinanceArtifactsService } from '../../src/modules/finance-artifacts/finance-artifacts.service';
import { FinanceService } from '../../src/modules/finance/finance.service';
import { TransactionsRepository } from '../../src/modules/transactions/transactions.repository';

type Fixture = any;

const loadFixture = (): Fixture => {
  const filePath = path.resolve(__dirname, '..', 'fixtures', 'finance', 'finance_read_invariants_v1_v2.json');
  return JSON.parse(readFileSync(filePath, 'utf8')) as Fixture;
};

describe('Finance read invariants hardening pack', () => {
  test('locks current v1/v2 read behavior, included/excluded components, and read-only invariants', async () => {
    const fixture = loadFixture();

    const transactionsRepository = new TransactionsRepository();
    const customersRepository = new CustomersRepository();
    const expensesRepository = new ExpensesRepository();
    const cashSessionsRepository = new CashSessionsRepository();
    const financeArtifactsRepository = new FinanceArtifactsRepository();

    const financeService = new FinanceService(transactionsRepository, customersRepository, expensesRepository);
    const expensesService = new ExpensesService(expensesRepository);
    const cashSessionsService = new CashSessionsService(cashSessionsRepository);
    const financeArtifactsService = new FinanceArtifactsService(financeArtifactsRepository);

    const storeId = fixture.storeId;
    const otherStoreId = fixture.otherStoreId;

    const createdCustomers = [] as Array<{ id: string; name: string; phone: string }>;
    for (const c of fixture.setup.customers) {
      createdCustomers.push(
        await customersRepository.create(storeId, {
          name: c.name,
          phone: c.phone,
          email: null,
          notes: null,
          dueBalance: c.dueBalance,
          storeCreditBalance: c.storeCreditBalance,
        }),
      );
    }

    const actorId = 'finance-invariants-tester';

    for (const tx of fixture.setup.transactions) {
      await transactionsRepository.create(storeId, {
        type: tx.type,
        transactionDate: tx.transactionDate,
        lineItems: [],
        settlement: tx.settlement,
        customer: {
          customerId: createdCustomers[0].id,
          customerName: createdCustomers[0].name,
          customerPhone: createdCustomers[0].phone,
        },
        totals: tx.totals,
        metadata: { source: 'pos', note: null, createdBy: null },
      });
    }

    for (const e of fixture.setup.expenses) {
      await expensesService.create(
        storeId,
        { title: `expense-${e.category}`, occurredAt: e.occurredAt, amount: e.amount, category: e.category, note: e.note },
        actorId,
      );
    }

    await cashSessionsService.create(
      storeId,
      {
        startTime: fixture.setup.cashSession.openedAt,
        openingBalance: fixture.setup.cashSession.openingCash,
        endTime: fixture.setup.cashSession.closedAt,
        closingBalance: fixture.setup.cashSession.closingCash,
        note: fixture.setup.cashSession.notes,
      },
      actorId,
    );

    await financeArtifactsService.recordDeleteCompensation(storeId, fixture.setup.deleteCompensation);
    await financeArtifactsService.recordUpdateCorrection(storeId, fixture.setup.updateCorrection);

    // Seed another store to prove tenant scope.
    await customersRepository.create(otherStoreId, {
      name: 'Other Tenant',
      phone: '+1-555-9999',
      email: null,
      notes: null,
      dueBalance: 999,
      storeCreditBalance: 999,
    });
    await transactionsRepository.create(otherStoreId, {
      type: 'sale',
      transactionDate: fixture.window.dateFrom,
      lineItems: [],
      settlement: { cashPaid: 999, onlinePaid: 0, creditDue: 0, storeCreditUsed: 0, paymentMethod: 'cash' },
      customer: { customerId: null, customerName: 'Other', customerPhone: null },
      totals: { subtotal: 999, discount: 0, tax: 0, grandTotal: 999 },
      metadata: { source: 'pos', note: null, createdBy: null },
    });

    const preState = {
      transactions: (await transactionsRepository.findMany(storeId, {})).total,
      customers: (await customersRepository.findMany(storeId, { includeArchived: true })).length,
      expenses: (await expensesRepository.findMany(storeId, fixture.window)).total,
      sessions: (await cashSessionsRepository.findMany(storeId, fixture.window)).total,
      deleteCompensations: (await financeArtifactsRepository.findDeleteCompensations(storeId, fixture.window)).length,
      updateCorrections: (await financeArtifactsRepository.findUpdateCorrections(storeId, fixture.window)).length,
    };

    const summary = await financeService.getSummary(storeId, fixture.window);
    const summaryV2 = await financeService.getSummaryV2(storeId, fixture.window);

    expect(summary.totals).toMatchObject(fixture.expected.v1.totals);
    expect(summary.customerBalances).toMatchObject(fixture.expected.v1.customerBalances);
    expect(summary.transactionCounts).toMatchObject(fixture.expected.v1.transactionCounts);

    expect(summaryV2.totals).toMatchObject(fixture.expected.v2.totals);
    expect(summaryV2.sourceStatus).toMatchObject(fixture.expected.v2.sourceStatus);

    // Included components remain included.
    expect(summary.transactionCounts.total).toBe(3);
    expect(summary.customerBalances.totalDue).toBe(70);
    expect(summaryV2.totals.expensesTotal).toBe(25);
    expect(summary.dataSources.deleteCompensations).toBe('available_not_applied');
    expect(summary.dataSources.updateCorrectionEvents).toBe('available_not_applied');

    // Excluded components remain excluded from formulas.
    expect(summary.semantics.excludes).toContain('Cash-session opening/closing and shift difference');
    expect(summary.semantics.excludes).toContain('Delete-compensation ledger effects');
    expect(summary.semantics.excludes).toContain('Update-correction event deltas');
    expect(summary.semantics.interpretationWarnings[0]).toContain('not canonical customer ledger replay');

    // Read endpoints do not mutate source state.
    const postState = {
      transactions: (await transactionsRepository.findMany(storeId, {})).total,
      customers: (await customersRepository.findMany(storeId, { includeArchived: true })).length,
      expenses: (await expensesRepository.findMany(storeId, fixture.window)).total,
      sessions: (await cashSessionsRepository.findMany(storeId, fixture.window)).total,
      deleteCompensations: (await financeArtifactsRepository.findDeleteCompensations(storeId, fixture.window)).length,
      updateCorrections: (await financeArtifactsRepository.findUpdateCorrections(storeId, fixture.window)).length,
    };
    expect(postState).toEqual(preState);

    // Tenant/store scope isolation remains respected.
    const otherSummary = await financeService.getSummary(otherStoreId, fixture.window);
    expect(otherSummary.totals.grossSales).toBe(999);
    expect(otherSummary.customerBalances.totalDue).toBe(999);
    expect(summary.totals.grossSales).toBe(120);
  });
});
