import { Injectable } from '@nestjs/common';

import { FinanceCorrectionsArtifactsQueryDto } from '../../contracts/v1/finance/finance-corrections-artifacts-query.dto';
import { FinanceSummaryQueryDto } from '../../contracts/v1/finance/finance-summary-query.dto';
import {
  FinanceCorrectionsArtifactsResponseDto,
  FinanceCorrectionsOverviewResponseDto,
  FinanceDataSourceStatusDto,
  FinancePaymentMixResponseDto,
  FinanceReadSemanticsDto,
  FinanceReconciliationOverviewResponseDto,
  FinanceSummaryResponseDto,
} from '../../contracts/v1/finance/finance-response.dto';
import { CustomerDto } from '../../contracts/v1/customers/customer.types';
import {
  DeletedTransactionDto,
  TransactionAuditEventDto,
  TransactionDto,
} from '../../contracts/v1/transactions/transaction.types';
import { CustomersRepository } from '../customers/customers.repository';
import { TransactionsRepository } from '../transactions/transactions.repository';

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

@Injectable()
export class FinanceService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly customersRepository: CustomersRepository,
  ) {}

  async getSummary(storeId: string, query: FinanceSummaryQueryDto): Promise<FinanceSummaryResponseDto> {
    const transactions = await this.findTransactionsInWindow(storeId, query);
    const customers = await this.customersRepository.findMany(storeId, { includeArchived: true });

    const transactionCounts = {
      sale: 0,
      payment: 0,
      return: 0,
      other: 0,
      total: transactions.length,
    };

    const totals = {
      grossSales: 0,
      salesReturns: 0,
      netSales: 0,
      cashIn: 0,
      cashOut: 0,
      onlineIn: 0,
      onlineOut: 0,
      creditDueNet: 0,
    };

    for (const tx of transactions) {
      if (tx.type === 'sale') {
        transactionCounts.sale += 1;
        totals.grossSales += tx.totals.grandTotal;
        totals.cashIn += tx.settlement.cashPaid;
        totals.onlineIn += tx.settlement.onlinePaid;
        totals.creditDueNet += tx.settlement.creditDue;
      } else if (tx.type === 'return') {
        transactionCounts.return += 1;
        totals.salesReturns += tx.totals.grandTotal;
        totals.cashOut += tx.settlement.cashPaid;
        totals.onlineOut += tx.settlement.onlinePaid;
        totals.creditDueNet -= tx.settlement.creditDue;
      } else if (tx.type === 'payment') {
        transactionCounts.payment += 1;
        totals.cashIn += tx.settlement.cashPaid;
        totals.onlineIn += tx.settlement.onlinePaid;
        totals.creditDueNet -= tx.totals.grandTotal;
      } else {
        transactionCounts.other += 1;
      }
    }

    totals.grossSales = roundMoney(totals.grossSales);
    totals.salesReturns = roundMoney(totals.salesReturns);
    totals.netSales = roundMoney(totals.grossSales - totals.salesReturns);
    totals.cashIn = roundMoney(totals.cashIn);
    totals.cashOut = roundMoney(totals.cashOut);
    totals.onlineIn = roundMoney(totals.onlineIn);
    totals.onlineOut = roundMoney(totals.onlineOut);
    totals.creditDueNet = roundMoney(totals.creditDueNet);

    return {
      window: { dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null },
      totals,
      transactionCounts,
      customerBalances: this.summarizeCustomerBalances(customers),
      semantics: {
        definition:
          'Transaction-settlement window summary for sale/payment/return streams plus current customer balances snapshot.',
        excludes: [
          'Expense cash-out impact',
          'Cash-session opening/closing and shift difference',
          'Delete-compensation ledger effects',
          'Update-correction event deltas',
        ],
        interpretationWarnings: [
          'creditDueNet is a provisional movement proxy derived from settlement snapshots and payment totals, not canonical customer ledger replay.',
          'customerBalances are present-state aggregates and are not limited to the transaction window.',
        ],
      },
      dataSources: this.getDataSourceStatus(),
      assumptions: [
        'Read-model uses transaction settlement snapshots only; no session or expense collections exist in backend yet.',
        'Payment transactions reduce due by full transaction grandTotal in this read model.',
        'Return due reduction uses settlement.creditDue because returnHandling payload is not persisted in current transaction schema.',
      ],
    };
  }

  async getPaymentMix(storeId: string, query: FinanceSummaryQueryDto): Promise<FinancePaymentMixResponseDto> {
    const transactions = await this.findTransactionsInWindow(storeId, query);

    let inflowCash = 0;
    let inflowOnline = 0;
    let outflowCash = 0;
    let outflowOnline = 0;

    for (const tx of transactions) {
      if (tx.type === 'sale' || tx.type === 'payment') {
        inflowCash += tx.settlement.cashPaid;
        inflowOnline += tx.settlement.onlinePaid;
      }
      if (tx.type === 'return') {
        outflowCash += tx.settlement.cashPaid;
        outflowOnline += tx.settlement.onlinePaid;
      }
    }

    const inflowTotal = inflowCash + inflowOnline;

    return {
      window: { dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null },
      inflow: {
        cash: roundMoney(inflowCash),
        online: roundMoney(inflowOnline),
        total: roundMoney(inflowTotal),
        cashSharePct: roundMoney(inflowTotal > 0 ? (inflowCash / inflowTotal) * 100 : 0),
        onlineSharePct: roundMoney(inflowTotal > 0 ? (inflowOnline / inflowTotal) * 100 : 0),
      },
      outflow: {
        cash: roundMoney(outflowCash),
        online: roundMoney(outflowOnline),
        total: roundMoney(outflowCash + outflowOnline),
      },
      net: {
        cash: roundMoney(inflowCash - outflowCash),
        online: roundMoney(inflowOnline - outflowOnline),
        overall: roundMoney(inflowCash + inflowOnline - outflowCash - outflowOnline),
      },
      semantics: {
        definition:
          'Settlement-channel mix of transaction inflows (sale/payment) and return outflows for the selected window.',
        excludes: [
          'Expenses',
          'Delete-compensation outflows',
          'Cash-session balancing differences',
          'Store-credit only flows that do not touch settlement cash/online fields',
        ],
        interpretationWarnings: [
          'This endpoint measures payment-channel movement only; it is not a cashbook close balance.',
          'A low net value can be valid even when sales are high if returns/outflows dominate in the same window.',
        ],
      },
      dataSources: this.getDataSourceStatus(),
      assumptions: [
        'Payment mix currently excludes expenses and delete-compensation cashouts because those collections are not modeled in backend yet.',
        'Return outflows are inferred from settlement snapshot fields.',
      ],
    };
  }

  async getReconciliationOverview(
    storeId: string,
    query: FinanceSummaryQueryDto,
  ): Promise<FinanceReconciliationOverviewResponseDto> {
    const transactions = await this.findTransactionsInWindow(storeId, query);
    const deletedSnapshots = await this.findDeletedInWindow(storeId, query);

    const byType = {
      sale: { count: 0, grossValue: 0 },
      payment: { count: 0, grossValue: 0 },
      return: { count: 0, grossValue: 0 },
      other: { count: 0, grossValue: 0 },
    };

    for (const deleted of deletedSnapshots) {
      const grossValue = deleted.snapshot.totals.grandTotal;
      if (deleted.snapshot.type === 'sale') {
        byType.sale.count += 1;
        byType.sale.grossValue += grossValue;
      } else if (deleted.snapshot.type === 'payment') {
        byType.payment.count += 1;
        byType.payment.grossValue += grossValue;
      } else if (deleted.snapshot.type === 'return') {
        byType.return.count += 1;
        byType.return.grossValue += grossValue;
      } else {
        byType.other.count += 1;
        byType.other.grossValue += grossValue;
      }
    }

    const latestDeletedAt = deletedSnapshots
      .map((item) => item.deletedAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

    return {
      window: { dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null },
      live: {
        transactionCount: transactions.length,
        grossValue: roundMoney(transactions.reduce((sum, item) => sum + item.totals.grandTotal, 0)),
      },
      deletedSnapshots: {
        deletedCount: deletedSnapshots.length,
        grossValue: roundMoney(
          deletedSnapshots.reduce((sum, item) => sum + item.snapshot.totals.grandTotal, 0),
        ),
        byType: {
          sale: { count: byType.sale.count, grossValue: roundMoney(byType.sale.grossValue) },
          payment: { count: byType.payment.count, grossValue: roundMoney(byType.payment.grossValue) },
          return: { count: byType.return.count, grossValue: roundMoney(byType.return.grossValue) },
          other: { count: byType.other.count, grossValue: roundMoney(byType.other.grossValue) },
        },
        latestDeletedAt,
      },
      semantics: {
        definition:
          'Visibility overlay comparing currently-live transactions with deleted snapshots recorded in the selected window.',
        excludes: [
          'Delete-compensation ledger rows',
          'Financial reversal math from deleted events',
          'Expense/session corrections',
        ],
        interpretationWarnings: [
          'deletedSnapshots values are not netted into live values and should be analyzed side-by-side, not merged blindly.',
          'Window is applied on deletedAt for deleted snapshots, not original transactionDate.',
        ],
      },
      dataSources: this.getDataSourceStatus(),
      assumptions: [
        'Reconciliation overview is visibility-only and does not mutate or compensate balances.',
        'Deleted snapshot windowing is based on deletedAt timestamp (audit event time), not original transactionDate.',
        'Delete-compensation records are not present in backend transaction repository and are intentionally excluded.',
      ],
    };
  }

  async getCorrectionsOverview(
    storeId: string,
    query: FinanceSummaryQueryDto,
  ): Promise<FinanceCorrectionsOverviewResponseDto> {
    const deletedSnapshots = await this.findDeletedInWindow(storeId, query);
    const auditEvents = await this.findAuditEventsInWindow(storeId, query);

    const byType = {
      sale: 0,
      payment: 0,
      return: 0,
      other: 0,
    };

    for (const deleted of deletedSnapshots) {
      if (deleted.snapshot.type === 'sale') byType.sale += 1;
      else if (deleted.snapshot.type === 'payment') byType.payment += 1;
      else if (deleted.snapshot.type === 'return') byType.return += 1;
      else byType.other += 1;
    }

    const latestDeletedAt = deletedSnapshots
      .map((item) => item.deletedAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

    return {
      window: { dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null },
      deletedSnapshots: {
        total: deletedSnapshots.length,
        byType,
        latestDeletedAt,
      },
      auditTrail: {
        createdEvents: auditEvents.filter((event) => event.eventType === 'created').length,
        updatedEvents: auditEvents.filter((event) => event.eventType === 'updated').length,
        deletedEvents: auditEvents.filter((event) => event.eventType === 'deleted').length,
      },
      semantics: {
        definition:
          'Correction visibility endpoint for currently persisted correction artifacts: deleted snapshots and transaction audit event stream.',
        excludes: [
          'Delete-compensation records',
          'Cashbook delta records for update corrections',
          'Session-level manual correction notes',
        ],
        interpretationWarnings: [
          'This endpoint is an activity/visibility feed and not a financial impact calculator.',
          'updatedEvents count reflects audit updates only, not guaranteed financial delta events.',
        ],
      },
      dataSources: this.getDataSourceStatus(),
      assumptions: [
        'Corrections overview uses only sources currently persisted in backend transaction repository.',
        'Delete compensation and update cashbook delta records are deferred until dedicated backend domains exist.',
      ],
    };
  }

  async getCorrectionsArtifacts(
    storeId: string,
    query: FinanceCorrectionsArtifactsQueryDto,
  ): Promise<FinanceCorrectionsArtifactsResponseDto> {
    const limit = query.limit ?? 50;
    const deletedSnapshots = await this.findDeletedInWindow(storeId, query);
    const auditEvents = await this.findAuditEventsInWindow(storeId, query);

    const deletedItems = [...deletedSnapshots]
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        originalTransactionId: item.originalTransactionId,
        deletedAt: item.deletedAt,
        type: item.snapshot.type,
        grossValue: roundMoney(item.snapshot.totals.grandTotal),
        reason: item.reason ?? null,
      }));

    const auditItems = [...auditEvents]
      .sort((a, b) => b.eventAt.localeCompare(a.eventAt))
      .slice(0, limit)
      .map((event) => ({
        id: event.id,
        transactionId: event.transactionId,
        eventType: event.eventType,
        eventAt: event.eventAt,
        summary: event.summary ?? null,
      }));

    return {
      window: { dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null },
      deletedSnapshots: {
        total: deletedSnapshots.length,
        items: deletedItems,
      },
      auditEvents: {
        total: auditEvents.length,
        items: auditItems,
      },
      semantics: {
        definition:
          'Raw correction artifact visibility endpoint from currently persisted sources (deleted snapshots and transaction audit events).',
        excludes: [
          'Delete-compensation domain artifacts',
          'Update correction cashbook delta artifacts',
          'Expense/session artifacts',
        ],
        interpretationWarnings: [
          'Items are visibility artifacts and should not be interpreted as net accounting effects.',
          'Missing domains remain explicitly unavailable and are not inferred.',
        ],
      },
      dataSources: this.getDataSourceStatus(),
      assumptions: [
        'Artifacts endpoint intentionally exposes only persisted correction sources already available in transaction repository.',
        'limit applies independently to deletedSnapshots.items and auditEvents.items.',
      ],
    };
  }

  private summarizeCustomerBalances(customers: CustomerDto[]): FinanceSummaryResponseDto['customerBalances'] {
    const totalDue = customers.reduce((sum, customer) => sum + customer.dueBalance, 0);
    const totalStoreCredit = customers.reduce((sum, customer) => sum + customer.storeCreditBalance, 0);

    return {
      totalDue: roundMoney(totalDue),
      totalStoreCredit: roundMoney(totalStoreCredit),
      customersWithDue: customers.filter((customer) => customer.dueBalance > 0).length,
      customersWithStoreCredit: customers.filter((customer) => customer.storeCreditBalance > 0).length,
    };
  }

  private getDataSourceStatus(): FinanceDataSourceStatusDto {
    return {
      transactions: 'available',
      deletedTransactions: 'available',
      customerBalances: 'available',
      expenses: 'unavailable',
      cashSessions: 'unavailable',
      deleteCompensations: 'unavailable',
      updateCorrectionEvents: 'unavailable',
    };
  }

  private async findTransactionsInWindow(
    storeId: string,
    query: FinanceSummaryQueryDto,
  ): Promise<TransactionDto[]> {
    const { items } = await this.transactionsRepository.findMany(storeId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
    return items;
  }

  private async findDeletedInWindow(
    storeId: string,
    query: FinanceSummaryQueryDto,
  ): Promise<DeletedTransactionDto[]> {
    const deleted = await this.transactionsRepository.findDeleted(storeId);
    const dateFromMs = query.dateFrom ? new Date(query.dateFrom).getTime() : Number.NEGATIVE_INFINITY;
    const dateToMs = query.dateTo ? new Date(query.dateTo).getTime() : Number.POSITIVE_INFINITY;

    return deleted.filter((item) => {
      const deletedAtMs = new Date(item.deletedAt).getTime();
      return deletedAtMs >= dateFromMs && deletedAtMs <= dateToMs;
    });
  }

  private async findAuditEventsInWindow(
    storeId: string,
    query: FinanceSummaryQueryDto,
  ): Promise<TransactionAuditEventDto[]> {
    const events = await this.transactionsRepository.findAuditEventsByStore(storeId);
    const dateFromMs = query.dateFrom ? new Date(query.dateFrom).getTime() : Number.NEGATIVE_INFINITY;
    const dateToMs = query.dateTo ? new Date(query.dateTo).getTime() : Number.POSITIVE_INFINITY;

    return events.filter((event) => {
      const eventAtMs = new Date(event.eventAt).getTime();
      return eventAtMs >= dateFromMs && eventAtMs <= dateToMs;
    });
  }
}
