import React, { useState } from 'react';
import { Settings, Save, X, Store, User, MapPin, Tag } from 'lucide-react';
import type { ShopSettings } from '../types';

interface SettingsModalProps {
  settings: ShopSettings;
  onSave: (newSettings: ShopSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<ShopSettings>({ ...settings });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-emerald-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg">দোকানের সেটিংস কনফিগারেশন</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-4">
            {/* Shop Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" /> দোকানের পূর্ণ নাম (Full Shop Name)
              </label>
              <input
                type="text"
                required
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white"
                placeholder="মেসার্স আব্দুস সামাদ মোল্লাহ্"
              />
            </div>

            {/* Shop Name Short */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> সংক্ষিপ্ত নাম (Short Name - 4 letters)
              </label>
              <input
                type="text"
                required
                maxLength={4}
                value={formData.shopNameShort}
                onChange={(e) => setFormData({ ...formData, shopNameShort: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white uppercase"
                placeholder="সামাদ"
              />
            </div>

            {/* Owner & Manager */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> মালিকের নাম
                </label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> ম্যানেজার
                </label>
                <input
                  type="text"
                  value={formData.managerName}
                  onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white"
                />
              </div>
            </div>

            {/* Slogan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> স্লোগান/ট্যাগলাইন (Slogan/Dealer Info)
              </label>
              <input
                type="text"
                value={formData.slogan}
                onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white"
                placeholder="BCIC ও BADC ডিলার"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> ঠিকানা (Address)
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white resize-none"
                placeholder="গোবিন্দপুর বাজার, ভূঞাপুর, টাঙ্গাইল"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              বাতিল
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              সংরক্ষণ করুন
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
