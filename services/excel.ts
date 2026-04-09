
import * as XLSX from 'xlsx';
import { Product, Transaction, Customer } from '../types';
import { NO_COLOR, NO_VARIANT } from './productVariants';
import { getReturnCashRefundAmount, getResolvedReturnHandlingMode, getSaleSettlementBreakdown, loadData } from './storage';

type TransactionFinanceEffect = {
    txId: string;
    type: Transaction['type'];
    paymentMethod?: Transaction['paymentMethod'];
    cashPaid: number;
    onlinePaid: number;
    creditDue: number;
    storeCreditUsed: number;
    returnMode: string;
    cashRefund: number;
    onlineRefund: number;
    dueReduction: number;
    storeCreditCreated: number;
    cogs: number;
    profitContribution: number;
    cashCollection: number;
    onlineCollection: number;
};

const txTime = (tx: Transaction) => new Date(tx.date).getTime();

const buildTransactionEffects = (transactions: Transaction[]) => {
    const sorted = [...transactions].sort((a, b) => txTime(a) - txTime(b));
    const byId = new Map<string, TransactionFinanceEffect>();
    const runningDue = new Map<string, number>();
    const runningStoreCredit = new Map<string, number>();

    sorted.forEach((tx, index) => {
        const amount = Math.abs(Number(tx.total || 0));
        const customerId = tx.customerId || '__walk_in__';
        const dueBefore = runningDue.get(customerId) || 0;
        const scBefore = runningStoreCredit.get(customerId) || 0;
        const cogs = (tx.items || []).reduce((sum, item) => sum + ((item.buyPrice || 0) * (item.quantity || 0)), 0);

        const base: TransactionFinanceEffect = {
            txId: tx.id,
            type: tx.type,
            paymentMethod: tx.paymentMethod,
            cashPaid: 0,
            onlinePaid: 0,
            creditDue: 0,
            storeCreditUsed: Math.max(0, Number(tx.storeCreditUsed || 0)),
            returnMode: tx.type === 'return' ? getResolvedReturnHandlingMode(tx) : '',
            cashRefund: 0,
            onlineRefund: 0,
            dueReduction: 0,
            storeCreditCreated: 0,
            cogs,
            profitContribution: 0,
            cashCollection: 0,
            onlineCollection: 0,
        };

        if (tx.type === 'sale') {
            const settlement = getSaleSettlementBreakdown(tx);
            base.cashPaid = settlement.cashPaid;
            base.onlinePaid = settlement.onlinePaid;
            base.creditDue = settlement.creditDue;
            runningDue.set(customerId, Math.max(0, dueBefore + settlement.creditDue));
            runningStoreCredit.set(customerId, Math.max(0, scBefore - base.storeCreditUsed));
            base.profitContribution = amount - cogs;
        } else if (tx.type === 'payment') {
            const dueReduction = Math.min(dueBefore, amount);
            const storeCreditCreated = Math.max(0, amount - dueReduction);
            base.dueReduction = dueReduction;
            base.storeCreditCreated = storeCreditCreated;
            base.cashCollection = (tx.paymentMethod || 'Cash') === 'Cash' ? amount : 0;
            base.onlineCollection = tx.paymentMethod === 'Online' ? amount : 0;
            runningDue.set(customerId, Math.max(0, dueBefore - dueReduction));
            runningStoreCredit.set(customerId, Math.max(0, scBefore + storeCreditCreated));
        } else {
            const mode = getResolvedReturnHandlingMode(tx);
            const historical = sorted.slice(0, index);
            if (mode === 'refund_cash') {
                base.cashRefund = getReturnCashRefundAmount(tx, historical);
                const remaining = Math.max(0, amount - base.cashRefund);
                base.dueReduction = Math.min(dueBefore, remaining);
                base.storeCreditCreated = Math.max(0, remaining - base.dueReduction);
            } else if (mode === 'refund_online') {
                base.onlineRefund = amount;
            } else if (mode === 'reduce_due') {
                base.dueReduction = Math.min(dueBefore, amount);
                base.storeCreditCreated = Math.max(0, amount - base.dueReduction);
            } else {
                base.storeCreditCreated = amount;
            }
            runningDue.set(customerId, Math.max(0, dueBefore - base.dueReduction));
            runningStoreCredit.set(customerId, Math.max(0, scBefore + base.storeCreditCreated));
            base.profitContribution = -(amount - cogs);
        }

        byId.set(tx.id, base);
    });

    return byId;
};

