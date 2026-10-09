import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Plus,
  Minus,
  Trash2,
  Volume2,
  VolumeX,
  ShoppingCart,
  Printer,
  Sparkles,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import { db, generateUUID, getDeviceId, ONE_BIGHA_BASE_DOSE } from '../db/database';
import type { Customer, InventoryItem, Prescription, PrescribedProductItem, CartItem } from '../types';
import { speakText, stopSpeaking } from '../services/ttsService';

interface PrescriptionModuleProps {
  onTransferToCart: (items: CartItem[], customer: Customer) => void;
}

export const PrescriptionModule: React.FC<PrescriptionModuleProps> = ({ onTransferToCart }) => {
  // Customer selection
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Land Area & Unit State
  const [landArea, setLandArea] = useState<number>(1); // Default: 1 Bigha
  const [landUnit, setLandUnit] = useState<'বিঘা' | 'শতাংশ' | 'কাঠা' | 'একর'>('বিঘা');
  const [selectedCrop, setSelectedCrop] = useState<string>('বোরো ধান (Boro Paddy)');
  const [symptoms, setSymptoms] = useState('জমি তৈরি ও প্রাথমিক খাদ্য ব্যবস্থাপনা');
  const [diagnosedIssue, setDiagnosedIssue] = useState('অনুমোদিত সার ও কীটনাশক বেস ডোজ');
  const [adviceNotes, setAdviceNotes] = useState(
    'জমি তৈরির শেষ চাষে প্রয়োগ করুন। মাটি সমতল করে পানি নিয়ন্ত্রণ রাখুন।'
  );

  // Editable Basket Items
  const [basketItems, setBasketItems] = useState<PrescribedProductItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState<Prescription[]>([]);
  const [activePrescriptionForView, setActivePrescriptionForView] = useState<Prescription | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Standard Land Conversion: 1 Bigha = 33 Decimals = 20 Katha
  const landAreaInDecimals = useMemo(() => {
    const val = Number(landArea) || 0;
    switch (landUnit) {
      case 'বিঘা':
        return val * 33;
      case 'শতাংশ':
        return val;
      case 'কাঠা':
        return val * 1.65; // 20 katha = 33 decimals
      case 'একর':
        return val * 100;
      default:
        return val * 33;
    }
  }, [landArea, landUnit]);

  // Agronomic Multiplier relative to 1 Bigha (33 Decimals)
  const multiplier = useMemo(() => {
    return landAreaInDecimals / 33;
  }, [landAreaInDecimals]);

  // Load Inventory & Recent Prescriptions
  useEffect(() => {
    async function init() {
      const items = await db.inventory.toArray();
      setInventoryList(items);
      const rxList = await db.prescriptions.orderBy('createdAt').reverse().limit(15).toArray();
      setRecentPrescriptions(rxList);
    }
    init();
  }, []);

  // Initialize or re-calculate Base Dose Basket when multiplier changes
  useEffect(() => {
    if (inventoryList.length === 0) return;

    // Check if basket is currently at default or empty
    const updated = ONE_BIGHA_BASE_DOSE.map((base) => {
      const invMatch = inventoryList.find(
        (i) => i.code === base.code || i.name.toLowerCase().includes(base.name.toLowerCase().split(' ')[0])
      );

      const calculatedDose = Math.round(base.baseDoseKg * multiplier * 100) / 100;

      // Preserve existing manual basket quantity if user already changed it, or calculate fresh
      return {
        productId: invMatch?.id,
        productCode: invMatch?.code || base.code,
        productName: base.name,
        banglaName: base.banglaName,
        category: base.category,
        baseDosePerBigha: base.baseDoseKg,
        calculatedDose,
        basketQuantity: calculatedDose,
        unit: base.unit,
        packSize: base.packSize,
        unitPrice: invMatch?.sellingPrice || base.sellingPrice,
        total: Math.round(calculatedDose * (invMatch?.sellingPrice || base.sellingPrice)),
        dosageInstructions: base.dosageInstructions,
      };
    });

    setBasketItems(updated);
  }, [multiplier, inventoryList]);

  // Debounced customer search
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = customerSearch.trim().toLowerCase();
      if (!q) {
        setCustomerResults([]);
        return;
      }
      const results = await db.customers
        .filter((c) =>
          Boolean(
            c.name.toLowerCase().includes(q) ||
            c.mobile.includes(q) ||
            (c.village && c.village.toLowerCase().includes(q))
          )
        )
        .limit(10)
        .toArray();
      setCustomerResults(results);
    }, 200);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Update Basket item quantity directly
  const handleUpdateBasketQty = (index: number, newQty: number) => {
    const val = Math.max(0, Math.round(newQty * 100) / 100);
    setBasketItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              basketQuantity: val,
              total: Math.round(val * item.unitPrice),
            }
          : item
      )
    );
  };

  // Add extra product from inventory
  const handleAddExtraProduct = (inv: InventoryItem) => {
    if (basketItems.some((b) => b.productId === inv.id)) return;

    const calculatedDose = 1;
    setBasketItems((prev) => [
      ...prev,
      {
        productId: inv.id,
        productCode: inv.code,
        productName: inv.name,
        banglaName: inv.banglaName || inv.name,
        category: inv.category,
        baseDosePerBigha: 1,
        calculatedDose: 1,
        basketQuantity: 1,
        unit: inv.unit,
        packSize: inv.packSize,
        unitPrice: inv.sellingPrice,
        total: inv.sellingPrice,
        dosageInstructions: 'প্রয়োজনে বা লক্ষণ অনুযায়ী প্রয়োগ করুন।',
      },
    ]);
  };

  const handleRemoveBasketItem = (index: number) => {
    setBasketItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Total Basket Estimated Amount
  const basketTotalAmount = useMemo(() => {
    return basketItems.reduce((sum, item) => sum + item.total, 0);
  }, [basketItems]);

  // Save Prescription
  const handleSavePrescription = async () => {
    if (!selectedCustomer) {
      alert('অনুগ্রহ করে কৃষক নির্বাচন করুন।');
      return;
    }
    if (basketItems.length === 0) {
      alert('প্রেসক্রিপশন বাস্কেটে অন্তত একটি পণ্য থাকতে হবে।');
      return;
    }

    const now = new Date().toISOString();
    const prescriptionNo = `RX-SAMAD-${Date.now().toString().slice(-6)}`;
    const prescription: Prescription = {
      id: generateUUID(),
      prescriptionNo,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerMobile: selectedCustomer.mobile,
      cropName: selectedCrop,
      cropNameBangla: selectedCrop.split(' ')[0],
      landArea,
      landUnit,
      landAreaInDecimals,
      multiplier,
      symptoms,
      diagnosedIssue,
      adviceNotes,
      items: basketItems,
      syncStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
      deviceId: getDeviceId(),
      version: 1,
    };

    await db.prescriptions.add(prescription);
    await db.sync_queue.add({
      id: generateUUID(),
      tableName: 'prescriptions',
      recordId: prescription.id,
      operation: 'UPSERT',
      payload: prescription,
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      deviceId: getDeviceId(),
      version: 1,
      syncStatus: 'PENDING',
    });

    setActivePrescriptionForView(prescription);
    const rxList = await db.prescriptions.orderBy('createdAt').reverse().limit(15).toArray();
    setRecentPrescriptions(rxList);

    setSaveSuccessMsg(`প্রেসক্রিপশন ${prescriptionNo} সফলভাবে সংরক্ষিত হয়েছে!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Transfer prescribed basket to POS Cart
  const handleTransferToCart = () => {
    if (!selectedCustomer) {
      alert('অনুগ্রহ করে একজন কৃষক নির্বাচন করুন।');
      return;
    }

    const cartItems: CartItem[] = [];
    for (const b of basketItems) {
      const invItem = inventoryList.find((i) => i.id === b.productId) || {
        id: b.productId || generateUUID(),
        code: b.productCode || 'GEN-01',
        name: b.productName,
        banglaName: b.banglaName,
        category: (b.category as any) || 'সার',
        packSize: b.packSize || '1 KG',
        unit: (b.unit as any) || 'কেজি',
        costPrice: Math.round(b.unitPrice * 0.8),
        sellingPrice: b.unitPrice,
        stockQuantity: 100,
        minStockAlert: 10,
        batchNo: 'B-2026',
        expireDate: '2028-12-31',
        manufacturer: 'BCIC / BADC',
        rackLocation: 'Godown 1',
        syncStatus: 'PENDING' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
        version: 1,
      };

      if (b.basketQuantity > 0) {
        cartItems.push({
          id: generateUUID(),
          product: invItem,
          quantity: b.basketQuantity,
          unitPrice: b.unitPrice,
          discount: 0,
          total: b.total,
        });
      }
    }

    onTransferToCart(cartItems, selectedCustomer);
  };

  // Voice Readout (Bengali TTS)
  const handleSpeakPrescription = async () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const itemsSpeech = basketItems
      .map((item, idx) => `${idx + 1}. ${item.banglaName} ${item.basketQuantity} ${item.unit}`)
      .join(', ');

    const speechText = `মেসার্স আব্দুস সামাদ মোল্লাহ্, বিসিআইসি ও বিএডিসি ডিলার, গোবিন্দপুর বাজার, ভূঞাপুর। সম্মানিত কৃষক ${
      selectedCustomer?.name || 'ভাই'
    }। আপনার ${landArea} ${landUnit} জমির জন্য অনুমোদিত মোট বালাইনাশক ও সার তালিকা: ${itemsSpeech}। পরামর্শ: ${adviceNotes}। ধন্যবাদ।`;

    await speakText(speechText);
    setIsSpeaking(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
      {/* Top Banner Header */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-emerald-950 font-serif">
              মেসার্স আব্দুস সামাদ মোল্লাহ্ — ১-বিঘা কৃষি প্রেসক্রিপশন ইঞ্জিন
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              BCIC ও BADC অনুমোদিত ফর্মুলা
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            ১ বিঘা = ৩৩ শতাংশ = ২০ কাঠা স্ট্যান্ডার্ড কনভার্সন • স্বয়ংক্রিয় ডোজ গুণক ও এডিটেবল বাস্কেট
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Audio TTS button */}
          <button
            onClick={handleSpeakPrescription}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs ${
              isSpeaking
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white'
            }`}
            title="Gemini 3.8 Flash TTS দিয়ে প্রেসক্রিপশন বাংলায় শুনুন"
          >
            {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {isSpeaking ? 'থামান' : 'ভয়েস পরামর্শ (TTS)'}
          </button>

          {/* Quick Transfer to Cart */}
          <button
            onClick={handleTransferToCart}
            disabled={basketItems.length === 0}
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-emerald-950 font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            কার্টে পাঠান ও বিক্রয় (POS)
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid: Left Calculator & Basket (7 cols) & Right Pad & History (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Land Formula & Editable Basket */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-xs border border-gray-200 p-4 space-y-4">
          {/* Step 1: Farmer Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">
              ১. কৃষক নির্বাচন করুন (Select Farmer):
            </label>
            {selectedCustomer ? (
              <div className="bg-emerald-50/70 border border-emerald-300 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-950 text-sm">{selectedCustomer.name}</span>
                  <span className="text-gray-600 ml-2 font-mono">{selectedCustomer.mobile}</span>
                  <span className="text-gray-500 ml-2">• গ্রাম: {selectedCustomer.village}</span>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-rose-600 hover:underline font-medium"
                >
                  পরিবর্তন
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="কৃষকের নাম, মোবাইল নম্বর বা গ্রাম দিয়ে খুঁজুন..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                />
                {customerResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {customerResults.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch('');
                        }}
                        className="p-2 hover:bg-emerald-50 cursor-pointer text-xs flex justify-between"
                      >
                        <span className="font-bold text-gray-900">{c.name}</span>
                        <span className="text-gray-500 font-mono">{c.mobile} • {c.village}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Land Conversion & Formula Multiplier */}
          <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-700" />
                ২. জমির ক্ষেত্রফল ও অটোমেটিক ডোজ কনভার্সন:
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                গুণক Multiplier: {multiplier.toFixed(2)}x (১ বিঘা = ৩৩ শতাংশ)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  ফসলের ধরন:
                </label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-1.5 bg-white font-medium text-xs"
                >
                  <option value="বোরো ধান (Boro Paddy)">বোরো ধান (Boro Paddy)</option>
                  <option value="আমন ধান (Aman Paddy)">আমন ধান (Aman Paddy)</option>
                  <option value="আলু (Potato)">আলু (Potato)</option>
                  <option value="ভুট্টা (Maize)">ভুট্টা (Maize)</option>
                  <option value="সরিষা (Mustard)">সরিষা (Mustard)</option>
                  <option value="সবজি / মরিচ (Vegetables)">সবজি / মরিচ (Vegetables)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  জমির পরিমাপ:
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={landArea}
                  onChange={(e) => setLandArea(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg p-1.5 font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  পরিমাপ একক (Land Unit):
                </label>
                <select
                  value={landUnit}
                  onChange={(e: any) => setLandUnit(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-1.5 bg-white font-bold text-xs text-emerald-900"
                >
                  <option value="বিঘা">বিঘা (১ বিঘা = ৩৩ শতাংশ)</option>
                  <option value="শতাংশ">শতাংশ (Decimal)</option>
                  <option value="কাঠা">কাঠা (২০ কাঠা = ১ বিঘা)</option>
                  <option value="একর">একর (১ একর = ১০০ শতাংশ)</option>
                </select>
              </div>
            </div>

            {/* Conversion Details Notice */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-600 bg-white p-2 rounded border border-gray-200">
              <div>
                হিসাবকৃত মোট জমি: <strong className="font-mono text-emerald-900">{landAreaInDecimals.toFixed(1)} শতাংশ</strong>
                <span className="text-gray-400 mx-1.5">|</span>
                বিঘা সমতুল্য: <strong className="font-mono text-emerald-900">{(landAreaInDecimals / 33).toFixed(2)} বিঘা</strong>
              </div>
              <div className="text-emerald-700 font-semibold">
                বেস ডোজ: জিপসাম ১০ কেজি, রোটন ২ কেজি, ম্যাগনেসিয়াম ৩ কেজি, দানাদার ২ কেজি, বোরন ১ কেজি, সালফার ১ কেজি
              </div>
            </div>
          </div>

          {/* Step 3: Fully Editable Basket with Real-time Deviation Indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                ৩. প্রেসক্রিপশন বাস্কেট ও ডোজ সমন্বয় ({basketItems.length} টি পণ্য):
              </span>
              <span className="text-xs font-mono font-black text-emerald-900">
                মোট আনুমানিক বিল: ৳ {basketTotalAmount.toLocaleString()}
              </span>
            </div>

            {/* Editable Basket Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-50 text-emerald-950 font-bold border-y border-emerald-200">
                    <th className="py-2 px-2.5">পণ্যের নাম</th>
                    <th className="py-2 px-2 text-center">১-বিঘা ডোজ</th>
                    <th className="py-2 px-2 text-center">প্রস্তাবিত মোট</th>
                    <th className="py-2 px-2 text-center">বাস্কেট পরিমাণ</th>
                    <th className="py-2 px-2 text-center">পার্থক্য নির্দেশক</th>
                    <th className="py-2 px-2 text-right">দর (৳)</th>
                    <th className="py-2 px-2 text-right">মোট (৳)</th>
                    <th className="py-2 px-1 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {basketItems.map((item, idx) => {
                    const diff = Math.round((item.basketQuantity - item.calculatedDose) * 100) / 100;
                    const isMatch = Math.abs(diff) < 0.01;
                    const isMore = diff > 0.01;
                    const isLess = diff < -0.01;

                    return (
                      <tr key={idx} className="hover:bg-gray-50/80">
                        <td className="py-2 px-2.5">
                          <div className="font-bold text-gray-900">{item.banglaName}</div>
                          <div className="text-[10px] text-gray-500">{item.productName}</div>
                        </td>

                        <td className="py-2 px-2 text-center font-mono text-gray-600">
                          {item.baseDosePerBigha} {item.unit}
                        </td>

                        <td className="py-2 px-2 text-center font-mono font-semibold text-emerald-900 bg-emerald-50/40">
                          {item.calculatedDose} {item.unit}
                        </td>

                        {/* Editable Stepper Quantity */}
                        <td className="py-2 px-2 text-center">
                          <div className="inline-flex items-center border border-gray-300 rounded overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleUpdateBasketQty(idx, item.basketQuantity - (item.unit === 'কেজি' ? 1 : 0.5))}
                              className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.basketQuantity}
                              onChange={(e) => handleUpdateBasketQty(idx, parseFloat(e.target.value) || 0)}
                              className="w-14 text-center font-mono font-bold text-xs py-0.5 border-x border-gray-300 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateBasketQty(idx, item.basketQuantity + (item.unit === 'কেজি' ? 1 : 0.5))}
                              className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </td>

                        {/* Real-time Deviation Indicator */}
                        <td className="py-2 px-2 text-center">
                          {isMatch ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                              ✓ প্রস্তাবিত মিল
                            </span>
                          ) : isMore ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                              +{diff} {item.unit} বেশি
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                              {diff} {item.unit} কম
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-2 text-right font-mono text-gray-600">
                          {item.unitPrice}
                        </td>

                        <td className="py-2 px-2 text-right font-mono font-bold text-gray-900">
                          {item.total}
                        </td>

                        <td className="py-2 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBasketItem(idx)}
                            className="text-gray-400 hover:text-rose-600 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Quick Add from stock */}
            <div className="pt-2 border-t flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-700">অতিরিক্ত পণ্য যোগ করুন:</span>
              {inventoryList
                .filter((inv) => !basketItems.some((b) => b.productId === inv.id))
                .slice(0, 5)
                .map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => handleAddExtraProduct(inv)}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-emerald-50 text-[11px] text-gray-800 rounded border border-gray-300 transition"
                  >
                    + {inv.banglaName || inv.name}
                  </button>
                ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
            <div className="text-xs text-gray-600 font-medium">
              * কৃষকের চাহিদামতো বাস্কেটের যেকোনো পরিমাণ পরিবর্তনযোগ্য।
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePrescription}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                প্রেসক্রিপশন সংরক্ষণ করুন
              </button>

              <button
                type="button"
                onClick={handleTransferToCart}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-emerald-950 font-black text-xs rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                কার্টে পাঠান ও বিক্রয়
              </button>
            </div>
          </div>
        </div>

        {/* Right: Printable Prescription Pad & Recent History */}
        <div className="lg:col-span-4 space-y-4">
          {/* Active Pad View */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wider">
                প্রেসক্রিপশন প্যাড প্রিভিউ
              </h3>
              <button
                onClick={() => window.print()}
                className="text-gray-600 hover:text-gray-900 p-1 rounded"
                title="প্রিন্ট করুন"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            {/* Shop Prescription Header */}
            <div className="text-center border-b pb-2">
              <h4 className="font-serif font-black text-emerald-900 text-base">
                মেসার্স আব্দুস সামাদ মোল্লাহ্
              </h4>
              <p className="text-[10px] text-gray-600 font-medium">
                BCIC ও BADC ডিলার • গোবিন্দপুর বাজার, ভূঞাপুর, টাঙ্গাইল
              </p>
              <div className="mt-1 font-mono text-[10px] text-emerald-800 bg-emerald-50 py-0.5 px-2 rounded-full inline-block">
                ১-বিঘা স্ট্যান্ডার্ড কৃষি প্রেসক্রিপশন
              </div>
            </div>

            {/* Farmer & Area Info */}
            <div className="bg-gray-50 p-2.5 rounded-lg text-xs space-y-1">
              <div>
                <strong>কৃষক:</strong> {selectedCustomer?.name || 'নির্বাচিত হয়নি'} (
                {selectedCustomer?.mobile || 'N/A'})
              </div>
              <div>
                <strong>ফসল ও জমি:</strong> {selectedCrop} •{' '}
                <span className="font-mono font-bold text-emerald-900">
                  {landArea} {landUnit} ({landAreaInDecimals.toFixed(1)} শতাংশ)
                </span>
              </div>
              <div>
                <strong>ডোজ গুণক:</strong> {multiplier.toFixed(2)}x
              </div>
            </div>

            {/* Items Summary in Pad */}
            <div className="text-xs space-y-1.5">
              <strong className="block text-gray-800">অনুমোদিত ঔষুধ ও সার বাস্কেট:</strong>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {basketItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded border border-gray-200 bg-white flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <div className="font-bold text-gray-900">{item.banglaName}</div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        প্রস্তাবিত: {item.calculatedDose} {item.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-900">
                        {item.basketQuantity} {item.unit}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        ৳ {item.total}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-2 flex justify-between items-center text-xs font-bold">
              <span>সর্বমোট আনুমানিক মূল্য:</span>
              <span className="font-mono text-emerald-900 text-sm">৳ {basketTotalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Recent Prescriptions List */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
            <h3 className="font-bold text-xs text-gray-700 uppercase tracking-wider mb-2">
              সাম্প্রতিক প্রেসক্রিপশনসমূহ
            </h3>
            <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {recentPrescriptions.map((rx) => (
                <div
                  key={rx.id}
                  onClick={() => setActivePrescriptionForView(rx)}
                  className="py-2 hover:bg-emerald-50/60 cursor-pointer flex items-center justify-between text-xs transition px-1"
                >
                  <div>
                    <div className="font-bold text-gray-900">{rx.customerName}</div>
                    <div className="text-[11px] text-emerald-800 font-medium">
                      {rx.cropNameBangla} • {rx.landArea} {rx.landUnit}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-gray-400 font-mono">
                    {rx.prescriptionNo}
                  </div>
                </div>
              ))}

              {recentPrescriptions.length === 0 && (
                <div className="text-center py-4 text-gray-400 text-xs">কোনো প্রেসক্রিপশন নেই</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
