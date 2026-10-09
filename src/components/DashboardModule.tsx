import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  CreditCard,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  PackageCheck,
  Calendar,
  Layers,
  ArrowRight,
  Cpu,
  Plus,
  Settings,
  Cloud,
  RefreshCcw,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { db } from '../db/database';
import type { Transaction, TransactionItem, InventoryItem, ShopSettings } from '../types';

interface DashboardModuleProps {
  onGoToPOS: () => void;
  onGoToInventory: () => void;
  onGoToLedger: () => void;
  onGoToSync?: () => void;
  onGoToWorkspace?: () => void;
  onGoToForecast?: () => void;
  onOpenSettings?: () => void;
  onOpenArchitecture?: () => void;
  shopSettings?: ShopSettings;
}

const CATEGORY_COLORS: Record<string, string> = {
  'সার': '#047857', // Deep Emerald
  'কীটনাশক': '#b45309', // Amber Brown
  'ছত্রাকনাশক': '#0284c7', // Sky Blue
  'আগাছানাশক': '#c026d3', // Fuchsia
  'অণুখাদ্য': '#10b981', // Light Emerald
  'বীজ': '#eab308', // Yellow
  'অন্যান্য': '#64748b', // Slate
};

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  onGoToPOS,
  onGoToInventory,
  onGoToLedger,
  onGoToSync,
  onGoToWorkspace,
  onGoToForecast,
  onOpenSettings,
  onOpenArchitecture,
  shopSettings,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [prescriptionsCount, setPrescriptionsCount] = useState<number>(0);
  const [customersCount, setCustomersCount] = useState<number>(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load records from IndexedDB
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [txs, items, inv, rxCount, custCount, syncCount, recentTxs] = await Promise.all([
          db.transactions.toArray(),
          db.transactionItems.toArray(),
          db.inventory.toArray(),
          db.prescriptions.count(),
          db.customers.count(),
          db.syncQueue.where('status').equals('PENDING').count(),
          db.transactions.orderBy('createdAt').reverse().limit(5).toArray(),
        ]);

        setTransactions(txs);
        setTransactionItems(items);
        setInventory(inv);
        setPrescriptionsCount(rxCount);
        setCustomersCount(custCount);
        setPendingSyncCount(syncCount);
        setRecentTransactions(recentTxs);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();

    // Refresh sync count every 10 seconds for real-time feel
    const syncInterval = setInterval(async () => {
      const count = await db.syncQueue.where('status').equals('PENDING').count();
      setPendingSyncCount(count);
    }, 10000);

    return () => clearInterval(syncInterval);
  }, []);

  const handleExportMonthlyReport = async () => {
    setIsExporting(true);
    try {
      const now = new Date();
      const monthStr = now.toISOString().slice(0, 7); // YYYY-MM
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const firstDay = `${monthStr}-01T00:00:00.000Z`;
      const lastDay = `${monthStr}-${daysInMonth}T23:59:59.999Z`;

      // Fetch monthly transactions and cash events (expenses)
      const [monthlyTxs, monthlyEvents] = await Promise.all([
        db.transactions.where('createdAt').between(firstDay, lastDay).toArray(),
        db.cash_events.where('createdAt').between(firstDay, lastDay).toArray(),
      ]);

      const csvRows = [
        ['Monthly Summary Report', `Month: ${monthStr}`],
        [],
        ['--- SALES SUMMARY ---'],
        ['Invoice No', 'Date', 'Customer', 'Grand Total', 'Paid', 'Due', 'Method', 'Status'],
        ...monthlyTxs.map(t => [
          t.invoiceNo,
          new Date(t.createdAt).toLocaleDateString(),
          t.customerName,
          t.grandTotal,
          t.paidAmount,
          t.dueAmount,
          t.paymentMethod,
          t.status
        ]),
        [],
        ['--- EXPENSES & CASH EVENTS ---'],
        ['Event Type', 'Date', 'Amount', 'Method', 'Description', 'Performed By'],
        ...monthlyEvents.map(e => [
          e.eventType,
          new Date(e.createdAt).toLocaleDateString(),
          e.amount,
          e.paymentMethod,
          e.description,
          e.performedBy
        ]),
        [],
        ['Total Sales Amount', monthlyTxs.reduce((sum, t) => sum + (t.grandTotal || 0), 0)],
        ['Total Cash Collected (Sales)', monthlyTxs.reduce((sum, t) => sum + (t.paidAmount || 0), 0)],
        ['Total Expenses', monthlyEvents.filter(e => e.eventType === 'EXPENSE').reduce((sum, e) => sum + (e.amount || 0), 0)],
      ];

      const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Samad_Agro_Monthly_Report_${monthStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      alert('এক্সপোর্ট করতে সমস্যা হয়েছে।');
    } finally {
      setIsExporting(false);
    }
  };

  // Today's summary metrics
  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTxs = transactions.filter((t) => t.createdAt.startsWith(todayStr));

    const totalSales = todayTxs.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
    const paidCash = todayTxs.reduce((sum, t) => sum + (t.paidAmount || 0), 0);
    const dueAmount = todayTxs.reduce((sum, t) => sum + (t.dueAmount || 0), 0);
    const txCount = todayTxs.length;

    return {
      totalSales,
      paidCash,
      dueAmount,
      txCount,
      avgTicket: txCount > 0 ? Math.round(totalSales / txCount) : 0,
    };
  }, [transactions]);

  // Overall due summary
  const totalShopDue = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.dueAmount || 0), 0);
  }, [transactions]);

  // Low stock alert products
  const lowStockProducts = useMemo(() => {
    return inventory.filter((item) => item.stockQuantity <= item.minStockAlert);
  }, [inventory]);

  // Daily revenue trend data for Recharts AreaChart
  const revenueTrendData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : 30;
    const now = new Date();
    const result: Array<{
      date: string;
      label: string;
      totalSales: number;
      cashCollected: number;
      dueAmount: number;
      txCount: number;
    }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });

      const dayTxs = transactions.filter((t) => t.createdAt.startsWith(dateStr));
      const totalSales = dayTxs.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
      const cashCollected = dayTxs.reduce((sum, t) => sum + (t.paidAmount || 0), 0);
      const dueAmount = dayTxs.reduce((sum, t) => sum + (t.dueAmount || 0), 0);
      const txCount = dayTxs.length;

      result.push({
        date: dateStr,
        label,
        totalSales,
        cashCollected,
        dueAmount,
        txCount,
      });
    }

    return result;
  }, [transactions, timeRange]);

  // Top-selling products calculation from IndexedDB transactionItems
  const topSellingProducts = useMemo(() => {
    const productStats: Record<
      string,
      {
        id: string;
        name: string;
        banglaName: string;
        category: string;
        quantity: number;
        revenue: number;
        unit: string;
      }
    > = {};

    for (const item of transactionItems) {
      if (!productStats[item.productId]) {
        productStats[item.productId] = {
          id: item.productId,
          name: item.productName,
          banglaName: item.banglaName || item.productName,
          category: item.category,
          quantity: 0,
          revenue: 0,
          unit: item.unit,
        };
      }
      productStats[item.productId].quantity += item.quantity || 0;
      productStats[item.productId].revenue += item.total || 0;
    }

    // Sort descending by revenue, take top 6
    return Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((p) => ({
        ...p,
        shortName: p.banglaName.length > 14 ? p.banglaName.slice(0, 14) + '...' : p.banglaName,
      }));
  }, [transactionItems]);

  // Category revenue distribution for PieChart
  const categoryDistribution = useMemo(() => {
    const catMap: Record<string, number> = {};
    for (const item of transactionItems) {
      const cat = item.category || 'অন্যান্য';
      catMap[cat] = (catMap[cat] || 0) + (item.total || 0);
    }

    return Object.entries(catMap)
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || '#64748b',
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactionItems]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
      {/* Top Welcome & Actions Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-gray-200 dark:border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-emerald-950 dark:text-emerald-400 font-serif">
              {shopSettings?.shopName || 'মেসার্স আব্দুস সামাদ মোল্লাহ্'} — রিয়েল-টাইম ড্যাশবোর্ড
            </h2>
            <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              লাইভ অ্যানালিটিক্স
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
            IndexedDB লোকাল ডেটাবেজ ভিত্তিক বিক্রয়, রাজস্ব প্রবণতা ও পণ্য মজুত বিশ্লেষণ
          </p>
        </div>

        {/* Time Filter & Quick Sale Button */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                timeRange === '7d'
                  ? 'bg-white dark:bg-slate-700 text-emerald-950 dark:text-emerald-300 font-bold shadow-xs'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              বিগত ৭ দিন
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                timeRange === '30d'
                  ? 'bg-white dark:bg-slate-700 text-emerald-950 dark:text-emerald-300 font-bold shadow-xs'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              বিগত ৩০ দিন
            </button>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm cursor-pointer"
            title="সেটিংস"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportMonthlyReport}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
            title="মাসিক রিপোর্ট এক্সপোর্ট (CSV)"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'প্রসেসিং...' : 'মাসিক রিপোর্ট (CSV)'}
          </button>

          <button
            onClick={onGoToPOS}
            className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            নতুন বিক্রয় (F2)
          </button>

          <button
            onClick={onGoToWorkspace}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
          >
            <Cloud className="w-3.5 h-3.5" />
            Workspace (F9)
          </button>

          <button
            onClick={onGoToForecast}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            চাহিদা পূর্বাভাস (F10)
          </button>
        </div>
      </div>

      {/* Sync Status Visual Indicator */}
      {pendingSyncCount > 0 && (
        <div 
          onClick={onGoToSync}
          className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-100 transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <RefreshCcw className="w-5 h-5 text-amber-600 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-400">অফলাইন ডাটা সিঙ্ক হচ্ছে...</h4>
              <p className="text-xs text-amber-700 dark:text-amber-500/80">
                বর্তমানে <strong className="font-mono">{pendingSyncCount}</strong> টি তথ্য গুগল শিট-এ আপলোড হওয়ার অপেক্ষায় আছে।
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold text-xs bg-amber-200 dark:bg-amber-900/60 px-3 py-1 rounded-full">
            <Cloud className="w-4 h-4" />
            সিঙ্ক স্ট্যাটাস দেখুন
          </div>
        </div>
      )}

      {/* KPI Cards: Today's Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Sales */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white p-4 rounded-xl border border-emerald-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold uppercase">
            <span>আজকের মোট বিক্রয় (Today)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-amber-300">
            ৳ {todayStats.totalSales.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-emerald-200">
            <span>{todayStats.txCount} টি সফল বিক্রয়</span>
            <span className="font-mono text-[11px]">গড়: ৳{todayStats.avgTicket}</span>
          </div>
        </div>

        {/* Today's Cash Inflow */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>আজকের নগদ জমা (Cash)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-2 text-xl font-black font-mono text-emerald-900">
            ৳ {todayStats.paidCash.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            কাউন্টার নগদ ও ডিজিটাল পেমেন্ট
          </div>
        </div>

        {/* Today's Due Generated */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>আজকের বকেয়া (Today's Due)</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div className="mt-2 text-xl font-black font-mono text-rose-700">
            ৳ {todayStats.dueAmount.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            বাকি খাতা রেজিস্টারে যুক্ত হয়েছে
          </div>
        </div>

        {/* Total Customers & Prescriptions */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>নিবন্ধিত কৃষক ও প্রেসক্রিপশন</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-xl font-bold font-mono text-gray-900">
                {customersCount}
              </span>
              <span className="text-[11px] text-gray-500 ml-1">জন কৃষক</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono text-teal-800">
                {prescriptionsCount}
              </span>
              <span className="text-[11px] text-gray-500 ml-1">প্রেসক্রিপশন</span>
            </div>
          </div>
          <button
            onClick={onGoToLedger}
            className="text-[11px] text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 mt-1 cursor-pointer"
          >
            বাকি খাতা দেখুন <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Row 2: Revenue Trend Chart (AreaChart) (7 cols) & Category Distribution (PieChart) (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Revenue Trends Recharts AreaChart */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <div>
              <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                রাজস্ব ও বিক্রয় প্রবণতা (Revenue & Sales Trends)
              </h3>
              <p className="text-[11px] text-gray-500">
                মোট বিক্রয়, নগদ জমা এবং বকেয়া টাকার দৈনিক গ্রাফ
              </p>
            </div>
            <span className="text-xs font-mono text-gray-500 font-medium">BDT (৳)</span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#cbd5e1"
                  tickFormatter={(val) => `৳${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const formatted = `৳ ${(value || 0).toLocaleString()}`;
                    if (name === 'totalSales') return [formatted, 'মোট বিক্রয় (Total)'];
                    if (name === 'cashCollected') return [formatted, 'নগদ জমা (Cash)'];
                    if (name === 'dueAmount') return [formatted, 'বকেয়া (Due)'];
                    return [formatted, name];
                  }}
                  contentStyle={{
                    backgroundColor: '#064e3b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                  labelStyle={{ color: '#fde68a', fontWeight: 'bold' }}
                />
                <Legend
                  formatter={(val) => {
                    if (val === 'totalSales') return 'মোট বিক্রয়';
                    if (val === 'cashCollected') return 'নগদ জমা';
                    if (val === 'dueAmount') return 'বকেয়া';
                    return val;
                  }}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                <Bar dataKey="totalSales" fill="#047857" radius={[4, 4, 0, 0]} barSize={timeRange === '7d' ? 30 : 10} />
                <Bar dataKey="cashCollected" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={timeRange === '7d' ? 30 : 10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Category Distribution PieChart */}
        <div className="lg:col-span-4 bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col">
          <div className="border-b pb-3 mb-2">
            <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              ক্যাটাগরি ভিত্তিক বিক্রয় শেয়ার
            </h3>
            <p className="text-[11px] text-gray-500">সার, কীটনাশক ও বীজের আয়ের হার</p>
          </div>

          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`৳ ${(value || 0).toLocaleString()}`, 'বিক্রয়']}
                  contentStyle={{
                    backgroundColor: '#064e3b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                    border: 'none',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category Legends */}
          <div className="mt-2 space-y-1 overflow-y-auto max-h-32 text-xs">
            {categoryDistribution.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  <span className="text-gray-700">{cat.name}</span>
                </div>
                <span className="font-mono font-bold text-gray-900">৳ {cat.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Daily Transaction Volume Bar Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-gray-200 dark:border-slate-800 p-4">
        <div className="border-b pb-3 mb-4">
          <h3 className="font-bold text-xs text-emerald-950 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-700" />
            দৈনিক বিক্রয় সংখ্যা (Daily Transaction Volume)
          </h3>
          <p className="text-[11px] text-gray-500">প্রতিদিন কতগুলো মেমো বা রশিদ কাটা হয়েছে তার পরিসংখ্যান</p>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
              <Tooltip
                formatter={(value: any) => [value, 'বিক্রয় সংখ্যা']}
                contentStyle={{
                  backgroundColor: '#064e3b',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                  border: 'none',
                }}
              />
              <Bar dataKey="txCount" fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4: Top-Selling Inventory Items (BarChart) & Stock Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Top-Selling Products BarChart */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-xs border border-gray-200 p-4">
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <div>
              <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-700" />
                সর্বোচ্চ বিক্রিত পণ্যসমূহ (Top-Selling Inventory)
              </h3>
              <p className="text-[11px] text-gray-500">মোট বিক্রয়মূল্য ও পরিমাণের ভিত্তিতে র্যাংকিং</p>
            </div>
            <button
              onClick={onGoToInventory}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
            >
              ইনভেন্টরি <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topSellingProducts}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `৳${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  tick={{ fontSize: 11, fill: '#334155' }}
                  width={110}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    if (name === 'revenue') return [`৳ ${(value || 0).toLocaleString()}`, 'মোট আয়'];
                    return [value, name];
                  }}
                  contentStyle={{
                    backgroundColor: '#064e3b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Bar dataKey="revenue" fill="#047857" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Alerts & Inventory Health */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <h3 className="font-bold text-xs text-rose-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                কম মজুত সতর্কতা (Low Stock Alerts)
              </h3>
              <span className="font-mono text-xs bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                {lowStockProducts.length} টি আইটেম
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
              {lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-gray-900">{p.banglaName || p.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      কোড: {p.code} • র‍্যাক: {p.rackLocation}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-rose-700 text-xs">
                      {p.stockQuantity} {p.unit}
                    </span>
                    <span className="block text-[9px] text-gray-400">
                      সতর্কতা: {p.minStockAlert} {p.unit}
                    </span>
                  </div>
                </div>
              ))}

              {lowStockProducts.length === 0 && (
                <div className="text-center py-10 text-emerald-700 text-xs flex flex-col items-center">
                  <PackageCheck className="w-8 h-8 text-emerald-500 mb-1" />
                  <span>সকল পণ্যের মজুত পর্যাপ্ত রয়েছে!</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t flex justify-end">
            <button
              onClick={onGoToInventory}
              className="text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white px-3.5 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
            >
              স্টক ইন ও পণ্য ব্যবস্থাপনা →
            </button>
          </div>
        </div>
      </div>

      {/* Row 5: Recent Activities */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-gray-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <h3 className="font-bold text-xs text-emerald-950 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            সাম্প্রতিক কার্যক্রম (Recent Activities)
          </h3>
          <p className="text-[11px] text-gray-500">দোকানের সর্বশেষ ৫টি লেনদেনের সংক্ষিপ্ত তালিকা</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {recentTransactions.map((tx) => (
            <div 
              key={tx.id} 
              className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 transition hover:shadow-md cursor-default"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                  {tx.invoiceNo}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                {tx.customerName}
              </div>
              <div className="flex items-center justify-between mt-auto pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  ৳{tx.grandTotal.toLocaleString()}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  tx.dueAmount > 0 
                    ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' 
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {tx.dueAmount > 0 ? 'বাকি' : 'পরিশোধিত'}
                </span>
              </div>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-400 text-xs italic">
              আজ কোনো লেনদেন পাওয়া যায়নি
            </div>
          )}
        </div>
      </div>

      {/* System Architecture Showcase Banner Card */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">
                সিস্টেম আর্কিটেকচার ডায়াগ্রাম (System Architecture)
              </h3>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Offline-First • 15 Tables • Sync Engine • Sheets
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              মোবাইল ফ্রন্টএন্ড UI, লোকাল IndexedDB, ব্যাকগ্রাউন্ড সিঙ্ক ইঞ্জিন, গুগল শিটস ও এগ্রো-ইআরপি মডিউলের সমন্বিত চিত্র
            </p>
          </div>
        </div>

        {onOpenArchitecture && (
          <button
            onClick={onOpenArchitecture}
            className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer shadow-md shrink-0 border border-emerald-500/40"
          >
            <Layers className="w-4 h-4 text-emerald-200" />
            আর্কিটেকচার ডায়াগ্রাম দেখুন
          </button>
        )}
      </div>

      {/* Quick Sale Floating Action Button */}
      <button
        onClick={onGoToPOS}
        className="fixed bottom-8 right-8 w-14 h-14 bg-emerald-800 hover:bg-emerald-900 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50 group border-2 border-emerald-400/30 ring-4 ring-emerald-500/10"
        title="দ্রুত বিক্রয় (Quick Sale)"
      >
        <Plus className="w-7 h-7" />
        <span className="absolute right-full mr-4 px-3 py-1.5 bg-emerald-950 text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-bold shadow-xl border border-emerald-800">
          দ্রুত বিক্রয় (Quick Sale)
        </span>
      </button>
    </div>
  );
};
