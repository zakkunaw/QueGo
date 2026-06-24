"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

export default function LandingPage() {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [nomorWa, setNomorWa] = useState("");
  const [logoError, setLogoError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Request Notification Permission if supported (Non-blocking fallback for mobile compatibility)
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch (err) {
          console.error("Failed to request notification permission:", err);
        }
      }
    }

    setLoading(true);

    // Pre-initialize and unlock global AudioContext using this button gesture
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        (window as unknown as { __queuego_audio_context: AudioContext }).__queuego_audio_context = ctx;
        if (ctx.state === "suspended") {
          ctx.resume();
        }
      }
    } catch (err) {
      console.error("Failed to pre-initialize audio context:", err);
    }

    const deviceFingerprint = getDeviceFingerprint();
    const supabase = createClient();

    // Pastikan user terautentikasi secara anonim untuk mendukung RLS
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      await supabase.auth.signInAnonymously();
    }

    const { data, error: submitError } = await supabase.rpc("submit_antrian", {
      p_nama_customer: nama.trim(),
      p_nomor_wa: nomorWa.trim() || null,
      p_device_fingerprint: deviceFingerprint,
    });

    setLoading(false);

    if (submitError) {
      setError(submitError.message || "Gagal mendaftar antrian");
      return;
    }

    if (data?.error) {
      setError(data.error);
      return;
    }

    if (data?.success && data.data?.id) {
      router.push(`/status/${data.data.id}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4 py-8 relative overflow-hidden">
      {/* Background ambient glow circles */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-blue-500/5 blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md flex flex-col items-center relative z-10 space-y-6">
        {/* Step Flow Guide */}
        <div className="w-full px-2">
          <div className="flex items-start justify-between w-full">
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-1.5 z-10 bg-transparent w-20 shrink-0">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-bg-dark text-white shadow-sm shrink-0">
                1
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-text-main text-center leading-tight">Isi Data</span>
            </div>

            {/* Line 1 */}
            <div className="flex-1 h-[2px] bg-border-main mt-3.5"></div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-1.5 z-10 bg-transparent w-20 shrink-0">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-white border border-border-main text-text-muted shadow-sm shrink-0">
                2
              </div>
              <span className="text-[9px] md:text-[10px] font-semibold text-text-sub text-center leading-tight">Konfirmasi Kasir</span>
            </div>

            {/* Line 2 */}
            <div className="flex-1 h-[2px] bg-border-main mt-3.5"></div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-1.5 z-10 bg-transparent w-20 shrink-0">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-white border border-border-main text-text-muted shadow-sm shrink-0">
                3
              </div>
              <span className="text-[9px] md:text-[10px] font-semibold text-text-sub text-center leading-tight">Pantau Antrean</span>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="card w-full space-y-6 bg-white/95 backdrop-blur-sm border border-border-main rounded-[24px]">
          {/* Header Toko */}
          <div className="text-center space-y-3 flex flex-col items-center">
            {!logoError && appConfig.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={appConfig.logo_url}
                alt={appConfig.nama_toko}
                className="h-14 w-auto rounded-xl shadow-sm"
                onError={() => setLogoError(true)}
              />
            )}
            <div>
              <h1 className="text-xl font-bold text-text-main">{appConfig.nama_toko}</h1>
              <p className="text-xs text-text-sub font-semibold mt-0.5">Silakan isi formulir di bawah ini</p>
            </div>
          </div>

          {/* Notifikasi Error */}
          {error && (
            <div className="p-3.5 bg-danger-bg border border-danger-border rounded-xl text-red-danger text-xs font-semibold" role="alert">
              {error}
            </div>
          )}

          {/* Form Ambil Antrian */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="nama" className="block text-xs font-bold text-text-main mb-1.5">
                Nama Lengkap <span className="text-danger-dark">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 flex items-center justify-center text-text-muted pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <input
                  type="text"
                  id="nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="input-field pl-11!"
                  required
                  autoComplete="name"
                  disabled={loading}
                  placeholder="Masukkan nama Anda"
                />
              </div>
            </div>

            <div>
              <label htmlFor="nomor_wa" className="block text-xs font-bold text-text-main mb-1.5">
                Nomor WhatsApp (opsional)
              </label>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 flex items-center justify-center text-text-muted pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 448 512" className="shrink-0"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                </div>
                <input
                  type="tel"
                  id="nomor_wa"
                  value={nomorWa}
                  onChange={(e) => setNomorWa(e.target.value)}
                  className="input-field pl-11!"
                  autoComplete="tel"
                  disabled={loading}
                  placeholder="Contoh: 628123456789"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-text-sub font-semibold">Digunakan untuk notifikasi panggilan WhatsApp</p>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-4 text-base mt-2 flex items-center justify-center"
              disabled={loading || !nama.trim()}
            >
              {loading ? "Memproses..." : "Ambil Nomor Antrean"}
            </button>
          </form>

          <div className="bg-bg-light border border-border-main rounded-xl p-3.5 text-center text-xs text-text-sub font-semibold">
            Tunjukkan halaman konfirmasi di layar setelah ini ke kasir untuk mendapatkan nomor resmi.
          </div>
        </div>
      </div>
    </div>
  );
}