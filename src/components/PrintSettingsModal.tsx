import React, { useState } from 'react';
import {
  Printer,
  Check,
  X,
  FileText,
  Sliders,
  Sparkles,
  Zap,
  Info,
  Minimize2,
} from 'lucide-react';
import type { PrintSettings, PaperSize } from '../types';

interface PrintSettingsModalProps {
  settings: PrintSettings;
  onSave: (newSettings: PrintSettings) => void;
  onClose: () => void;
}

export const PrintSettingsModal: React.FC<PrintSettingsModalProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [autoPrintOnSale, setAutoPrintOnSale] = useState<boolean>(settings.autoPrintOnSale);
  const [paperSize, setPaperSize] = useState<PaperSize>(settings.paperSize || '80mm');
  const [printCopies, setPrintCopies] = useState<number>(settings.printCopies || 1);
  const [compactView, setCompactView] = useState<boolean>(Boolean(settings.compactView));
  const [showTestMemo, setShowTestMemo] = useState<boolean>(false);

  const handleSave = () => {
    onSave({
      autoPrintOnSale,
      paperSize,
      printCopies,
      compactView,
    });
    onClose();
  };

  const handleTriggerTestPrint = () => {
    setShowTestMemo(true);
    setTimeout(() => {
      window.print();
      setShowTestMemo(false);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="bg-emerald-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800/80 flex items-center justify-center text-amber-300 border border-emerald-700">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">থার্মাল প্রিন্ট কনফিগারেশন</h3>
              <p className="text-[11px] text-emerald-300 font-sans">
                স্বয়ংক্রিয় রসিদ প্রিন্ট ও কাগজের সাইজ সেটিংস
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Main Feature Toggle: Auto-print on sale completion */}
          <div className="p-3.5 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-sm text-emerald-950">
                  বিক্রয় শেষে স্বয়ংক্রিয় প্রিন্ট (Auto-print on Sale)
                </span>
              </div>
              <p className="text-xs text-emerald-900/80 leading-relaxed">
                চালু থাকলে পারমাণবিক বিক্রয় লেনদেন সফল হওয়া মাত্রই কোনো বাড়তি ক্লিক ছাড়াই স্বয়ংক্রিয়ভাবে থার্মাল ক্যাশ মেমো প্রিন্ট কমান্ড শুরু হবে।
              </p>
            </div>

            {/* Custom Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={autoPrintOnSale}
              onClick={() => setAutoPrintOnSale(!autoPrintOnSale)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                autoPrintOnSale ? 'bg-emerald-800' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  autoPrintOnSale ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Compact View Option for 80mm/58mm Thermal Paper Saving */}
          <div className="p-3.5 rounded-xl border-2 border-teal-200 bg-teal-50/50 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Minimize2 className="w-4 h-4 text-teal-700" />
                <span className="font-bold text-sm text-teal-950">
                  কমপ্যাক্ট ভিউ / কাগজ সাশ্রয়ী মোড (Compact View)
                </span>
                <span className="text-[10px] font-bold bg-teal-200 text-teal-900 px-1.5 py-0.5 rounded">
                  80mm Paper Saver
                </span>
              </div>
              <p className="text-xs text-teal-900/80 leading-relaxed">
                ৮০মিমি (80mm) থার্মাল প্রিন্টারে প্রিন্ট করার সময় রশিদের অতিরিক্ত ফাঁকা জায়গা (whitespace), প্যাডিং এবং মার্জিন কমিয়ে কাগজ সাশ্রয় করে।
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={compactView}
              onClick={() => setCompactView(!compactView)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                compactView ? 'bg-teal-700' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  compactView ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Paper Size Configuration */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
              ডিফল্ট কাগজের প্রস্থ / সাইজ (Thermal Paper Size)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  id: '80mm' as PaperSize,
                  title: '80mm (স্ট্যান্ডার্ড)',
                  desc: '৩ ইঞ্চি POS থার্মাল রসিদ',
                  recommended: true,
                },
                {
                  id: '58mm' as PaperSize,
                  title: '58mm (মিনি)',
                  desc: '২ ইঞ্চি ব্লুটুথ/ইউএসবি প্রিন্টার',
                  recommended: false,
                },
                {
                  id: 'A4' as PaperSize,
                  title: 'A4 / লেটার',
                  desc: 'লেজার বা সাধারণ ইনকজেট',
                  recommended: false,
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPaperSize(item.id)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    paperSize === item.id
                      ? 'border-emerald-700 bg-emerald-50/70 ring-2 ring-emerald-600/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-900">{item.title}</span>
                      {paperSize === item.id && (
                        <Check className="w-3.5 h-3.5 text-emerald-700 font-bold" />
                      )}
                    </div>
                    <span className="block text-[10px] text-gray-500 mt-0.5">
                      {item.desc}
                    </span>
                  </div>
                  {item.recommended && (
                    <span className="mt-2 inline-block text-[9px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded self-start">
                      প্রস্তাবিত
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Print Copies */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800">
              প্রিন্ট কপি সংখ্যা (Print Copies)
            </label>
            <div className="flex gap-2">
              {[1, 2].map((copies) => (
                <button
                  key={copies}
                  type="button"
                  onClick={() => setPrintCopies(copies)}
                  className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-bold transition cursor-pointer ${
                    printCopies === copies
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {copies === 1 ? '১ কপি (একক মেমো)' : '২ কপি (গ্রাহক + দোকান রেকর্ড)'}
                </button>
              ))}
            </div>
          </div>

          {/* Status Note & Test Print */}
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                থার্মাল প্রিন্টারে সরাসরি মার্জিন ছাড়া প্রিন্ট নিশ্চিত করতে ব্রাউজারের প্রিন্ট ডায়ালগে <strong>Margin: None</strong> নির্বাচন করুন।
              </p>
              <button
                type="button"
                onClick={handleTriggerTestPrint}
                className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer mt-1"
              >
                <Printer className="w-3 h-3" />
                এখানে ক্লিক করে টেস্ট প্রিন্ট পরীক্ষা করুন
              </button>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium text-xs rounded-lg transition cursor-pointer"
          >
            বাতিল (Cancel)
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs px-5 py-2 rounded-lg transition cursor-pointer shadow-xs"
          >
            <Check className="w-4 h-4" />
            সেটিংস সংরক্ষণ করুন (Save Settings)
          </button>
        </div>
      </div>

      {/* Hidden Test Print Area */}
      {showTestMemo && (
        <div
          id="printable-memo"
          className={`hidden print:block font-mono text-xs ${
            compactView ? 'compact-receipt p-1 leading-tight' : 'p-4'
          }`}
        >
          <div className={`text-center border-b ${compactView ? 'pb-0.5' : 'pb-2'}`}>
            <h2 className="font-bold text-sm">মেসার্স আব্দুস সামাদ মোল্লাহ্</h2>
            <p className="text-[10px]">গোবিন্দপুর বাজার, ভূঞাপুর, টাঙ্গাইল</p>
            <p className="text-[10px] font-bold mt-0.5">*** টেস্ট থার্মাল প্রিন্ট ***</p>
          </div>
          <div className={`${compactView ? 'py-1' : 'py-2'} text-[10px]`}>
            <p>প্রিন্টার টেস্ট সফল হয়েছে।</p>
            <p>কাগজের সাইজ: {paperSize}</p>
            <p>কমপ্যাক্ট ভিউ: {compactView ? 'সক্রিয় (COMPACT)' : 'সাধারণ (NORMAL)'}</p>
            <p>অটো প্রিন্ট: {autoPrintOnSale ? 'সক্রিয় (ENABLED)' : 'নিষ্ক্রিয় (DISABLED)'}</p>
            <p>তারিখ: {new Date().toLocaleString('bn-BD')}</p>
          </div>
          <div className={`${compactView ? 'pt-0.5' : 'pt-2'} border-t text-center text-[9px]`}>
            ধন্যবাদ
          </div>
        </div>
      )}
    </div>
  );
};
