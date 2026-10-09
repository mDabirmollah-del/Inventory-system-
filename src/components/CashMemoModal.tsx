import React, { useState, useEffect } from 'react';
import {
  Printer,
  Volume2,
  VolumeX,
  CheckCircle2,
  X,
  Zap,
  MessageSquare,
  FileText,
  Minimize2,
} from 'lucide-react';
import type { Transaction, TransactionItem, PaperSize, ShopSettings } from '../types';
import { speakText, stopSpeaking, formatCashMemoSpeech } from '../services/ttsService';
import { logPrintedReceipt } from './PrintHistoryModal';

interface CashMemoModalProps {
  transaction: Transaction;
  items: TransactionItem[];
  previousDue?: number;
  autoPrint?: boolean;
  isPreview?: boolean;
  defaultPaperSize?: PaperSize;
  printCopies?: number;
  compactView?: boolean;
  onToggleAutoPrint?: (enabled: boolean) => void;
  onToggleCompactView?: (enabled: boolean) => void;
  onClose: () => void;
  shopSettings?: ShopSettings;
}

export const CashMemoModal: React.FC<CashMemoModalProps> = ({
  transaction,
  items,
  previousDue = 0,
  autoPrint = false,
  isPreview = false,
  defaultPaperSize = '80mm',
  printCopies = 1,
  compactView: initialCompactView = false,
  onToggleAutoPrint,
  onToggleCompactView,
  onClose,
  shopSettings,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>(defaultPaperSize);
  const [isCompact, setIsCompact] = useState<boolean>(initialCompactView);
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false);

  useEffect(() => {
    setIsCompact(initialCompactView);
  }, [initialCompactView]);

  // Trigger auto-print if configured
  useEffect(() => {
    if (autoPrint && !autoPrintTriggered) {
      setAutoPrintTriggered(true);
      if (!isPreview) {
        logPrintedReceipt(transaction, paperSize, true);
      }
      const timer = setTimeout(() => {
        window.print();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, autoPrintTriggered, isPreview, transaction, paperSize]);

  const handleSpeak = async () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const text = formatCashMemoSpeech({
      customerName: transaction.customerName,
      invoiceNo: transaction.invoiceNo,
      grandTotal: transaction.grandTotal,
      paidAmount: transaction.paidAmount,
      dueAmount: transaction.dueAmount,
    });

    await speakText(text);
    setIsSpeaking(false);
  };

  const handlePrint = () => {
    if (!isPreview) {
      logPrintedReceipt(transaction, paperSize, false);
    }
    window.print();
  };

  const handleToggleCompact = () => {
    const next = !isCompact;
    setIsCompact(next);
    onToggleCompactView?.(next);
  };

  const handleWhatsAppShare = () => {
    // Replaced customer mobile with user-requested fixed target for record/direct sharing
    const phone = '01625652441'; 
    const formattedPhone = `88${phone}`;
    
    const shopName = shopSettings?.shopName || 'মেসার্স আব্দুস সামাদ মোল্লাহ্';
    const itemsList = items.map((item, idx) => `${idx + 1}. ${item.banglaName || item.productName} (${item.quantity} ${item.unit}) - ৳${item.total}`).join('\n');
    
    const message = `*${shopName}*\n🚀 *Cash Memo / Receipt*\n\n📝 *Invoice No:* ${transaction.invoiceNo}\n📅 *Date:* ${new Date(transaction.createdAt).toLocaleDateString('bn-BD')}\n👤 *Customer:* ${transaction.customerName}\n📱 *Mobile:* ${transaction.customerMobile || 'N/A'}\n\n📦 *Product List:*\n${itemsList}\n\n--------------------------------\n💰 *Total Bill: ৳${transaction.grandTotal}*\n💵 *Paid Amount: ৳${transaction.paidAmount}*\n🔴 *Due Amount: ৳${transaction.dueAmount}*\n--------------------------------\nThank you for shopping with us!`;
    
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const totalCurrentDue = (previousDue || 0) + (transaction.dueAmount || 0);

  // Styling classes according to paper size and compact view
  const paperContainerStyle =
    paperSize === '58mm'
      ? isCompact
        ? 'max-w-[270px] px-1.5 py-1 text-[10px] leading-tight compact-receipt'
        : 'max-w-[280px] p-3 text-[10px]'
      : paperSize === '80mm'
      ? isCompact
        ? 'max-w-[360px] px-2 py-1 text-[11px] leading-tight compact-receipt'
        : 'max-w-[380px] p-4 text-xs'
      : isCompact
      ? 'max-w-2xl px-4 py-2 text-xs leading-tight compact-receipt'
      : 'max-w-2xl p-6 text-xs';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white text-gray-900 rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 overflow-hidden my-auto">
        {/* Modal Top Actions */}
        <div className="bg-emerald-950 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            {isPreview ? (
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-sm text-amber-400 uppercase tracking-widest">মেমো প্রাক-দর্শন (PREVIEW)</span>
              </div>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-sm">বিক্রয় সফল হয়েছে!</span>
              </>
            )}
            {autoPrint && !isPreview && (
              <span className="inline-flex items-center gap-1 bg-amber-400 text-emerald-950 font-bold px-2 py-0.5 rounded text-[10px] shadow-xs">
                <Zap className="w-3 h-3 text-emerald-950 fill-emerald-950" />
                অটো থার্মাল প্রিন্ট
              </span>
            )}
          </div>

          {/* Paper Size & Compact View Selector */}
          <div className="flex items-center gap-1.5 bg-emerald-900 px-2 py-1 rounded-lg text-xs">
            <span className="text-emerald-300 text-[11px] font-medium mr-1">সাইজ:</span>
            {(['58mm', '80mm', 'A4'] as PaperSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setPaperSize(size)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  paperSize === size
                    ? 'bg-amber-400 text-emerald-950 shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                {size}
              </button>
            ))}
            <span className="text-emerald-700 mx-0.5">|</span>
            <button
              type="button"
              onClick={handleToggleCompact}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                isCompact
                  ? 'bg-teal-400 text-emerald-950 shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
              title="৮০মিমি প্রিন্টারে কাগজ বাঁচাতে অতিরিক্ত ফাঁকা জায়গা কমান (Compact View)"
            >
              <Minimize2 className="w-3 h-3" />
              কমপ্যাক্ট
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Readout */}
            <button
              onClick={handleSpeak}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isSpeaking
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-emerald-800 hover:bg-emerald-700 text-emerald-100'
              }`}
              title="মেমো বিস্তারিত বাংলায় শুনুন (TTS)"
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isSpeaking ? 'থামান' : 'ভয়েস (TTS)'}
            </button>

            {/* Print button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-emerald-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              প্রিন্ট
            </button>

            <button
              onClick={handleWhatsAppShare}
              disabled={isPreview}
              className={`inline-flex items-center gap-1.5 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs ${
                isPreview 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title={isPreview ? "প্রিভিউ মোডে হোয়াটসঅ্যাপ পাঠানো যাবে না" : "হোয়াটসঅ্যাপে সম্পূর্ণ রশিদ পাঠান"}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              হোয়াটসঅ্যাপে ফুল মেমো (Full)
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-md transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Cash Memo Area */}
        <div className={`overflow-x-auto flex justify-center bg-gray-50 ${isCompact ? 'py-2' : 'py-4'} print:py-0 print:bg-white`}>
          <div
            id="printable-memo"
            className={`bg-white text-gray-900 font-sans shadow-sm border border-gray-200 print:border-none print:shadow-none mx-auto ${paperContainerStyle}`}
          >
            {/* Shop Header */}
            <div className={`text-center border-b border-emerald-900 ${isCompact ? 'pb-1' : 'border-b-2 pb-2'} relative overflow-hidden`}>
              {isPreview && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08] rotate-[-15deg]">
                  <span className="text-4xl font-black uppercase tracking-[1em]">PREVIEW</span>
                </div>
              )}
              {!isCompact && (
                <div className="text-[10px] font-semibold text-emerald-800 tracking-wider">
                  বিসমিল্লাহির রাহমানির রাহিম
                </div>
              )}
              <h2 className={`font-black text-emerald-950 font-serif ${paperSize === '58mm' || isCompact ? 'text-base leading-snug' : 'text-xl'}`}>
                {shopSettings?.shopName || 'মেসার্স আব্দুস সামাদ মোল্লাহ্'}
              </h2>
              <p className="text-[10px] font-bold text-emerald-800 leading-tight">
                {shopSettings?.slogan || 'BCIC ও BADC অনুমোদিত সার, বীজ ও বালাইনাশক ডিলার'}
              </p>
              <p className="text-[10px] text-gray-700 leading-tight">
                {shopSettings?.address || 'গোবিন্দপুর বাজার, ভূঞাপুর, টাঙ্গাইল • মোবা: ০১৭১২-৩৪৫৬৭৮'}
              </p>
              {!isCompact && (
                <div className="inline-block mt-1 px-3 py-0.5 bg-emerald-900 text-white text-[10px] font-bold rounded-full">
                  ক্যাশ মেমো / রশিদ
                </div>
              )}
            </div>

            {/* Memo & Customer Metadata */}
            <div className={`grid grid-cols-2 ${isCompact ? 'py-1 text-[10px] leading-tight' : 'py-2 text-[11px]'} border-b border-gray-300 gap-1`}>
              <div>
                <p>
                  <strong className="text-gray-700">মেমো:</strong>{' '}
                  <span className="font-mono font-bold">{transaction.invoiceNo}</span>
                </p>
                <p>
                  <strong className="text-gray-700">তারিখ:</strong>{' '}
                  {new Date(transaction.createdAt).toLocaleDateString('bn-BD')}
                </p>
                {!isCompact && (
                  <p>
                    <strong className="text-gray-700">মাধ্যম:</strong>{' '}
                    <span className="font-semibold text-emerald-800">{transaction.paymentMethod}</span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="truncate">
                  <strong className="text-gray-700">ক্রেতা:</strong>{' '}
                  <span className="font-bold text-gray-900">{transaction.customerName}</span>
                </p>
                <p>
                  <strong className="text-gray-700">মোবাইল:</strong>{' '}
                  <span className="font-mono">{transaction.customerMobile || 'N/A'}</span>
                </p>
                <p className="truncate">
                  <strong className="text-gray-700">গ্রাম:</strong>{' '}
                  {transaction.customerVillage || 'স্থানীয়'}
                  {isCompact ? ` • ${transaction.paymentMethod}` : ''}
                </p>
              </div>
            </div>

            {/* Items Table - Cost price / Profit is 100% hidden and secure */}
            <div className={isCompact ? 'mt-1' : 'mt-2'}>
              <table className={`w-full text-left border-collapse ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
                <thead>
                  <tr className="bg-emerald-50 text-emerald-950 border-y border-emerald-900 font-bold">
                    <th className={`${isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'} text-center w-5`}>নং</th>
                    <th className={isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'}>পণ্যের বিবরণ</th>
                    <th className={`${isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'} text-center`}>পরিমাণ</th>
                    <th className={`${isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'} text-right`}>দর</th>
                    <th className={`${isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'} text-right`}>মোট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className={`${isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'} text-center text-gray-500 font-mono`}>
                        {idx + 1}
                      </td>
                      <td className={`${isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'} font-medium`}>
                        <div className="leading-tight">
                          {item.banglaName || item.productName}
                          {isCompact && item.packSize ? (
                            <span className="text-[9px] text-gray-400 font-mono ml-1">({item.packSize})</span>
                          ) : null}
                        </div>
                        {!isCompact && (
                          <div className="text-[9px] text-gray-400 font-mono">{item.packSize}</div>
                        )}
                      </td>
                      <td className={`${isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'} text-center font-bold whitespace-nowrap`}>
                        {item.quantity} {item.unit}
                      </td>
                      <td className={`${isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'} text-right font-mono`}>
                        {item.unitPrice}
                      </td>
                      <td className={`${isCompact ? 'py-0.5 px-0.5' : 'py-1 px-1'} text-right font-mono font-bold`}>
                        {item.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Breakdown */}
            <div className={`${isCompact ? 'mt-1 pt-1 text-[10px]' : 'mt-3 pt-2 text-[11px]'} border-t-2 border-gray-300 flex justify-end`}>
              <div className={`${isCompact ? 'w-48 space-y-0.5' : 'w-56 space-y-1'}`}>
                {(!isCompact || transaction.discount > 0) && (
                  <div className="flex justify-between text-gray-700">
                    <span>উপমোট:</span>
                    <span className="font-mono font-medium">৳ {transaction.subtotal}</span>
                  </div>
                )}

                {transaction.discount > 0 && (
                  <div className="flex justify-between text-rose-700 font-medium">
                    <span>বিশেষ ছাড়:</span>
                    <span className="font-mono">- ৳ {transaction.discount}</span>
                  </div>
                )}

                <div className={`flex justify-between text-emerald-950 font-bold ${!isCompact || transaction.discount > 0 ? 'border-t border-gray-300 pt-0.5' : ''} ${isCompact ? 'text-[11px]' : 'text-xs'}`}>
                  <span>সর্বমোট বিল:</span>
                  <span className="font-mono font-black text-emerald-900">৳ {transaction.grandTotal}</span>
                </div>

                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>নগদ পরিশোধ:</span>
                  <span className="font-mono">৳ {transaction.paidAmount}</span>
                </div>

                {transaction.dueAmount > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold border-t border-dashed border-rose-300 pt-0.5">
                    <span>বর্তমান বকেয়া:</span>
                    <span className="font-mono">৳ {transaction.dueAmount}</span>
                  </div>
                )}

                {previousDue > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>পূর্বের বকেয়া:</span>
                    <span className="font-mono">৳ {previousDue}</span>
                  </div>
                )}

                {totalCurrentDue > 0 && (
                  <div className="flex justify-between text-rose-950 font-black bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                    <span>মোট অবশিষ্ট বকেয়া:</span>
                    <span className="font-mono">৳ {totalCurrentDue}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Notice */}
            <div className={`${isCompact ? 'mt-1.5 pt-1 text-[8px]' : 'mt-4 pt-3 text-[9px]'} border-t border-gray-300 flex justify-between items-end text-gray-500`}>
              <div className="leading-tight">
                {!isCompact && <p>• বিক্রিত পণ্য পরিবর্তনযোগ্য।</p>}
                <p>• {shopSettings?.shopName || 'মেসার্স আব্দুস সামাদ মোল্লাহ্'}-র সাথে থাকার জন্য ধন্যবাদ।</p>
              </div>
              <div className="text-center">
                <div className={`border-t border-gray-400 ${isCompact ? 'w-16 pt-0 text-[9px]' : 'w-24 pt-0.5 text-[10px]'} font-semibold text-gray-800`}>
                  স্বাক্ষর
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Close */}
        <div className="bg-gray-100 px-4 py-2.5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex flex-wrap items-center gap-4">
            {!isPreview && onToggleAutoPrint && (
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => onToggleAutoPrint(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-800 focus:ring-emerald-500 cursor-pointer"
                />
                <span>পরবর্তী বিক্রয়ে অটো-প্রিন্ট সক্রিয় রাখুন</span>
              </label>
            )}
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-teal-800 font-medium select-none">
              <input
                type="checkbox"
                checked={isCompact}
                onChange={handleToggleCompact}
                className="rounded border-gray-300 text-teal-700 focus:ring-teal-500 cursor-pointer"
              />
              <span>কমপ্যাক্ট ভিউ (কাগজ সাশ্রয়ী মোড)</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsAppShare}
              disabled={isPreview}
              className={`px-4 py-1.5 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-2 shadow-sm ${
                isPreview
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp শেয়ার
            </button>

            {isPreview && (
              <p className="text-[10px] text-gray-500 font-medium mr-2">
                * এটি একটি খসড়া মেমো, মূল বিক্রয়ের আগে চেক করে নিন।
              </p>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs rounded-lg transition cursor-pointer"
            >
              {isPreview ? 'প্রিভিউ বন্ধ করুন' : 'বন্ধ করুন (Close)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
