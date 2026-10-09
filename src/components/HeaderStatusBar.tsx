import React from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  CloudCheck,
  Clock,
  AlertTriangle,
  RefreshCw,
  Download,
  HardDrive,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Printer,
  Cpu,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { PrintSettings, ShopSettings } from '../types';

interface HeaderStatusBarProps {
  isOnline: boolean;
  localDbOk: boolean;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSyncTime: string | null;
  lastBackupTime: string | null;
  user: User | null;
  isSyncing: boolean;
  onSyncNow: () => void;
  onBackupNow: () => void;
  onDriveBackup?: () => void;
  onOpenAutoTest?: () => void;
  onOpenArchitecture?: () => void;
  printSettings?: PrintSettings;
  onOpenPrintSettings?: () => void;
  onOpenPrintHistory?: () => void;
  shopSettings?: ShopSettings;
  onOpenSettings?: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const HeaderStatusBar: React.FC<HeaderStatusBarProps> = ({
  isOnline,
  localDbOk,
  pendingCount,
  syncedCount,
  failedCount,
  lastSyncTime,
  lastBackupTime,
  user,
  isSyncing,
  onSyncNow,
  onBackupNow,
  onDriveBackup,
  onOpenAutoTest,
  onOpenArchitecture,
  printSettings,
  onOpenPrintSettings,
  onOpenPrintHistory,
  shopSettings,
  onOpenSettings,
  onSignIn,
  onSignOut,
  activeTab,
  onTabChange,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const formatTimeAgo = (isoString: string | null) => {
    if (!isoString) return 'কখনও না';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('bn-BD', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <header className="bg-emerald-950 text-white border-b border-emerald-800 shadow-md">
      {/* Top Persistent Technical Status Bar */}
      <div className="bg-emerald-900/90 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/80">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Online/Offline status */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
              isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/25 text-red-300 animate-pulse'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>

          {/* Local DB status */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
              localDbOk ? 'bg-teal-500/20 text-teal-300' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            {localDbOk ? 'LOCAL DB OK' : 'REPAIRING'}
          </span>

          {/* Sync status counters */}
          <div className="hidden sm:flex items-center gap-2 border-l border-emerald-700/60 pl-2.5">
            <span className="text-emerald-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              SYNCED: <strong>{syncedCount}</strong>
            </span>
            <span
              className={`flex items-center gap-1 ${
                pendingCount > 0 ? 'text-amber-300 font-semibold' : 'text-gray-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              PENDING: <strong>{pendingCount}</strong>
            </span>
            {failedCount > 0 && (
              <span className="text-rose-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                FAILED: <strong>{failedCount}</strong>
              </span>
            )}
          </div>

          {/* Live 'সর্বশেষ ব্যাকআপ' Timestamp & Visual Badge */}
          {lastBackupTime && (
            <span className="hidden xl:inline-flex items-center gap-1 bg-emerald-800/80 text-emerald-200 px-2 py-0.5 rounded font-mono text-[11px] border border-emerald-700">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ✓ সুরক্ষিত (SUCCESS): {formatTimeAgo(lastBackupTime)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 12 Automated Acceptance Tests Button */}
          <button
            onClick={onOpenAutoTest}
            className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-emerald-950 font-bold px-2.5 py-1 rounded text-xs transition cursor-pointer shadow-xs"
            title="১২টি স্বয়ংক্রিয় গ্রহণযোগ্যতা টেস্ট চালান"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-950" />
            <span>অটো টেস্ট (12 Tests)</span>
          </button>

          {/* 1-Click Drive Backup Quick Button */}
          <button
            onClick={onDriveBackup}
            disabled={!isOnline}
            className="inline-flex items-center gap-1 bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white font-bold px-2.5 py-1 rounded text-xs transition cursor-pointer shadow-xs"
            title="Google Drive এ কমপ্রেসড GZIP ব্যাকআপ আপলোড"
          >
            <HardDrive className="w-3 h-3 text-teal-200" />
            <span>ড্রাইভ ব্যাকআপ</span>
          </button>

          {/* Thermal Print Settings Button */}
          {onOpenPrintSettings && (
            <button
              onClick={onOpenPrintSettings}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer shadow-xs ${
                printSettings?.autoPrintOnSale
                  ? 'bg-emerald-700 hover:bg-emerald-600 text-amber-200 border border-emerald-500/50'
                  : 'bg-emerald-900 hover:bg-emerald-800 text-emerald-300 border border-emerald-800'
              }`}
              title="থার্মাল প্রিন্ট ও অটো-প্রিন্ট কনফিগারেশন"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">প্রিন্ট</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  printSettings?.autoPrintOnSale ? 'bg-amber-400' : 'bg-gray-400'
                }`}
                title={printSettings?.autoPrintOnSale ? 'অটো-প্রিন্ট চালু' : 'অটো-প্রিন্ট বন্ধ'}
              />
            </button>
          )}

          {/* Print History Button */}
          {onOpenPrintHistory && (
            <button
              onClick={onOpenPrintHistory}
              className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 text-amber-200 font-bold px-2.5 py-1 rounded text-xs transition cursor-pointer shadow-xs border border-emerald-700"
              title="সর্বশেষ প্রিন্টকৃত ৫টি রশিদের ইতিহাস দেখুন (Print History)"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">প্রিন্ট হিস্ট্রি</span>
            </button>
          )}

          {/* System Architecture Diagram Button */}
          {onOpenArchitecture && (
            <button
              onClick={onOpenArchitecture}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-2.5 py-1 rounded text-xs transition cursor-pointer shadow-xs border border-slate-600"
              title="সিস্টেম আর্কিটেকচার ডায়াগ্রাম দেখুন"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">আর্কিটেকচার</span>
            </button>
          )}

          {/* Sync Now */}
          <button
            onClick={onSyncNow}
            disabled={isSyncing || !isOnline}
            className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shadow-xs"
            title="Google Sheets এ সিঙ্ক করুন"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Now</span>
          </button>

          {/* JSON Backup Download */}
          <button
            onClick={onBackupNow}
            className="inline-flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shadow-xs"
            title="সম্পূর্ণ ব্যাকআপ ফাইল ডাউনলোড করুন"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Backup</span>
          </button>

          {/* Theme Toggle Button */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 font-bold px-2.5 py-1 rounded text-xs transition cursor-pointer shadow-xs border border-emerald-700"
              title={isDarkMode ? 'লাইট মোড অন করুন' : 'নাইট মোড অন করুন'}
            >
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sun text-amber-400"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-moon text-emerald-300"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              )}
              <span className="hidden xl:inline">{isDarkMode ? 'লাইট মোড' : 'নাইট মোড'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Brand & Navigation Header */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Store Title */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-xl shadow-inner text-amber-200 border border-emerald-400/40 shrink-0">
            {shopSettings?.shopNameShort || 'সামাদ'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white font-serif">
                {shopSettings?.shopName || 'মেসার্স আব্দুস সামাদ মোল্লাহ্'}
              </h1>
              <span className="bg-amber-400/20 text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded border border-amber-400/30">
                {shopSettings?.slogan || 'BCIC ও BADC ডিলার'}
              </span>
            </div>
            <p className="text-xs text-emerald-300 font-medium">
              {shopSettings?.address || 'গোবিন্দপুর বাজার, ভূঞাপুর, টাঙ্গাইল • স্মার্ট অফলাইন এগ্রো-পস ও কৃষি প্রেসক্রিপশন'}
            </p>
          </div>
        </div>

        {/* User Auth & Actions */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 text-emerald-200 hover:text-white bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700/50 rounded-lg transition shadow-sm group"
              title="দোকানের সেটিংস কনফিগার করুন"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings group-hover:rotate-90 transition-transform duration-300"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          )}
          {user ? (
            <div className="flex items-center gap-2 bg-emerald-900/70 border border-emerald-600/60 rounded-lg p-1.5 pl-3 shadow-xs">
              <button
                type="button"
                onClick={onSignIn}
                className="flex items-center gap-2 text-left cursor-pointer group"
                title="স্থায়ী লগইন আইডি ও গুগল সিঙ্ক সেটিংস দেখুন"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full border border-emerald-400"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-[11px]">
                    ID
                  </div>
                )}
                <div className="text-left">
                  <div className="text-xs font-bold text-white max-w-[170px] truncate group-hover:text-amber-300 transition">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-[10px] text-emerald-300 flex items-center gap-1 font-medium">
                    <ShieldCheck className="w-3 h-3 text-amber-400" /> স্থায়ী আইডি সক্রিয় (Permanent ID)
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="text-xs text-emerald-200 hover:text-white bg-emerald-800/80 hover:bg-rose-700 p-1.5 rounded transition cursor-pointer"
                title="লগআউট"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-emerald-950 font-black text-xs px-3.5 py-2 rounded-lg shadow-md transition border border-amber-500 cursor-pointer active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-950" />
              <span>স্থায়ী আইডি লগইন (Permanent ID Login)</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav className="bg-emerald-900 border-t border-emerald-800/80 px-4">
        <div className="max-w-7xl mx-auto flex items-center overflow-x-auto gap-1 py-1 no-scrollbar">
          {[
            { id: 'dashboard', label: 'ড্যাশবোর্ড (Dashboard)', shortcut: 'F1' },
            { id: 'pos', label: 'বিক্রয় কাউন্টার (POS)', shortcut: 'F2' },
            { id: 'prescriptions', label: '১-বিঘা প্রেসক্রিপশন (Rx)', shortcut: 'F4' },
            { id: 'customers', label: 'গ্রাহক ও বাকি খাতা (Ledger)', shortcut: 'F3' },
            { id: 'inventory', label: 'মজুত ও পণ্য (Inventory)', shortcut: 'F5' },
            { id: 'drawer', label: 'ক্যাশ ড্রয়ার (Cash Drawer)', shortcut: 'F7' },
            { id: 'workspace', label: 'গুগল ওয়ার্কস্পেস (Docs/Forms)', shortcut: 'F9' },
            { id: 'forecast', label: 'চাহিদা পূর্বাভাস (Forecast)', shortcut: 'F10' },
            { id: 'sync', label: 'শিট ও ড্রাইভ ব্যাকআপ সেন্টার', shortcut: 'F8' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-md text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-950 text-amber-300 border-t-2 border-amber-400 font-semibold shadow-xs'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-800/60'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono hidden md:inline ${
                    isActive ? 'bg-amber-400/20 text-amber-200' : 'bg-emerald-800 text-emerald-300'
                  }`}
                >
                  {tab.shortcut}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
