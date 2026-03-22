'use client';

import { useState, useEffect } from 'react';
import { Transaction, Category } from '@/types';
import { PlusCircle, MinusCircle, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, HandCoins, Trash2, BarChart2, X, Calendar, ChevronDown, Settings, Edit3, Tag, HelpCircle } from 'lucide-react';

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

const formatCurrency = (val: number) => {
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const generateMonthOptions = () => {
  const options = [];
  const today = new Date();
  let d = new Date(today.getFullYear(), today.getMonth() - 12, 1);
  for (let i = 0; i < 36; i++) {
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1).replace('.', '') });
    d.setMonth(d.getMonth() + 1);
  }
  return options;
};

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // New Wise State
  const [selectedWise, setSelectedWise] = useState<'Daniel' | 'Marília' | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'Total' | 'Daniel' | 'Marília'>('Total');
  const [amountUSD, setAmountUSD] = useState('');
  const [costBRL, setCostBRL] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  
  // Category management state
  const [newCatName, setNewCatName] = useState('');
  const [newCatCodebook, setNewCatCodebook] = useState('');

  // Analytics State
  const [selectedMonthStr, setSelectedMonthStr] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

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

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountUSD || !costBRL) return;

    setShowAddModal(false);
    setIsLoading(true);

    const payload: Transaction = {
      id: editingTx ? editingTx.id : crypto.randomUUID(),
      date: editingTx ? editingTx.date : new Date().toISOString(),
      type: 'Deposit',
      person: editingTx ? editingTx.person : (selectedWise || 'Daniel'),
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
    if (!amountUSD || !description || !categoryName) {
        alert("Preencha todos os campos e selecione uma categoria!");
        return;
    }

    setShowExpenseModal(false);
    setIsLoading(true);

    const payload: Transaction = {
      id: editingTx ? editingTx.id : crypto.randomUUID(),
      date: editingTx ? editingTx.date : new Date().toISOString(),
      type: 'Expense',
      person: editingTx ? editingTx.person : (selectedWise || 'Daniel'),
      amountUSD: parseInputNumber(amountUSD),
      description,
      category: categoryName,
      rowIndex: editingTx ? editingTx.rowIndex : undefined
    };

    setAmountUSD('');
    setDescription('');
    setCategoryName('');
    setEditingTx(null);

    await fetch('/api/transactions', {
      method: editingTx ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });

    fetchTransactions();
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setAmountUSD(tx.amountUSD.toString());
    if (tx.type === 'Deposit') {
        setCostBRL(tx.costBRL?.toString() || '');
        setShowAddModal(true);
    } else {
        setDescription(tx.description || '');
        setCategoryName(tx.category || '');
        setShowExpenseModal(true);
    }
  };

  const handleDelete = async (tx: Transaction) => {
    if (!tx.rowIndex) return;

    if (!confirm('Tem certeza que deseja apagar esta transação da planilha?')) {
      return;
    }

    setIsDeleting(tx.id);
    try {
      await fetch(`/api/transactions?rowIndex=${tx.rowIndex}`, {
        method: 'DELETE',
      });
      await fetchTransactions();
    } catch (error) {
      console.error('Failed to delete', error);
      alert('Failed to delete transaction');
    } finally {
      setIsDeleting(null);
    }
  };

  const totalDeposits = transactions.filter(t => t.type === 'Deposit').reduce((acc, t) => acc + t.amountUSD, 0);
  const totalExpenses = transactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + t.amountUSD, 0);
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

  const getPersonBalance = (p: 'Daniel'|'Marília') => {
    const deps = transactions.filter(t => t.type === 'Deposit' && t.person === p).reduce((acc, t) => acc + t.amountUSD, 0);
    const exps = transactions.filter(t => t.type === 'Expense' && t.person === p).reduce((acc, t) => acc + t.amountUSD, 0);
    return deps - exps;
  };
  const danielBalance = getPersonBalance('Daniel');
  const mariliaBalance = getPersonBalance('Marília');

  const filteredTransactions = historyFilter === 'Total' 
    ? transactions 
    : transactions.filter(t => t.person === historyFilter);

  // --- Analytics Calculations ---
  // Analytics apply only to the filtered view
  const expenses = filteredTransactions.filter(t => t.type === 'Expense');
  const filteredTotalExpenses = expenses.reduce((acc, t) => acc + t.amountUSD, 0);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(startOfDay - now.getDay() * 24 * 60 * 60 * 1000).getTime();

  // Selected Month Logic
  const [selYear, selMonth] = selectedMonthStr.split('-').map(Number);
  const startOfSelectedMonth = new Date(selYear, selMonth - 1, 1).getTime();
  const endOfSelectedMonth = new Date(selYear, selMonth, 1).getTime(); // 1st of next month

  let spendToday = 0;
  let spendThisWeek = 0;
  let spendSelectedMonth = 0;

  expenses.forEach(t => {
    const time = new Date(t.date).getTime();
    if (time >= startOfDay) spendToday += t.amountUSD;
    if (time >= startOfWeek) spendThisWeek += t.amountUSD;
    if (time >= startOfSelectedMonth && time < endOfSelectedMonth) spendSelectedMonth += t.amountUSD;
  });

  // Category Breakdown logic for the selected month
  const expensesSelectedMonth = expenses.filter(t => {
     const time = new Date(t.date).getTime();
     return time >= startOfSelectedMonth && time < endOfSelectedMonth;
  });
  
  const categoryTotals: Record<string, number> = {};
  expensesSelectedMonth.forEach(t => {
      const cat = t.category || 'Outros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amountUSD;
  });
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  // Calculate Averages
  let firstTxDate = expenses.length > 0 ? new Date(expenses[expenses.length - 1].date).getTime() : now.getTime();
  const daysSinceFirst = Math.max(1, Math.ceil((now.getTime() - firstTxDate) / (1000 * 60 * 60 * 24)));
  const monthsSinceFirst = Math.max(1, daysSinceFirst / 30);

  const dailyAverage = filteredTotalExpenses / daysSinceFirst;
  const monthlyAverage = filteredTotalExpenses / monthsSinceFirst;


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
                <p className="text-xs text-rose-300 font-medium flex items-center gap-1 mb-1"><ArrowUpRight className="w-3 h-3" /> Gastos</p>
                <p className="font-semibold">${formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4">
        {/* NEW WALLETS SECTION */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">Carteiras Wise</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setSelectedWise(selectedWise === 'Daniel' ? null : 'Daniel')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${selectedWise === 'Daniel' ? 'bg-indigo-900 border-indigo-700 text-white shadow-md scale-100' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
            >
              <Wallet className="w-6 h-6" />
              <span className="font-bold">Wise Daniel</span>
            </button>
            <button
              onClick={() => setSelectedWise(selectedWise === 'Marília' ? null : 'Marília')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${selectedWise === 'Marília' ? 'bg-rose-100 border-rose-300 text-rose-800 shadow-md scale-100' : 'bg-white border-gray-200 text-gray-600 hover:border-rose-300 hover:bg-rose-50/50'}`}
            >
              <Wallet className="w-6 h-6" />
              <span className="font-bold">Wise Marília</span>
            </button>
          </div>

          {selectedWise && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">Saldo Disponível</p>
                  <p className={`text-3xl font-black ${selectedWise === 'Daniel' ? 'text-indigo-900' : 'text-rose-800'}`}>
                    ${formatCurrency(selectedWise === 'Daniel' ? danielBalance : mariliaBalance)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-emerald-50 text-emerald-600 font-bold p-3 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  Comprar Dólar
                </button>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="bg-rose-50 text-rose-600 font-bold p-3 rounded-xl border border-rose-100 hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                >
                  <MinusCircle className="w-5 h-5" />
                  Registrar Gasto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Transactions List */}
        <div>
          <div className="flex justify-between items-end mb-4 px-1">
            <h2 className="text-lg font-bold text-gray-800">Histórico</h2>
            <div className="flex bg-gray-200/50 p-1 rounded-lg">
              <button 
                onClick={() => setHistoryFilter('Total')} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyFilter === 'Total' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Total
              </button>
              <button 
                onClick={() => setHistoryFilter('Daniel')} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyFilter === 'Daniel' ? 'bg-indigo-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Daniel
              </button>
              <button 
                onClick={() => setHistoryFilter('Marília')} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyFilter === 'Marília' ? 'bg-rose-100 text-rose-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Marília
              </button>
            </div>
          </div>

          {isLoading && filteredTransactions.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-white p-4 rounded-2xl h-20 shadow-sm border border-gray-100"></div>
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-gray-300">
              <HandCoins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum registro ainda nesta carteira.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map(tx => {
                const isDaniel = tx.person === 'Daniel';
                const isDeposit = tx.type === 'Deposit';
                const isItemDeleting = isDeleting === tx.id;

                // Color Themes (High contrast)
                const personBg = isDaniel
                  ? 'bg-green-100 border border-green-300 text-green-800 shadow-sm'
                  : 'bg-yellow-100 border border-yellow-300 text-yellow-800 shadow-sm';

                return (
                  <div key={tx.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between transition-all ${isItemDeleting ? 'opacity-50 scale-95' : 'hover:border-gray-300'}`}>
                    <div className="flex items-center gap-4 truncate">
                      <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isDeposit ? 'bg-emerald-100' : 'bg-red-50'}`}>
                        {isDeposit ? <ArrowDownRight className="w-6 h-6 text-emerald-600" /> : <ArrowUpRight className="w-6 h-6 text-rose-500" />}
                      </div>
                      <div className="truncate pr-2">
                        <p className="font-bold text-gray-800 truncate">{isDeposit ? 'Compra de Dólar' : tx.description}</p>
                        <div className="flex flex-col items-start gap-1 mt-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${personBg}`}>
                              {tx.person}
                            </span>
                          </div>
                          {tx.category && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider mt-0.5">
                              {tx.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`font-black text-[17px] ${isDeposit ? 'text-emerald-500' : 'text-rose-600'} leading-none`}>
                            {isDeposit ? '+' : '-'}${formatCurrency(tx.amountUSD)}
                          </p>
                          {isDeposit && tx.costBRL && (
                            <p className="text-[11px] text-gray-400 font-semibold mt-1">R$ {formatCurrency(tx.costBRL)}</p>
                          )}
                        </div>
                        <button
                          onClick={() => openEditModal(tx)}
                          disabled={isItemDeleting || isLoading}
                          className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                          title="Editar transação"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
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
              {showAddModal ? <><PlusCircle className="text-emerald-500" /> {editingTx ? 'Editar Dólar' : 'Comprar Dólar'}</> : <><MinusCircle className="text-rose-500" /> {editingTx ? 'Editar Gasto' : 'Registrar Gasto'}</>}
            </h3>

            <form onSubmit={showAddModal ? handleDeposit : handleExpense} className="space-y-4">

              {/* A Pessoa (Quem) agora é associada automaticamente com a carteira Wise selecionada */}

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

              {showAddModal && (
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
              )}

              {showExpenseModal && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><Tag className="w-4 h-4 text-rose-500" /> Categoria</label>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryName(cat.name)}
                          className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${categoryName === cat.name ? 'bg-rose-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          title={cat.codebook}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 mt-2">Descrição</label>
                    <input
                      type="text"
                      required
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-semibold focus:border-rose-500 focus:bg-white outline-none transition-all"
                      placeholder="Ex: Restaurante Shake Shack"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowExpenseModal(false);
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
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <p className="text-sm text-cyan-700 font-bold uppercase tracking-wide">Este Mês</p>
                  <div className="relative">
                    <select
                      value={selectedMonthStr}
                      onChange={e => setSelectedMonthStr(e.target.value)}
                      className="appearance-none bg-cyan-100/80 hover:bg-cyan-200 text-cyan-800 font-bold text-sm pl-3 pr-8 py-1.5 rounded-lg border border-cyan-200 cursor-pointer transition-colors outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {generateMonthOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-cyan-700 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <p className="text-4xl font-black text-cyan-900 relative z-0 break-words">${formatCurrency(spendSelectedMonth)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-[11px] text-gray-400 font-bold mb-1 uppercase tracking-wide">Média Diária (Anual)</p>
                  <p className="text-lg font-bold text-gray-700">${formatCurrency(dailyAverage)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-bold mb-1 uppercase tracking-wide">Média Mensal</p>
                  <p className="text-lg font-bold text-gray-700">${formatCurrency(monthlyAverage)}</p>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-slate-500 font-bold mb-3 uppercase tracking-wide flex items-center gap-1"><Tag className="w-3 h-3" /> Categorias Neste Mês</p>
                {sortedCategories.length === 0 ? (
                  <p className="text-sm text-gray-400 font-medium">Nenhum gasto no mês.</p>
                ) : (
                  <div className="space-y-3">
                    {sortedCategories.map(([catName, amount]) => (
                      <div key={catName} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                          <span className="text-sm font-semibold text-gray-700">{catName}</span>
                        </div>
                        <span className="text-sm font-black text-rose-600">${formatCurrency(amount)}</span>
                      </div>
                    ))}
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
