const FINGERPRINT_KEY = 'queuego_device_fingerprint';

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return '';

  try {
    let fingerprint = localStorage.getItem(FINGERPRINT_KEY);
    if (!fingerprint) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        fingerprint = crypto.randomUUID();
      } else {
        // Fallback for non-secure HTTP contexts (e.g. accessing via local IP address)
        fingerprint = 'uf_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      }
      localStorage.setItem(FINGERPRINT_KEY, fingerprint);
    }
    return fingerprint;
  } catch {
    // Return a temporary session-based fingerprint if localStorage is blocked
    return 'temp_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
  }
}

export function clearDeviceFingerprint(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(FINGERPRINT_KEY);
  }
}