/**
 * Utility to trigger download of an Excel file
 */
const downloadExcel = (workbook: XLSX.WorkBook, fileName: string) => {
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * Export Products/Inventory to Excel
 */
export const exportProductsToExcel = (products: Product[]) => {
    const data = products.map(p => ({
        'Barcode': p.barcode,
        'Product Name': p.name,
        'Category': p.category || '-',
        'Variants': (p.variants || []).join(', ') || NO_VARIANT,
        'Colors': (p.colors || []).join(', ') || NO_COLOR,
        'HSN/SAC': p.hsn || '-',
        'Buy Price (₹)': p.buyPrice,
        'Sell Price (₹)': p.sellPrice,
        'Total Purchase': p.totalPurchase ?? ((p.stock || 0) + (p.totalSold || 0)),
        'Total Sold': p.totalSold || 0,
        'Current Stock': p.stock,
        'Stock Value (Buy)': p.stock * p.buyPrice,
        'Stock Value (Sell)': p.stock * p.sellPrice,
        'Status': p.stock <= 0 ? 'Out of Stock' : p.stock < 5 ? 'Low Stock' : 'Available'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    
    // Set column widths
    const wscols = [
        { wch: 15 }, // Barcode
        { wch: 30 }, // Name
        { wch: 15 }, // Category
        { wch: 12 }, // HSN
        { wch: 12 }, // Buy Price
        { wch: 12 }, // Sell Price
        { wch: 12 }, // Stock
        { wch: 12 }, // Total Sold
        { wch: 15 }, // Stock Value Buy
        { wch: 15 }, // Stock Value Sell
        { wch: 15 }, // Status
    ];
    worksheet['!cols'] = wscols;

    downloadExcel(workbook, `Inventory_Report_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Export Transactions to Excel
 */
export const exportTransactionsToExcel = (transactions: Transaction[]) => {
    const effects = buildTransactionEffects(transactions);
    const data = transactions.map(t => {
        const fx = effects.get(t.id);
        return {
        'txId': t.id,
        'Date': new Date(t.date).toLocaleString(),
        'customerId': t.customerId || '',
        'Type': t.type.toUpperCase(),
        'Subtotal (₹)': t.subtotal || Math.abs(t.total),
        'Discount (₹)': t.discount || 0,
        'Tax (₹)': t.tax || 0,
        'Total (₹)': t.total,
        'Payment Method': t.paymentMethod || 'Cash',
        'cashPaid': fx?.cashPaid || 0,
        'onlinePaid': fx?.onlinePaid || 0,
        'creditDue': fx?.creditDue || 0,
        'storeCreditUsed': fx?.storeCreditUsed || 0,
        'returnMode': fx?.returnMode || '',
        'cashRefund': fx?.cashRefund || 0,
        'onlineRefund': fx?.onlineRefund || 0,
        'dueReduction': fx?.dueReduction || 0,
        'storeCreditCreated': fx?.storeCreditCreated || 0,
        'cogs': fx?.cogs || 0,
        'profitContribution': fx?.profitContribution || 0
    }});

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    const wscols = [
        { wch: 20 }, // Date
        { wch: 15 }, // Invoice ID
        { wch: 10 }, // Type
        { wch: 25 }, // Customer
        { wch: 12 }, // Items Count
        { wch: 12 }, // Subtotal
        { wch: 12 }, // Discount
        { wch: 12 }, // Tax
        { wch: 12 }, // Total
        { wch: 15 }, // Payment Method
    ];
    worksheet['!cols'] = wscols;

    downloadExcel(workbook, `Transactions_Report_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Export Detailed Sales (Items level) to Excel
 */
export const exportDetailedSalesToExcel = (transactions: Transaction[]) => {
    const effects = buildTransactionEffects(transactions);
    const data: any[] = [];
    
    transactions.forEach(t => {
        const fx = effects.get(t.id);
        if (!t.items.length) {
            data.push({
                'txId': t.id,
                'date': new Date(t.date).toLocaleString(),
                'customerId': t.customerId || '',
                'type': t.type,
                'productId': '',
                'qty': 0,
                'unitPrice': 0,
                'subtotal': t.subtotal || Math.abs(t.total),
                'discount': t.discount || 0,
                'tax': t.tax || 0,
                'total': t.total,
                'cashPaid': fx?.cashPaid || 0,
                'onlinePaid': fx?.onlinePaid || 0,
                'creditDue': fx?.creditDue || 0,
                'storeCreditUsed': fx?.storeCreditUsed || 0,
                'returnMode': fx?.returnMode || '',
                'cashRefund': fx?.cashRefund || 0,
                'onlineRefund': fx?.onlineRefund || 0,
                'dueReduction': fx?.dueReduction || 0,
                'storeCreditCreated': fx?.storeCreditCreated || 0,
                'cogs': 0,
                'profitContribution': 0,
            });
            return;
        }
        t.items.forEach(item => {
            const lineSubtotal = (item.sellPrice || 0) * (item.quantity || 0);
            const lineDiscount = item.discountAmount || 0;
            const lineNet = lineSubtotal - lineDiscount;
            const lineCogs = (item.buyPrice || 0) * (item.quantity || 0);
            const sign = t.type === 'return' ? -1 : 1;
            const lineProfit = sign * (lineNet - lineCogs);
            data.push({
                'txId': t.id,
                'date': new Date(t.date).toLocaleString(),
                'customerId': t.customerId || '',
                'type': t.type,
                'productId': item.id,
                'qty': item.quantity,
                'unitPrice': item.sellPrice,
                'subtotal': lineSubtotal,
                'discount': lineDiscount,
                'tax': t.tax || 0,
                'total': t.total,
                'cashPaid': fx?.cashPaid || 0,
                'onlinePaid': fx?.onlinePaid || 0,
                'creditDue': fx?.creditDue || 0,
                'storeCreditUsed': fx?.storeCreditUsed || 0,
                'returnMode': fx?.returnMode || '',
                'cashRefund': fx?.cashRefund || 0,
                'onlineRefund': fx?.onlineRefund || 0,
                'dueReduction': fx?.dueReduction || 0,
                'storeCreditCreated': fx?.storeCreditCreated || 0,
                'cogs': lineCogs,
                'profitContribution': lineProfit,
                'Item Name': item.name,
                'Variant': item.selectedVariant || NO_VARIANT,
                'Color': item.selectedColor || NO_COLOR,
                'Barcode': item.barcode
            });
        });
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaction_Finance');

    const { expenses, cashSessions } = loadData();
    const grossSales = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + Math.abs(t.total), 0);
    const salesReturns = transactions.filter(t => t.type === 'return').reduce((sum, t) => sum + Math.abs(t.total), 0);
    const netSales = grossSales - salesReturns;
    const cogsSales = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + ((effects.get(t.id)?.cogs || 0)), 0);
    const cogsReturn = transactions.filter(t => t.type === 'return').reduce((sum, t) => sum + ((effects.get(t.id)?.cogs || 0)), 0);
    const cogsNet = cogsSales - cogsReturn;
    const grossProfit = netSales - cogsNet;
    const expenseTotal = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = grossProfit - expenseTotal;

    const revenueSummary = XLSX.utils.json_to_sheet([
        { metric: 'Gross Sales', value: grossSales },
        { metric: 'Sales Returns', value: salesReturns },
        { metric: 'Net Sales', value: netSales },
        { metric: 'COGS', value: cogsNet },
        { metric: 'Gross Profit', value: grossProfit },
        { metric: 'Net Profit (after expenses)', value: netProfit },
    ]);
    XLSX.utils.book_append_sheet(workbook, revenueSummary, 'Revenue_Summary');

    const settlementSummary = XLSX.utils.json_to_sheet([
        { metric: 'Cash Paid at Sale', value: transactions.reduce((s, t) => s + (effects.get(t.id)?.cashPaid || 0), 0) },
        { metric: 'Online Paid at Sale', value: transactions.reduce((s, t) => s + (effects.get(t.id)?.onlinePaid || 0), 0) },
        { metric: 'Credit Created', value: transactions.reduce((s, t) => s + (effects.get(t.id)?.creditDue || 0), 0) },
        { metric: 'Cash Collections', value: transactions.reduce((s, t) => s + (effects.get(t.id)?.cashCollection || 0), 0) },
        { metric: 'Online Collections', value: transactions.reduce((s, t) => s + (effects.get(t.id)?.onlineCollection || 0), 0) },
        { metric: 'Cash Refunds', value: transactions.reduce((s, t) => s + (effects.get(t.id)?.cashRefund || 0), 0) },
        { metric: 'Online Refunds', value: transactions.reduce((s, t) => s + (effects.get(t.id)?.onlineRefund || 0), 0) },
        { metric: 'Store Credit Created', value: transactions.reduce((s, t) => s + (effects.get(t.id)?.storeCreditCreated || 0), 0) },
        { metric: 'Store Credit Used', value: transactions.reduce((s, t) => s + (effects.get(t.id)?.storeCreditUsed || 0), 0) },
    ]);
    XLSX.utils.book_append_sheet(workbook, settlementSummary, 'Settlement_Summary');

    const openSession = (cashSessions || []).find(session => session.status === 'open');
    const openingCash = openSession?.openingBalance || 0;
    const cashSales = transactions.reduce((sum, tx) => sum + (effects.get(tx.id)?.cashPaid || 0), 0);
    const cashCollections = transactions.reduce((sum, tx) => sum + (effects.get(tx.id)?.cashCollection || 0), 0);
    const cashRefunds = transactions.reduce((sum, tx) => sum + (effects.get(tx.id)?.cashRefund || 0), 0);
    const closingEstimate = openingCash + cashSales + cashCollections - cashRefunds - expenseTotal;
    const operationalCash = XLSX.utils.json_to_sheet([
        { metric: 'Opening Cash', value: openingCash },
        { metric: 'Cash Sales', value: cashSales },
        { metric: 'Cash Collections', value: cashCollections },
        { metric: 'Cash Refunds', value: cashRefunds },
        { metric: 'Expenses', value: expenseTotal },
        { metric: 'Closing Cash (estimate)', value: closingEstimate },
    ]);
    XLSX.utils.book_append_sheet(workbook, operationalCash, 'Operational_Cash');

    const wscols = [
        { wch: 20 }, // Date
        { wch: 15 }, // Invoice ID
        { wch: 10 }, // Type
        { wch: 20 }, // Customer
        { wch: 30 }, // Item Name
        { wch: 15 }, // Barcode
        { wch: 10 }, // Quantity
        { wch: 12 }, // Unit Price
        { wch: 12 }, // Discount
        { wch: 12 }, // Total
        { wch: 12 }, // Payment
    ];
    worksheet['!cols'] = wscols;

    downloadExcel(workbook, `Detailed_Sales_Report_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Export Customers to Excel
 */
export const exportCustomersToExcel = (customers: Customer[]) => {
    const data = customers.map(c => ({
        'Name': c.name,
        'Phone': c.phone,
        'Total Spend (₹)': c.totalSpend,
        'Total Due (₹)': c.totalDue || 0,
        'Visit Count': c.visitCount,
        'Last Visit': c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    const wscols = [
        { wch: 25 }, // Name
        { wch: 15 }, // Phone
        { wch: 15 }, // Spend
        { wch: 15 }, // Due
        { wch: 12 }, // Visit Count
        { wch: 15 }, // Last Visit
    ];
    worksheet['!cols'] = wscols;

    downloadExcel(workbook, `Customers_Report_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Export Single Invoice to Excel
 */
export const exportInvoiceToExcel = (transaction: Transaction) => {
    const { profile } = loadData();
    
    // Header Info
    const header = [
        [profile.storeName],
        [profile.addressLine1 || ''],
        [profile.addressLine2 || ''],
        [`Phone: ${profile.phone || ''}`],
        [`GSTIN: ${profile.gstin || ''}`],
        [],
        ['INVOICE'],
        [`Invoice No: IN-${transaction.id.slice(-6)}`],
        [`Date: ${new Date(transaction.date).toLocaleString()}`],
        [`Customer: ${transaction.customerName || 'Walk-in'}`],
        [`Payment Method: ${transaction.paymentMethod || 'Cash'}`],
        []
    ];

    // Items
    const itemsHeader = [['#', 'Item Name', 'HSN', 'Qty', 'Price', 'Discount', 'Total']];
    const itemsData = transaction.items.map((item, idx) => [
        idx + 1,
`${item.name} - ${item.selectedVariant || NO_VARIANT} - ${item.selectedColor || NO_COLOR}`,
        item.hsn || '-',
        item.quantity,
        item.sellPrice,
        item.discountAmount || 0,
        (item.sellPrice * item.quantity) - (item.discountAmount || 0)
    ]);

    // Summary
    const summary = [
        [],
        ['', '', '', '', '', 'Subtotal', transaction.subtotal || transaction.total],
        ['', '', '', '', '', 'Discount', transaction.discount || 0],
        ['', '', '', '', '', 'Tax', transaction.tax || 0],
        ['', '', '', '', '', 'Grand Total', transaction.total]
    ];

    const combinedData = [...header, ...itemsHeader, ...itemsData, ...summary];
    const worksheet = XLSX.utils.aoa_to_sheet(combinedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice');

    downloadExcel(workbook, `Invoice_${transaction.id.slice(-6)}`);
};

/**
 * Export Customer Statement to Excel
 */
export const exportCustomerStatementToExcel = (customer: Customer, history: any[]) => {
    const { profile } = loadData();
    
    const header = [
        [profile.storeName],
        [`Customer Statement: ${customer.name}`],
        [`Phone: ${customer.phone}`],
        [`Period: ${history.length > 0 ? new Date(history[0].date).toLocaleDateString() : 'N/A'} To ${new Date().toLocaleDateString()}`],
        []
    ];

    const tableHeader = [['Date', 'Description', 'Debit (₹)', 'Credit (₹)', 'Type', 'Balance (₹)']];
    
    const txHistory = history.filter((entry: any) => entry?.type === 'sale' || entry?.type === 'return' || entry?.type === 'payment') as Transaction[];
    const effects = buildTransactionEffects(txHistory);
    let runningDue = 0;
    let runningStoreCredit = 0;
    const tableData = txHistory
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(tx => {
        const amount = Math.abs(tx.total);
        const fx = effects.get(tx.id)!;
        const netBefore = runningDue - runningStoreCredit;
        if (tx.type === 'sale') {
            runningDue += fx.creditDue;
            runningStoreCredit = Math.max(0, runningStoreCredit - fx.storeCreditUsed);
        } else {
            runningDue = Math.max(0, runningDue - fx.dueReduction);
            runningStoreCredit += fx.storeCreditCreated;
        }
        const netAfter = runningDue - runningStoreCredit;
        const delta = netAfter - netBefore;
        const desc = tx.type === 'sale'
          ? `Invoice #${tx.id.slice(-6)} (Paid ₹${(fx.cashPaid + fx.onlinePaid).toFixed(2)}, Due +₹${fx.creditDue.toFixed(2)})`
          : tx.type === 'payment'
            ? `Payment #${tx.id.slice(-6)} (${tx.paymentMethod || 'Cash'} ₹${amount.toFixed(2)}, Due -₹${fx.dueReduction.toFixed(2)}${fx.storeCreditCreated > 0 ? `, SC +₹${fx.storeCreditCreated.toFixed(2)}` : ''})`
            : `Return #${tx.id.slice(-6)} (${fx.returnMode}: Cash ₹${fx.cashRefund.toFixed(2)}, Online ₹${fx.onlineRefund.toFixed(2)}, Due -₹${fx.dueReduction.toFixed(2)}, SC +₹${fx.storeCreditCreated.toFixed(2)})`;
        return [
            new Date(tx.date).toLocaleDateString(),
            desc,
            delta > 0 ? delta.toFixed(2) : '',
            delta < 0 ? Math.abs(delta).toFixed(2) : '',
            netAfter >= 0 ? 'Dr' : 'Cr',
            Math.abs(netAfter).toFixed(2)
        ];
    });

    const summary = [
        [],
        ['', '', '', '', 'Final Balance', tableData.length ? tableData[tableData.length - 1][5] : '0.00']
    ];

    const combinedData = [...header, ...tableHeader, ...tableData, ...summary];
    const worksheet = XLSX.utils.aoa_to_sheet(combinedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement');

    downloadExcel(workbook, `Statement_${customer.name.replace(/\s+/g, '_')}`);
};
