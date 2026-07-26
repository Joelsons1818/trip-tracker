'use client';

import { useState, useEffect } from 'react';
import type { Transaction, Category, WalletId } from '@/types';
import { PlusCircle, MinusCircle, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, HandCoins, Trash2, BarChart2, X, Calendar, ChevronDown, Settings, Edit3, Tag, Send } from 'lucide-react';

const parseInputNumber = (val: string) => {
    if (!val) return 0;
    const str = val.trim();
    if (str.includes(',') && str.includes('.')) {
         const lastDot = str.lastIndexOf('.');
         const lastComma = str.lastIndexOf(',');
         return lastComma > lastDot 
            ? parseFloat(str.replace(/\./g, '').replace(',', '.'))
            : parseFloat(str.replace(/,/g, ''));
    } else if (str.includes(',')) {
         return parseFloat(str.replace(',', '.'));
    } else {
         return parseFloat(str);
    }
};

const parseSafeInputNumber = (val: string) => {
  const parsed = parseInputNumber(val);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getOptionalInputNumber = (val: string) => {
  if (!val.trim()) return null;

  const parsed = parseInputNumber(val);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatAutoAmount = (val: number) => {
  return Number.isFinite(val) && val >= 0 ? val.toFixed(2) : '';
};

const formatCurrency = (val: number) => {
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateForInput = (dateValue: string) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const dateInputToIso = (dateValue: string) => `${dateValue}T12:00:00.000Z`;

const getTodayDateInput = () => formatDateForInput(new Date().toISOString());

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getLocalDateOnlyKey = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

const getDaysBetweenLocalDates = (startDate: Date, endDate: Date) => {
  const startKey = getLocalDateOnlyKey(startDate);
  const endKey = getLocalDateOnlyKey(endDate);

  return Math.max(1, (endKey - startKey) / DAY_IN_MS);
};

const MONTHS = [
  { value: 0, label: 'Jan' },
  { value: 1, label: 'Fev' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Abr' },
  { value: 4, label: 'Mai' },
  { value: 5, label: 'Jun' },
  { value: 6, label: 'Jul' },
  { value: 7, label: 'Ago' },
  { value: 8, label: 'Set' },
  { value: 9, label: 'Out' },
  { value: 10, label: 'Nov' },
  { value: 11, label: 'Dez' },
];

const WALLETS: WalletId[] = ['Daniel', 'Marília', 'BofA'];

type HistoryPeriod = 'All' | 'Today' | 'Week' | 'Month';
type TransferCalcMode = 'received' | 'fee' | null;

type HistoryItem =
  | { kind: 'transaction'; tx: Transaction }
  | {
      kind: 'transfer';
      id: string;
      date: string;
      sourceWallet: WalletId;
      sentAmount: number;
      receivedAmount: number;
      fee: number;
      outTx?: Transaction;
      inTx?: Transaction;
      referenceTx: Transaction;
    };

type TransferEditState = {
  id: string;
  sourceWallet: WalletId;
  outTx: Transaction;
  inTx: Transaction;
};

const walletTextClass: Record<WalletId, string> = {
  Daniel: 'text-indigo-900',
  Marília: 'text-rose-800',
  BofA: 'text-blue-900',
};

const walletBadgeClass: Record<WalletId, string> = {
  Daniel: 'bg-blue-50 border border-blue-200 text-blue-700 shadow-sm',
  Marília: 'bg-yellow-50 border border-yellow-200 text-yellow-700 shadow-sm',
  BofA: 'bg-white border border-blue-300 text-blue-800 shadow-sm',
};

const isIncomingTransaction = (tx: Transaction) => tx.type === 'Deposit' || tx.type === 'TransferIn';
const isOutgoingTransaction = (tx: Transaction) => tx.type === 'Expense' || tx.type === 'TransferOut';
const isTransferTransaction = (tx: Transaction) => tx.type === 'TransferIn' || tx.type === 'TransferOut';
const getTransferGroupId = (id: string) => id.replace(/-(in|out)$/, '');
const isWalletId = (value: string | undefined): value is WalletId => value === 'Daniel' || value === 'Marília' || value === 'BofA';

const getCategoryColorClass = (category: string) => {
  const pastelColors = [
    'bg-slate-50 text-slate-600 border-slate-200',
    'bg-red-50 text-red-600 border-red-200',
    'bg-orange-50 text-orange-600 border-orange-200',
    'bg-amber-50 text-amber-600 border-amber-200',
    'bg-lime-50 text-lime-600 border-lime-200',
    'bg-emerald-50 text-emerald-600 border-emerald-200',
    'bg-teal-50 text-teal-600 border-teal-200',
    'bg-cyan-50 text-cyan-600 border-cyan-200',
    'bg-sky-50 text-sky-600 border-sky-200',
    'bg-indigo-50 text-indigo-600 border-indigo-200',
    'bg-violet-50 text-violet-600 border-violet-200',
    'bg-purple-50 text-purple-600 border-purple-200',
    'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200',
    'bg-rose-50 text-rose-600 border-rose-200',
  ];
  if (!category) return pastelColors[0];
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return pastelColors[Math.abs(hash) % pastelColors.length];
};

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<TransferEditState | null>(null);

  // Wallet state
  const [selectedWallet, setSelectedWallet] = useState<WalletId | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'Total' | WalletId>('Total');
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('All');
  const [amountUSD, setAmountUSD] = useState('');
  const [costBRL, setCostBRL] = useState('');
  const [transferSentUSD, setTransferSentUSD] = useState('');
  const [transferReceivedUSD, setTransferReceivedUSD] = useState('');
  const [transferFeeUSD, setTransferFeeUSD] = useState('');
  const [transferCalcMode, setTransferCalcMode] = useState<TransferCalcMode>(null);
  const [transferSourceWallet, setTransferSourceWallet] = useState<WalletId | null>(null);
  const [transferDate, setTransferDate] = useState(() => getTodayDateInput());
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => getTodayDateInput());
  
  // Category management state
  const [newCatName, setNewCatName] = useState('');
  const [newCatCodebook, setNewCatCodebook] = useState('');

  // Analytics State
  const [expandedStatsCategory, setExpandedStatsCategory] = useState<string | null>(null);
  
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(new Date().getFullYear());

  const [avgStartMonth, setAvgStartMonth] = useState(new Date().getMonth());
  const [avgStartYear, setAvgStartYear] = useState(new Date().getFullYear());
  const [avgEndMonth, setAvgEndMonth] = useState(new Date().getMonth());
  const [avgEndYear, setAvgEndYear] = useState(new Date().getFullYear());

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      if (data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, []);

  const resetTransferForm = () => {
    setTransferSentUSD('');
    setTransferReceivedUSD('');
    setTransferFeeUSD('');
    setTransferCalcMode(null);
    setTransferSourceWallet(null);
    setTransferDate(getTodayDateInput());
    setEditingTransfer(null);
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    resetTransferForm();
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountUSD || !costBRL) return;

    setShowAddModal(false);
    setIsLoading(true);

    const payload: Transaction = {
      id: editingTx ? editingTx.id : crypto.randomUUID(),
      date: editingTx ? editingTx.date : new Date().toISOString(),
      type: 'Deposit',
      person: editingTx ? editingTx.person : (selectedWallet || 'Daniel'),
      amountUSD: parseInputNumber(amountUSD),
      costBRL: parseInputNumber(costBRL),
      rowIndex: editingTx ? editingTx.rowIndex : undefined
    };

    setAmountUSD('');
    setCostBRL('');
    setEditingTx(null);

    await fetch('/api/transactions', {
      method: editingTx ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });

    fetchTransactions();
  };

  const handleExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountUSD || !description || !categoryName || !transactionDate) {
        alert("Preencha todos os campos e selecione uma categoria!");
        return;
    }

    setShowExpenseModal(false);
    setIsLoading(true);

    const payload: Transaction = {
      id: editingTx ? editingTx.id : crypto.randomUUID(),
      date: dateInputToIso(transactionDate),
      type: 'Expense',
      person: editingTx ? editingTx.person : (selectedWallet || 'Daniel'),
      amountUSD: parseInputNumber(amountUSD),
      description,
      category: categoryName,
      rowIndex: editingTx ? editingTx.rowIndex : undefined
    };

    setAmountUSD('');
    setDescription('');
    setCategoryName('');
    setTransactionDate(getTodayDateInput());
    setEditingTx(null);

    await fetch('/api/transactions', {
      method: editingTx ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });

    fetchTransactions();
  };

  const handleTransferToBofA = async (e: React.FormEvent) => {
    e.preventDefault();
    const sourceWallet = transferSourceWallet || selectedWallet;

    if (!sourceWallet || sourceWallet === 'BofA') return;
    if (!transferSentUSD || !transferReceivedUSD || !transferFeeUSD || !transferDate) return;

    const amountSent = parseSafeInputNumber(transferSentUSD);
    const amountReceived = parseSafeInputNumber(transferReceivedUSD);
    const amountFee = parseSafeInputNumber(transferFeeUSD);
    const amountsAreSynced = Math.abs(amountSent - amountReceived - amountFee) <= 0.01;

    if (amountSent <= 0 || amountReceived <= 0 || amountFee < 0 || amountReceived > amountSent || amountFee > amountSent || !amountsAreSynced) {
      alert('Confira os valores da transferência. O valor enviado precisa ser igual ao valor que chega mais a fee.');
      return;
    }

    if (editingTransfer && (!editingTransfer.outTx.rowIndex || !editingTransfer.inTx.rowIndex)) {
      alert('Não foi possível editar esta transferência porque faltam linhas da planilha.');
      return;
    }

    setShowTransferModal(false);
    setIsLoading(true);

    const transferId = editingTransfer?.id || crypto.randomUUID();
    const transferDateIso = dateInputToIso(transferDate);
    const payload: Transaction[] = [
      {
        id: editingTransfer?.outTx.id || `${transferId}-out`,
        date: transferDateIso,
        type: 'TransferOut',
        person: sourceWallet,
        amountUSD: amountSent,
        description: 'Transferência para BofA',
        category: 'BofA',
        rowIndex: editingTransfer?.outTx.rowIndex,
      },
      {
        id: editingTransfer?.inTx.id || `${transferId}-in`,
        date: transferDateIso,
        type: 'TransferIn',
        person: 'BofA',
        amountUSD: amountReceived,
        description: `Transferência de ${sourceWallet}`,
        category: sourceWallet,
        rowIndex: editingTransfer?.inTx.rowIndex,
      },
    ];

    resetTransferForm();

    if (editingTransfer) {
      await Promise.all(payload.map(transaction => fetch('/api/transactions', {
        method: 'PUT',
        body: JSON.stringify(transaction),
        headers: { 'Content-Type': 'application/json' }
      })));
    } else {
      await fetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });
    }

    fetchTransactions();
  };

  const openEditModal = (tx: Transaction) => {
    if (isTransferTransaction(tx)) {
      alert('Para corrigir uma transferência, apague a transferência e registre novamente.');
      return;
    }

    setEditingTx(tx);
    setAmountUSD(tx.amountUSD.toString());
    if (tx.type === 'Deposit') {
        setCostBRL(tx.costBRL?.toString() || '');
        setShowAddModal(true);
    } else {
        setDescription(tx.description || '');
        setCategoryName(tx.category || '');
        setTransactionDate(formatDateForInput(tx.date));
        setShowExpenseModal(true);
    }
  };

  const openNewDepositModal = () => {
    setEditingTx(null);
    setAmountUSD('');
    setCostBRL('');
    setShowAddModal(true);
  };

  const openNewExpenseModal = () => {
    setEditingTx(null);
    setAmountUSD('');
    setDescription('');
    setCategoryName('');
    setTransactionDate(getTodayDateInput());
    setShowExpenseModal(true);
  };

  const openTransferModal = () => {
    if (!selectedWallet || selectedWallet === 'BofA') return;

    setEditingTx(null);
    setEditingTransfer(null);
    setTransferSentUSD('');
    setTransferReceivedUSD('');
    setTransferFeeUSD('');
    setTransferCalcMode(null);
    setTransferSourceWallet(selectedWallet);
    setTransferDate(getTodayDateInput());
    setShowTransferModal(true);
  };

  const openEditTransferModal = (item: Extract<HistoryItem, { kind: 'transfer' }>) => {
    if (!item.outTx || !item.inTx || !item.outTx.rowIndex || !item.inTx.rowIndex || item.sourceWallet === 'BofA') {
      alert('Não foi possível editar esta transferência. Apague e registre novamente para corrigir.');
      return;
    }

    setEditingTx(null);
    setEditingTransfer({
      id: item.id,
      sourceWallet: item.sourceWallet,
      outTx: item.outTx,
      inTx: item.inTx,
    });
    setTransferSourceWallet(item.sourceWallet);
    setTransferSentUSD(formatAutoAmount(item.sentAmount));
    setTransferReceivedUSD(formatAutoAmount(item.receivedAmount));
    setTransferFeeUSD(formatAutoAmount(item.fee));
    setTransferCalcMode(null);
    setTransferDate(formatDateForInput(item.date));
    setShowTransferModal(true);
  };

  const handleTransferSentChange = (value: string) => {
    setTransferSentUSD(value);

    const amountSent = getOptionalInputNumber(value);
    const amountReceived = getOptionalInputNumber(transferReceivedUSD);
    const amountFee = getOptionalInputNumber(transferFeeUSD);

    if (amountSent === null) return;

    if (transferCalcMode === 'fee' && amountFee !== null) {
      setTransferReceivedUSD(formatAutoAmount(amountSent - amountFee));
      return;
    }

    if (amountReceived !== null) {
      setTransferFeeUSD(formatAutoAmount(amountSent - amountReceived));
      return;
    }

    if (amountFee !== null) {
      setTransferReceivedUSD(formatAutoAmount(amountSent - amountFee));
    }
  };

  const handleTransferReceivedChange = (value: string) => {
    setTransferReceivedUSD(value);
    setTransferCalcMode('received');

    const amountSent = getOptionalInputNumber(transferSentUSD);
    const amountReceived = getOptionalInputNumber(value);

    if (amountReceived === null) {
      setTransferFeeUSD('');
      return;
    }

    if (amountSent !== null) {
      setTransferFeeUSD(formatAutoAmount(amountSent - amountReceived));
    }
  };

  const handleTransferFeeChange = (value: string) => {
    setTransferFeeUSD(value);
    setTransferCalcMode('fee');

    const amountSent = getOptionalInputNumber(transferSentUSD);
    const amountFee = getOptionalInputNumber(value);

    if (amountFee === null) {
      setTransferReceivedUSD('');
      return;
    }

    if (amountSent !== null) {
      setTransferReceivedUSD(formatAutoAmount(amountSent - amountFee));
    }
  };

  const handleDelete = async (tx: Transaction) => {
    if (!tx.rowIndex) return;

    const transferGroupId = isTransferTransaction(tx) ? getTransferGroupId(tx.id) : null;
    const transactionsToDelete = transferGroupId
      ? transactions
          .filter(item => isTransferTransaction(item) && getTransferGroupId(item.id) === transferGroupId && item.rowIndex)
          .sort((a, b) => (b.rowIndex || 0) - (a.rowIndex || 0))
      : [tx];

    if (!confirm(transferGroupId ? 'Apagar esta transferência da planilha?' : 'Tem certeza que deseja apagar esta transação da planilha?')) {
      return;
    }

    setIsDeleting(tx.id);
    try {
      for (const item of transactionsToDelete) {
        await fetch(`/api/transactions?rowIndex=${item.rowIndex}`, {
          method: 'DELETE',
        });
      }
      await fetchTransactions();
    } catch (error) {
      console.error('Failed to delete', error);
      alert('Failed to delete transaction');
    } finally {
      setIsDeleting(null);
    }
  };

  const totalDeposits = transactions.filter(isIncomingTransaction).reduce((acc, t) => acc + t.amountUSD, 0);
  const totalExpenses = transactions.filter(isOutgoingTransaction).reduce((acc, t) => acc + t.amountUSD, 0);
  const balance = totalDeposits - totalExpenses;

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    setIsLoading(true);
    await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName, codebook: newCatCodebook })
    });
    setNewCatName('');
    setNewCatCodebook('');
    fetchCategories();
    setIsLoading(false);
  };

  const handleDeleteCategory = async (nameC: string) => {
    if (!confirm('Deletar essa categoria? Ela desaparecerá da lista, mas não apagará o histórico passado.')) return;
    setIsLoading(true);
    await fetch(`/api/categories?id=${encodeURIComponent(nameC)}`, { method: 'DELETE' });
    fetchCategories();
    setIsLoading(false);
  };

  const getWalletBalance = (wallet: WalletId) => {
    const deps = transactions.filter(t => isIncomingTransaction(t) && t.person === wallet).reduce((acc, t) => acc + t.amountUSD, 0);
    const exps = transactions.filter(t => isOutgoingTransaction(t) && t.person === wallet).reduce((acc, t) => acc + t.amountUSD, 0);
    return deps - exps;
  };
  const walletBalances: Record<WalletId, number> = {
    Daniel: getWalletBalance('Daniel'),
    Marília: getWalletBalance('Marília'),
    BofA: getWalletBalance('BofA'),
  };
  const selectedWalletBalance = selectedWallet ? walletBalances[selectedWallet] : 0;
  const depositModalWallet = editingTx?.person || selectedWallet;
  const depositActionLabel = depositModalWallet === 'BofA' ? 'Enviar Dinheiro' : 'Comprar Dólar';
  const walletSummaries = WALLETS.map(wallet => ({ wallet, balance: walletBalances[wallet] }));

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const startOfWeek = startOfDay - 6 * DAY_IN_MS;
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const startOfSelectedMonth = new Date(selYear, selMonth, 1).getTime();
  const isSelectedCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth();
  const endOfSelectedMonth = isSelectedCurrentMonth
    ? endOfDay
    : new Date(selYear, selMonth + 1, 1).getTime();

  const walletFilteredTransactions = historyFilter === 'Total' 
    ? transactions 
    : transactions.filter(t => t.person === historyFilter);

  const filterByHistoryPeriod = (tx: Transaction) => {
    if (historyPeriod === 'All') return true;

    const time = new Date(tx.date).getTime();
    if (Number.isNaN(time)) return false;

    if (historyPeriod === 'Today') return time >= startOfDay && time < endOfDay;
    if (historyPeriod === 'Week') return time >= startOfWeek && time < endOfDay;
    return time >= startOfCurrentMonth && time < endOfCurrentMonth;
  };

  const historyTransactions = walletFilteredTransactions.filter(filterByHistoryPeriod);
  const transferLookup = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    if (!isTransferTransaction(tx)) return acc;
    const groupId = getTransferGroupId(tx.id);
    acc[groupId] = [...(acc[groupId] || []), tx];
    return acc;
  }, {});
  const renderedTransferGroups = new Set<string>();
  const historyItems: HistoryItem[] = historyTransactions.flatMap<HistoryItem>(tx => {
    if (!isTransferTransaction(tx)) return [{ kind: 'transaction', tx }];

    const groupId = getTransferGroupId(tx.id);
    if (renderedTransferGroups.has(groupId)) return [];
    renderedTransferGroups.add(groupId);

    const transferGroup = transferLookup[groupId] || [tx];
    const outTx = transferGroup.find(item => item.type === 'TransferOut');
    const inTx = transferGroup.find(item => item.type === 'TransferIn');
    const sourceWallet = outTx?.person || (isWalletId(inTx?.category) ? inTx.category : tx.person);
    const sentAmount = outTx?.amountUSD || (tx.type === 'TransferOut' ? tx.amountUSD : inTx?.amountUSD || tx.amountUSD);
    const receivedAmount = inTx?.amountUSD || (tx.type === 'TransferIn' ? tx.amountUSD : outTx?.amountUSD || tx.amountUSD);

    return [{
      kind: 'transfer',
      id: groupId,
      date: outTx?.date || inTx?.date || tx.date,
      sourceWallet,
      sentAmount,
      receivedAmount,
      fee: Math.max(0, sentAmount - receivedAmount),
      outTx,
      inTx,
      referenceTx: outTx || inTx || tx,
    }];
  });

  // --- Analytics Calculations ---
  // Analytics apply only to the filtered view
  const expenses = walletFilteredTransactions.filter(t => t.type === 'Expense');

  const txYears = Array.from(new Set(transactions
    .map(t => {
      const date = new Date(t.date);
      return Number.isNaN(date.getTime()) ? null : date.getFullYear();
    })
    .filter((year): year is number => year !== null)));
  const availableYears = txYears.length > 0 ? txYears : [new Date().getFullYear()];
  if (!availableYears.includes(new Date().getFullYear())) availableYears.push(new Date().getFullYear());
  if (!availableYears.includes(new Date().getFullYear() + 1)) availableYears.push(new Date().getFullYear() + 1);
  availableYears.sort((a, b) => a - b);

  let spendToday = 0;
  let spendThisWeek = 0;
  let spendSelectedMonth = 0;

  expenses.forEach(t => {
    const time = new Date(t.date).getTime();
    if (Number.isNaN(time)) return;

    if (time >= startOfDay && time < endOfDay) spendToday += t.amountUSD;
    if (time >= startOfWeek && time < endOfDay) spendThisWeek += t.amountUSD;
    if (time >= startOfSelectedMonth && time < endOfSelectedMonth) spendSelectedMonth += t.amountUSD;
  });

  // Category Breakdown logic for the selected month
  const expensesSelectedMonth = expenses.filter(t => {
     const time = new Date(t.date).getTime();
     return !Number.isNaN(time) && time >= startOfSelectedMonth && time < endOfSelectedMonth;
  });
  
  const categoryTotals: Record<string, number> = {};
  expensesSelectedMonth.forEach(t => {
      const cat = t.category || 'Outros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amountUSD;
  });
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  // Custom Average Logic
  const startOfAvgDate = new Date(avgStartYear, avgStartMonth, 1);
  const selectedEndOfAvgDate = new Date(avgEndYear, avgEndMonth + 1, 1);
  const endOfAvgDate = selectedEndOfAvgDate.getTime() > startOfAvgDate.getTime()
    ? selectedEndOfAvgDate
    : new Date(avgStartYear, avgStartMonth + 1, 1);
  const startOfAvg = startOfAvgDate.getTime();
  const endOfAvg = endOfAvgDate.getTime();
  
  const expensesInAvgRange = expenses.filter(t => {
     const time = new Date(t.date).getTime();
     return !Number.isNaN(time) && time >= startOfAvg && time < endOfAvg;
  });
  const totalAvgExpenses = expensesInAvgRange.reduce((acc, t) => acc + t.amountUSD, 0);

  let monthsInAvg = (avgEndYear - avgStartYear) * 12 + (avgEndMonth - avgStartMonth) + 1;
  if (monthsInAvg <= 0) monthsInAvg = 1;
  const daysInAvg = getDaysBetweenLocalDates(startOfAvgDate, endOfAvgDate);

  const dailyAverage = totalAvgExpenses / daysInAvg;
  const monthlyAverage = totalAvgExpenses / monthsInAvg;
  const selectedMonthLabel = isSelectedCurrentMonth ? 'Este Mês' : 'Mês Selecionado';
  const selectedCategoriesLabel = isSelectedCurrentMonth ? 'Categorias Neste Mês' : 'Categorias no Mês';


  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-24 font-sans selection:bg-emerald-200">
      <header className="bg-slate-900 text-white p-6 shadow-md rounded-b-3xl mb-6 sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-400" />
              Trip Tracker
            </h1>
            <div className="flex gap-2">
              <button onClick={() => setShowCategorySettings(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors" title="Gerenciar Categorias">
                <Settings className="w-5 h-5 text-purple-300" />
              </button>
              <button onClick={() => setShowStatsModal(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors" title="Visão de Gastos">
                <BarChart2 className="w-5 h-5 text-cyan-300" />
              </button>
              <button onClick={fetchTransactions} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-gray-400' : 'text-gray-200'}`} />
              </button>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400"></div>
            <p className="text-gray-300 text-sm font-medium mb-1">Saldo Disponível (USD)</p>
            <p className="text-4xl font-extrabold tracking-tight">${formatCurrency(balance)}</p>

            <div className="flex gap-4 mt-5 pt-4 border-t border-white/10">
              <div className="flex-1">
                <p className="text-xs text-emerald-300 font-medium flex items-center gap-1 mb-1"><ArrowDownRight className="w-3 h-3" /> Entradas</p>
                <p className="font-semibold">${formatCurrency(totalDeposits)}</p>
              </div>
              <div className="w-px bg-white/10"></div>
              <div className="flex-1">
                <p className="text-xs text-rose-300 font-medium flex items-center gap-1 mb-1"><ArrowUpRight className="w-3 h-3" /> Saídas</p>
                <p className="font-semibold">${formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4">
        {/* NEW WALLETS SECTION */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">Carteiras</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setSelectedWallet(selectedWallet === 'Daniel' ? null : 'Daniel')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${selectedWallet === 'Daniel' ? 'bg-indigo-900 border-indigo-700 text-white shadow-md scale-100' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
            >
              <Wallet className="w-6 h-6" />
              <span className="font-bold">Wise Daniel</span>
            </button>
            <button
              onClick={() => setSelectedWallet(selectedWallet === 'Marília' ? null : 'Marília')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${selectedWallet === 'Marília' ? 'bg-rose-100 border-rose-300 text-rose-800 shadow-md scale-100' : 'bg-white border-gray-200 text-gray-600 hover:border-rose-300 hover:bg-rose-50/50'}`}
            >
              <Wallet className="w-6 h-6" />
              <span className="font-bold">Wise Marília</span>
            </button>
            <button
              onClick={() => setSelectedWallet(selectedWallet === 'BofA' ? null : 'BofA')}
              className={`col-span-2 p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 overflow-hidden relative ${selectedWallet === 'BofA' ? 'bg-blue-900 border-red-500 text-white shadow-md scale-100' : 'bg-white border-blue-200 text-blue-800 hover:border-red-300 hover:bg-blue-50/50'}`}
            >
              <span className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-red-500 via-white to-blue-600"></span>
              <Wallet className="w-6 h-6" />
              <span className="font-bold">BofA</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {walletSummaries.map(({ wallet, balance: walletBalance }) => (
              <button
                key={wallet}
                onClick={() => setSelectedWallet(selectedWallet === wallet ? null : wallet)}
                className={`min-w-0 rounded-lg border px-2.5 py-2 text-left transition-all ${selectedWallet === wallet ? 'border-slate-400 bg-white shadow-sm' : 'border-gray-200 bg-white/70 hover:bg-white'}`}
              >
                <p className="truncate text-[10px] font-bold uppercase tracking-wide text-gray-400">{wallet}</p>
                <p className={`truncate text-sm font-black ${walletTextClass[wallet]}`}>${formatCurrency(walletBalance)}</p>
              </button>
            ))}
          </div>

          {selectedWallet && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">Saldo Disponível</p>
                  <p className={`text-3xl font-black ${walletTextClass[selectedWallet]}`}>
                    ${formatCurrency(selectedWalletBalance)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={openNewDepositModal}
                  className="bg-emerald-50 text-emerald-600 font-bold p-3 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  {selectedWallet === 'BofA' ? 'Enviar Dinheiro' : 'Comprar Dólar'}
                </button>
                <button
                  onClick={openNewExpenseModal}
                  className="bg-rose-50 text-rose-600 font-bold p-3 rounded-xl border border-rose-100 hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                >
                  <MinusCircle className="w-5 h-5" />
                  Registrar Gasto
                </button>
                {selectedWallet !== 'BofA' && (
                  <button
                    onClick={openTransferModal}
                    className="col-span-2 bg-blue-50 text-blue-700 font-bold p-3 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Transferir p/ BofA
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Transactions List */}
        <div>
          <div className="flex justify-between items-end mb-4 px-1">
            <h2 className="text-lg font-bold text-gray-800">Histórico</h2>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap justify-end bg-gray-200/50 p-1 rounded-lg">
                <button
                  onClick={() => setHistoryFilter('Total')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${historyFilter === 'Total' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Total
                </button>
                <button
                  onClick={() => setHistoryFilter('Daniel')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${historyFilter === 'Daniel' ? 'bg-indigo-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Daniel
                </button>
                <button
                  onClick={() => setHistoryFilter('Marília')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${historyFilter === 'Marília' ? 'bg-rose-100 text-rose-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Marília
                </button>
                <button
                  onClick={() => setHistoryFilter('BofA')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${historyFilter === 'BofA' ? 'bg-blue-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  BofA
                </button>
              </div>
              <div className="flex flex-wrap justify-end bg-gray-200/50 p-1 rounded-lg">
                {[
                  { value: 'All', label: 'Tudo' },
                  { value: 'Today', label: 'Hoje' },
                  { value: 'Week', label: 'Semana' },
                  { value: 'Month', label: 'Mês' },
                ].map(period => (
                  <button
                    key={period.value}
                    onClick={() => setHistoryPeriod(period.value as HistoryPeriod)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${historyPeriod === period.value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading && historyItems.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-white p-4 rounded-2xl h-20 shadow-sm border border-gray-100"></div>
              ))}
            </div>
          ) : historyItems.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-gray-300">
              <HandCoins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum registro ainda nesta carteira.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyItems.map(item => {
                if (item.kind === 'transfer') {
                  const isItemDeleting = Boolean(isDeleting && getTransferGroupId(isDeleting) === item.id);

                  return (
                    <div key={`transfer-${item.id}`} className={`bg-white p-4 rounded-2xl shadow-sm border border-blue-100 flex items-center justify-between gap-3 transition-all ${isItemDeleting ? 'opacity-50 scale-95' : 'hover:border-blue-200'}`}>
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-blue-50">
                          <Send className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-gray-800 truncate">Transferência para BofA</p>
                          <div className="flex flex-col items-start gap-1 mt-2">
                            <p className="font-black text-[17px] text-blue-700 leading-none">
                              ${formatCurrency(item.sentAmount)} -&gt; ${formatCurrency(item.receivedAmount)}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                {new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${walletBadgeClass[item.sourceWallet]}`}>
                                {item.sourceWallet}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${walletBadgeClass.BofA}`}>
                                BofA
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                              Fee ${formatCurrency(item.fee)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEditTransferModal(item)}
                            disabled={isItemDeleting || isLoading}
                            className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                            title="Editar transferência"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.referenceTx)}
                            disabled={isItemDeleting || isLoading}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                            title="Apagar transferência"
                          >
                            {isItemDeleting ? <RefreshCw className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                const tx = item.tx;
                const isDeposit = tx.type === 'Deposit';
                const isExpense = tx.type === 'Expense';
                const isIncoming = isIncomingTransaction(tx);
                const isItemDeleting = isDeleting === tx.id;
                const transactionTitle = isDeposit ? 'Compra de Dólar' : tx.description;
                const canEdit = isDeposit || isExpense;

                return (
                  <div key={tx.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between gap-3 transition-all ${isItemDeleting ? 'opacity-50 scale-95' : 'hover:border-gray-300'}`}>
                    <div className="flex items-start gap-4 min-w-0">
                      <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isIncoming ? 'bg-emerald-100' : 'bg-red-50'}`}>
                        {isIncoming ? <ArrowDownRight className="w-6 h-6 text-emerald-600" /> : <ArrowUpRight className="w-6 h-6 text-rose-500" />}
                      </div>
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-gray-800 truncate">{transactionTitle}</p>
                        <div className="flex flex-col items-start gap-1 mt-2">
                          {!isDeposit && (
                            <p className={`font-black text-[17px] leading-none ${isIncoming ? 'text-emerald-500' : 'text-rose-600'}`}>
                              {isIncoming ? '+' : '-'}${formatCurrency(tx.amountUSD)}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                              {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${walletBadgeClass[tx.person]}`}>
                              {tx.person}
                            </span>
                          </div>
                          {isExpense && tx.category && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider mt-0.5 ${getCategoryColorClass(tx.category)}`}>
                              {tx.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-3">
                        {isDeposit && (
                          <div className="text-right">
                            <p className="font-black text-[17px] text-emerald-500 leading-none">
                              +${formatCurrency(tx.amountUSD)}
                            </p>
                            {tx.costBRL && (
                              <p className="text-[11px] text-gray-400 font-semibold mt-1">R$ {formatCurrency(tx.costBRL)}</p>
                            )}
                          </div>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(tx)}
                            disabled={isItemDeleting || isLoading}
                            className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                            title="Editar transação"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(tx)}
                          disabled={isItemDeleting || isLoading}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                          title="Apagar transação"
                        >
                          {isItemDeleting ? <RefreshCw className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}
      {(showAddModal || showExpenseModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
              {showAddModal ? <><PlusCircle className="text-emerald-500" /> {editingTx ? 'Editar Dólar' : depositActionLabel}</> : <><MinusCircle className="text-rose-500" /> {editingTx ? 'Editar Gasto' : 'Registrar Gasto'}</>}
            </h3>

            <form onSubmit={showAddModal ? handleDeposit : handleExpense} className="space-y-4">

              {/* A pessoa/conta é associada automaticamente com a carteira selecionada */}

              {showAddModal && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Valor (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={amountUSD}
                        onChange={e => setAmountUSD(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 pl-8 text-lg font-bold focus:border-slate-800 focus:bg-white outline-none transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Custo em Reais (BRL)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={costBRL}
                        onChange={e => setCostBRL(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 pl-10 text-lg font-bold focus:border-emerald-500 focus:bg-white outline-none transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </>
              )}

              {showExpenseModal && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                    <input
                      type="text"
                      required
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full h-14 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-semibold focus:border-rose-500 focus:bg-white outline-none transition-all"
                      placeholder="Ex: Restaurante Shake Shack"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Valor (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={amountUSD}
                        onChange={e => setAmountUSD(e.target.value)}
                        className="w-full h-14 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 pl-8 text-lg font-bold focus:border-rose-500 focus:bg-white outline-none transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-rose-500" /> Data da compra
                    </label>
                    <input
                      type="date"
                      required
                      value={transactionDate}
                      onChange={e => setTransactionDate(e.target.value)}
                      className="w-full h-14 appearance-none bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-semibold leading-none focus:border-rose-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><Tag className="w-4 h-4 text-rose-500" /> Categoria</label>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryName(cat.name)}
                          className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${categoryName === cat.name ? 'shadow-md border-gray-400 opacity-100 scale-105' : 'opacity-70 hover:opacity-100 border-transparent'} ${getCategoryColorClass(cat.name)}`}
                          title={cat.codebook}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowExpenseModal(false);
                    setTransactionDate(getTodayDateInput());
                    setEditingTx(null);
                  }}
                  className="flex-1 py-3.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-3.5 text-white font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 ${showAddModal ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'}`}
                >
                  Salvar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {showTransferModal && transferSourceWallet && transferSourceWallet !== 'BofA' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
              <Send className="text-blue-500" /> {editingTransfer ? 'Editar transferência' : 'Transferir para BofA'}
            </h3>

            <form onSubmit={handleTransferToBofA} className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="text-xs text-blue-500 font-bold uppercase tracking-wide mb-1">Origem</p>
                <p className="font-black text-blue-900">Wise {transferSourceWallet}</p>
                <p className="text-sm text-blue-600 font-semibold mt-1">${formatCurrency(walletBalances[transferSourceWallet])} disponível</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Valor enviado (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={transferSentUSD}
                    onChange={e => handleTransferSentChange(e.target.value)}
                    className="w-full h-14 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 pl-8 text-lg font-bold focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Valor que chega (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={transferReceivedUSD}
                    onChange={e => handleTransferReceivedChange(e.target.value)}
                    className="w-full h-14 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 pl-8 text-lg font-bold focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Fee (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={transferFeeUSD}
                    onChange={e => handleTransferFeeChange(e.target.value)}
                    className="w-full h-14 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 pl-8 text-lg font-bold focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-blue-500" /> Data da transferência
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full h-14 appearance-none bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-semibold leading-none focus:border-blue-500 focus:bg-white outline-none transition-all"
                />
              </div>

              <div className="flex gap-2 pt-5">
                <button
                  type="button"
                  onClick={closeTransferModal}
                  className="flex-1 py-3.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 text-white font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                >
                  {editingTransfer ? 'Salvar' : 'Transferir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATS MODAL */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative">
            <button
              onClick={() => setShowStatsModal(false)}
              className="absolute top-4 right-4 p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              <BarChart2 className="text-cyan-500" /> Visão de Gastos
            </h3>

            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 pb-4">
              <div className="grid grid-cols-2 gap-3 pb-4 border-b border-gray-100">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wide">Hoje</p>
                  <p className="text-2xl font-black text-slate-800">${formatCurrency(spendToday)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wide">Esta Semana</p>
                  <p className="text-2xl font-black text-slate-800">${formatCurrency(spendThisWeek)}</p>
                </div>
              </div>

              <div className="bg-cyan-50 p-5 rounded-2xl border border-cyan-100 relative overflow-hidden">
                <div className="flex justify-between items-start mb-2 relative z-10 w-full">
                  <p className="text-sm text-cyan-700 font-bold uppercase tracking-wide flex-shrink-0 mt-1">{selectedMonthLabel}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative">
                      <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="appearance-none bg-cyan-100/80 hover:bg-cyan-200 text-cyan-800 font-bold text-sm pl-2 pr-6 py-1.5 rounded-lg border border-cyan-200 cursor-pointer outline-none">
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown className="w-3 h-3 text-cyan-700 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="appearance-none bg-cyan-100/80 hover:bg-cyan-200 text-cyan-800 font-bold text-sm pl-2 pr-6 py-1.5 rounded-lg border border-cyan-200 cursor-pointer outline-none">
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="w-3 h-3 text-cyan-700 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <p className="text-4xl font-black text-cyan-900 relative z-0 break-words">${formatCurrency(spendSelectedMonth)}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-4 mt-1">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mb-3">Média Personalizada</p>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold text-slate-400 w-8">DE:</span>
                  <div className="flex gap-1.5">
                    <div className="relative">
                      <select value={avgStartMonth} onChange={e => setAvgStartMonth(Number(e.target.value))} className="appearance-none text-xs font-bold text-slate-700 bg-white border border-gray-200 rounded p-1.5 pr-6 outline-none">
                         {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select value={avgStartYear} onChange={e => setAvgStartYear(Number(e.target.value))} className="appearance-none text-xs font-bold text-slate-700 bg-white border border-gray-200 rounded p-1.5 pr-6 outline-none">
                         {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-bold text-slate-400 w-8">ATÉ:</span>
                  <div className="flex gap-1.5">
                    <div className="relative">
                      <select value={avgEndMonth} onChange={e => setAvgEndMonth(Number(e.target.value))} className="appearance-none text-xs font-bold text-slate-700 bg-white border border-gray-200 rounded p-1.5 pr-6 outline-none">
                         {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select value={avgEndYear} onChange={e => setAvgEndYear(Number(e.target.value))} className="appearance-none text-xs font-bold text-slate-700 bg-white border border-gray-200 rounded p-1.5 pr-6 outline-none">
                         {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold mb-0.5 uppercase tracking-wide">Média Diária</p>
                    <p className="text-lg font-black text-gray-800">${formatCurrency(dailyAverage)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold mb-0.5 uppercase tracking-wide">Média Mensal</p>
                    <p className="text-lg font-black text-gray-800">${formatCurrency(monthlyAverage)}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-slate-500 font-bold mb-3 uppercase tracking-wide flex items-center gap-1"><Tag className="w-3 h-3" /> {selectedCategoriesLabel}</p>
                {sortedCategories.length === 0 ? (
                  <p className="text-sm text-gray-400 font-medium">Nenhum gasto no mês.</p>
                ) : (
                  <div className="space-y-3">
                    {sortedCategories.map(([catName, amount]) => {
                      const isExpanded = expandedStatsCategory === catName;
                      const catExpenses = expensesSelectedMonth.filter(t => (t.category || 'Outros') === catName).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      return (
                      <div key={catName} className="flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-2 transition-all">
                        <button 
                          onClick={() => setExpandedStatsCategory(isExpanded ? null : catName)}
                          className="flex justify-between items-center p-2.5 w-full text-left hover:bg-gray-50 transition-colors"
                        >
                          <span className={`text-[11px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${getCategoryColorClass(catName)}`}>
                            {catName}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-700">${formatCurrency(amount)}</span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="bg-slate-50 border-t border-gray-100 p-2 space-y-1.5 max-h-48 overflow-y-auto">
                            {catExpenses.map(tx => (
                              <div key={tx.id} className="flex justify-between items-center p-2 rounded-lg bg-white border border-gray-100 shadow-sm">
                                <div className="truncate pr-2">
                                  <p className="font-semibold text-xs text-slate-700 truncate">{tx.description}</p>
                                  <p className="text-[10px] font-bold text-gray-400 mt-0.5 whitespace-nowrap">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <span className="font-bold text-xs text-slate-600 shrink-0">
                                  ${formatCurrency(tx.amountUSD)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CATEGORY SETTINGS MODAL */}
      {showCategorySettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => setShowCategorySettings(false)}
              className="absolute top-4 right-4 p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              <Settings className="text-purple-500" /> Categorias
            </h3>

            <div className="overflow-y-auto flex-1 pr-2 space-y-3 mb-4 min-h-[50vh]">
              {categories.map(cat => (
                <div key={cat.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800 items-center flex gap-1"><Tag className="w-3 h-3 text-purple-400" /> {cat.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{cat.codebook}</p>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat.name)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateCategory} className="pt-4 border-t border-gray-100 mt-auto">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Nova Categoria</p>
              <div className="space-y-3">
                <input
                  type="text" required placeholder="Nome (Ex: Padaria)"
                  value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:border-purple-500 focus:bg-white outline-none"
                />
                <input
                  type="text" required placeholder="O que entra aqui? (Codebook)"
                  value={newCatCodebook} onChange={e => setNewCatCodebook(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:border-purple-500 focus:bg-white outline-none"
                />
                <button type="submit" disabled={isLoading} className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  <PlusCircle className="w-4 h-4" /> Adicionar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
