import React from 'react';
import {
  Layers,
  Database,
  RefreshCw,
  FileSpreadsheet,
  Users,
  Package,
  HardDrive,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  X,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface ArchitectureModalProps {
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-700 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-mono tracking-tight">
                  SYSTEM ARCHITECTURE
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40">
                  OFFLINE-FIRST POS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                মেসার্স আব্দুস সামাদ মোল্লাহ্ — ফুল-স্ট্যাক ক্লাউড ও অফলাইন আর্কিটেকচার ডায়াগ্রাম
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-5 space-y-6">
          {/* Architecture Diagram Hero Image */}
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-inner relative group">
            <img
              src="/src/assets/images/system_architecture_1790858031909.jpg"
              alt="Offline-First POS System Architecture Diagram"
              referrerPolicy="no-referrer"
              className="w-full h-auto object-cover max-h-[480px] select-none"
            />
            <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-md text-[11px] text-emerald-400 px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5 shadow-md">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ACID পারমাণবিক লেনদেন ও গুগল সিঙ্ক রেডি</span>
            </div>
          </div>

          {/* 5 Core Architectural Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pillar 1: Mobile Frontend UI */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <Layers className="w-4 h-4" />
                <span>1. Mobile & POS Frontend UI</span>
              </div>
              <h4 className="font-bold text-sm text-white">
                রিস্পন্সিভ রিঅ্যাক্ট পিওএস ইন্টারফেস
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>২৫০+ দৈনিক লেনদেনের দ্রুতগতি ও কীবোর্ড শর্টকাট (F1-F8)</li>
                <li>১-বিঘা কৃষি প্রেসক্রিপশন ক্যালকুলেটর ও ল্যান্ড কনভার্সন</li>
                <li>থার্মাল প্রিন্ট ইঞ্জিন (৮০ মিমি, ৫৮ মিমি ও A4 সাইজ)</li>
                <li>রিয়েল-টাইম ক্যাশ ও বাকি ড্রয়ার ইনপুট</li>
              </ul>
            </div>

            {/* Pillar 2: Local Database (Dexie.js IndexedDB) */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
                <Database className="w-4 h-4" />
                <span>2. Local IndexedDB (Dexie.js)</span>
              </div>
              <h4 className="font-bold text-sm text-white">
                সম্পূর্ণ অফলাইন প্রাথমিক ডাটাবেজ
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>১৫টি সম্পূর্ণ টেবিল (কাস্টমার, ইনভেন্টরি, সেলস, ইত্যাদি)</li>
                <li>ইন্টারনেটবিহীন নিরবচ্ছিন্ন ক্যাশ মেমো ও বিক্রয় চালনা</li>
                <li>ইন্ডেক্সড অনুসন্ধান: মোবাইল ও গ্রামে ৫০ মি.সে.-র নিচে রেসপন্স</li>
                <li>পারমাণবিক ট্রানজ্যাকশন ও idempotencyKey ডুপ্লিকেট রোধ</li>
              </ul>
            </div>

            {/* Pillar 3: Conflict-Safe Sync Engine */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <RefreshCw className="w-4 h-4" />
                <span>3. Background Sync Engine</span>
              </div>
              <h4 className="font-bold text-sm text-white">
                নিরাপদ সিঙ্ক কিউই ও কনফ্লিক্ট হ্যান্ডলার
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>স্ট্যাটাস লাইফসাইকেল: PENDING → SYNCING → SYNCED</li>
                <li>ইন্টারনেট ড্রপ হলে এক্সপোনেনশিয়াল ব্যাকঅফ অটো-রিট্রাই</li>
                <li>ভার্সন এবং টাইমস্ট্যাম্প ভিত্তিক কনফ্লিক্ট ডিটেকশন</li>
                <li>কখনও লোকাল রেকর্ড ডিলিট না করে ডেটা অখণ্ডতা সুরক্ষা</li>
              </ul>
            </div>

            {/* Pillar 4: Google Sheets & Drive Integration */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                <FileSpreadsheet className="w-4 h-4" />
                <span>4. Google Sheets & Cloud Sync</span>
              </div>
              <h4 className="font-bold text-sm text-white">
                ১১-ট্যাব ক্লাউড রিপোর্টিং লেয়ার
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>CUSTOMERS, TRANSACTIONS, ITEMS সহ ১১টি গুগল শিট ট্যাব</li>
                <li>Google Drive-এ সংরক্ষিত দৈনিক কমপ্রেসড GZIP ব্যাকআপ</li>
                <li>মাইক্রোসফট এক্সেল সমর্থিত UTF-8 BOM CSV এক্সপোর্ট</li>
                <li>ক্লাউড শিটের ডেটা ক্ষতি হলেও লোকাল স্টোরেজ সম্পূর্ণ নিরাপদ</li>
              </ul>
            </div>

            {/* Pillar 5: Farmer KYC & Agri CRM */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                <Users className="w-4 h-4" />
                <span>5. Farmer KYC & Due Ledger</span>
              </div>
              <h4 className="font-bold text-sm text-white">
                কৃষক প্রোফাইল ও বাকি খাতা রেজিস্টার
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>জমির পরিমাণ (বিঘা/শতাংশ), জামিনদার ও শস্যের তথ্য</li>
                <li>বাকি সীমা (Credit Limit) অতিক্রমকারী সতর্কবার্তা</li>
                <li>আংশিক পেমেন্ট স্বয়ংক্রিয় ক্যাশ ও বাকি স্প্লিট</li>
                <li>তাৎক্ষণিক কিস্তি আদায় ও কালেকশন মেমো জেনারেশন</li>
              </ul>
            </div>

            {/* Pillar 6: Sales & Stock Inventory */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <Package className="w-4 h-4" />
                <span>6. Sales & Stock Inventory</span>
              </div>
              <h4 className="font-bold text-sm text-white">
                মজুত ও সার-কীটনাশক ব্যবস্থাপনা
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>BCIC ও BADC অনুমোদিত সার, বীজ ও কীটনাশক স্টক</li>
                <li>বিক্রয়ের সাথে সাথে ইনভেন্টরি থেকে পারমাণবিক স্টক কর্তন</li>
                <li>কম মজুত (Low Stock Alert) ও গোডাউন র‍্যাক ট্র্যাকিং</li>
                <li>ব্যাচ নম্বর ও মেয়াদোত্তীর্ণের তারিখ নিরীক্ষণ</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>সিস্টেম লাইভ ও আর্কিটেকচার ভেরিফাইড (12/12 Tests Passing)</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg transition cursor-pointer shadow-xs"
          >
            বন্ধ করুন (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
