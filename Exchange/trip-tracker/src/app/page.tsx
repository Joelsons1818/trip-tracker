'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '@/types';
import { PlusCircle, MinusCircle, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, HandCoins, Trash2, BarChart2, X, Calendar, ChevronDown } from 'lucide-react';

const generateMonthOptions = () => {
  const options = [];
  const today = new Date();
  let d = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  for (let i = 0; i < 24; i++) {
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1).replace('.', '') });
    d.setMonth(d.getMonth() + 1);
  }
  return options;
};

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Form State
  const [person, setPerson] = useState<'Daniel' | 'Marília'>('Daniel');
  const [amountUSD, setAmountUSD] = useState('');
  const [costBRL, setCostBRL] = useState('');
  const [description, setDescription] = useState('');

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

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountUSD || !costBRL) return;

    setShowAddModal(false);
    setIsLoading(true);

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: 'Deposit',
      person,
      amountUSD: parseFloat(amountUSD),
      costBRL: parseFloat(costBRL)
    };

    setAmountUSD('');
    setCostBRL('');

    await fetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(newTx),
      headers: { 'Content-Type': 'application/json' }
    });

    fetchTransactions();
  };

  const handleExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountUSD || !description) return;

    setShowExpenseModal(false);
    setIsLoading(true);

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: 'Expense',
      person,
      amountUSD: parseFloat(amountUSD),
      description
    };

    setAmountUSD('');
    setDescription('');

    await fetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(newTx),
      headers: { 'Content-Type': 'application/json' }
    });

    fetchTransactions();
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

  // --- Analytics Calculations ---
  const expenses = transactions.filter(t => t.type === 'Expense');

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

  // Calculate Averages
  let firstTxDate = expenses.length > 0 ? new Date(expenses[expenses.length - 1].date).getTime() : now.getTime();
  const daysSinceFirst = Math.max(1, Math.ceil((now.getTime() - firstTxDate) / (1000 * 60 * 60 * 24)));
  const monthsSinceFirst = Math.max(1, daysSinceFirst / 30);

  const dailyAverage = totalExpenses / daysSinceFirst;
  const monthlyAverage = totalExpenses / monthsSinceFirst;


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
              <button onClick={() => setShowStatsModal(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
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
            <p className="text-4xl font-extrabold tracking-tight">${balance.toFixed(2)}</p>

            <div className="flex gap-4 mt-5 pt-4 border-t border-white/10">
              <div className="flex-1">
                <p className="text-xs text-emerald-300 font-medium flex items-center gap-1 mb-1"><ArrowDownRight className="w-3 h-3" /> Entradas</p>
                <p className="font-semibold">${totalDeposits.toFixed(2)}</p>
              </div>
              <div className="w-px bg-white/10"></div>
              <div className="flex-1">
                <p className="text-xs text-rose-300 font-medium flex items-center gap-1 mb-1"><ArrowUpRight className="w-3 h-3" /> Gastos</p>
                <p className="font-semibold">${totalExpenses.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setShowAddModal(true)}
            className="group relative overflow-hidden bg-white text-emerald-600 font-semibold p-4 rounded-2xl shadow-sm border border-emerald-100 hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
          >
            <div className="bg-emerald-100 p-3 rounded-full group-hover:scale-110 transition-transform">
              <PlusCircle className="w-6 h-6" />
            </div>
            Comprar Dólar
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="group relative overflow-hidden bg-white text-rose-600 font-semibold p-4 rounded-2xl shadow-sm border border-rose-100 hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
          >
            <div className="bg-rose-100 p-3 rounded-full group-hover:scale-110 transition-transform">
              <MinusCircle className="w-6 h-6" />
            </div>
            Registrar Gasto
          </button>
        </div>

        {/* Transactions List */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">Histórico (Carnêzinho)</h2>

          {isLoading && transactions.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-white p-4 rounded-2xl h-20 shadow-sm border border-gray-100"></div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-gray-300">
              <HandCoins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum registro ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map(tx => {
                const isDaniel = tx.person === 'Daniel';
                const isDeposit = tx.type === 'Deposit';
                const isItemDeleting = isDeleting === tx.id;

                // Color Themes (High contrast)
                const personBg = isDaniel
                  ? 'bg-indigo-900 border border-indigo-700 text-indigo-50 shadow-sm'
                  : 'bg-rose-100 border border-rose-300 text-rose-800 shadow-sm';

                return (
                  <div key={tx.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between transition-all ${isItemDeleting ? 'opacity-50 scale-95' : 'hover:border-gray-300'}`}>
                    <div className="flex items-center gap-4 truncate">
                      <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isDeposit ? 'bg-emerald-100' : 'bg-red-50'}`}>
                        {isDeposit ? <ArrowDownRight className="w-6 h-6 text-emerald-600" /> : <ArrowUpRight className="w-6 h-6 text-rose-500" />}
                      </div>
                      <div className="truncate pr-2">
                        <p className="font-bold text-gray-800 truncate">{isDeposit ? 'Compra de Dólar' : tx.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${personBg}`}>
                            {tx.person}
                          </span>
                          <span className="text-xs text-gray-400 font-medium shrink-0">
                            {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className={`font-black text-[17px] ${isDeposit ? 'text-emerald-500' : 'text-rose-600'}`}>
                          {isDeposit ? '+' : '-'}${tx.amountUSD.toFixed(2)}
                        </p>
                        {isDeposit && tx.costBRL && (
                          <p className="text-[11px] text-gray-400 font-semibold">R$ {tx.costBRL.toFixed(2)}</p>
                        )}
                      </div>
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
              {showAddModal ? <><PlusCircle className="text-emerald-500" /> Comprar Dólar</> : <><MinusCircle className="text-rose-500" /> Registrar Gasto</>}
            </h3>

            <form onSubmit={showAddModal ? handleDeposit : handleExpense} className="space-y-4">

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quem?</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setPerson('Daniel')}
                    className={`flex-1 py-3 px-2 rounded-xl font-bold transition-all ${person === 'Daniel' ? 'bg-indigo-900 text-white shadow-md scale-100' : 'bg-transparent text-gray-500 hover:bg-gray-200'}`}
                  >
                    Daniel
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerson('Marília')}
                    className={`flex-1 py-3 px-2 rounded-xl font-bold transition-all ${person === 'Marília' ? 'bg-rose-100 border border-rose-300 text-rose-800 shadow-md scale-100' : 'bg-transparent text-gray-500 hover:bg-gray-200'}`}
                  >
                    Marília
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Valor (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
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
                      type="number"
                      step="0.01"
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base font-semibold focus:border-rose-500 focus:bg-white outline-none transition-all"
                    placeholder="Ex: Restaurante Shake Shack"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowExpenseModal(false);
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

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 pb-4 border-b border-gray-100">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wide">Hoje</p>
                  <p className="text-2xl font-black text-slate-800">${spendToday.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wide">Esta Semana</p>
                  <p className="text-2xl font-black text-slate-800">${spendThisWeek.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-cyan-50 p-5 rounded-2xl border border-cyan-100 relative overflow-hidden">
                <div className="absolute top-4 right-4 z-10">
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

                <p className="text-sm text-cyan-700 font-bold mb-1 uppercase tracking-wide relative z-0">Este Mês</p>
                <p className="text-4xl font-black text-cyan-900 mb-2 relative z-0">${spendSelectedMonth.toFixed(2)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <p className="text-[11px] text-gray-400 font-bold mb-1 uppercase tracking-wide">Média Diária (Anual)</p>
                  <p className="text-lg font-bold text-gray-700">${dailyAverage.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-bold mb-1 uppercase tracking-wide">Média Mensal</p>
                  <p className="text-lg font-bold text-gray-700">${monthlyAverage.toFixed(2)}</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
