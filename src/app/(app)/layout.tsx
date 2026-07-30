import { redirect } from "next/navigation";
import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase-server";
import Navegacao from "@/components/Navegacao";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, papel")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
        <div className="mb-6 px-3">
          <p className="text-lg font-bold tracking-tight">MAMBIX</p>
          <p className="text-xs text-slate-500">Gestão financeira</p>
        </div>
        <Suspense fallback={null}>
          <Navegacao />
        </Suspense>
        <div className="mt-8 border-t border-slate-200 px-3 pt-4">
          <p className="truncate text-sm font-medium">{perfil?.nome ?? user.email}</p>
          <p className="mb-2 text-xs capitalize text-slate-500">{perfil?.papel ?? "sem perfil"}</p>
          <form action="/auth/signout" method="post">
            <button className="text-xs text-slate-500 underline hover:text-slate-800">Sair</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
