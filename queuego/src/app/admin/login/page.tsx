"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [logoError, setLogoError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      // Login ke Supabase Auth di sisi browser agar RLS ter-bypass sebagai admin
      const supabase = createClient();
      const { error: sbError } = await supabase.auth.signInWithPassword({
        email: "admin@queuego.local",
        password: password,
      });
      if (sbError) {
        console.error("Gagal login ke Supabase:", sbError.message);
      }
      router.push("/admin/dashboard");
    } else {
      setError("Password salah");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          {!logoError && appConfig.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={appConfig.logo_url}
              alt={appConfig.nama_toko}
              className="h-12 w-auto mx-auto mb-3"
              onError={() => setLogoError(true)}
            />
          )}
          <h1 className="text-xl font-bold text-gray-900">{appConfig.nama_toko}</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password Admin
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              autoFocus
              disabled={loading}
              placeholder="Masukkan password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading || !password}
          >
            {loading ? "Memverifikasi..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}