"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { appConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase";
import type { QueueItem, QueueStatus } from "@/lib/types";

const STATUS_MESSAGES: Record<QueueStatus, { title: string; description: string; icon: string }> = {
  menunggu_konfirmasi: {
    title: "Permintaan Terkirim",
    description: "Tunjukkan halaman ini ke kasir untuk mendapatkan nomor antrian resmi.",
    icon: "🕐",
  },
  aktif: {
    title: "Antrian Aktif",
    description: "",
    icon: "✅",
  },
  dipanggil: {
    title: "Dipanggil!",
    description: "Silakan menuju ke loket / kasir.",
    icon: "📢",
  },
  selesai: {
    title: "Selesai",
    description: "Terima kasih, antrian Anda telah selesai.",
    icon: "✓",
  },
  expired: {
    title: "Permintaan Kedaluwarsa",
    description: "Silakan scan ulang QR code di lokasi untuk mengambil antrian baru.",
    icon: "✕",
  },
};

function playChimeOnContext(ctx: AudioContext) {
  try {
    // Tone 1: Ding (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.25, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Tone 2: Dong (A4)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(440.00, ctx.currentTime + 0.2);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start();
    osc1.stop(ctx.currentTime + 0.4);
    
    osc2.start(ctx.currentTime + 0.2);
    osc2.stop(ctx.currentTime + 0.75);

    // Vibrate device if supported on mobile
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch (e) {
    console.error("Gagal memutar audio:", e);
  }
}

export default function StatusPage() {
  const params = useParams();
  const supabase = createClient();
  const [queue, setQueue] = useState<QueueItem | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<QueueItem | null>(null);
  const chimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const id = Number(params.id);

  // Sync queueRef with latest state to prevent stale closures
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const playChime = () => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        playChimeOnContext(ctx);
        speakCall();
      });
    } else {
      playChimeOnContext(ctx);
      speakCall();
    }
  };

  const speakCall = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech to avoid overlapping
    window.speechSynthesis.cancel();
    
    const nomor = queueRef.current?.nomor;
    if (!nomor) return;
    
    const text = `Nomor antrean ${nomor}, silakan menuju ke kasir.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 0.95; // Kecepatan natural
    utterance.pitch = 1.05; // Pitch sedikit tinggi menyerupai suara wanita
    
    const voices = window.speechSynthesis.getVoices();
    const indVoice = voices.find(v => v.lang.includes("id") || v.lang.startsWith("id-"));
    if (indVoice) {
      utterance.voice = indVoice;
    }
    
    // Jeda singkat setelah bel berbunyi
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 600);
  };

  const startChimeLoop = () => {
    if (chimeIntervalRef.current) return;
    
    // Play immediately
    playChime();
    
    // Loop chime sound and voice announcement every 8 seconds
    chimeIntervalRef.current = setInterval(() => {
      playChime();
    }, 8000);
  };

  const stopChimeLoop = () => {
    if (chimeIntervalRef.current) {
      clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const unlockAudio = () => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass && !audioContextRef.current) {
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      (window as unknown as { __queuego_audio_context: AudioContext }).__queuego_audio_context = ctx;
      if (ctx.state === "suspended") {
        ctx.resume().then(() => {
          setAudioUnlocked(true);
          // If queue is already called on load, start loop immediately
          if (queueRef.current?.status === "dipanggil") {
            stopChimeLoop();
            startChimeLoop();
          }
        });
      } else {
        setAudioUnlocked(true);
        if (queueRef.current?.status === "dipanggil") {
          stopChimeLoop();
          startChimeLoop();
        }
      }
    }
  };

  useEffect(() => {
    // Check if we have an already unlocked AudioContext carried over from landing page
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass && (window as unknown as { __queuego_audio_context?: AudioContext }).__queuego_audio_context) {
      const ctx = (window as unknown as { __queuego_audio_context: AudioContext }).__queuego_audio_context;
      audioContextRef.current = ctx;
      if (ctx.state === "running") {
        Promise.resolve().then(() => {
          setAudioUnlocked(true);
          if (queueRef.current?.status === "dipanggil") {
            stopChimeLoop();
            startChimeLoop();
          }
        });
      }
    }

    const handleInteraction = () => {
      unlockAudio();
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      if (chimeIntervalRef.current) {
        clearInterval(chimeIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchQueue = async () => {
      // Pastikan user terautentikasi secara anonim untuk mendukung RLS
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        await supabase.auth.signInAnonymously();
      }

      const { data } = await supabase
        .from("queue")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setQueue(data as unknown as QueueItem);
        if (data.status === "dipanggil") {
          startChimeLoop();
        }
        if (data.status === "aktif") {
          const { count } = await supabase
            .from("queue")
            .select("*", { count: "exact", head: true })
            .eq("tanggal_antrian", data.tanggal_antrian)
            .eq("status", "aktif")
            .lt("nomor", data.nomor);
          setActiveCount(count || 0);
        }
      }
      setLoading(false);
    };

    fetchQueue();

    const channel = supabase
      .channel(`queue-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newData = payload.new as QueueItem | null;
          if (newData) {
            const oldStatus = queueRef.current?.status;
            if (newData.status === "dipanggil" && oldStatus !== "dipanggil") {
              startChimeLoop();
            } else if (newData.status !== "dipanggil") {
              stopChimeLoop();
            }
            setQueue(newData);
            if (newData.status === "aktif") {
              supabase
                .from("queue")
                .select("*", { count: "exact", head: true })
                .eq("tanggal_antrian", newData.tanggal_antrian)
                .eq("status", "aktif")
                .lt("nomor", newData.nomor)
                .then(({ count }) => setActiveCount(count || 0));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Memuat...</div>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card text-center max-w-sm mx-4">
          <div className="text-4xl mb-4">❓</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Antrian Tidak Ditemukan</h2>
          <p className="text-gray-500 text-sm">Silakan scan ulang QR code untuk mengambil antrian.</p>
        </div>
      </div>
    );
  }

  const msg = STATUS_MESSAGES[queue.status];

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
              className="h-12 w-auto mx-auto rounded-lg"
              onError={() => setLogoError(true)}
            />
          )}
          <div>
            <h1 className="text-base font-bold text-text-main">{appConfig.nama_toko}</h1>
            <p className="text-xs text-text-sub font-medium">Status Antrean Pribadi</p>
          </div>
        </div>

        {/* Kotak Konten Utama Status */}
        <div className="bg-bg-surface border border-border-main rounded-2xl p-6 text-center space-y-6">
          
          {/* Audio Notification Status Indicator */}
          <div className="flex justify-center select-none">
            {audioUnlocked ? (
              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-bold bg-success-bg text-success-text border border-success-border">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                Notifikasi Suara Aktif
              </span>
            ) : (
              <button
                onClick={unlockAudio}
                className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-bold bg-warning-bg text-warning-text border border-warning-border animate-pulse cursor-pointer transition-all duration-150 active:scale-95"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M13.73 21a2 2 0 0 1-3.46 0M18.8 4A10.05 10.05 0 0 1 22 12M15 8.87a6.2 6.2 0 0 1 1 3.13M3 3l18 18M9 9v8H4v-6h4.59L11 8.59V9M18 12a10 10 0 0 1-.6 3.4M12 4.14v3.58"/></svg>
                Ketuk untuk Aktifkan Suara
              </button>
            )}
          </div>
          
          {queue.status === "aktif" ? (
            <div className="space-y-4">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center bg-white border border-border-main rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 text-primary">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <span className="status-badge status-aktif">Antrean Aktif</span>
              </div>
              <div className="pt-2">
                <p className="text-[10px] uppercase tracking-wider text-text-sub font-bold">Nomor Antrean Anda</p>
                <div className="text-6xl font-black tracking-tight text-bg-dark mt-1">
                  {queue.nomor}
                </div>
              </div>
              <p className="text-sm text-text-sub font-semibold bg-white border border-border-main py-3 rounded-xl shadow-sm">
                {activeCount > 0
                  ? `Ada ${activeCount} orang sebelum Anda`
                  : "Anda adalah antrean berikutnya!"}
              </p>
              <p className="text-xs text-text-muted font-medium pt-2">Mohon tunggu nomor Anda dipanggil oleh kasir.</p>
            </div>
          ) : queue.status === "dipanggil" ? (
            <div className="space-y-4">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center bg-white border border-border-main rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0053C4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 text-[#0053C4]">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </div>
              <div>
                <span className="status-badge status-dipanggil">Dipanggil!</span>
              </div>
              <div className="pt-2">
                <p className="text-[10px] uppercase tracking-wider text-blue-700 font-bold">Silakan ke Loket / Kasir</p>
                <div className="text-7xl font-black tracking-tight text-blue-600 mt-1">
                  {queue.nomor}
                </div>
              </div>
              <p className="text-sm text-blue-800 font-bold bg-blue-50 border border-blue-200 py-4 rounded-xl">
                Nomor Anda sedang dipanggil!
              </p>
              {queue.nomor_wa && (
                <a
                  href={`https://wa.me/${queue.nomor_wa.replace(/^0/, "62")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full btn-primary text-sm py-3.5"
                >
                  Hubungi Toko (WhatsApp)
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {queue.status === "menunggu_konfirmasi" ? (
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center bg-white border border-border-main rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                  {/* Outer pulsing ring for "waiting" effect */}
                  <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping opacity-75" style={{ animationDuration: '2s' }}></div>
                  
                  <svg width="64" height="64" viewBox="0 0 100 100" className="relative z-10">
                    {/* Dial face */}
                    <circle cx="50" cy="50" r="45" fill="#FFFFFF" stroke="#E4E7EC" strokeWidth="2" />
                    
                    {/* Hour tick marks */}
                    <circle cx="50" cy="15" r="2.5" fill="#98A2B3" />
                    <circle cx="85" cy="50" r="2.5" fill="#98A2B3" />
                    <circle cx="50" cy="85" r="2.5" fill="#98A2B3" />
                    <circle cx="15" cy="50" r="2.5" fill="#98A2B3" />
                    
                    {/* Hour hand */}
                    <g>
                      <line x1="50" y1="50" x2="50" y2="28" stroke="#101213" strokeWidth="4" strokeLinecap="round" />
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 50 50"
                        to="360 50 50"
                        dur="60s"
                        repeatCount="indefinite"
                      />
                    </g>
                    
                    {/* Minute hand */}
                    <g>
                      <line x1="50" y1="50" x2="50" y2="18" stroke="#475467" strokeWidth="3" strokeLinecap="round" />
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 50 50"
                        to="360 50 50"
                        dur="10s"
                        repeatCount="indefinite"
                      />
                    </g>

                    {/* Second hand */}
                    <g>
                      <line x1="50" y1="52" x2="50" y2="12" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="50" cy="20" r="3" fill="#1D9E75" />
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 50 50"
                        to="360 50 50"
                        dur="2.5s"
                        repeatCount="indefinite"
                      />
                    </g>
                    
                    {/* Center pin */}
                    <circle cx="50" cy="50" r="5" fill="#101213" />
                    <circle cx="50" cy="50" r="2" fill="#FFFFFF" />
                  </svg>
                </div>
              ) : queue.status === "selesai" ? (
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center bg-bg-surface border border-border-main rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#475467" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-medium">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center bg-danger-bg border border-danger-border rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-danger">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              )}
              <div>
                <span className={`status-badge status-${queue.status}`}>{msg.title}</span>
              </div>
              <p className="text-sm text-text-sub font-semibold">{msg.description}</p>
              {(queue.status === "menunggu_konfirmasi" || queue.status === "expired") && (
                <div className="pt-4 border-t border-border-main text-[10px] text-text-muted font-semibold space-y-1">
                  {queue.status === "menunggu_konfirmasi" ? (
                    <>
                      <p>Waktu pendaftaran: {new Date(queue.requested_at).toLocaleTimeString("id-ID")}</p>
                      <p className="text-warning-text bg-warning-bg/50 py-2 rounded-lg border border-warning-border/50 mt-2 font-bold">
                        Tunjukkan layar ini ke petugas kasir untuk dikonfirmasi.
                      </p>
                    </>
                  ) : (
                    <p>Permintaan kedaluwarsa karena tidak dikonfirmasi dalam 15 menit.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-text-muted font-medium pt-2">
          Powered by QueueGo
        </div>
      </div>
    </div>
  );
}