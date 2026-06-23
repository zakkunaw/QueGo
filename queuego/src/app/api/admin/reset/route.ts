import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  const { error: expireError } = await supabase
    .from("queue")
    .update({ status: "expired" })
    .eq("tanggal_antrian", today)
    .eq("status", "menunggu_konfirmasi");

  if (expireError) {
    return NextResponse.json({ success: false, error: expireError.message }, { status: 500 });
  }

  const { error: selesaiError } = await supabase
    .from("queue")
    .update({ status: "selesai" })
    .eq("tanggal_antrian", today)
    .in("status", ["aktif", "dipanggil"]);

  if (selesaiError) {
    return NextResponse.json({ success: false, error: selesaiError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}