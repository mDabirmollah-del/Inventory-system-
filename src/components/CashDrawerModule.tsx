import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  PlusCircle,
  MinusCircle,
  Calendar,
  Clock,
  CheckCircle,
  X,
  Receipt,
} from 'lucide-react';
import { db } from '../db/database';
import type { CashDrawer, CashEvent, CashEventType } from '../types';
import { recordCashAdjustment } from '../services/posService';

export const CashDrawerModule: React.FC = () => {
  const [drawer, setDrawer] = useState<CashDrawer | null>(null);
  const [events, setEvents] = useState<CashEvent[]>([]);

  // Adjustment Modal
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'CASH_IN' | 'CASH_OUT' | 'ADJUSTMENT' | 'EXPENSE'>('CASH_IN');
  const [amountInput, setAmountInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('বিদ্যুৎ বিল');
  const [isProcessing, setIsProcessing] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadDrawerData = async () => {
    const active = await db.cashDrawer.where('sessionDate').equals(todayStr).first();
    setDrawer(active || null);

    const list = await db.cashEvents.orderBy('createdAt').reverse().limit(40).toArray();
    setEvents(list);
  };

  useEffect(() => {
    loadDrawerData();
  }, []);

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountInput);
    if (!amount || amount <= 0) {
      alert('সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }
    if (!descriptionInput.trim()) {
      alert('বিবরণ / কারণ আবশ্যক।');
      return;
    }

    setIsProcessing(true);
    try {
      await recordCashAdjustment({
        eventType: modalType,
        amount,
        description: descriptionInput.trim(),
        performedBy: 'মালিক',
      });

      await loadDrawerData();
      setShowModal(false);
      setAmountInput('');
      setDescriptionInput('');
    } catch (err: any) {
      alert(err.message || 'ক্যাশ ড্রয়ার আপডেট ব্যর্থ হয়েছে');
    } finally {
      setIsProcessing(false);
    }
  };

  const getEventBadge = (type: CashEventType) => {
    switch (type) {
      case 'SALE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">পণ্য বিক্রয়</span>;
      case 'DUE_COLLECTION':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">বাকি আদায়</span>;
      case 'CASH_IN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">ক্যাশ ইন</span>;
      case 'CASH_OUT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">ক্যাশ আউট</span>;
      case 'EXPENSE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">ব্যবসায়িক খরচ</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800">{type}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-base text-emerald-950 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-700" />
            দৈনিক ক্যাশ ড্রয়ার ও নগদ ক্যাশবুক (Event-Based Cash Drawer)
          </h2>
          <p className="text-xs text-gray-600">
            রিয়েল-টাইম ক্যাশ ট্র্যাকিং, বিক্রয় জমা, বকেয়া আদায় এবং দোকান খরচ খতিয়ান
          </p>
        </div>

        {/* Quick Cash In / Out Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setModalType('CASH_IN');
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            ক্যাশ ইন (জমা)
          </button>
          <button
            onClick={() => {
              setModalType('CASH_OUT');
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
          >
            <MinusCircle className="w-3.5 h-3.5" />
            ক্যাশ আউট
          </button>
          <button
            onClick={() => {
              setModalType('EXPENSE');
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
          >
            <Receipt className="w-3.5 h-3.5" />
            কুইক খরচ (Expense)
          </button>
        </div>
      </div>

      {/* Cash Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-emerald-950 text-white p-4 rounded-xl border border-emerald-900 shadow-sm">
          <span className="text-xs font-semibold text-emerald-300 uppercase block">
            বর্তমান ক্যাশ ব্যালেন্স (Current Cash)
          </span>
          <div className="text-2xl font-black font-mono text-amber-300 mt-1">
            ৳ {(drawer?.currentCash || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-400 block mt-1">
            প্রারম্ভিক ক্যাশ: ৳ {(drawer?.openingBalance || 0).toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase block">
            আজকের নগদ বিক্রয় (Sales Cash)
          </span>
          <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
            ৳ {(drawer?.totalSalesCash || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium block mt-1 flex items-center gap-1">
            <ArrowDownLeft className="w-3 h-3" /> কাউন্টার বিক্রয় থেকে
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase block">
            বকেয়া আদায় ক্যাশ (Due Collected)
          </span>
          <div className="text-xl font-bold font-mono text-teal-800 mt-1">
            ৳ {(drawer?.totalDueCollectedCash || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-teal-600 font-medium block mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> কৃষকদের বাকি পরিশোধ
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase block">
            দোকান খরচ / ক্যাশ আউট (Cash Out)
          </span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">
            ৳ {(drawer?.totalCashOut || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-rose-600 font-medium block mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> বিভিন্ন খরচ ও অপচয়
          </span>
        </div>
      </div>

      {/* Cash Events Audit Trail Table */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
        <div className="flex items-center justify-between border-b pb-3 mb-3">
          <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wider">
            ক্যাশ ইভেন্ট ইতিহাস ও অডিট ট্রেইল ({events.length})
          </h3>
          <span className="text-xs text-gray-500 font-mono">
            সেশন তারিখ: {drawer?.sessionDate || todayStr}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-emerald-50 text-emerald-950 font-bold border-y border-emerald-200">
                <th className="py-2.5 px-3">সময়</th>
                <th className="py-2.5 px-3">ইভেন্টের ধরন</th>
                <th className="py-2.5 px-3">বিবরণ / রেফারেন্স</th>
                <th className="py-2.5 px-3">দায়িত্বপ্রাপ্ত</th>
                <th className="py-2.5 px-3 text-right">টাকার পরিমাণ</th>
                <th className="py-2.5 px-3 text-right">পরবর্তী ব্যালেন্স</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((ev) => {
                const isInflow = ['SALE', 'DUE_COLLECTION', 'CASH_IN'].includes(ev.eventType);
                return (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono text-gray-500">
                      {new Date(ev.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3">{getEventBadge(ev.eventType)}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-800">{ev.description}</td>
                    <td className="py-2.5 px-3 text-gray-600">{ev.performedBy}</td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        isInflow ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isInflow ? '+' : '-'} ৳ {ev.amount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                      ৳ {ev.balanceAfter}
                    </td>
                  </tr>
                );
              })}

              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    আজ এখনও কোনো ক্যাশ ইভেন্ট সম্পন্ন হয়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Adjustment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-gray-200 overflow-hidden">
            <div className="bg-emerald-950 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {modalType === 'CASH_IN'
                  ? 'ক্যাশ ড্রয়ারে টাকা জমা (Cash In)'
                  : modalType === 'CASH_OUT'
                  ? 'ক্যাশ আউট / উত্তোলন (Cash Out)'
                  : modalType === 'EXPENSE'
                  ? 'ব্যবসায়িক খরচ এন্ট্রি (Quick Expense)'
                  : 'ক্যাশ সমন্বয় (Adjustment)'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="p-5 space-y-3 text-xs">
              {modalType === 'EXPENSE' && (
                <div>
                  <label className="block font-bold text-gray-800 mb-1">খরচের ধরন (Category)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['বিদ্যুৎ বিল', 'পরিবহন খরচ', 'লেবার খরচ', 'দোকান ভাড়া', 'চা-নাস্তা', 'অন্যান্য'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setExpenseCategory(cat);
                          if (descriptionInput === '' || ['বিদ্যুৎ বিল', 'পরিবহন খরচ', 'লেবার খরচ', 'দোকান ভাড়া', 'চা-নাস্তা', 'অন্যান্য'].includes(descriptionInput)) {
                            setDescriptionInput(cat);
                          }
                        }}
                        className={`py-1.5 px-2 rounded border text-[10px] font-bold transition ${
                          expenseCategory === cat
                            ? 'bg-orange-100 border-orange-500 text-orange-900'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  টাকার পরিমাণ (BDT ৳) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="যেমন: ৫০০"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 font-mono font-bold text-sm focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  {modalType === 'EXPENSE' ? 'খরচের বিস্তারিত বিবরণ *' : 'বিবরণ / রেফারেন্স *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    modalType === 'EXPENSE'
                      ? 'যেমন: অক্টোবর মাসের বিদ্যুৎ বিল পরিশোধ'
                      : modalType === 'CASH_OUT'
                      ? 'যেমন: ব্যাংক জমা, ব্যক্তিগত উত্তোলন...'
                      : 'যেমন: ক্যাশ শর্ট এডজাস্টমেন্ট...'
                  }
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded shadow-xs"
                >
                  {isProcessing ? 'আপডেট হচ্ছে...' : 'নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
