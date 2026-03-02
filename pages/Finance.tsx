import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/ui';
import { loadData, saveData, processTransaction } from '../services/storage';
import { AppState, Customer, Transaction } from '../types';
import { AlertCircle, DollarSign, Wallet, ReceiptIndianRupee, BarChart3 } from 'lucide-react';

type CashSession = {
  id: string;
  startTime: string;
  endTime?: string;
  openingBalance: number;
  closingBalance?: number;
  systemCashTotal?: number;
  difference?: number;
  status: 'open' | 'closed';
};

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  note?: string;
  createdAt: string;
};

type FinanceTabKey = 'cash' | 'expense' | 'credit' | 'profit';

const dateKeyFromDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const todayISO = () => dateKeyFromDate(new Date());

const previousDayISO = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return dateKeyFromDate(date);
};

const isSameDay = (iso: string, dateKey: string) => dateKeyFromDate(new Date(iso)) === dateKey;

const monthKeyOf = (iso: string) => {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

const formatINR = (value: number) => `₹${value.toFixed(2)}`;

function StatCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'bad' }) {
  const toneClasses = tone === 'good'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : tone === 'bad'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-border bg-muted/30';

  return (
    <div className={`rounded-lg border p-3 ${toneClasses}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}


function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'emerald' | 'amber' | 'rose' }) {
  const cls = tone === 'emerald'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : tone === 'rose'
        ? 'bg-rose-50 text-rose-700 ring-rose-200'
        : 'bg-slate-100 text-slate-700 ring-slate-200';

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}>{children}</span>;
}

function MoneyTile({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'emerald' | 'rose' }) {
  const theme = tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50'
    : tone === 'rose'
      ? 'border-rose-200 bg-rose-50'
      : 'border-slate-200 bg-slate-50';

  const labelCls = tone === 'emerald'
    ? 'text-emerald-700'
    : tone === 'rose'
      ? 'text-rose-700'
      : 'text-slate-500';

  const valueCls = tone === 'emerald'
    ? 'text-emerald-800'
    : tone === 'rose'
      ? 'text-rose-800'
      : 'text-slate-900';

  return (
    <div className={`rounded-lg border px-3 py-2 ${theme}`}>
      <div className={`text-[11px] font-medium ${labelCls}`}>{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${valueCls}`}>{value}</div>
    </div>
  );
}

