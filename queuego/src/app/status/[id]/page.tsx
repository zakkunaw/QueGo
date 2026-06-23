"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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

const getStepState = (stepNumber: number, status: QueueStatus) => {
  if (stepNumber === 1) {
    return "completed";
  }
  if (stepNumber === 2) {
    if (status === "menunggu_konfirmasi") return "active";
    if (status === "aktif" || status === "dipanggil" || status === "selesai") return "completed";
    return "upcoming";
  }
  if (stepNumber === 3) {
    if (status === "aktif" || status === "dipanggil") return "active";
    if (status === "selesai") return "completed";
    return "upcoming";
  }
  return "upcoming";
};

const renderStepIcon = (stepNumber: number, state: "completed" | "active" | "upcoming") => {
  if (state === "completed") {
    return (
      <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-[#101213] text-white shadow-sm shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-white border-2 border-[#101213] text-[#101213] shadow-sm shrink-0 animate-pulse">
        {stepNumber}
      </div>
    );
  }
  return (
    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-white border border-border-main text-text-muted shadow-sm shrink-0">
      {stepNumber}
    </div>
  );
};

const getStepTextClass = (state: "completed" | "active" | "upcoming") => {
  if (state === "completed" || state === "active") {
    return "text-[9px] md:text-[10px] font-bold text-text-main text-center leading-tight";
  }
  return "text-[9px] md:text-[10px] font-semibold text-text-sub text-center leading-tight";
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
  const id = Number(params.id);
  const supabase = createClient();
  const [queue, setQueue] = useState<QueueItem | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const [showModal, setShowModal] = useState(() => {
    if (typeof window !== "undefined") {
      const dismissed = sessionStorage.getItem(`dismissed-status-modal-${id}`);
      return dismissed !== "true";
    }
    return true;
  });

  const handleDismissModal = () => {
    setShowModal(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`dismissed-status-modal-${id}`, "true");
    }
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<QueueItem | null>(null);
  const chimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendLocalNotification = useCallback((nomorAntrean: number) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      if (document.visibilityState !== "visible") {
        const title = `${appConfig.nama_toko} - Panggilan Antrean!`;
        const options = {
          body: `Nomor antrean Anda ${nomorAntrean} sedang dipanggil. Silakan segera menuju ke kasir / loket.`,
          tag: `panggil-${nomorAntrean}-${id}`,
          requireInteraction: true,
        };
        
        try {
          const notification = new Notification(title, options);
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (e) {
          console.error("Gagal mengirim notifikasi lokal:", e);
        }
      }
    }
  }, [id]);

  const fetchQueue = useCallback(async () => {
    try {
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
        const newData = data as unknown as QueueItem;
        const oldStatus = queueRef.current?.status;
        setQueue(newData);

        if (newData.status === "dipanggil") {
          // Play loop chime
          if (!chimeIntervalRef.current) {
            playChime();
            chimeIntervalRef.current = setInterval(() => {
              playChime();
            }, 8000);
          }
          if (oldStatus !== "dipanggil" && newData.nomor) {
            sendLocalNotification(newData.nomor);
          }
        } else {
          stopChimeLoop();
        }

        if (newData.status === "aktif") {
          if (oldStatus === "menunggu_konfirmasi" && newData.nomor) {
            playActivationSound(newData.nomor);
          }
          const { count } = await supabase
            .from("queue")
            .select("*", { count: "exact", head: true })
            .eq("tanggal_antrian", newData.tanggal_antrian)
            .eq("status", "aktif")
            .lt("nomor", newData.nomor);
          setActiveCount(count || 0);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil data antrean:", err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, supabase]);

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

  const speakActivation = (nomorAntrean: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    
    const text = `Antrean Anda telah aktif. Nomor antrean Anda adalah ${nomorAntrean}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    
    const voices = window.speechSynthesis.getVoices();
    const indVoice = voices.find(v => v.lang.includes("id") || v.lang.startsWith("id-"));
    if (indVoice) {
      utterance.voice = indVoice;
    }
    
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 600);
  };

  const playActivationSound = (nomorAntrean: number) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        playChimeOnContext(ctx);
        speakActivation(nomorAntrean);
      });
    } else {
      playChimeOnContext(ctx);
      speakActivation(nomorAntrean);
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
    // Request local notification permission on load
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch((err) => console.error("Gagal meminta izin notifikasi:", err));
      }
    }

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

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchQueue();
        const ctx = audioContextRef.current;
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch((err) => console.error("Gagal me-resume audio setelah tab aktif kembali:", err));
        }
      }
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (chimeIntervalRef.current) {
        clearInterval(chimeIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchQueue]);

  useEffect(() => {
    if (!id) return;

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
              if (newData.nomor) {
                sendLocalNotification(newData.nomor);
              }
            } else if (newData.status !== "dipanggil") {
              stopChimeLoop();
            }
            setQueue(newData);
            if (newData.status === "aktif") {
              if (oldStatus === "menunggu_konfirmasi" && newData.nomor) {
                playActivationSound(newData.nomor);
              }
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
      <div className="min-h-screen flex items-center justify-center bg-bg-base px-4 py-8 relative overflow-hidden">
        {/* Background ambient glow circles */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-blue-500/5 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center space-y-4 relative z-10">
          <div className="h-10 w-10 border-4 border-border-main border-t-primary rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-text-sub">Memuat status antrean...</p>
        </div>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base px-4 py-8 relative overflow-hidden">
        {/* Background ambient glow circles */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-blue-500/5 blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-sm relative z-10">
          <div className="card text-center space-y-5 bg-white/95 backdrop-blur-sm border border-border-main rounded-[24px]">
            <div className="w-12 h-12 rounded-full bg-danger-bg border border-danger-border flex items-center justify-center mx-auto text-red-danger">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-text-main">Antrean Tidak Ditemukan</h2>
              <p className="text-xs text-text-sub font-semibold">Silakan scan ulang QR code resmi di lokasi untuk mendaftar antrean baru.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const msg = STATUS_MESSAGES[queue.status];
  const step2State = getStepState(2, queue.status);
  const step3State = getStepState(3, queue.status);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4 py-8 relative overflow-hidden">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101213]/60 backdrop-blur-sm px-4 animate-fade-in">
          <div className="bg-white border border-border-main rounded-[24px] p-6 max-w-sm w-full space-y-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] relative text-center animate-scale-in">
            {/* Close Button X */}
            <button
              onClick={handleDismissModal}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main transition-colors cursor-pointer"
              aria-label="Tutup"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* Warning Icon */}
            <div className="w-12 h-12 rounded-full bg-warning-bg border border-warning-border flex items-center justify-center mx-auto text-warning-text">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-text-main">Perhatian Penting</h3>
              <p className="text-xs text-text-sub font-semibold leading-relaxed">
                Harap pantau halaman browser ini secara berkala untuk melihat status antrean terbaru.
              </p>
            </div>

            <button
              onClick={handleDismissModal}
              className="btn-primary w-full py-3.5 text-sm mt-2 flex items-center justify-center rounded-xl"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Background ambient glow circles */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-blue-500/5 blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md flex flex-col items-center relative z-10 space-y-6">
        {/* Step Flow Guide */}
        <div className="w-full px-2">
          <div className="flex items-start justify-between w-full">
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-1.5 z-10 bg-transparent w-20 shrink-0">
              {renderStepIcon(1, "completed")}
              <span className={getStepTextClass("completed")}>Isi Data</span>
            </div>

            {/* Line 1 */}
            <div className={`flex-1 h-[2px] mt-3.5 ${step2State === "completed" || step2State === "active" ? "bg-[#101213]" : "bg-border-main"}`}></div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-1.5 z-10 bg-transparent w-20 shrink-0">
              {renderStepIcon(2, step2State)}
              <span className={getStepTextClass(step2State)}>Konfirmasi Kasir</span>
            </div>

            {/* Line 2 */}
            <div className={`flex-1 h-[2px] mt-3.5 ${step3State === "completed" || step3State === "active" ? "bg-[#101213]" : "bg-border-main"}`}></div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-1.5 z-10 bg-transparent w-20 shrink-0">
              {renderStepIcon(3, step3State)}
              <span className={getStepTextClass(step3State)}>Pantau Antrean</span>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="card w-full space-y-6 bg-white/95 backdrop-blur-sm border border-border-main rounded-[24px]">
          
          {/* Header Toko */}
          <div className="text-center flex flex-col items-center">
            <div>
              <h1 className="text-xl font-bold text-text-main">{appConfig.nama_toko}</h1>
              <p className="text-xs text-text-sub font-semibold mt-0.5">Status Antrean Pribadi</p>
            </div>
          </div>

          {/* Kotak Konten Utama Status */}
          <div className="bg-bg-surface border border-border-main rounded-2xl p-6 text-center space-y-6">
            
            {/* Audio Notification Status Indicator */}
            <div className="flex justify-center select-none">
              {audioUnlocked ? (
                <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[10px] font-bold bg-success-bg text-success-text border border-success-border">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Notifikasi Suara Aktif
                </span>
              ) : (
                <button
                  onClick={unlockAudio}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[10px] font-bold bg-warning-bg text-warning-text border border-warning-border animate-pulse cursor-pointer transition-all duration-150 active:scale-95"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M13.73 21a2 2 0 0 1-3.46 0M18.8 4A10.05 10.05 0 0 1 22 12M15 8.87a6.2 6.2 0 0 1 1 3.13M3 3l18 18M9 9v8H4v-6h4.59L11 8.59V9M18 12a10 10 0 0 1-.6 3.4M12 4.14v3.58"/></svg>
                  Ketuk untuk Aktifkan Suara
                </button>
              )}
            </div>
            
            {queue.status === "aktif" ? (
              <div className="space-y-4">
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center bg-success-bg border border-success-border rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
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
                <p className={`text-sm font-semibold border py-3 rounded-xl shadow-sm ${activeCount > 0 ? "bg-white border-border-main text-text-main" : "bg-success-bg border-success-border text-success-text font-bold"}`}>
                  {activeCount > 0
                    ? `Ada ${activeCount} orang sebelum Anda`
                    : "Anda adalah antrean berikutnya!"}
                </p>
                <p className="text-xs text-text-muted font-medium pt-2">
                  Harap pantau halaman browser ini secara berkala agar tidak terlewat saat nomor Anda dipanggil oleh kasir.
                </p>
              </div>
            ) : queue.status === "dipanggil" ? (
              <div className="space-y-4">
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center bg-[#D1E9FF] border border-[#B2DDFF] rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.02)] animate-pulse">
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
                    className="inline-flex items-center justify-center w-full btn-primary text-sm py-4 rounded-xl"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 448 512" className="mr-2 shrink-0"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                    Hubungi Toko (WhatsApp)
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {queue.status === "menunggu_konfirmasi" ? (
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center bg-white border border-border-main rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                    {/* Outer pulsing ring for "waiting" effect */}
                    <div className="absolute inset-0 rounded-full bg-warning-bg/40 animate-ping opacity-75" style={{ animationDuration: '2.5s' }}></div>
                    
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#101213" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 text-text-main animate-pulse">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                ) : queue.status === "selesai" ? (
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center bg-bg-light border border-border-main rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
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
                        <div className="flex items-start gap-2.5 text-left text-xs text-warning-text bg-warning-bg border border-warning-border p-3.5 rounded-xl font-bold mt-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <span>Tunjukkan layar ini ke petugas kasir untuk mendapatkan konfirmasi nomor antrean resmi Anda.</span>
                        </div>
                        <p className="text-[9px] text-text-muted text-center font-semibold mt-2.5">
                          * Harap pantau halaman browser ini secara berkala untuk melihat status antrean terbaru.
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
    </div>
  );
}