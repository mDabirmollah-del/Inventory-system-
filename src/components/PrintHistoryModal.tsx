import React, { useState, useEffect } from 'react';
import {
  Printer,
  Clock,
  CheckCircle2,
  X,
  FileText,
  User,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { db, generateUUID, getDeviceId } from '../db/database';
import type { Transaction, TransactionItem, PaperSize, ShopSettings } from '../types';
import { CashMemoModal } from './CashMemoModal';

export interface PrintedReceiptRecord {
  id: string;
  transactionId: string;
  invoiceNo: string;
  customerName: string;
  customerMobile: string;
  customerVillage?: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  printedAt: string;
  paperSize: PaperSize;
  isAutoPrint: boolean;
  source: 'PRINT_LOG' | 'TRANSACTION_RECORD';
}

export async function logPrintedReceipt(
  transaction: Transaction,
  paperSize: PaperSize = '80mm',
  isAutoPrint: boolean = false
): Promise<void> {
  if (!transaction || transaction.id === 'preview') return;
  try {
    await db.auditLogs.add({
      id: generateUUID(),
      action: 'PRINT_RECEIPT',
      entity: 'transactions',
      entityId: transaction.id,
      details: JSON.stringify({
        invoiceNo: transaction.invoiceNo,
        customerName: transaction.customerName,
        customerMobile: transaction.customerMobile,
        customerVillage: transaction.customerVillage,
        grandTotal: transaction.grandTotal,
        paidAmount: transaction.paidAmount,
        dueAmount: transaction.dueAmount,
        paperSize,
        isAutoPrint,
        txCreatedAt: transaction.createdAt,
      }),
      performedBy: 'কাউন্টার ম্যানেজার',
      deviceId: getDeviceId(),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log printed receipt:', err);
  }
}

interface PrintHistoryModalProps {
  onClose: () => void;
  defaultPaperSize?: PaperSize;
  compactView?: boolean;
  onToggleCompactView?: (enabled: boolean) => void;
  shopSettings?: ShopSettings;
}

export const PrintHistoryModal: React.FC<PrintHistoryModalProps> = ({
  onClose,
  defaultPaperSize = '80mm',
  compactView = false,
  onToggleCompactView,
  shopSettings,
}) => {
  const [records, setRecords] = useState<PrintedReceiptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTxForView, setSelectedTxForView] = useState<{
    transaction: Transaction;
    items: TransactionItem[];
  } | null>(null);

  const loadPrintHistory = async () => {
    setIsLoading(true);
    try {
      const [allAuditLogs, recentTxs] = await Promise.all([
        db.auditLogs.orderBy('createdAt').reverse().toArray(),
        db.transactions.orderBy('createdAt').reverse().limit(15).toArray(),
      ]);

      const printLogs = allAuditLogs.filter((log) => log.action === 'PRINT_RECEIPT');
      const result: PrintedReceiptRecord[] = [];
      const seenTxIds = new Set<string>();

      for (const log of printLogs) {
        if (result.length >= 5) break;
        try {
          const parsed = log.details ? JSON.parse(log.details) : {};
          if (parsed.invoiceNo) {
            result.push({
              id: log.id,
              transactionId: log.entityId,
              invoiceNo: parsed.invoiceNo,
              customerName: parsed.customerName || 'গ্রাহক',
              customerMobile: parsed.customerMobile || '',
              customerVillage: parsed.customerVillage || '',
              grandTotal: Number(parsed.grandTotal) || 0,
              paidAmount: Number(parsed.paidAmount) || 0,
              dueAmount: Number(parsed.dueAmount) || 0,
              printedAt: log.createdAt,
              paperSize: parsed.paperSize || defaultPaperSize,
              isAutoPrint: Boolean(parsed.isAutoPrint),
              source: 'PRINT_LOG',
            });
            seenTxIds.add(log.entityId);
          }
        } catch {
          // ignore malformed log details
        }
      }

      // Supplement with recent completed transactions if fewer than 5 explicit print logs exist
      for (const tx of recentTxs) {
        if (result.length >= 5) break;
        if (tx.status === 'COMPLETED' && !seenTxIds.has(tx.id)) {
          result.push({
            id: `tx-${tx.id}`,
            transactionId: tx.id,
            invoiceNo: tx.invoiceNo,
            customerName: tx.customerName,
            customerMobile: tx.customerMobile,
            customerVillage: tx.customerVillage,
            grandTotal: tx.grandTotal,
            paidAmount: tx.paidAmount,
            dueAmount: tx.dueAmount,
            printedAt: tx.createdAt,
            paperSize: defaultPaperSize,
            isAutoPrint: false,
            source: 'TRANSACTION_RECORD',
          });
          seenTxIds.add(tx.id);
        }
      }

      setRecords(result);
    } catch (err) {
      console.error('Error loading print history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrintHistory();
  }, []);

  const handleInspectReceipt = async (rec: PrintedReceiptRecord) => {
    const tx = await db.transactions.get(rec.transactionId);
    if (!tx) return;
    const items = await db.transactionItems.where('transactionId').equals(tx.id).toArray();
    setSelectedTxForView({ transaction: tx, items });
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      const datePart = d.toLocaleDateString('bn-BD', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timePart = d.toLocaleTimeString('bn-BD', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return `${datePart} • ${timePart}`;
    } catch {
      return iso;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-950 text-white px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-800 rounded-lg text-amber-300">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  প্রিন্ট হিস্ট্রি (Print History)
                  <span className="bg-emerald-800 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-mono">
                    সর্বশেষ ৫টি রশিদ
                  </span>
                </h3>
                <p className="text-[11px] text-emerald-300">
                  বিক্রয় রশিদ সঠিকভাবে প্রিন্ট ও নথিভুক্ত হয়েছে কি না তা যাচাই করুন
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={loadPrintHistory}
                className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-800 rounded-lg transition cursor-pointer"
                title="তালিকা রিফ্রেশ করুন"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-emerald-800 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body: Last 5 Printed Receipts */}
          <div className="p-4 space-y-2.5 max-h-[440px] overflow-y-auto bg-gray-50/50">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-gray-500">
                প্রিন্ট হিস্ট্রি লোড হচ্ছে...
              </div>
            ) : records.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <FileText className="w-9 h-9 mx-auto text-gray-300 stroke-1" />
                <p className="text-xs font-medium">এখনও কোনো প্রিন্টকৃত রশিদ পাওয়া যায়নি।</p>
              </div>
            ) : (
              records.map((rec, index) => (
                <div
                  key={rec.id}
                  className="bg-white border border-gray-200 hover:border-emerald-400 rounded-xl p-3 shadow-2xs transition flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[10px] flex items-center justify-center font-mono shrink-0">
                        {index + 1}
                      </span>
                      <span className="font-mono font-bold text-xs text-emerald-950 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {rec.invoiceNo}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-teal-600" />
                        {rec.source === 'PRINT_LOG'
                          ? rec.isAutoPrint
                            ? `অটো-প্রিন্ট (${rec.paperSize})`
                            : `প্রিন্টেড (${rec.paperSize})`
                          : 'নথিভুক্ত মেমো'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-800 font-bold truncate pt-0.5">
                      <User className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">{rec.customerName}</span>
                      {rec.customerMobile && (
                        <span className="text-[11px] font-mono font-normal text-gray-500">
                          ({rec.customerMobile})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
                      <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>সময়: {formatTimestamp(rec.printedAt)}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1.5">
                    <div>
                      <div className="font-mono font-black text-sm text-emerald-900">
                        ৳ {rec.grandTotal.toLocaleString()}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          rec.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {rec.dueAmount > 0
                          ? `বকেয়া: ৳${rec.dueAmount.toLocaleString()}`
                          : 'পূর্ণ পরিশোধিত'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInspectReceipt(rec)}
                      className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-1 rounded-lg text-[10px] transition cursor-pointer"
                      title="রশিদ দেখুন ও পুনরায় প্রিন্ট করুন"
                    >
                      <Eye className="w-3 h-3 text-emerald-700" />
                      মেমো ও রি-প্রিন্ট
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-white border-t border-gray-200 flex items-center justify-between text-xs">
            <span className="text-[11px] text-gray-500">
              সর্বশেষ ৫টি প্রিন্টকৃত ও সংরক্ষিত রশিদের যাচাই তালিকা
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>

      {/* View / Reprint Cash Memo Modal */}
      {selectedTxForView && (
        <CashMemoModal
          transaction={selectedTxForView.transaction}
          items={selectedTxForView.items}
          defaultPaperSize={defaultPaperSize}
          compactView={compactView}
          onToggleCompactView={onToggleCompactView}
          shopSettings={shopSettings}
          onClose={() => {
            setSelectedTxForView(null);
            loadPrintHistory();
          }}
        />
      )}
    </>
  );
};
