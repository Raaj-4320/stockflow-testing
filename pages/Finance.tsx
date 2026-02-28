import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/ui';
import { loadData, saveData, processTransaction } from '../services/storage';
import { AppState, Customer, Transaction } from '../types';
import { AlertCircle, ChevronDown, ChevronUp, DollarSign, Wallet, ReceiptIndianRupee, BarChart3 } from 'lucide-react';

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

const isSameDay = (iso: string, dateKey: string) => {
  return dateKeyFromDate(new Date(iso)) === dateKey;
};

const monthKeyOf = (iso: string) => {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

export default function Finance() {
  const [data, setData] = useState<AppState>(loadData());
  const [errors, setErrors] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState({ cash: true, expenses: true, credit: true, profit: true });

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

  const isAdmin = true; // Placeholder for future role-based access integration.
  const todayKey = todayISO();
  const previousDayKey = previousDayISO();
  const todaySessionExists = cashSessions.some(session => isSameDay(session.startTime, todayKey));
  const isOpenSessionToday = !!openSession && isSameDay(openSession.startTime, todayKey);

  const previousDayClosedSession = useMemo(() => {
    return cashHistory.find(session => (
      session.status === 'closed'
      && isSameDay(session.startTime, previousDayKey)
      && Number.isFinite(session.closingBalance)
    ));
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

  const expensesForDate = useMemo(
    () => expenses.filter(e => isSameDay(e.createdAt, expenseDateFilter)),
    [expenses, expenseDateFilter]
  );

  const expensesTotalForDate = useMemo(
    () => expensesForDate.reduce((sum, e) => sum + e.amount, 0),
    [expensesForDate]
  );

  const creditCustomers = useMemo(
    () => data.customers.filter(c => c.totalDue > 0).sort((a, b) => b.totalDue - a.totalDue),
    [data.customers]
  );

  const dailyProfit = useMemo(() => {
    const sales = data.transactions
      .filter(t => t.type === 'sale' && isSameDay(t.date, profitDate))
      .reduce((sum, t) => sum + t.total, 0);

    const cogs = data.transactions
      .filter(t => t.type === 'sale' && isSameDay(t.date, profitDate))
      .reduce((sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + ((item.buyPrice || 0) * item.quantity), 0), 0);

    const expenseSum = expenses.filter(e => isSameDay(e.createdAt, profitDate)).reduce((sum, e) => sum + e.amount, 0);

    return {
      sales,
      cogs,
      expenses: expenseSum,
      profit: sales - cogs - expenseSum
    };
  }, [data.transactions, expenses, profitDate]);

  const monthlyProfit = useMemo(() => {
    const sales = data.transactions
      .filter(t => t.type === 'sale' && monthKeyOf(t.date) === profitMonth)
      .reduce((sum, t) => sum + t.total, 0);

    const cogs = data.transactions
      .filter(t => t.type === 'sale' && monthKeyOf(t.date) === profitMonth)
      .reduce((sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + ((item.buyPrice || 0) * item.quantity), 0), 0);

    const expenseSum = expenses
      .filter(e => monthKeyOf(e.createdAt) === profitMonth)
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      sales,
      expenses: expenseSum,
      profit: sales - cogs - expenseSum
    };
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
    if (!isAdmin) {
      setErrors('Only admin can start or close shifts.');
      return;
    }

    if (todaySessionExists) {
      setErrors('Cash session for today already exists.');
      return;
    }

    if (openSession) {
      setErrors('An open cash session already exists.');
      return;
    }

    const autoCarryBalance = previousDayClosedSession?.closingBalance;
    const value = openingBalance.trim()
      ? Number(openingBalance)
      : (autoCarryBalance !== undefined ? autoCarryBalance : Number.NaN);

    if (!Number.isFinite(value) || value < 0) {
      setErrors('Please enter a valid opening balance.');
      return;
    }

    const session: CashSession = {
      id: buildCashSessionId(cashSessions),
      startTime: new Date().toISOString(),
      openingBalance: value,
      status: 'open'
    };

    await persistState({ ...data, cashSessions: [session, ...(data.cashSessions || [])] });
    setOpeningBalance('');
    setOpeningBalanceAutoFilled(false);
  };

  const closeShift = async () => {
    if (!isAdmin) {
      setErrors('Only admin can start or close shifts.');
      return;
    }

    if (!openSession) {
      setErrors('No open cash session found.');
      return;
    }

    const counted = Number(closingBalance);
    if (!Number.isFinite(counted) || counted < 0) {
      setErrors('Please enter a valid closing cash value.');
      return;
    }

    const systemCashTotal = dailyCashTotals.systemCashTotal;
    const expectedClosing = openSession.openingBalance + systemCashTotal;
    const difference = counted - expectedClosing;

    const updated = (data.cashSessions || []).map(session =>
      session.id === openSession.id
        ? {
            ...session,
            endTime: new Date().toISOString(),
            closingBalance: counted,
            systemCashTotal,
            difference,
            status: 'closed' as const
          }
        : session
    );

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
    if (!openSession || !isOpenSessionToday || !isAdmin) {
      setErrors('Only admin can start or close shifts.');
      return;
    }

    const value = Number(openingBalanceEditValue);
    if (!Number.isFinite(value) || value < 0) {
      setErrors('Please enter a valid opening balance.');
      return;
    }

    const updated = (data.cashSessions || []).map(session =>
      session.id === openSession.id
        ? {
            ...session,
            openingBalance: value
          }
        : session
    );

    await persistState({ ...data, cashSessions: updated });
    setEditingOpeningBalance(false);
    setOpeningBalanceEditValue('');
  };

  const addExpense = async () => {
    const amount = Number(expenseAmount);
    if (!expenseTitle.trim() || !expenseCategory.trim() || !Number.isFinite(amount) || amount <= 0) {
      setErrors('Please enter valid expense details.');
      return;
    }

    const expense: Expense = {
      id: Date.now().toString(),
      title: expenseTitle.trim(),
      amount,
      category: expenseCategory.trim(),
      note: expenseNote.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const categories = Array.from(new Set([...(data.expenseCategories || []), expense.category]));

    await persistState({
      ...data,
      expenses: [expense, ...(data.expenses || [])],
      expenseCategories: categories
    });

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
    if (isUsed) {
      setErrors('Cannot delete category that is used by expenses.');
      return;
    }

    await persistState({
      ...data,
      expenseCategories: (data.expenseCategories || []).filter(c => c !== name)
    });
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
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrors('Please enter a valid payment amount.');
      return;
    }

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">Manage cash sessions, expenses, customer credit, and profit summary.</p>
      </div>

      {errors && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {errors}
        </div>
      )}

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setOpenSections(v => ({ ...v, cash: !v.cash }))}>
          <CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><Wallet className="w-5 h-5" /> Cash Management</span>{openSections.cash ? <ChevronUp /> : <ChevronDown />}</CardTitle>
        </CardHeader>
        {openSections.cash && (
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-4 space-y-3">
                  <Label>Opening Balance</Label>
                  <Input
                    type="number"
                    min="0"
                    value={openingBalance}
                    onChange={e => {
                      setOpeningBalance(e.target.value);
                      setOpeningBalanceAutoFilled(false);
                    }}
                    placeholder="0.00"
                  />
                  {openingBalanceAutoFilled && (
                    <p className="text-xs text-muted-foreground">Carried forward from previous closing balance</p>
                  )}
                  {todaySessionExists && (
                    <p className="text-xs text-destructive">Cash session for today already exists.</p>
                  )}
                  <Button onClick={startShift} disabled={!isAdmin || !!openSession || todaySessionExists}>Start Shift</Button>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="pt-4 space-y-2">
                  <Label>Closing Cash Counted</Label>
                  <Input type="number" min="0" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} placeholder="0.00" />
                  <p className="text-sm text-muted-foreground">System Cash Total (today): ₹{dailyCashTotals.systemCashTotal.toFixed(2)}</p>
                  <Button onClick={closeShift} disabled={!isAdmin || !openSession}>Close Shift</Button>
                </CardContent>
              </Card>
            </div>

            {openSession && (
              <div className="p-3 rounded border text-sm bg-blue-50/60 border-blue-200">
                <div className="flex items-center justify-between gap-2">
                  <span>Open Session Started: {new Date(openSession.startTime).toLocaleString()}</span>
                  <div className="flex items-center gap-2">
                    {isOpenSessionToday && <Badge variant="secondary">Today</Badge>}
                    <Badge variant="secondary">open</Badge>
                  </div>
                </div>
                <div className="mt-2">
                  {editingOpeningBalance ? (
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={openingBalanceEditValue}
                        onChange={e => setOpeningBalanceEditValue(e.target.value)}
                        placeholder="0.00"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveOpeningBalanceEdit}>Save Opening Balance</Button>
                        <Button size="sm" variant="outline" onClick={cancelOpeningBalanceEdit}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <p className="text-sm">Current Opening Balance: ₹{openSession.openingBalance.toFixed(2)}</p>
                      {isOpenSessionToday && isAdmin && (
                        <Button size="sm" variant="outline" onClick={startOpeningBalanceEdit}>Edit Opening Balance</Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-semibold">Cash History</h3>
              <div className="space-y-2">
                {cashHistory.map(session => (
                  <div key={session.id} className={`p-3 border rounded flex flex-col md:flex-row md:items-center md:justify-between gap-2 ${isSameDay(session.startTime, todayKey) ? 'bg-blue-50/40 border-blue-200' : ''}`}>
                    <div className="text-sm">
                      <p>Start: {new Date(session.startTime).toLocaleString()}</p>
                      {session.endTime && <p>End: {new Date(session.endTime).toLocaleString()}</p>}
                    </div>
                    <div className="text-sm">
                      <p>Opening: ₹{session.openingBalance.toFixed(2)}</p>
                      {session.closingBalance !== undefined && <p>Closing: ₹{session.closingBalance.toFixed(2)}</p>}
                    </div>
                    <div className="text-sm">
                      {session.systemCashTotal !== undefined && <p>System: ₹{session.systemCashTotal.toFixed(2)}</p>}
                      {session.difference !== undefined && (
                        <p className={session.difference === 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                          Difference: ₹{session.difference.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isSameDay(session.startTime, todayKey) && <Badge variant="secondary">Today</Badge>}
                      <Badge variant={session.status === 'open' ? 'destructive' : 'secondary'}>{session.status}</Badge>
                    </div>
                  </div>
                ))}
                {!cashHistory.length && <p className="text-sm text-muted-foreground">No cash sessions yet.</p>}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setOpenSections(v => ({ ...v, expenses: !v.expenses }))}>
          <CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><ReceiptIndianRupee className="w-5 h-5" /> Expense Management</span>{openSections.expenses ? <ChevronUp /> : <ChevronDown />}</CardTitle>
        </CardHeader>
        {openSections.expenses && (
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-4 space-y-2">
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
                  <Button onClick={addExpense}>Add Expense</Button>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="pt-4 space-y-2">
                  <Label>Add Category</Label>
                  <div className="flex gap-2">
                    <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Category name" />
                    <Button onClick={addExpenseCategory}>Add</Button>
                  </div>
                  <div className="space-y-2 mt-2">
                    {expenseCategories.map(c => (
                      <div key={c} className="flex items-center justify-between border rounded p-2">
                        <span className="text-sm">{c}</span>
                        {c !== 'General' && (
                          <Button variant="outline" size="sm" onClick={() => deleteExpenseCategory(c)}>Delete</Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-muted/20">
              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label>Daily Expense Report</Label>
                  <Input type="date" className="w-auto" value={expenseDateFilter} onChange={e => setExpenseDateFilter(e.target.value)} />
                  <Button variant="outline" onClick={exportExpensePDF}>Export PDF</Button>
                </div>
                <p className="font-semibold">Total: ₹{expensesTotalForDate.toFixed(2)}</p>
                <div className="space-y-2">
                  {expensesForDate.map(e => (
                    <div key={e.id} className="border rounded p-2 text-sm">
                      <div className="flex justify-between"><span>{e.title}</span><span>₹{e.amount.toFixed(2)}</span></div>
                      <div className="text-muted-foreground">{e.category}{e.note ? ` • ${e.note}` : ''}</div>
                    </div>
                  ))}
                  {!expensesForDate.length && <p className="text-sm text-muted-foreground">No expenses for selected date.</p>}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setOpenSections(v => ({ ...v, credit: !v.credit }))}>
          <CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><DollarSign className="w-5 h-5" /> Credit Management</span>{openSections.credit ? <ChevronUp /> : <ChevronDown />}</CardTitle>
        </CardHeader>
        {openSections.credit && (
          <CardContent className="space-y-3">
            {creditCustomers.map(customer => (
              <div key={customer.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">Last Visit: {new Date(customer.lastVisit).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-700">Due: ₹{customer.totalDue.toFixed(2)}</p>
                  <Button size="sm" onClick={() => { setCollectingCustomer(customer); setPaymentAmount(customer.totalDue.toFixed(2)); }}>
                    Collect Payment
                  </Button>
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
        )}
      </Card>

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setOpenSections(v => ({ ...v, profit: !v.profit }))}>
          <CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Profit Summary</span>{openSections.profit ? <ChevronUp /> : <ChevronDown />}</CardTitle>
        </CardHeader>
        {openSections.profit && (
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-4 space-y-2">
                  <Label>Daily Profit Date</Label>
                  <Input type="date" value={profitDate} onChange={e => setProfitDate(e.target.value)} />
                  <p>Sales: ₹{dailyProfit.sales.toFixed(2)}</p>
                  <p>COGS: ₹{dailyProfit.cogs.toFixed(2)}</p>
                  <p>Expenses: ₹{dailyProfit.expenses.toFixed(2)}</p>
                  <p className={dailyProfit.profit >= 0 ? 'font-bold text-green-700' : 'font-bold text-red-700'}>Profit: ₹{dailyProfit.profit.toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="pt-4 space-y-2">
                  <Label>Monthly Profit</Label>
                  <Input type="month" value={profitMonth} onChange={e => setProfitMonth(e.target.value)} />
                  <p>Sales: ₹{monthlyProfit.sales.toFixed(2)}</p>
                  <p>Expenses: ₹{monthlyProfit.expenses.toFixed(2)}</p>
                  <p className={monthlyProfit.profit >= 0 ? 'font-bold text-green-700' : 'font-bold text-red-700'}>Profit: ₹{monthlyProfit.profit.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-muted/20">
              <CardContent className="pt-4 space-y-3">
                <p className="font-semibold">Sales vs Expense Chart</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm"><span>Sales</span><span>₹{monthlyProfit.sales.toFixed(2)}</span></div>
                    <div className="h-3 bg-muted rounded"><div className="h-3 bg-green-500 rounded" style={{ width: `${(monthlyProfit.sales / chartMax) * 100}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm"><span>Expenses</span><span>₹{monthlyProfit.expenses.toFixed(2)}</span></div>
                    <div className="h-3 bg-muted rounded"><div className="h-3 bg-red-500 rounded" style={{ width: `${(monthlyProfit.expenses / chartMax) * 100}%` }} /></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
