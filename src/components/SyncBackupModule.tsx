import React, { useState, useEffect } from 'react';
import {
  Cloud,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Database,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { db } from '../db/database';
import type { SyncQueueItem, ConflictLog } from '../types';
import {
  processSyncQueue,
  exportTodayToSheets,
  exportCustomersToSheets,
  exportTransactionsToSheets,
  uploadBackupToGoogleDrive,
  SHEET_TABS,
} from '../services/sheetsSync';
import {
  generateBackupPayload,
  downloadBackupFile,
  restoreDatabase,
  exportTransactionsToCSV,
  exportInventoryToCSV,
  exportTransactionsAndInventoryCSV,
  type DatabaseBackupPayload,
} from '../services/backupService';
import { getAccessToken, googleSignIn } from '../services/authService';

interface SyncBackupModuleProps {
  isOnline: boolean;
  onRefreshStatus: () => void;
}

export const SyncBackupModule: React.FC<SyncBackupModuleProps> = ({
  isOnline,
  onRefreshStatus,
}) => {
  // Sync queue states
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [conflictLogs, setConflictLogs] = useState<ConflictLog[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);

  // Loading states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isDriveUploading, setIsDriveUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Date range export states
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Restore confirmation modal
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestorePayload, setPendingRestorePayload] =
    useState<DatabaseBackupPayload | null>(null);

  const loadData = async () => {
    const queue = await db.syncQueue.orderBy('createdAt').reverse().limit(30).toArray();
    setQueueItems(queue);

    const conflicts = await db.conflictLogs.orderBy('createdAt').reverse().limit(20).toArray();
    setConflictLogs(conflicts);

    const setting = await db.settings.where('key').equals('GOOGLE_SHEETS_SPREADSHEET_ID').first();
    setSpreadsheetId(setting?.value || null);
  };

  useEffect(() => {
    loadData();
  }, []);

  // [Sync Now] handler
  const handleSyncNow = async () => {
    if (!isOnline) {
      setStatusMessage({ type: 'error', text: 'আপনি বর্তমানে অফলাইনে আছেন। ইন্টারনেট সংযোগ পরীক্ষা করুন।' });
      return;
    }

    setIsSyncing(true);
    setStatusMessage(null);
    try {
      let result;
      try {
        result = await processSyncQueue();
      } catch (err: any) {
        if (err.message === 'AUTH_REQUIRED') {
          const signin = await googleSignIn();
          if (signin) {
            result = await processSyncQueue();
          } else {
            setIsSyncing(false);
            return;
          }
        } else {
          throw err;
        }
      }

      await loadData();
      onRefreshStatus();
      setStatusMessage({
        type: 'success',
        text: `সিঙ্ক সম্পন্ন! সফল: ${result.synced} টি রেকর্ড, ব্যর্থ: ${result.failed} টি।`,
      });
    } catch (err: any) {
      const msg = err.code === 'auth/popup-closed-by-user' 
        ? 'সাইন ইন বাতিল করা হয়েছে।' 
        : (err.message || 'সিঙ্ক করতে ব্যর্থ হয়েছে।');
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  // [Export Today]
  const handleExportToday = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const count = await exportTodayToSheets();
      await loadData();
      onRefreshStatus();
      setStatusMessage({
        type: 'success',
        text: `আজকের ${count} টি বিক্রয় সফলভাবে Google Sheets এ আপলোড হয়েছে।`,
      });
    } catch (err: any) {
      const msg = err.code === 'auth/popup-closed-by-user' 
        ? 'সাইন ইন বাতিল করা হয়েছে।' 
        : (err.message || 'আজকের তথ্য এক্সপোর্ট ব্যর্থ।');
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  // [Export Customers]
  const handleExportCustomers = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const count = await exportCustomersToSheets();
      await loadData();
      onRefreshStatus();
      setStatusMessage({
        type: 'success',
        text: `মোট ${count} জন কৃষকের তালিকা Google Sheets এ আপলোড হয়েছে।`,
      });
    } catch (err: any) {
      const msg = err.code === 'auth/popup-closed-by-user' 
        ? 'সাইন ইন বাতিল করা হয়েছে।' 
        : (err.message || 'গ্রাহক তথ্য এক্সপোর্ট ব্যর্থ।');
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  // [Export Transactions Date Range]
  const handleExportDateRange = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const count = await exportTransactionsToSheets(startDate, endDate);
      await loadData();
      onRefreshStatus();
      setStatusMessage({
        type: 'success',
        text: `${startDate} থেকে ${endDate} পর্যন্ত মোট ${count} টি লেনদেন Google Sheets এ আপলোড হয়েছে।`,
      });
    } catch (err: any) {
      const msg = err.code === 'auth/popup-closed-by-user' 
        ? 'সাইন ইন বাতিল করা হয়েছে।' 
        : (err.message || 'লেনদেন তথ্য এক্সপোর্ট ব্যর্থ।');
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  // [Backup Now] - Download Local JSON
  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      await downloadBackupFile();
      onRefreshStatus();
      setStatusMessage({
        type: 'success',
        text: 'সম্পূর্ণ লোকাল ডাটাবেজ ব্যাকআপ সফলভাবে ডাউনলোড হয়েছে!',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'ব্যাকআপ তৈরি ব্যর্থ।' });
    } finally {
      setIsBackingUp(false);
    }
  };

  // [CSV Export] - Export Combined Transactions & Inventory CSV
  const handleExportCombinedCSV = async () => {
    setIsExportingCsv(true);
    setStatusMessage(null);
    try {
      const { txCount, invCount } = await exportTransactionsAndInventoryCSV();
      setStatusMessage({
        type: 'success',
        text: `সফলভাবে ${txCount} টি লেনদেন এবং ${invCount} টি ইনভেন্টরি পণ্যের CSV ফাইল ডাউনলোড হয়েছে!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'CSV এক্সপোর্ট ব্যর্থ হয়েছে।' });
    } finally {
      setIsExportingCsv(false);
    }
  };

  // [CSV Export] - Export Transactions Only CSV
  const handleExportTransactionsCSV = async () => {
    setIsExportingCsv(true);
    setStatusMessage(null);
    try {
      const count = await exportTransactionsToCSV();
      setStatusMessage({
        type: 'success',
        text: `সফলভাবে মোট ${count} টি লেনদেনের CSV ফাইল ডাউনলোড হয়েছে!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'লেনদেন CSV এক্সপোর্ট ব্যর্থ হয়েছে।' });
    } finally {
      setIsExportingCsv(false);
    }
  };

  // [CSV Export] - Export Inventory Only CSV
  const handleExportInventoryCSV = async () => {
    setIsExportingCsv(true);
    setStatusMessage(null);
    try {
      const count = await exportInventoryToCSV();
      setStatusMessage({
        type: 'success',
        text: `সফলভাবে মোট ${count} টি ইনভেন্টরি পণ্যের CSV ফাইল ডাউনলোড হয়েছে!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'ইনভেন্টরি CSV এক্সপোর্ট ব্যর্থ হয়েছে।' });
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Upload Backup to Google Drive
  const handleDriveBackup = async () => {
    if (!isOnline) {
      setStatusMessage({ type: 'error', text: 'ড্রাইভে ব্যাকআপের জন্য ইন্টারনেট সংযোগ প্রয়োজন।' });
      return;
    }

    setIsDriveUploading(true);
    try {
      let result;
      try {
        result = await uploadBackupToGoogleDrive();
      } catch (err: any) {
        if (err.message === 'AUTH_REQUIRED') {
          const signin = await googleSignIn();
          if (signin) {
            result = await uploadBackupToGoogleDrive();
          } else {
            setIsDriveUploading(false);
            return;
          }
        } else {
          throw err;
        }
      }
      
      onRefreshStatus();
      setStatusMessage({
        type: 'success',
        text: `গুগল ড্রাইভে ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে! (File ID: ${result.fileId})`,
      });
    } catch (err: any) {
      const msg = err.code === 'auth/popup-closed-by-user' 
        ? 'সাইন ইন বাতিল করা হয়েছে।' 
        : (err.message || 'গুগল ড্রাইভ ব্যাকআপ ব্যর্থ।');
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsDriveUploading(false);
    }
  };

  // File Upload for Restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setPendingRestorePayload(json);
        setShowRestoreConfirm(true);
      } catch {
        setStatusMessage({ type: 'error', text: 'অবৈধ ব্যাকআপ ফাইল ফরম্যাট।' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Execute restore after user confirmation
  const handleExecuteRestore = async () => {
    if (!pendingRestorePayload) return;
    try {
      const { restoredCount, conflictCount } = await restoreDatabase(pendingRestorePayload);
      await loadData();
      onRefreshStatus();
      setShowRestoreConfirm(false);
      setPendingRestorePayload(null);
      setStatusMessage({
        type: 'success',
        text: `ডাটাবেজ পুনরুদ্ধার সম্পন্ন! ${restoredCount} টি রেকর্ড আপডেট হয়েছে (${conflictCount} টি দ্বন্দ্ব সংরক্ষিত)।`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'ডাটাবেজ রিস্টোর ব্যর্থ।' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-base text-emerald-950 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-emerald-700" />
            ক্লাউড সিঙ্ক ও দ্বন্দ্ব-মুক্ত ডাটাবেজ ব্যাকআপ (Google Sheets & Drive)
          </h2>
          <p className="text-xs text-gray-600">
            গুগল শিটস ক্লাউড রিপোর্টিং, অফলাইন কিউই, আইডিমপোটেন্ট আপসার্ট ও সেফ রিস্টোর
          </p>
        </div>

        {spreadsheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer self-start sm:self-auto"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Google Sheets ফাইল খুলুন <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        )}
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Grid: Google Sheets Actions (Left) & Backup Recovery (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Google Sheets Sync & On-Demand Exports */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-xs border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              গুগল শিটস সিঙ্ক ও এক্সপোর্ট কন্ট্রোল
            </h3>
            <span className="text-[10px] text-gray-500">৯টি শিট ট্যাব সমন্বিত</span>
          </div>

          {/* Quick Sync Action */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-xs text-emerald-950">
                অপেক্ষমাণ সিঙ্ক কিউই (Pending Sync Queue)
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5">
                অফলাইনে সম্পন্ন সকল বিক্রয় ও পরিবর্তনগুলো গুগল শিটসে আপসার্ট করুন
              </div>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={isSyncing || !isOnline}
              className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'সিঙ্ক হচ্ছে...' : 'Sync Now (এখনই সিঙ্ক)'}
            </button>
          </div>

          {/* Required On-Demand Export Buttons */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-gray-800 block">
              অন-ডিমান্ড এক্সপোর্ট বাটনসমূহ:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleExportToday}
                disabled={isSyncing || !isOnline}
                className="p-3 border border-gray-200 hover:border-emerald-500 rounded-lg text-left transition flex items-center justify-between group hover:bg-emerald-50/30 cursor-pointer"
              >
                <div>
                  <div className="font-bold text-xs text-gray-900 group-hover:text-emerald-950">
                    [Export Today]
                  </div>
                  <div className="text-[10px] text-gray-500">আজকের সকল বিক্রি শিটসে পাঠান</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700" />
              </button>

              <button
                onClick={handleExportCustomers}
                disabled={isSyncing || !isOnline}
                className="p-3 border border-gray-200 hover:border-emerald-500 rounded-lg text-left transition flex items-center justify-between group hover:bg-emerald-50/30 cursor-pointer"
              >
                <div>
                  <div className="font-bold text-xs text-gray-900 group-hover:text-emerald-950">
                    [Export Customers]
                  </div>
                  <div className="text-[10px] text-gray-500">গ্রাহক তালিকা শিটসে আপডেট করুন</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700" />
              </button>
            </div>

            {/* Date Range Export */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/40">
              <div className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                [Export Date Range] তারিখ ভিত্তিক লেনদেন এক্সপোর্ট:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">শুরুর তারিখ</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded p-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">শেষ তারিখ</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded p-1 text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleExportDateRange}
                    disabled={isSyncing || !isOnline}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold py-1.5 rounded text-xs transition cursor-pointer shadow-2xs"
                  >
                    এক্সপোর্ট করুন
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Separate Tabs List */}
          <div>
            <span className="text-xs font-bold text-gray-700 block mb-1">
              গুগল শিটসের সংযুক্ত ট্যাবসমূহ (9 Tabs):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SHEET_TABS.map((tab) => (
                <span
                  key={tab}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-100 text-emerald-900 border border-emerald-200"
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Conflict-Safe Backup & Recovery (Right) */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-xs border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              ব্যাকআপ ও ডেটা পুনরুদ্ধার
            </h3>
            <span className="text-[10px] text-emerald-700 font-semibold">100% সুরক্ষিত</span>
          </div>

          {/* Backup Now */}
          <div className="border border-teal-200 bg-teal-50/50 rounded-lg p-3 space-y-2">
            <div className="font-bold text-xs text-teal-950">
              [Backup Now] লোকাল ডাটাবেজ ব্যাকআপ ডাউনলোড
            </div>
            <p className="text-[11px] text-gray-600">
              সকল গ্রাহক, প্রেসক্রিপশন, ইনভেন্টরি, ক্যাশ ড্রয়ার ও বিক্রয় রেকর্ডের সম্পূর্ণ সুরক্ষিত JSON কপি
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleDownloadBackup}
                disabled={isBackingUp}
                className="inline-flex items-center gap-1.5 bg-teal-800 hover:bg-teal-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                {isBackingUp ? 'ডাউনলোড হচ্ছে...' : 'লোকাল ফাইল ব্যাকআপ (.JSON)'}
              </button>

              <button
                onClick={handleDriveBackup}
                disabled={isDriveUploading || !isOnline}
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
              >
                <HardDrive className="w-3.5 h-3.5" />
                {isDriveUploading ? 'সংরক্ষিত হচ্ছে...' : 'Google Drive এ ব্যাকআপ'}
              </button>
            </div>
          </div>

          {/* CSV Data Export for External Analysis */}
          <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                [Export CSV] এক্সটার্নাল বিশ্লেষণের জন্য CSV ডাউনলোড
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                Excel / CSV
              </span>
            </div>
            <p className="text-[11px] text-gray-600">
              বর্তমান লেনদেন (Transactions) এবং মজুত পণ্যের (Inventory) তথ্য সরাসরি Excel বা স্প্রেডশিটে বিশ্লেষণের জন্য CSV ফরম্যাটে ডাউনলোড করুন।
            </p>
            <div className="space-y-2 pt-0.5">
              <button
                onClick={handleExportCombinedCSV}
                disabled={isExportingCsv}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold px-3 py-2 rounded-lg text-xs transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                {isExportingCsv
                  ? 'CSV তৈরি হচ্ছে...'
                  : 'লেনদেন ও ইনভেন্টরি একত্রে ডাউনলোড (.CSV)'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportTransactionsCSV}
                  disabled={isExportingCsv}
                  className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition cursor-pointer"
                >
                  <Download className="w-3 h-3 text-emerald-700" />
                  শুধু লেনদেন (.CSV)
                </button>
                <button
                  onClick={handleExportInventoryCSV}
                  disabled={isExportingCsv}
                  className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition cursor-pointer"
                >
                  <Download className="w-3 h-3 text-emerald-700" />
                  শুধু ইনভেন্টরি (.CSV)
                </button>
              </div>
            </div>
          </div>

          {/* Restore Database */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-gray-700" />
              ব্যাকআপ ফাইল থেকে পুনরুদ্ধার (Restore)
            </div>
            <p className="text-[11px] text-gray-600">
              পূর্বে সংরক্ষিত ব্যাকআপ ফাইল নির্বাচন করুন। সিস্টেম অটোমেটিক ভার্সন চেক করে ডেটা রিস্টোর করবে।
            </p>

            <label className="inline-block cursor-pointer">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 rounded-lg text-xs font-bold transition">
                <Upload className="w-3.5 h-3.5" /> ফাইল আপলোড করুন
              </span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* Conflict Logs */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                দ্বন্দ্ব লগ ইতিহাস (Conflict Log):
              </span>
              <span className="text-[10px] text-gray-400 font-mono">{conflictLogs.length} টি</span>
            </div>

            <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 text-[11px]">
              {conflictLogs.map((log) => (
                <div key={log.id} className="py-1.5">
                  <div className="font-medium text-gray-800">
                    টেবিল: <strong>{log.tableName}</strong> • রেকর্ড: {log.recordId.slice(0, 8)}...
                  </div>
                  <div className="text-[10px] text-gray-500">
                    লোকাল ভার্সন v{log.localVersion} vs রিমোট v{log.remoteVersion} • সংরক্ষিত
                  </div>
                </div>
              ))}

              {conflictLogs.length === 0 && (
                <div className="text-gray-400 text-center py-4 text-xs">
                  কোনো দ্বন্দ্ব পাওয়া যায়নি। ডেটা সম্পূর্ণ সংগতিপূর্ণ।
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sync Queue Monitor Table */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
        <div className="flex items-center justify-between border-b pb-3 mb-3">
          <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wider">
            রিয়েল-টাইম সিঙ্ক কিউই ট্র্যাকার (Sync Queue Activity)
          </h3>
          <span className="text-xs text-gray-500">সাম্প্রতিক ৩০ টি অ্যাক্টিভিটি</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-emerald-50 text-emerald-950 font-bold border-y border-emerald-200">
                <th className="py-2 px-3">সময়</th>
                <th className="py-2 px-3">টেবিল</th>
                <th className="py-2 px-3">অপারেশন</th>
                <th className="py-2 px-3">স্ট্যাটাস</th>
                <th className="py-2 px-3">চেষ্টা</th>
                <th className="py-2 px-3">রেকর্ড আইডি</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queueItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="py-2 px-3 font-mono text-gray-500">
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3 font-medium text-gray-800">{item.tableName}</td>
                  <td className="py-2 px-3 text-gray-600">{item.operation}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === 'SYNCED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-gray-500">{item.attempts}</td>
                  <td className="py-2 px-3 font-mono text-gray-400 text-[10px]">
                    {item.recordId}
                  </td>
                </tr>
              ))}

              {queueItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    সিঙ্ক কিউই খালি। কোনো মুলতবি কাজ নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory User Confirmation Modal for Restore */}
      {showRestoreConfirm && pendingRestorePayload && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="bg-rose-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                সতর্কতা: ডাটাবেজ পুনরুদ্ধার নিশ্চিতকরণ
              </h3>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-gray-800 font-medium">
                আপনি কি নিশ্চিতভাবে নির্বাচিত ব্যাকআপ ফাইল থেকে ডাটাবেজ পুনরুদ্ধার করতে চান?
              </p>
              <div className="bg-gray-50 p-3 rounded border text-[11px] space-y-1">
                <div>
                  অ্যাপ: <strong>{pendingRestorePayload.app}</strong>
                </div>
                <div>
                  ব্যাকআপ তারিখ: <strong>{pendingRestorePayload.exportedAt}</strong>
                </div>
                <div>
                  মোট লেনদেন: <strong>{pendingRestorePayload.data?.transactions?.length || 0} টি</strong>
                </div>
                <div>
                  মোট গ্রাহক: <strong>{pendingRestorePayload.data?.customers?.length || 0} জন</strong>
                </div>
              </div>

              <p className="text-amber-800 text-[11px]">
                * নতুন পরিবর্তন হারানো রোধে সিস্টেম স্বয়ংক্রিয়ভাবে নতুন লোকাল ডেটা সংরক্ষণ করবে এবং কোনো দ্বন্দ্ব তৈরি হলে তা ConflictLog-এ রাখবে।
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowRestoreConfirm(false);
                    setPendingRestorePayload(null);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  বাতিল করুন
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  className="px-4 py-1.5 bg-rose-800 hover:bg-rose-900 text-white font-bold rounded shadow-xs"
                >
                  হ্যাঁ, পুনরুদ্ধার করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
