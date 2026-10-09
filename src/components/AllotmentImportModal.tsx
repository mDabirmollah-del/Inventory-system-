import React, { useState } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { db, generateUUID, getDeviceId } from '../db/database';
import type { InventoryItem, InventoryMovement } from '../types';

interface AllotmentImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AllotmentImportModal: React.FC<AllotmentImportModalProps> = ({ onClose, onSuccess }) => {
  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const FERTILIZER_MAPPING: Record<string, string> = {
    'ইউরিয়া': 'ইউরিয়া',
    'UREA': 'ইউরিয়া',
    'EURA': 'ইউরিয়া',
    'DAP (BADC)': 'DAP (BADC)',
    'DAP(BADC)': 'DAP (BADC)',
    'TSP (BADC)': 'TSP (BADC)',
    'TSP(BADC)': 'TSP (BADC)',
    'MOP (BADC)': 'MOP (BADC)',
    'MOP(BADC)': 'MOP (BADC)',
    'DAP (BCIC)': 'DAP (BCIC)',
    'DAP(BCIC)': 'DAP (BCIC)',
    'TSP (BCIC)': 'TSP (BCIC)',
    'TSP(BCIC)': 'TSP (BCIC)',
    'DAP (আমদানি)': 'DAP (আমদানি)',
    'TSP (আমদানি)': 'TSP (আমদানি)',
    'MOP (আমদানি)': 'MOP (আমদানি)',
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      setError('অনুগ্রহ করে অ্যালটমেন্ট টেক্সট পেস্ট করুন।');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const lines = importText.split('\n');
      const allotmentMap = new Map<string, number>();

      lines.forEach(line => {
        const trimmed = line.trim().toUpperCase();
        if (!trimmed || trimmed.startsWith('---') || trimmed.includes('ALLOTMENT')) return;

        // Try to find a number in the line
        const numMatch = trimmed.match(/(\d+)/);
        if (numMatch) {
          const qty = parseInt(numMatch[1]);
          
          // Check for matches in our mapping
          for (const [key, targetName] of Object.entries(FERTILIZER_MAPPING)) {
            if (trimmed.includes(key.toUpperCase())) {
              allotmentMap.set(targetName, qty);
              break;
            }
          }
        }
      });

      if (allotmentMap.size === 0) {
        throw new Error('কোনো বৈধ সার বা পরিমাণ খুঁজে পাওয়া যায়নি। অনুগ্রহ করে সঠিক ফরম্যাটে টেক্সট দিন। (যেমন: EURA(BCIC) 480)');
      }

      const allItems = await db.inventory.toArray();
      const now = new Date().toISOString();
      const deviceId = getDeviceId();

      await db.transaction('rw', [db.inventory, db.inventoryMovements, db.syncQueue], async () => {
        for (const item of allItems) {
          let newStock = 0;
          let matchedName = '';

          // Match by banglaName or name using the mapped values
          for (const [targetName, qty] of allotmentMap.entries()) {
            if (item.banglaName === targetName || item.name.includes(targetName) || (targetName === 'ইউরিয়া' && item.banglaName === 'ইউরিয়া')) {
              newStock = qty;
              matchedName = targetName;
              break;
            }
          }

          const diff = newStock - item.stockQuantity;
          const newVersion = (item.version || 1) + 1;

          // Update stock
          await db.inventory.update(item.id, {
            stockQuantity: newStock,
            updatedAt: now,
            version: newVersion,
            syncStatus: 'PENDING'
          });

          // Record movement
          const movement: InventoryMovement = {
            id: generateUUID(),
            productId: item.id,
            type: 'ADJUSTMENT',
            quantity: diff,
            referenceId: 'ALLOTMENT-IMPORT',
            balanceAfter: newStock,
            notes: matchedName ? `${matchedName} অক্টোবর অ্যালটমেন্ট আপডেট` : 'অ্যালটমেন্ট রিসেট (০)',
            createdAt: now,
            updatedAt: now,
            deviceId,
            version: 1,
            syncStatus: 'PENDING'
          };
          await db.inventoryMovements.add(movement);

          // Add to sync queue
          await db.syncQueue.add({
            id: generateUUID(),
            tableName: 'inventory',
            recordId: item.id,
            operation: 'UPSERT',
            payload: { ...item, stockQuantity: newStock, updatedAt: now, version: newVersion },
            status: 'PENDING',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
            deviceId,
            version: newVersion,
            syncStatus: 'PENDING'
          });
        }
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'অ্যালটমেন্ট ইমপোর্ট করতে সমস্যা হয়েছে।');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-emerald-950 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">অক্টোবর অ্যালটমেন্ট ইমপোর্ট (Bulk Import)</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-bold">সতর্কতা (Reset Warning):</p>
              <p>
                এই প্রক্রিয়াটি অ্যালটমেন্ট তালিকায় থাকা সারগুলোর স্টক আপডেট করবে এবং <strong>অন্য সকল পণ্যের স্টক ০ (শূন্য) করে দিবে।</strong> এটি করার আগে নিশ্চিত হয়ে নিন।
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              অ্যালটমেন্ট টেক্সট পেস্ট করুন:
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="ইউরিয়া ১০০&#10;DAP (BADC) ৫০&#10;TSP (BADC) ৩০..."
              className="w-full h-48 p-4 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 items-start">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              <p className="font-bold mb-1">সাপোর্টেড সারের তালিকা:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]">
                {Object.keys(FERTILIZER_MAPPING).filter(k => k.length > 3).slice(0, 10).map(name => (
                  <div key={name} className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {name}
                  </div>
                ))}
                <div className="text-[9px] text-gray-500 italic mt-1">+ আরও অনেক...</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition cursor-pointer"
          >
            বাতিল
          </button>
          <button
            onClick={handleImport}
            disabled={isProcessing}
            className="px-6 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            {isProcessing ? 'প্রসেসিং হচ্ছে...' : 'ইমপোর্ট ও আপডেট করুন'}
          </button>
        </div>
      </div>
    </div>
  );
};
