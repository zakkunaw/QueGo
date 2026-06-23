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
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4 py-8">
      <div className="card w-full max-w-md space-y-6">
        {/* Header Toko */}
        <div className="text-center space-y-3">
          {!logoError && appConfig.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={appConfig.logo_url}
              alt={appConfig.nama_toko}
              className="h-14 w-auto mx-auto rounded-lg"
              onError={() => setLogoError(true)}
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-text-main">{appConfig.nama_toko}</h1>
            <p className="text-xs text-text-sub font-medium">Ambil Antrean Digital</p>
          </div>
        </div>

        {/* Notifikasi Error */}
        {error && (
          <div className="p-3.5 bg-danger-bg border border-danger-border rounded-xl text-red-danger text-xs font-semibold" role="alert">
            {error}
          </div>
        )}

        {/* Form Ambil Antrian */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="nama" className="block text-xs font-bold text-text-main mb-1.5">
              Nama Lengkap <span className="text-danger-dark">*</span>
            </label>
            <input
              type="text"
              id="nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="input-field"
              required
              autoComplete="name"
              disabled={loading}
              placeholder="Masukkan nama Anda"
            />
          </div>

          <div>
            <label htmlFor="nomor_wa" className="block text-xs font-bold text-text-main mb-1.5">
              Nomor WhatsApp (opsional)
            </label>
            <input
              type="tel"
              id="nomor_wa"
              value={nomorWa}
              onChange={(e) => setNomorWa(e.target.value)}
              className="input-field"
              autoComplete="tel"
              disabled={loading}
              placeholder="Contoh: 628123456789"
            />
            <p className="mt-1.5 text-[10px] text-text-sub font-medium">Digunakan untuk notifikasi panggilan</p>
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-4 text-base mt-2"
            disabled={loading || !nama.trim()}
          >
            {loading ? "Memproses..." : "Ambil Nomor Antrean"}
          </button>
        </form>

        <p className="text-center text-xs text-text-sub font-medium pt-4 border-t border-border-main">
          Tunjukkan halaman konfirmasi di layar setelah ini ke kasir untuk mendapatkan nomor resmi.
        </p>
      </div>
    </div>
  );
}