export default function Finance() {
  const [data, setData] = useState<AppState>(loadData());
  const [errors, setErrors] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('cash');

  const [openingBalance, setOpeningBalance] = useState('');
  const [openingBalanceAutoFilled, setOpeningBalanceAutoFilled] = useState(false);
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [openingBalanceEditValue, setOpeningBalanceEditValue] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [cashHistoryRange, setCashHistoryRange] = useState<'today' | '7d' | '30d' | 'all'>('today');

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('General');
  const [expenseNote, setExpenseNote] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [expenseDateFilter, setExpenseDateFilter] = useState(todayISO());

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Online'>('Cash');
  const [collectingCustomer, setCollectingCustomer] = useState<Customer | null>(null);

  const [profitDate, setProfitDate] = useState(todayISO());
  const [profitMonth, setProfitMonth] = useState(new Date().toISOString().slice(0, 7));

  const refreshData = () => setData(loadData());

  const cashSessions: CashSession[] = useMemo(() => data.cashSessions || [], [data]);
  const expenses: Expense[] = useMemo(() => data.expenses || [], [data]);
  const expenseCategories: string[] = useMemo(() => {
    const defaults = ['General'];
    const existing = data.expenseCategories || [];
    return Array.from(new Set([...defaults, ...existing]));
  }, [data]);

  const openSession = cashSessions.find(s => s.status === 'open');
  const cashHistory = [...cashSessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const filteredCashHistory = useMemo(() => {
    const now = new Date();

    if (cashHistoryRange === 'all') return cashHistory;
    if (cashHistoryRange === 'today') return cashHistory.filter(session => isSameDay(session.startTime, todayISO()));

    const daysBack = cashHistoryRange === '7d' ? 7 : 30;
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (daysBack - 1));

    return cashHistory.filter(session => new Date(session.startTime) >= cutoff);
  }, [cashHistory, cashHistoryRange]);

  const isAdmin = true;
  const todayKey = todayISO();
  const previousDayKey = previousDayISO();
  const todaySessionExists = cashSessions.some(session => isSameDay(session.startTime, todayKey));
  const isOpenSessionToday = !!openSession && isSameDay(openSession.startTime, todayKey);

  const previousDayClosedSession = useMemo(() => {
    return cashHistory.find(session => session.status === 'closed' && isSameDay(session.startTime, previousDayKey) && Number.isFinite(session.closingBalance));
  }, [cashHistory, previousDayKey]);

  useEffect(() => {
    if (openSession || todaySessionExists || openingBalance.trim() || editingOpeningBalance) return;

    if (previousDayClosedSession?.closingBalance !== undefined) {
      setOpeningBalance(previousDayClosedSession.closingBalance.toFixed(2));
      setOpeningBalanceAutoFilled(true);
      return;
    }

    setOpeningBalanceAutoFilled(false);
  }, [openSession, openingBalance, previousDayClosedSession, todaySessionExists, editingOpeningBalance]);

  const buildCashSessionId = (sessions: CashSession[]) => {
    const existingIds = new Set(sessions.map(session => session.id));
    let candidate = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    while (existingIds.has(candidate)) {
      candidate = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    }

    return candidate;
  };

  const dailyCashTotals = useMemo(() => {
    const key = todayISO();
    const cashSales = data.transactions
      .filter(t => t.type === 'sale' && t.paymentMethod === 'Cash' && isSameDay(t.date, key))
      .reduce((sum, t) => sum + t.total, 0);

    const cashRefunds = data.transactions
      .filter(t => t.type === 'return' && t.paymentMethod === 'Cash' && isSameDay(t.date, key))
      .reduce((sum, t) => sum + Math.abs(t.total), 0);

    return { cashSales, cashRefunds, systemCashTotal: cashSales - cashRefunds };
  }, [data.transactions]);

  const expensesForDate = useMemo(() => expenses.filter(e => isSameDay(e.createdAt, expenseDateFilter)), [expenses, expenseDateFilter]);
  const expensesTotalForDate = useMemo(() => expensesForDate.reduce((sum, e) => sum + e.amount, 0), [expensesForDate]);

  const creditCustomers = useMemo(() => data.customers.filter(c => c.totalDue > 0).sort((a, b) => b.totalDue - a.totalDue), [data.customers]);

  const dailyProfit = useMemo(() => {
    const sales = data.transactions.filter(t => t.type === 'sale' && isSameDay(t.date, profitDate)).reduce((sum, t) => sum + t.total, 0);
    const cogs = data.transactions
      .filter(t => t.type === 'sale' && isSameDay(t.date, profitDate))
      .reduce((sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + ((item.buyPrice || 0) * item.quantity), 0), 0);
    const expenseSum = expenses.filter(e => isSameDay(e.createdAt, profitDate)).reduce((sum, e) => sum + e.amount, 0);

    return { sales, cogs, expenses: expenseSum, profit: sales - cogs - expenseSum };
  }, [data.transactions, expenses, profitDate]);

  const monthlyProfit = useMemo(() => {
    const sales = data.transactions.filter(t => t.type === 'sale' && monthKeyOf(t.date) === profitMonth).reduce((sum, t) => sum + t.total, 0);
    const cogs = data.transactions
      .filter(t => t.type === 'sale' && monthKeyOf(t.date) === profitMonth)
      .reduce((sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + ((item.buyPrice || 0) * item.quantity), 0), 0);
    const expenseSum = expenses.filter(e => monthKeyOf(e.createdAt) === profitMonth).reduce((sum, e) => sum + e.amount, 0);

    return { sales, expenses: expenseSum, profit: sales - cogs - expenseSum };
  }, [data.transactions, expenses, profitMonth]);

  const persistState = async (newState: AppState) => {
    try {
      await saveData(newState, { throwOnError: true });
      refreshData();
      setErrors(null);
    } catch (error) {
      console.error('[finance] Persist failed', error);
      setErrors('Unable to save finance data. Please try again.');
    }
  };

  const startShift = async () => {
    if (!isAdmin) return setErrors('Only admin can start or close shifts.');
    if (todaySessionExists) return setErrors('Cash session for today already exists.');
    if (openSession) return setErrors('An open cash session already exists.');

    const autoCarryBalance = previousDayClosedSession?.closingBalance;
    const value = openingBalance.trim() ? Number(openingBalance) : (autoCarryBalance !== undefined ? autoCarryBalance : Number.NaN);
    if (!Number.isFinite(value) || value < 0) return setErrors('Please enter a valid opening balance.');

    const session: CashSession = { id: buildCashSessionId(cashSessions), startTime: new Date().toISOString(), openingBalance: value, status: 'open' };
    await persistState({ ...data, cashSessions: [session, ...(data.cashSessions || [])] });
    setOpeningBalance('');
    setOpeningBalanceAutoFilled(false);
  };

  const closeShift = async () => {
    if (!isAdmin) return setErrors('Only admin can start or close shifts.');
    if (!openSession) return setErrors('No open cash session found.');

    const counted = Number(closingBalance);
    if (!Number.isFinite(counted) || counted < 0) return setErrors('Please enter a valid closing cash value.');

    const systemCashTotal = dailyCashTotals.systemCashTotal;
    const expectedClosing = openSession.openingBalance + systemCashTotal;
    const difference = counted - expectedClosing;

    const updated = (data.cashSessions || []).map(session => session.id === openSession.id ? {
      ...session,
      endTime: new Date().toISOString(),
      closingBalance: counted,
      systemCashTotal,
      difference,
      status: 'closed' as const
    } : session);

    await persistState({ ...data, cashSessions: updated });
    setClosingBalance('');
  };

  const startOpeningBalanceEdit = () => {
    if (!openSession || !isOpenSessionToday || !isAdmin) return;
    setOpeningBalanceEditValue(openSession.openingBalance.toFixed(2));
    setEditingOpeningBalance(true);
    setErrors(null);
  };

  const cancelOpeningBalanceEdit = () => {
    setEditingOpeningBalance(false);
    setOpeningBalanceEditValue('');
  };

  const saveOpeningBalanceEdit = async () => {
    if (!openSession || !isOpenSessionToday || !isAdmin) return setErrors('Only admin can start or close shifts.');

    const value = Number(openingBalanceEditValue);
    if (!Number.isFinite(value) || value < 0) return setErrors('Please enter a valid opening balance.');

    const updated = (data.cashSessions || []).map(session => session.id === openSession.id ? { ...session, openingBalance: value } : session);
    await persistState({ ...data, cashSessions: updated });
    setEditingOpeningBalance(false);
    setOpeningBalanceEditValue('');
  };

  const addExpense = async () => {
    const amount = Number(expenseAmount);
    if (!expenseTitle.trim() || !expenseCategory.trim() || !Number.isFinite(amount) || amount <= 0) return setErrors('Please enter valid expense details.');

    const expense: Expense = {
      id: Date.now().toString(),
      title: expenseTitle.trim(),
      amount,
      category: expenseCategory.trim(),
      note: expenseNote.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const categories = Array.from(new Set([...(data.expenseCategories || []), expense.category]));
    await persistState({ ...data, expenses: [expense, ...(data.expenses || [])], expenseCategories: categories });

    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseNote('');
  };

  const addExpenseCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;

    const categories = Array.from(new Set([...(data.expenseCategories || []), name]));
    await persistState({ ...data, expenseCategories: categories });
    setNewCategory('');
  };

  const deleteExpenseCategory = async (name: string) => {
    const isUsed = (data.expenses || []).some(e => e.category === name);
    if (isUsed) return setErrors('Cannot delete category that is used by expenses.');

    await persistState({ ...data, expenseCategories: (data.expenseCategories || []).filter(c => c !== name) });
  };

  const exportExpensePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Daily Expense Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Date: ${expenseDateFilter}`, 14, 26);

    let y = 36;
    expensesForDate.forEach((e, idx) => {
      doc.text(`${idx + 1}. ${e.title} (${e.category}) - ₹${e.amount.toFixed(2)}`, 14, y);
      y += 7;
      if (e.note) {
        doc.setTextColor(110);
        doc.text(`Note: ${e.note}`, 18, y);
        doc.setTextColor(0);
        y += 6;
      }
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    doc.setFontSize(12);
    doc.text(`Total Expenses: ₹${expensesTotalForDate.toFixed(2)}`, 14, y + 8);
    doc.save(`expenses-${expenseDateFilter}.pdf`);
  };

  const collectPayment = async () => {
    if (!collectingCustomer) return;

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return setErrors('Please enter a valid payment amount.');

    const tx: Transaction = {
      id: Date.now().toString(),
      items: [],
      total: amount,
      date: new Date().toISOString(),
      type: 'payment',
      customerId: collectingCustomer.id,
      customerName: collectingCustomer.name,
      paymentMethod: paymentMethod === 'Online' ? 'Online' : 'Cash'
    };

    try {
      const nextState = processTransaction(tx);
      setData(nextState);
      setCollectingCustomer(null);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setErrors(null);
    } catch (error) {
      console.error('[finance] Collect payment failed', error);
      setErrors('Unable to collect payment. Please try again.');
    }
  };

  const chartMax = Math.max(monthlyProfit.sales, monthlyProfit.expenses, 1);

  const tabs: Array<{ key: FinanceTabKey; label: string; icon: React.ReactNode }> = [
    { key: 'cash', label: 'Cash Management', icon: <Wallet className="w-4 h-4" /> },
    { key: 'expense', label: 'Expense Management', icon: <ReceiptIndianRupee className="w-4 h-4" /> },
    { key: 'credit', label: 'Credit Management', icon: <DollarSign className="w-4 h-4" /> },
    { key: 'profit', label: 'Profit Summary', icon: <BarChart3 className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="text-sm text-slate-600">Manage cash sessions, expenses, customer credit, and profit summary.</p>
        </div>

        {errors && (
          <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {errors}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'cash' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" /> Cash Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Opening Balance" value={formatINR(openSession?.openingBalance ?? Number(openingBalance || 0))} />
                    <StatCard label="Closing Cash Counted" value={formatINR(Number(closingBalance || 0))} />
                    <div className="col-span-2">
                      <StatCard label="System Cash Total (today)" value={formatINR(dailyCashTotals.systemCashTotal)} />
                    </div>
                  </div>

                  {todaySessionExists && !openSession && <p className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 p-2 text-sm">Cash session for today already exists.</p>}

                  {!openSession ? (
                    <div className="space-y-2">
                      <Label>Opening Balance</Label>
                      <Input type="number" min="0" value={openingBalance} onChange={e => { setOpeningBalance(e.target.value); if (openingBalanceAutoFilled) setOpeningBalanceAutoFilled(false); }} placeholder="Enter opening balance" />
                      {openingBalanceAutoFilled && <p className="text-xs text-muted-foreground">Auto-filled from previous day closing cash.</p>}
                      <Button onClick={startShift}>Start Shift</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded border bg-muted/20">
                        <p className="text-sm">Current shift started: <span className="font-semibold">{new Date(openSession.startTime).toLocaleString()}</span></p>
                        <p className="text-sm">Opening balance: <span className="font-semibold">{formatINR(openSession.openingBalance)}</span></p>
                        {isOpenSessionToday && isAdmin && !editingOpeningBalance && <Button className="mt-2" size="sm" variant="outline" onClick={startOpeningBalanceEdit}>Edit Opening Balance</Button>}
                      </div>

                      {editingOpeningBalance && (
                        <div className="space-y-2 p-3 rounded border bg-muted/20">
                          <Label>Edit Opening Balance</Label>
                          <Input type="number" min="0" value={openingBalanceEditValue} onChange={e => setOpeningBalanceEditValue(e.target.value)} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveOpeningBalanceEdit}>Save</Button>
                            <Button size="sm" variant="outline" onClick={cancelOpeningBalanceEdit}>Cancel</Button>
                          </div>
                        </div>
                      )}

                      <Label>Closing Cash Counted</Label>
                      <Input type="number" min="0" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} placeholder="Enter counted closing cash" />
                      <Button variant="outline" onClick={closeShift}>Close Shift</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-7">
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">Cash History</h2>
                      <p className="mt-1 text-sm text-slate-600">Clean view of each session with key totals and variance.</p>
                    </div>
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      value={cashHistoryRange}
                      onChange={e => setCashHistoryRange(e.target.value as 'today' | '7d' | '30d' | 'all')}
                    >
                      <option value="today">Today</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="all">All</option>
                    </select>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-5">
                  {filteredCashHistory.map(session => {
                    const difference = session.difference ?? ((session.closingBalance ?? 0) - (session.openingBalance + (session.systemCashTotal ?? 0)));
                    const diffTone: 'neutral' | 'emerald' | 'rose' = difference === 0 ? 'emerald' : difference < 0 ? 'rose' : 'neutral';
                    const statusTone: 'neutral' | 'amber' = session.status === 'closed' ? 'neutral' : 'amber';

                    return (
                      <div key={session.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">{isSameDay(session.startTime, todayKey) ? 'Today' : new Date(session.startTime).toLocaleDateString()}</div>
                            <Pill tone={statusTone}>{session.status}</Pill>
                          </div>

                          <div className="flex flex-col gap-1 text-xs text-slate-600 sm:flex-row sm:items-center sm:gap-3">
                            <div><span className="font-medium text-slate-700">Start:</span> {new Date(session.startTime).toLocaleString()}</div>
                            <span className="hidden text-slate-300 sm:inline">•</span>
                            <div><span className="font-medium text-slate-700">End:</span> {session.endTime ? new Date(session.endTime).toLocaleString() : 'In progress'}</div>
                          </div>
                        </div>

                        <div className="px-5 py-5">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <MoneyTile label="Opening" value={formatINR(session.openingBalance)} />
                            <MoneyTile label="Closing" value={formatINR(session.closingBalance ?? 0)} />
                            <MoneyTile label="System" value={formatINR(session.systemCashTotal ?? 0)} />
                            <MoneyTile label="Difference" value={formatINR(difference)} tone={diffTone === 'neutral' ? 'neutral' : diffTone} />
                          </div>

                          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                            <div><span className="font-medium text-slate-700">System reference:</span> {formatINR(session.systemCashTotal ?? 0)}</div>
                            <div>
                              <span className="font-medium text-slate-700">Variance:</span>{' '}
                              <span className={`font-semibold ${difference < 0 ? 'text-rose-700' : difference === 0 ? 'text-emerald-700' : 'text-slate-900'}`}>{formatINR(difference)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!filteredCashHistory.length && <p className="text-sm text-muted-foreground">No cash sessions in selected range.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'expense' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader><CardTitle>Expense Management</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Label>Title</Label>
                  <Input value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} placeholder="Expense title" />
                  <Label>Amount</Label>
                  <Input type="number" min="0" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0.00" />
                  <Label>Category</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-3" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>
                    {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Label>Note (optional)</Label>
                  <Input value={expenseNote} onChange={e => setExpenseNote(e.target.value)} placeholder="Optional note" />
                  <div className="flex gap-2 pt-2">
                    <Button onClick={addExpense}>Add Expense</Button>
                    <Button variant="outline" onClick={exportExpensePDF}>Export PDF</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2">
                    <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Category name" />
                    <Button onClick={addExpenseCategory}>Add</Button>
                  </div>
                  <div className="space-y-2">
                    {expenseCategories.map(c => (
                      <div key={c} className="flex items-center justify-between border rounded p-2">
                        <span className="text-sm">{c}</span>
                        {c !== 'General' ? <Button variant="outline" size="sm" onClick={() => deleteExpenseCategory(c)}>Delete</Button> : <span className="text-xs text-muted-foreground">Default</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-7">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                    <span>Daily Expense Report</span>
                    <Input type="date" className="w-auto" value={expenseDateFilter} onChange={e => setExpenseDateFilter(e.target.value)} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatCard label="Total" value={formatINR(expensesTotalForDate)} />
                  {expensesForDate.map(e => (
                    <div key={e.id} className="border rounded p-2 text-sm">
                      <div className="flex justify-between"><span>{e.title}</span><span>{formatINR(e.amount)}</span></div>
                      <div className="text-muted-foreground">{e.category}{e.note ? ` • ${e.note}` : ''}</div>
                    </div>
                  ))}
                  {!expensesForDate.length && <p className="text-sm text-muted-foreground">No expenses for selected date.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'credit' && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle>Credit Management</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {creditCustomers.map(customer => (
                <div key={customer.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-semibold">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">Last Visit: {new Date(customer.lastVisit).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-700">Due: {formatINR(customer.totalDue)}</p>
                    <Button size="sm" onClick={() => { setCollectingCustomer(customer); setPaymentAmount(customer.totalDue.toFixed(2)); }}>Collect Payment</Button>
                  </div>
                </div>
              ))}
              {!creditCustomers.length && <p className="text-sm text-muted-foreground">No customers with due balance.</p>}

              {collectingCustomer && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 space-y-2">
                    <p className="font-semibold">Collect from {collectingCustomer.name}</p>
                    <Label>Amount</Label>
                    <Input type="number" min="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                    <Label>Method</Label>
                    <div className="flex gap-2">
                      <Button variant={paymentMethod === 'Cash' ? 'default' : 'outline'} onClick={() => setPaymentMethod('Cash')}>Cash</Button>
                      <Button variant={paymentMethod === 'Online' ? 'default' : 'outline'} onClick={() => setPaymentMethod('Online')}>UPI</Button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={collectPayment}>Confirm Collection</Button>
                      <Button variant="outline" onClick={() => setCollectingCustomer(null)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'profit' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                    <span>Daily Profit</span>
                    <Input type="date" className="w-auto" value={profitDate} onChange={e => setProfitDate(e.target.value)} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <StatCard label="Sales" value={formatINR(dailyProfit.sales)} />
                  <StatCard label="COGS" value={formatINR(dailyProfit.cogs)} />
                  <StatCard label="Expenses" value={formatINR(dailyProfit.expenses)} />
                  <StatCard label="Profit" value={formatINR(dailyProfit.profit)} tone={dailyProfit.profit >= 0 ? 'good' : 'bad'} />
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                    <span>Monthly Profit</span>
                    <Input type="month" className="w-auto" value={profitMonth} onChange={e => setProfitMonth(e.target.value)} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <StatCard label="Sales" value={formatINR(monthlyProfit.sales)} />
                  <StatCard label="Expenses" value={formatINR(monthlyProfit.expenses)} />
                  <StatCard label="Profit" value={formatINR(monthlyProfit.profit)} tone={monthlyProfit.profit >= 0 ? 'good' : 'bad'} />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-7">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader><CardTitle>Sales vs Expense Chart</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm"><span>Sales</span><span>{formatINR(monthlyProfit.sales)}</span></div>
                    <div className="h-3 bg-muted rounded"><div className="h-3 bg-green-500 rounded" style={{ width: `${(monthlyProfit.sales / chartMax) * 100}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm"><span>Expenses</span><span>{formatINR(monthlyProfit.expenses)}</span></div>
                    <div className="h-3 bg-muted rounded"><div className="h-3 bg-red-500 rounded" style={{ width: `${(monthlyProfit.expenses / chartMax) * 100}%` }} /></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
