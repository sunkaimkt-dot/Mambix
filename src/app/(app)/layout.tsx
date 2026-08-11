import { redirect } from "next/navigation";
import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase-server";
import { carregarMarca, urlDaLogo, MARCA_PADRAO } from "@/lib/marca";
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

  // Sem argumento: a marca sai da empresa que estiver no cookie.
  const marca = await carregarMarca();
  const logo = urlDaLogo(marca.logo_url);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
        <div className="mb-6 px-3">
          {logo ? (
            /* Altura travada e largura livre: logo de cliente vem em qualquer
               proporcao, e esticar a marca dos outros e falta de cuidado. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={marca.nome_exibido ?? "Logo"}
              className="mb-1 h-9 w-auto max-w-full object-contain object-left"
            />
          ) : (
            <p className="text-lg font-bold tracking-tight">{marca.nome_exibido ?? MARCA_PADRAO.nome_exibido}</p>
          )}
          {marca.tagline && <p className="text-xs text-slate-500">{marca.tagline}</p>}
        </div>
        <Suspense fallback={null}>
          <Navegacao papel={(perfil?.papel as "plataforma" | "gestor" | "empresario") ?? "empresario"} />
        </Suspense>
        <div className="mt-8 border-t border-slate-200 px-3 pt-4">
          <p className="truncate text-sm font-medium">{perfil?.nome ?? user.email}</p>
          <p className="mb-2 text-xs text-slate-500">
            {perfil?.papel === "plataforma"
              ? "Leads de Sucesso"
              : perfil?.papel === "gestor"
                ? "BPO financeiro"
                : perfil?.papel === "empresario"
                  ? "Cliente"
                  : "sem perfil"}
          </p>
          <form action="/auth/signout" method="post">
            <button className="text-xs text-slate-500 underline hover:text-slate-800">Sair</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
