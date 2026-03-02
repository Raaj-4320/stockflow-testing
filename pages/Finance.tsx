import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/ui';
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

export default function Finance() {
  const [data, setData] = useState<AppState>(loadData());
  const [errors, setErrors] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('cash');

  const [openingBalance, setOpeningBalance] = useState('');
  const [openingBalanceAutoFilled, setOpeningBalanceAutoFilled] = useState(false);
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [openingBalanceEditValue, setOpeningBalanceEditValue] = useState('');
  const [closingBalance, setClosingBalance] = useState('');

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
              <Card className="border-slate-200 shadow-sm">
                <CardHeader><CardTitle>Cash History</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {cashHistory.map(session => (
                    <div key={session.id} className={`p-3 border rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${isSameDay(session.startTime, todayKey) ? 'bg-blue-50/40 border-blue-200' : ''}`}>
                      <div className="text-sm">
                        <p>Start: {new Date(session.startTime).toLocaleString()}</p>
                        {session.endTime && <p>End: {new Date(session.endTime).toLocaleString()}</p>}
                      </div>
                      <div className="text-sm">
                        <p>Opening: {formatINR(session.openingBalance)}</p>
                        {session.closingBalance !== undefined && <p>Closing: {formatINR(session.closingBalance)}</p>}
                      </div>
                      <div className="text-sm">
                        {session.systemCashTotal !== undefined && <p>System: {formatINR(session.systemCashTotal)}</p>}
                        {session.difference !== undefined && <p className={session.difference === 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>Difference: {formatINR(session.difference)}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {isSameDay(session.startTime, todayKey) && <Badge variant="secondary">Today</Badge>}
                        <Badge variant={session.status === 'open' ? 'destructive' : 'secondary'}>{session.status}</Badge>
                      </div>
                    </div>
                  ))}
                  {!cashHistory.length && <p className="text-sm text-muted-foreground">No cash sessions yet.</p>}
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
