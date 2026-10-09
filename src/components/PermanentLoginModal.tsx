import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  UserCheck,
  CheckCircle2,
  X,
  Cloud,
  LogOut,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  getSavedPermanentProfile,
  loginWithPermanentId,
  googleSignIn,
} from '../services/authService';

interface PermanentLoginModalProps {
  currentUser: User | null;
  onLoginSuccess: (user: User, message: string) => void;
  onSignOut: () => void;
  onClose: () => void;
}

export const PermanentLoginModal: React.FC<PermanentLoginModalProps> = ({
  currentUser,
  onLoginSuccess,
  onSignOut,
  onClose,
}) => {
  const savedProfile = getSavedPermanentProfile();
  const [loginId, setLoginId] = useState(savedProfile?.loginId || 'SAMAD-786');
  const [displayName, setDisplayName] = useState(
    savedProfile?.displayName || 'মেসার্স আব্দুস সামাদ মোল্লাহ্'
  );
  const [email, setEmail] = useState(
    savedProfile?.email || 'mssamadmollah@gmail.com'
  );
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSavePermanentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim()) {
      setErrorMsg('অনুগ্রহ করে একটি লগইন আইডি (Login ID) লিখুন।');
      return;
    }

    const userObj = loginWithPermanentId({
      loginId: loginId.trim(),
      displayName: displayName.trim() || 'মেসার্স আব্দুস সামাদ মোল্লাহ্',
      email: email.trim() || 'mssamadmollah@gmail.com',
    });

    onLoginSuccess(
      userObj,
      `স্থায়ী লগইন আইডি (${loginId.trim()}) সফলভাবে সক্রিয় ও সংরক্ষিত হয়েছে!`
    );
    onClose();
  };

  const handleGoogleConnect = async () => {
    setErrorMsg(null);
    setIsConnectingGoogle(true);
    try {
      const result = await googleSignIn();
      if (result) {
        onLoginSuccess(
          result.user,
          'Google অ্যাকাউন্ট ও স্থায়ী লগইন আইডি সফলভাবে সংযুক্ত হয়েছে!'
        );
        onClose();
      }
    } catch (err: any) {
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        setErrorMsg('গুগল পপআপ বন্ধ করা হয়েছে। আপনি নিচের বাটনে ক্লিক করে সরাসরি স্থায়ী আইডি লগইন করতে পারেন।');
      } else {
        // Fallback to permanent ID login if popup is blocked by browser/iframe
        const fallbackUser = loginWithPermanentId({
          loginId: loginId.trim() || 'SAMAD-786',
          displayName: displayName.trim() || 'মেসার্স আব্দুস সামাদ মোল্লাহ্',
          email: email.trim() || 'mssamadmollah@gmail.com',
        });
        onLoginSuccess(
          fallbackUser,
          `স্থায়ী আইডি (${loginId.trim() || 'SAMAD-786'}) দিয়ে লগইন সম্পন্ন হয়েছে!`
        );
        onClose();
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden text-gray-900">
        {/* Header */}
        <div className="bg-emerald-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800 rounded-lg text-amber-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                ওয়ান-টাইম স্থায়ী আইডি লগইন (Permanent ID)
              </h3>
              <p className="text-[11px] text-emerald-300">
                একবার লগইন করলে আর বারবার লগইন করতে হবে না
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSavePermanentLogin} className="p-5 space-y-4 text-xs">
          {/* Status Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900 space-y-0.5">
              <div className="font-bold">
                {currentUser
                  ? 'আপনার স্থায়ী লগইন আইডি বর্তমানে সক্রিয় আছে'
                  : 'ওয়ান-টাইম পার্মানেন্ট লগইন সিস্টেম'}
              </div>
              <p className="text-emerald-700">
                এই আইডি ব্রাউজারে স্থায়ীভাবে সংরক্ষিত থাকবে। পেজ রিলোড বা অফলাইন মোডেও কখনো অটো-লগআউট হবে না।
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-[11px]">
              {errorMsg}
            </div>
          )}

          {/* Permanent Login ID Field */}
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-gray-800 mb-1">
                স্থায়ী ডিলার লগইন আইডি (Permanent Login ID) *
              </label>
              <input
                type="text"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="যেমন: SAMAD-786"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono font-bold text-sm text-emerald-950 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-800 mb-1">
                প্রতিষ্ঠান / ব্যবহারকারীর নাম (Dealer Name)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="মেসার্স আব্দুস সামাদ মোল্লাহ্"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-800 mb-1">
                ইমেইল আইডি (Permanent Email ID)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mssamadmollah@gmail.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Primary Action: 1-Click Permanent ID Login */}
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-amber-300" />
            {currentUser
              ? 'স্থায়ী লগইন আইডি আপডেট ও সংরক্ষণ করুন'
              : 'স্থায়ীভাবে লগইন করুন (One-Time Permanent Login)'}
          </button>

          {/* Secondary Action: Optional Google Workspace Sync Connect */}
          <div className="pt-2 border-t border-gray-200 space-y-2">
            <div className="text-[11px] text-gray-500 text-center">
              গুগল শিটস ও ড্রাইভ ক্লাউড সিঙ্কের জন্য (ঐচ্ছিক):
            </div>
            <button
              type="button"
              onClick={handleGoogleConnect}
              disabled={isConnectingGoogle}
              className="w-full py-2 px-3 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <Cloud className="w-4 h-4 text-emerald-700" />
              {isConnectingGoogle
                ? 'সংযুক্ত হচ্ছে...'
                : 'Google অ্যাকাউন্ট সংযুক্ত করুন (Sheets & Drive)'}
            </button>
          </div>

          {/* Footer / Logout if currently logged in */}
          {currentUser && (
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                স্থায়ী সেশন সক্রিয়
              </span>
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  onClose();
                }}
                className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-bold text-[11px] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                লগআউট করুন
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
