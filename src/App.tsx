import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { db, seedInitialDataIfNeeded } from './db/database';
import { initAuth, googleSignIn, logout } from './services/authService';
import { processSyncQueue, uploadBackupToGoogleDrive } from './services/sheetsSync';
import { downloadBackupFile, checkAndRunDailyBackup } from './services/backupService';
import { HeaderStatusBar } from './components/HeaderStatusBar';
import { AcceptanceSuiteModal } from './components/AcceptanceSuiteModal';
import { DashboardModule } from './components/DashboardModule';
import { POSModule } from './components/POSModule';
import { PrescriptionModule } from './components/PrescriptionModule';
import { CustomerLedgerModule } from './components/CustomerLedgerModule';
import { InventoryModule } from './components/InventoryModule';
import { CashDrawerModule } from './components/CashDrawerModule';
import { SyncBackupModule } from './components/SyncBackupModule';
import { WorkspaceModule } from './components/WorkspaceModule';
import { SalesForecastingModule } from './components/SalesForecastingModule';
import { PrintSettingsModal } from './components/PrintSettingsModal';
import { PrintHistoryModal } from './components/PrintHistoryModal';
import { PermanentLoginModal } from './components/PermanentLoginModal';
import { SettingsModal } from './components/SettingsModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import { ArrowLeft, CheckCircle, X, Loader2, Clock, ShieldCheck } from 'lucide-react';
import type { CartItem, Customer, PrintSettings, ShopSettings } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [localDbOk, setLocalDbOk] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  // Status bar counters
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncedCount, setSyncedCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Cross-module state: items transferred from Prescription to POS
  const [prescribedCartItems, setPrescribedCartItems] = useState<CartItem[]>([]);
  const [prescribedCustomer, setPrescribedCustomer] = useState<Customer | undefined>(undefined);
  const [showAutoTestModal, setShowAutoTestModal] = useState<boolean>(false);
  const [showPrintSettingsModal, setShowPrintSettingsModal] = useState<boolean>(false);
  const [showPrintHistoryModal, setShowPrintHistoryModal] = useState<boolean>(false);
  const [showPermanentLoginModal, setShowPermanentLoginModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Print Settings Configuration (persisted in localStorage)
  const [printSettings, setPrintSettings] = useState<PrintSettings>(() => {
    try {
      const saved = localStorage.getItem('SAMAD_AGRO_PRINT_SETTINGS');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      autoPrintOnSale: true,
      paperSize: '80mm',
      printCopies: 1,
      compactView: false,
    };
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('SAMAD_AGRO_DARK_MODE') === 'true';
  });

  const [shopSettings, setShopSettings] = useState<ShopSettings>(() => {
    try {
      const saved = localStorage.getItem('SAMAD_AGRO_SHOP_SETTINGS');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      shopName: 'মেসার্স আব্দুস সামাদ মোল্লাহ্',
      shopNameShort: 'সামাদ',
      ownerName: 'আব্দুস সামাদ মোল্লাহ্',
      managerName: 'ম্যানেজার',
      slogan: 'BCIC ও BADC ডিলার',
      address: 'গোবিন্দপুর বাজার, ভূঞাপুর, টাঙ্গাইল • স্মার্ট অফলাইন এগ্রো-পস ও কৃষি প্রেসক্রিপশন',
    };
  });

  const handleUpdateShopSettings = (newSettings: ShopSettings) => {
    setShopSettings(newSettings);
    try {
      localStorage.setItem('SAMAD_AGRO_SHOP_SETTINGS', JSON.stringify(newSettings));
      showToast('দোকানের সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch {}
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newVal = !prev;
      localStorage.setItem('SAMAD_AGRO_DARK_MODE', String(newVal));
      return newVal;
    });
  };

  const handleUpdatePrintSettings = (newSettings: Partial<PrintSettings>) => {
    setPrintSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('SAMAD_AGRO_PRINT_SETTINGS', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Refresh status bar statistics
  const refreshStatus = useCallback(async () => {
    try {
      const [pending, synced, failed, lastSync, lastBackup] = await Promise.all([
        db.syncQueue.where('status').equals('PENDING').count(),
        db.syncQueue.where('status').equals('SYNCED').count(),
        db.syncQueue.where('status').equals('FAILED').count(),
        db.settings.where('key').equals('LAST_SYNC_TIME').first(),
        db.settings.where('key').equals('LAST_BACKUP_TIME').first(),
      ]);

      setPendingCount(pending);
      setSyncedCount(synced);
      setFailedCount(failed);
      setLastSyncTime(lastSync?.value || null);
      setLastBackupTime(lastBackup?.value || null);
      setLocalDbOk(true);
    } catch {
      setLocalDbOk(false);
    }
  }, []);

  // Initialize DB & Auth on mount
  useEffect(() => {
    async function init() {
      try {
        await seedInitialDataIfNeeded();
        await checkAndRunDailyBackup();
        await refreshStatus();
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    init();

    // Firebase Auth Listener
    const unsubscribeAuth = initAuth(
      (currentUser) => {
        setUser(currentUser);
      },
      () => {
        setUser(null);
      }
    );

    // Network connectivity listeners
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync queue on reconnect
      processSyncQueue().then((res) => {
        if (res && res.synced > 0) {
          showToast(`ইন্টারনেট ফিরে এসেছে! ${res.synced}টি রেকর্ড সিঙ্ক হয়েছে।`);
        }
        refreshStatus();
      }).catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Global keyboard shortcut handler (F1, F2, F3, F4, F5, F7, F8)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('dashboard');
      } else if (e.key === 'F2') {
        if (activeTab !== 'pos') {
          e.preventDefault();
          setActiveTab('pos');
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('customers');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('prescriptions');
      } else if (e.key === 'F5' && !e.ctrlKey) {
        e.preventDefault();
        setActiveTab('inventory');
      } else if (e.key === 'F7') {
        e.preventDefault();
        setActiveTab('drawer');
      } else if (e.key === 'F8') {
        e.preventDefault();
        setActiveTab('sync');
      } else if (e.key === 'F9') {
        e.preventDefault();
        setActiveTab('workspace');
      } else if (e.key === 'F10') {
        e.preventDefault();
        setActiveTab('forecast');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribeAuth();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [refreshStatus]);

  // Background Auto-Sync Effect (Runs every 2 minutes if online and logged in)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const count = await db.syncQueue.where('status').equals('PENDING').count();
        if (count > 0) {
          const res = await processSyncQueue();
          if (res && res.synced > 0) {
            showToast(`ব্যাকগ্রাউন্ড সিঙ্ক সফল! ${res.synced}টি রেকর্ড আপডেট হয়েছে।`);
            refreshStatus();
          }
        }
      } catch (err: any) {
        // Suppress AUTH_REQUIRED in background sync
        if (err.message !== 'AUTH_REQUIRED') {
          console.error('Auto-sync failed:', err);
        }
      }
    }, 120000);

    return () => clearInterval(interval);
  }, [user, refreshStatus]);

  // Open Permanent ID & Google Sign-In Modal
  const handleSignIn = () => {
    setShowPermanentLoginModal(true);
  };

  // Handle Sign-Out
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    showToast('লগআউট সম্পন্ন হয়েছে। পুনরায় লগইন করতে "স্থায়ী আইডি লগইন" বাটনে ক্লিক করুন।');
  };

  // Manual [Sync Now]
  const handleSyncNow = async () => {
    if (!isOnline) {
      alert('ইন্টারনেট সংযোগ নেই। অফলাইনে ডাটা স্থানীয়ভাবে সংরক্ষিত আছে।');
      return;
    }

    setIsSyncing(true);
    try {
      let res;
      try {
        res = await processSyncQueue();
      } catch (err: any) {
        if (err.message === 'AUTH_REQUIRED') {
          const signin = await googleSignIn();
          if (signin) {
            res = await processSyncQueue();
          } else {
            return;
          }
        } else {
          throw err;
        }
      }
      
      await refreshStatus();
      if (res && res.synced > 0) {
        showToast(`সিঙ্ক সফল! ${res.synced}টি রেকর্ড আপডেট হয়েছে।`);
      } else {
        showToast('সিঙ্ক করার মতো নতুন কোনো ডাটা নেই।');
      }
    } catch (err: any) {
      showToast(`সিঙ্ক ত্রুটি: ${err.message || err}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual [Backup Now]
  const handleBackupNow = async () => {
    try {
      await downloadBackupFile();
      await refreshStatus();
    } catch (err: any) {
      alert(`ব্যাকআপ ত্রুটি: ${err.message || err}`);
    }
  };

  // Google Drive Cloud GZIP Backup
  const handleDriveBackup = async () => {
    if (!isOnline) {
      alert('ইন্টারনেট সংযোগ প্রয়োজন। অফলাইনে ডাটা স্থানীয়ভাবে সংরক্ষিত আছে।');
      return;
    }
    try {
      let res;
      try {
        res = await uploadBackupToGoogleDrive();
      } catch (err: any) {
        if (err.message === 'AUTH_REQUIRED') {
          const signin = await googleSignIn();
          if (signin) {
            res = await uploadBackupToGoogleDrive();
          } else {
            return;
          }
        } else {
          throw err;
        }
      }

      await refreshStatus();
      alert(`গুগল ড্রাইভে ব্যাকআপ সংরক্ষিত হয়েছে! ফাইল: ${res.fileName}`);
    } catch (err: any) {
      alert(`গুগল ড্রাইভ ব্যাকআপ ত্রুটি: ${err.message || err}`);
    }
  };

  // Transfer prescribed items into POS Cart
  const handleTransferToCart = (items: CartItem[], customer: Customer) => {
    setPrescribedCartItems(items);
    setPrescribedCustomer(customer);
    setActiveTab('pos');
  };

  const isFullDisplayMode = activeTab !== 'dashboard';

  return (
    <div className={`min-h-screen flex flex-col text-gray-900 font-sans antialiased selection:bg-emerald-200 transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100'}`}>
      {/* Persistent Status & Header Bar - Hide in Full Display Mode */}
      {!isFullDisplayMode && (
        <HeaderStatusBar
          isOnline={isOnline}
          localDbOk={localDbOk}
          pendingCount={pendingCount}
          syncedCount={syncedCount}
          failedCount={failedCount}
          lastSyncTime={lastSyncTime}
          lastBackupTime={lastBackupTime}
          user={user}
          isSyncing={isSyncing}
          onSyncNow={handleSyncNow}
          onBackupNow={handleBackupNow}
          onDriveBackup={handleDriveBackup}
          onOpenAutoTest={() => setShowAutoTestModal(true)}
          onOpenArchitecture={() => setShowArchitectureModal(true)}
          printSettings={printSettings}
          onOpenPrintSettings={() => setShowPrintSettingsModal(true)}
          onOpenPrintHistory={() => setShowPrintHistoryModal(true)}
          shopSettings={shopSettings}
          onOpenSettings={() => setShowSettingsModal(true)}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            refreshStatus();
          }}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      )}

      {/* Main Workspace Area */}
      <main className={`flex-1 ${!isFullDisplayMode ? 'pb-10' : ''}`}>
        {isFullDisplayMode && (
          <div className="bg-emerald-950 px-4 py-2 border-b border-emerald-800 flex items-center justify-between sticky top-0 z-40 print:hidden">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 hover:shadow-lg text-white rounded-lg transition-all duration-200 font-bold text-sm cursor-pointer shadow-md active:scale-95"
              title="ফিরে যান"
            >
              <ArrowLeft className="w-4 h-4" />
              ফিরে যান (Return)
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPermanentLoginModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 text-xs font-bold transition cursor-pointer"
                title="স্থায়ী লগইন আইডি (One-Time Permanent Login ID)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="max-w-[140px] truncate">
                  {user ? user.displayName || 'স্থায়ী আইডি সক্রিয়' : 'আইডি লগইন'}
                </span>
              </button>
              <button
                onClick={() => setShowPrintHistoryModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-amber-300 border border-emerald-700 text-xs font-bold transition cursor-pointer"
                title="সর্বশেষ প্রিন্টকৃত ৫টি রশিদের ইতিহাস দেখুন (Print History)"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>প্রিন্ট হিস্ট্রি</span>
              </button>
              <button
                onClick={toggleDarkMode}
                className="p-1.5 rounded-lg bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900 transition-colors border border-emerald-800/50"
                title={isDarkMode ? 'লাইট মোড অন করুন' : 'নাইট মোড অন করুন'}
              >
                {isDarkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                )}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-mono text-[10px] uppercase tracking-widest hidden sm:inline">
                  {activeTab} mode active
                </span>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'dashboard' && (
          <DashboardModule
            onGoToPOS={() => setActiveTab('pos')}
            onGoToInventory={() => setActiveTab('inventory')}
            onGoToLedger={() => setActiveTab('customers')}
            onGoToSync={() => setActiveTab('sync')}
            onGoToWorkspace={() => setActiveTab('workspace')}
            onGoToForecast={() => setActiveTab('forecast')}
            onOpenSettings={() => setShowSettingsModal(true)}
            onOpenArchitecture={() => setShowArchitectureModal(true)}
            shopSettings={shopSettings}
          />
        )}

        {activeTab === 'pos' && (
          <POSModule
            onGoToPrescriptions={() => setActiveTab('prescriptions')}
            initialCartItems={prescribedCartItems}
            initialCustomer={prescribedCustomer}
            printSettings={printSettings}
            onUpdatePrintSettings={handleUpdatePrintSettings}
            onOpenPrintSettings={() => setShowPrintSettingsModal(true)}
            onOpenPrintHistory={() => setShowPrintHistoryModal(true)}
            shopSettings={shopSettings}
          />
        )}

        {activeTab === 'prescriptions' && (
          <PrescriptionModule onTransferToCart={handleTransferToCart} />
        )}

        {activeTab === 'customers' && <CustomerLedgerModule shopSettings={shopSettings} />}

        {activeTab === 'inventory' && <InventoryModule />}

        {activeTab === 'drawer' && <CashDrawerModule />}

        {activeTab === 'workspace' && <WorkspaceModule />}

        {activeTab === 'forecast' && <SalesForecastingModule />}

        {activeTab === 'sync' && (
          <SyncBackupModule isOnline={isOnline} onRefreshStatus={refreshStatus} />
        )}
      </main>

      {/* 12 Automated Acceptance Tests Modal */}
      {showAutoTestModal && (
        <AcceptanceSuiteModal onClose={() => setShowAutoTestModal(false)} />
      )}

      {/* Thermal Print Settings Modal */}
      {showPrintSettingsModal && (
        <PrintSettingsModal
          settings={printSettings}
          onSave={handleUpdatePrintSettings}
          onClose={() => setShowPrintSettingsModal(false)}
        />
      )}

      {/* Print History Modal (Last 5 Printed Receipts) */}
      {showPrintHistoryModal && (
        <PrintHistoryModal
          onClose={() => setShowPrintHistoryModal(false)}
          defaultPaperSize={printSettings.paperSize}
          compactView={Boolean(printSettings.compactView)}
          onToggleCompactView={(enabled) => handleUpdatePrintSettings({ compactView: enabled })}
          shopSettings={shopSettings}
        />
      )}

      {/* One-Time Permanent Login ID Modal */}
      {showPermanentLoginModal && (
        <PermanentLoginModal
          currentUser={user}
          onLoginSuccess={(loggedInUser, msg) => {
            setUser(loggedInUser);
            showToast(msg);
          }}
          onSignOut={handleSignOut}
          onClose={() => setShowPermanentLoginModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          settings={shopSettings}
          onSave={handleUpdateShopSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* System Architecture Diagram Modal */}
      {showArchitectureModal && (
        <ArchitectureModal onClose={() => setShowArchitectureModal(false)} />
      )}

      {/* Toast Notification Component */}
      {toast && (
        <div className="fixed bottom-12 right-4 z-[9999] animate-in slide-in-from-right fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${
            toast.type === 'success' 
              ? 'bg-emerald-800 border-emerald-600 text-white' 
              : 'bg-rose-800 border-rose-600 text-white'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-300" />
            ) : (
              <X className="w-5 h-5 text-rose-300" />
            )}
            <p className="text-sm font-bold tracking-tight">{toast.message}</p>
            <button 
              onClick={() => setToast(null)}
              className="ml-2 p-1 hover:bg-black/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Technical Status Line - Hide in Full Display Mode */}
      {!isFullDisplayMode && (
        <footer className="bg-emerald-950 text-emerald-400/80 text-[11px] py-1.5 px-4 border-t border-emerald-900 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>মেসার্স আব্দুস সামাদ মোল্লাহ্ • AgroPOS Enterprise Engine</span>
            <span>•</span>
            <span className="font-mono text-emerald-300">Dexie.js IndexedDB v2</span>
            <span>•</span>
            <span className="font-mono text-emerald-300">Google Sheets Sync Ready</span>
          </div>
          <div className="flex items-center gap-3">
            <span>F1: ড্যাশবোর্ড</span>
            <span>F2: POS</span>
            <span>F3: গ্রাহক</span>
            <span>F4: প্রেসক্রিপশন</span>
            <span>F5: ইনভেন্টরি</span>
            <span>F7: ক্যাশ ড্রয়ার</span>
            <span>F8: ক্লাউড সিঙ্ক</span>
            <span>F9: ওয়ার্কস্পেস</span>
            <span>F10: চাহিদা পূর্বাভাস</span>
          </div>
        </footer>
      )}
    </div>
  );
}
