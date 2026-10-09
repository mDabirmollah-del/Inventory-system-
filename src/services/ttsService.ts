/**
 * M/S Abdus Samad Mollah - Smart Offline Agro-POS
 * Text-to-Speech (TTS) Engine using Gemini 3.8 Flash TTS
 * With offline browser Web Speech API fallback
 */

let currentAudio: HTMLAudioElement | null = null;

export interface TTSOptions {
  voiceName?: 'Kore' | 'Puck' | 'Zephyr' | 'Fenrir' | 'Charon';
  language?: 'bn-BD' | 'en-US';
  style?: string;
}

/**
 * Play speech audio for prescribed text, memo summary, or farmer dosage guidance
 */
export async function speakText(
  text: string,
  options: TTSOptions = {}
): Promise<{ success: boolean; source: 'gemini' | 'browser' | 'error' }> {
  stopSpeaking();

  if (!text || text.trim() === '') {
    return { success: false, source: 'error' };
  }

  // 1. Attempt Gemini 3.8 Flash TTS via server endpoint if online
  if (navigator.onLine) {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceName: options.voiceName || 'Kore',
          style: options.style || 'Helpful, warm agricultural specialist and shopkeeper in Bangladesh',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.audioBase64) {
          const audioUrl = `data:audio/wav;base64,${data.audioBase64}`;
          currentAudio = new Audio(audioUrl);
          await currentAudio.play();
          return { success: true, source: 'gemini' };
        }
      }
    } catch {
      // Network failure or offline, proceed to fallback
    }
  }

  // 2. Offline Fallback: HTML5 Web Speech API
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.language || 'bn-BD';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Try to find a Bengali or English voice
      const voices = window.speechSynthesis.getVoices();
      const bnVoice = voices.find((v) => v.lang.includes('bn') || v.lang.includes('BD'));
      if (bnVoice) {
        utterance.voice = bnVoice;
      }

      window.speechSynthesis.speak(utterance);
      return { success: true, source: 'browser' };
    } catch (e) {
      console.warn('Browser speech synthesis failed:', e);
    }
  }

  return { success: false, source: 'error' };
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Format a prescription for voice readout
 */
export function formatPrescriptionSpeech(prescription: {
  customerName: string;
  cropNameBangla: string;
  diagnosedIssue: string;
  adviceNotes: string;
  recommendedProducts: Array<{ banglaName: string; dosage: string; frequency: string }>;
}): string {
  const productsSummary = prescription.recommendedProducts
    .map((p, idx) => `${idx + 1}. ${p.banglaName}: মাত্রা ${p.dosage}, ${p.frequency} প্রয়োগ করুন।`)
    .join(' ');

  return `মেসার্স আব্দুস সামাদ মোল্লাহ্ কৃষি প্রেসক্রিপশন। সম্মানিত কৃষক ${prescription.customerName}। ফসলের নাম: ${prescription.cropNameBangla}। নির্ণীত রোগ বা সমস্যা: ${prescription.diagnosedIssue}। পরামর্শ: ${productsSummary} বিশেষ নির্দেশনা: ${prescription.adviceNotes}। ধন্যবাদ।`;
}

/**
 * Format a cash memo summary for audio announcement
 */
export function formatCashMemoSpeech(memo: {
  customerName: string;
  invoiceNo: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
}): string {
  let dueText = '';
  if (memo.dueAmount > 0) {
    dueText = `বকেয়া রয়েছে ${memo.dueAmount} টাকা।`;
  } else {
    dueText = `সম্পূর্ণ মূল্য পরিশোধিত হয়েছে।`;
  }
  return `মেসার্স আব্দুস সামাদ মোল্লাহ্। ক্যাশ মেমো নম্বর ${memo.invoiceNo}। গ্রাহক ${memo.customerName}। মোট মূল্য ${memo.grandTotal} টাকা। পরিশোধ করেছেন ${memo.paidAmount} টাকা। ${dueText} আমাদের দোকানে আসার জন্য ধন্যবাদ!`;
}
