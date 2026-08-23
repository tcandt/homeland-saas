"use client";

const MOBILE_CREDENTIALS_KEY = "homeland:mobile-login-credentials";

type StoredMobileCredentials = {
  emailOrPhone: string;
  password: string;
  savedAt: string;
};

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  const viewportMatches = window.matchMedia("(max-width: 767px)").matches;
  const userAgentMatches = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return viewportMatches || userAgentMatches;
}

export function shouldUseMobileSessionRecovery() {
  return isMobileViewport();
}

export function saveMobileLoginCredentials(emailOrPhone: string, password: string) {
  if (typeof window === "undefined" || !shouldUseMobileSessionRecovery()) return;
  if (!emailOrPhone.trim() || !password) return;

  const payload: StoredMobileCredentials = {
    emailOrPhone: emailOrPhone.trim(),
    password,
    savedAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(MOBILE_CREDENTIALS_KEY, JSON.stringify(payload));
}

export function readMobileLoginCredentials(): StoredMobileCredentials | null {
  if (typeof window === "undefined" || !shouldUseMobileSessionRecovery()) return null;

  try {
    const raw = window.sessionStorage.getItem(MOBILE_CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMobileCredentials>;
    if (!parsed.emailOrPhone || !parsed.password) return null;
    return {
      emailOrPhone: String(parsed.emailOrPhone),
      password: String(parsed.password),
      savedAt: String(parsed.savedAt || ""),
    };
  } catch {
    return null;
  }
}

export function clearMobileLoginCredentials() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(MOBILE_CREDENTIALS_KEY);
}
