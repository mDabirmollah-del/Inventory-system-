import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  CheckCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { db, generateUUID, getDeviceId } from '../db/database';
import type { InventoryItem, ProductCategory, InventoryMovement } from '../types';
import { AllotmentImportModal } from './AllotmentImportModal';

export const InventoryModule: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('সব');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAllotmentModal, setShowAllotmentModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Stock Adjustment modal
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'PURCHASE' | 'ADJUSTMENT'>('PURCHASE');
  const [adjustNote, setAdjustNote] = useState('');

  // Form states for Add/Edit
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [banglaName, setBanglaName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('কীটনাশক');
  const [packSize, setPackSize] = useState('100 gm');
  const [unit, setUnit] = useState<any>('প্যাকেট');
  const [costPrice, setCostPrice] = useState<number>(100);
  const [sellingPrice, setSellingPrice] = useState<number>(130);
  const [stockQuantity, setStockQuantity] = useState<number>(50);
  const [minStockAlert, setMinStockAlert] = useState<number>(10);
  const [batchNo, setBatchNo] = useState('B-2026');
  const [expireDate, setExpireDate] = useState('2028-12-31');
  const [manufacturer, setManufacturer] = useState('');
  const [rackLocation, setRackLocation] = useState('Rack A1');
  const [genericName, setGenericName] = useState('');

  const loadInventory = async () => {
    const list = await db.inventory.toArray();
    setItems(list);
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchCat = categoryFilter === 'সব' || item.category === categoryFilter;
    const matchQ =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.banglaName && item.banglaName.toLowerCase().includes(q)) ||
      (item.genericName && item.genericName.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  // Handle Save (Add or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const deviceId = getDeviceId();

    if (editingItem) {
      // Update
      const updatedVersion = (editingItem.version || 1) + 1;
      const updated: InventoryItem = {
        ...editingItem,
        code,
        name,
        banglaName,
        category,
        packSize,
        unit,
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        minStockAlert: Number(minStockAlert),
        batchNo,
        expireDate,
        manufacturer,
        rackLocation,
        genericName,
        updatedAt: now,
        version: updatedVersion,
        syncStatus: 'PENDING',
      };

      await db.inventory.put(updated);
      await db.syncQueue.add({
        id: generateUUID(),
        tableName: 'inventory',
        recordId: updated.id,
        operation: 'UPSERT',
        payload: updated,
        status: 'PENDING',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: updatedVersion,
        syncStatus: 'PENDING',
      });
    } else {
      // Create new
      const newItem: InventoryItem = {
        id: generateUUID(),
        code: code || `AGRO-${Date.now().toString().slice(-4)}`,
        name,
        banglaName: banglaName || name,
        category,
        packSize,
        unit,
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        stockQuantity: Number(stockQuantity),
        minStockAlert: Number(minStockAlert),
        batchNo,
        expireDate,
        manufacturer,
        rackLocation,
        genericName,
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      };

      await db.inventory.add(newItem);
      await db.syncQueue.add({
        id: generateUUID(),
        tableName: 'inventory',
        recordId: newItem.id,
        operation: 'UPSERT',
        payload: newItem,
        status: 'PENDING',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
        syncStatus: 'PENDING',
      });
    }

    await loadInventory();
    closeModal();
  };

  // Handle Stock Adjustment
  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    const delta = parseInt(adjustQty);
    if (!delta || delta === 0) return;

    const now = new Date().toISOString();
    const deviceId = getDeviceId();
    const newStock = adjustingItem.stockQuantity + delta;
    const newVersion = (adjustingItem.version || 1) + 1;

    await db.transaction('rw', [db.inventory, db.inventoryMovements, db.syncQueue], async () => {
      await db.inventory.update(adjustingItem.id, {
        stockQuantity: newStock,
        updatedAt: now,
        version: newVersion,
        syncStatus: 'PENDING',
      });

      const movement: InventoryMovement = {
        id: generateUUID(),
        productId: adjustingItem.id,
        type: adjustType,
        quantity: delta,
        referenceId: `STOCK-${adjustType}`,
        balanceAfter: newStock,
        notes: adjustNote || `${adjustType} স্টকে সংযোজন`,
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
        syncStatus: 'PENDING',
      };
      await db.inventoryMovements.add(movement);

      await db.syncQueue.add({
        id: generateUUID(),
        tableName: 'inventory',
        recordId: adjustingItem.id,
        operation: 'UPSERT',
        payload: { ...adjustingItem, stockQuantity: newStock, updatedAt: now, version: newVersion },
        status: 'PENDING',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: newVersion,
        syncStatus: 'PENDING',
      });
    });

    await loadInventory();
    setAdjustingItem(null);
    setAdjustQty('');
    setAdjustNote('');
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setBanglaName(item.banglaName || '');
    setCategory(item.category);
    setPackSize(item.packSize);
    setUnit(item.unit);
    setCostPrice(item.costPrice);
    setSellingPrice(item.sellingPrice);
    setStockQuantity(item.stockQuantity);
    setMinStockAlert(item.minStockAlert);
    setBatchNo(item.batchNo);
    setExpireDate(item.expireDate);
    setManufacturer(item.manufacturer);
    setRackLocation(item.rackLocation);
    setGenericName(item.genericName || '');
    setShowAddModal(true);
  };

  const closeModal = () => {
    setEditingItem(null);
    setShowAddModal(false);
    setCode('');
    setName('');
    setBanglaName('');
    setGenericName('');
    setManufacturer('');
  };

  const categories = ['সব', 'সার', 'কীটনাশক', 'ছত্রাকনাশক', 'আগাছানাশক', 'অণুখাদ্য', 'বীজ'];

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-base text-emerald-950 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-700" />
            কৃষি ইনভেন্টরি ও মজুত ব্যবস্থাপনা (Inventory & Stock)
          </h2>
          <p className="text-xs text-gray-600">
            রিয়েল-টাইম স্টক আপডেট, ব্যাচ ট্র্যাকিং, মেয়াদ ও কম মজুত সতর্কতা
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAllotmentModal(true)}
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <FileSpreadsheet className="w-4 h-4" />
            অ্যালটমেন্ট ইমপোর্ট
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            নতুন পণ্য যোগ করুন
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="পণ্যের কোড, বাংলা নাম, ব্র্যান্ড বা উপাদান দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  categoryFilter === c
                    ? 'bg-emerald-800 text-white font-semibold shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-emerald-950 text-white font-bold border-b border-emerald-900">
                <th className="py-2.5 px-3">কোড</th>
                <th className="py-2.5 px-3">পণ্যের নাম ও বিবরণ</th>
                <th className="py-2.5 px-3">ক্যাটাগরি</th>
                <th className="py-2.5 px-3">প্যাক সাইজ</th>
                <th className="py-2.5 px-3 text-right">কেনা দর</th>
                <th className="py-2.5 px-3 text-right">বিক্রয় দর</th>
                <th className="py-2.5 px-3 text-center">বর্তমান মজুত</th>
                <th className="py-2.5 px-3 text-center">র‍্যাক</th>
                <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const isLow = item.stockQuantity <= item.minStockAlert;
                const isOut = item.stockQuantity <= 0;

                return (
                  <tr key={item.id} className="hover:bg-emerald-50/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-gray-700">{item.code}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-gray-900">{item.banglaName || item.name}</div>
                      <div className="text-[11px] text-gray-500">
                        {item.genericName || item.name} • {item.manufacturer}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">{item.packSize}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-600">৳ {item.costPrice}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-900">
                      ৳ {item.sellingPrice}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-bold text-xs ${
                          isOut
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : isLow
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.stockQuantity} {item.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-600">{item.rackLocation}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setAdjustingItem(item);
                            setAdjustQty('');
                          }}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[11px] font-medium"
                          title="মজুত বৃদ্ধি বা সমন্বয়"
                        >
                          স্টক ইন
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-emerald-800"
                          title="সম্পাদনা"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    কোনো পণ্য পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-gray-200 overflow-hidden">
            <div className="bg-emerald-950 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">মজুত বৃদ্ধি / স্টক সমন্বয়</h3>
              <button onClick={() => setAdjustingItem(null)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStockAdjustment} className="p-5 space-y-3 text-xs">
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <div className="font-bold text-gray-900">
                  {adjustingItem.banglaName || adjustingItem.name}
                </div>
                <div className="text-gray-500">
                  বর্তমান স্টক: <strong>{adjustingItem.stockQuantity} {adjustingItem.unit}</strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">কাজের ধরন:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('PURCHASE')}
                    className={`py-1 rounded font-bold border transition ${
                      adjustType === 'PURCHASE'
                        ? 'bg-emerald-800 text-white'
                        : 'bg-white text-gray-700'
                    }`}
                  >
                    নতুন ক্রয় (Purchase)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADJUSTMENT')}
                    className={`py-1 rounded font-bold border transition ${
                      adjustType === 'ADJUSTMENT'
                        ? 'bg-emerald-800 text-white'
                        : 'bg-white text-gray-700'
                    }`}
                  >
                    সমন্বয় (Adjustment)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  যোগ করার পরিমাণ ({adjustingItem.unit}):
                </label>
                <input
                  type="number"
                  required
                  placeholder="যেমন: ৫০"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">রেফারেন্স / নোট:</label>
                <input
                  type="text"
                  placeholder="যেমন: চালান নং ৫৪৬"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-1.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-3 py-1.5 border border-gray-300 rounded"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded shadow-xs"
                >
                  মজুত আপডেট করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden">
            <div className="bg-emerald-950 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingItem ? 'পণ্য সম্পাদনা (Edit Product)' : 'নতুন কৃষি পণ্য যোগ (Add Product)'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-3 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">পণ্য কোড (SKU)</label>
                  <input
                    type="text"
                    placeholder="FERT-001"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">ক্যাটাগরি *</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 bg-white"
                  >
                    {categories.filter((c) => c !== 'সব').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">বাংলা নাম (Bangla Name) *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ইউরিয়া সার"
                  value={banglaName}
                  onChange={(e) => setBanglaName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-1.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">ইংরেজি / ব্র্যান্ড নাম</label>
                <input
                  type="text"
                  placeholder="যেমন: Urea Fertilizer 46%"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">প্যাক সাইজ</label>
                  <input
                    type="text"
                    placeholder="যেমন: 50 KG বা 100 gm"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-1.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">একক (Unit)</label>
                  <select
                    value={unit}
                    onChange={(e: any) => setUnit(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 bg-white"
                  >
                    {['বস্তা', 'প্যাকেট', 'পিস', 'কেজি', 'গ্রাম', 'লিটার', 'মিলি'].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">কেনা দর (Cost ৳) *</label>
                  <input
                    type="number"
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">বিক্রয় দর (Selling ৳) *</label>
                  <input
                    type="number"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono font-bold text-emerald-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editingItem && (
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">প্রারম্ভিক মজুত</label>
                    <input
                      type="number"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">কম মজুত সতর্কবার্তা</label>
                  <input
                    type="number"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">কোম্পানি / প্রস্তুতকারক</label>
                  <input
                    type="text"
                    placeholder="যেমন: Syngenta, BCIC"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-1.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">দোকানের র‍্যাক অবস্থান</label>
                  <input
                    type="text"
                    placeholder="যেমন: Rack B1"
                    value={rackLocation}
                    onChange={(e) => setRackLocation(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-1.5 border border-gray-300 rounded text-gray-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded shadow-xs"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allotment Import Modal */}
      {showAllotmentModal && (
        <AllotmentImportModal
          onClose={() => setShowAllotmentModal(false)}
          onSuccess={() => {
            loadInventory();
            alert('অক্টোবর অ্যালটমেন্ট সফলভাবে আপডেট করা হয়েছে!');
          }}
        />
      )}
    </div>
  );
};
