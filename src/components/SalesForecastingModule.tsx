import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  BarChart2,
  Calendar,
  Package,
  Search,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  BrainCircuit,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { getProductForecast, getAllProductsDemand, type ForecastData } from '../services/forecastService';
import { db } from '../db/database';
import type { InventoryItem } from '../types';

export const SalesForecastingModule: React.FC = () => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [forecastDays, setForecastDays] = useState(14);
  const [historyDays, setHistoryDays] = useState(30);

  useEffect(() => {
    async function init() {
      const allProducts = await db.inventory.toArray();
      setProducts(allProducts);
      if (allProducts.length > 0) {
        setSelectedProductId(allProducts[0].id);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      loadForecast(selectedProductId);
    }
  }, [selectedProductId, forecastDays, historyDays]);

  const loadForecast = async (pid: string) => {
    setIsLoading(true);
    try {
      const data = await getProductForecast(pid, historyDays, forecastDays);
      setForecastData(data);
    } catch (err) {
      console.error('Forecast error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.banglaName && p.banglaName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <BrainCircuit className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                ভবিষ্যৎ চাহিদা পূর্বাভাস (Demand Forecasting)
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                মেশিন লার্নিং অ্যালগরিদম ব্যবহার করে পণ্যের সম্ভাব্য চাহিদা বিশ্লেষণ
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setForecastDays(7)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${forecastDays === 7 ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500'}`}
              >
                ৭ দিন
              </button>
              <button 
                onClick={() => setForecastDays(14)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${forecastDays === 14 ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500'}`}
              >
                ১৪ দিন
              </button>
              <button 
                onClick={() => setForecastDays(30)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${forecastDays === 30 ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500'}`}
              >
                ৩০ দিন
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Product Selection */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="পণ্য খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProductId(product.id)}
                  className={`w-full flex flex-col p-3 rounded-xl text-left transition-all ${
                    selectedProductId === product.id
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-900 dark:text-emerald-400'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400'
                  } border`}
                >
                  <span className="font-bold text-sm truncate">{product.banglaName || product.name}</span>
                  <span className="text-[10px] font-mono opacity-60">কোড: {product.code}</span>
                </button>
              ))}
              
              {filteredProducts.length === 0 && (
                <div className="p-10 text-center text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">কোনো পণ্য পাওয়া যায়নি</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content: Chart & Stats */}
        <div className="lg:col-span-3 space-y-6">
          {/* Main Chart Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  {selectedProduct?.banglaName || selectedProduct?.name} - চাহিদা গ্রাফ
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  বিগত ৩০ দিনের বিক্রয় বনাম আগামী {forecastDays} দিনের সম্ভাব্য চাহিদা
                </p>
              </div>
              
              {isLoading && <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />}
            </div>

            <div className="flex-1 min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    minTickGap={30}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <Tooltip 
                    labelFormatter={(label) => formatDate(label as string)}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Area 
                    type="monotone" 
                    dataKey="historicalDemand" 
                    name="অতীতের চাহিদা"
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorHistory)" 
                    strokeWidth={3}
                    dot={false}
                    connectNulls
                  />
                  <Area 
                    type="monotone" 
                    dataKey="predictedDemand" 
                    name="সম্ভাব্য চাহিদা (AI)"
                    stroke="#8b5cf6" 
                    fillOpacity={1} 
                    fill="url(#colorForecast)" 
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            {/* Info Box */}
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <strong>তথ্যসূত্র:</strong> এই পূর্বাভাসটি "Linear Regression" অ্যালগরিদম ব্যবহার করে তৈরি করা হয়েছে। 
                  এটি আপনার পূর্বের বিক্রয় তথ্যের ট্রেন্ড বিশ্লেষণ করে আগামী কয়েকদিনের সম্ভাব্য চাহিদার একটি ধারণা দেয়। 
                  মৌসুমী পরিবর্তন বা বিশেষ উৎসবের ক্ষেত্রে বাস্তবের সাথে পূর্বাভাসের সামান্য পার্থক্য হতে পারে।
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">বর্তমান স্টক</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {selectedProduct?.stockQuantity || 0} {selectedProduct?.unit}
                </span>
                <Package className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">সাপ্তাহিক গড় চাহিদা</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {(forecastData.filter(d => !d.isForecast).reduce((sum, d) => sum + d.historicalDemand, 0) / (historyDays / 7)).toFixed(1)} {selectedProduct?.unit}
                </span>
                <BarChart2 className="w-5 h-5 text-blue-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">স্টক আউট পূর্বাভাস</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {selectedProduct && selectedProduct.stockQuantity > 0 ? 'সুরক্ষিত' : 'রি-অর্ডার করুন'}
                </span>
                <ArrowUpRight className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
