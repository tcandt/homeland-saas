export type NotificationSoundId = "coins" | "soft" | "alert" | "pop" | "none";

type SoundStep = {
  frequency: number;
  delay: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
};

const SOUND_LIBRARY: Record<Exclude<NotificationSoundId, "none">, SoundStep[]> = {
  coins: [
    { frequency: 880, delay: 0, duration: 0.24, volume: 0.14 },
    { frequency: 1175, delay: 0.13, duration: 0.28, volume: 0.14 },
  ],
  soft: [
    { frequency: 523, delay: 0, duration: 0.34, volume: 0.09, type: "sine" },
    { frequency: 659, delay: 0.16, duration: 0.42, volume: 0.08, type: "sine" },
  ],
  alert: [
    { frequency: 660, delay: 0, duration: 0.2, volume: 0.12, type: "triangle" },
    { frequency: 440, delay: 0.23, duration: 0.28, volume: 0.12, type: "triangle" },
  ],
  pop: [
    { frequency: 740, delay: 0, duration: 0.18, volume: 0.1, type: "sine" },
  ],
};

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ||= new AudioContextClass();
  return audioContext;
}

export async function playNotificationSound(
  soundId: NotificationSoundId,
  volume = 0.75,
) {
  if (soundId === "none") return false;
  const context = getAudioContext();
  if (!context) return false;

  try {
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") return false;

    const startAt = context.currentTime;
    SOUND_LIBRARY[soundId].forEach((step) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = startAt + step.delay;
      const peak = Math.max(0.001, Math.min(0.25, step.volume * Math.max(0.1, volume)));
      oscillator.type = step.type || "sine";
      oscillator.frequency.setValueAtTime(step.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + step.duration + 0.02);
    });
    return true;
  } catch {
    return false;
  }
}

export async function unlockNotificationAudio() {
  const context = getAudioContext();
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const SCALES = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

function readThreeDigits(value: number, full: boolean) {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const parts: string[] = [];

  if (hundreds > 0 || full) {
    parts.push(`${DIGITS[hundreds]} trăm`);
  }
  if (tens > 1) {
    parts.push(`${DIGITS[tens]} mươi`);
    if (units === 1) parts.push("mốt");
    else if (units === 4) parts.push("tư");
    else if (units === 5) parts.push("lăm");
    else if (units > 0) parts.push(DIGITS[units]);
  } else if (tens === 1) {
    parts.push("mười");
    if (units === 5) parts.push("lăm");
    else if (units > 0) parts.push(DIGITS[units]);
  } else if (units > 0) {
    if (full) parts.push(`lẻ ${DIGITS[units]}`);
    else parts.push(DIGITS[units]);
  }
  return parts.join(" ");
}

export function amountToVietnameseWords(amount: number) {
  const rounded = Math.round(Number(amount) || 0);
  if (rounded <= 0) return "không đồng";

  const groups: string[] = [];
  let remaining = rounded;
  let groupIndex = 0;
  while (remaining > 0) {
    const group = remaining % 1000;
    if (group > 0) {
      const text = readThreeDigits(group, remaining >= 1000);
      groups.unshift(`${text}${SCALES[groupIndex] ? ` ${SCALES[groupIndex]}` : ""}`);
    }
    remaining = Math.floor(remaining / 1000);
    groupIndex += 1;
  }
  return `${groups.join(" ")} đồng`;
}

export function getSpeechVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter((voice) => {
    const language = String(voice.lang || "").toLowerCase();
    return language.startsWith("vi") || language.startsWith("en");
  });
}

export function speakText(
  text: string,
  options: { volume?: number; voiceName?: string; rate?: number; pitch?: number } = {},
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";
  utterance.rate = Math.max(0.5, Math.min(2, options.rate ?? 0.95));
  utterance.pitch = Math.max(0, Math.min(2, options.pitch ?? 1));
  utterance.volume = Math.max(0.1, Math.min(1, options.volume ?? 0.75));
  const voice = getSpeechVoices().find((item) => item.name === options.voiceName);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function speakPaymentAmount(
  amount: number,
  volume = 0.75,
  options: { voiceName?: string; rate?: number; pitch?: number } = {},
) {
  return speakText(`Đã nhận được ${amountToVietnameseWords(amount)}`, {
    volume,
    ...options,
  });
}
