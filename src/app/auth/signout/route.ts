import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { portaDeEntrada } from "@/lib/marca";

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  // Sai pela mesma porta por onde entrou.
  return NextResponse.redirect(new URL(await portaDeEntrada(), request.url), { status: 302 });
}
