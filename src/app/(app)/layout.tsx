import { redirect } from "next/navigation";
import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase-server";
import { carregarMarca, urlDaLogo, MARCA_PADRAO, portaDeEntrada } from "@/lib/marca";
import Navegacao from "@/components/Navegacao";
import TourGuiado from "@/components/TourGuiado";
import TourBoasVindas from "@/components/TourBoasVindas";
import BotaoTourCompleto from "@/components/BotaoTourCompleto";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(await portaDeEntrada());

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, papel, funcao")
    .eq("user_id", user.id)
    .maybeSingle();

  const marca = await carregarMarca();
  // Telas cujo tour a pessoa ja viu (o tour abre sozinho so no primeiro acesso).
  const toursRes = await supabase.from("tours_vistos").select("tela").eq("user_id", user.id);
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
              ? "Mambix · dono"
              : perfil?.papel === "gestor"
                ? `Equipe Mambix · ${
                    perfil?.funcao === "admin"
                      ? "administrador"
                      : perfil?.funcao === "consulta"
                        ? "consulta"
                        : "operador"
                  }`
                : perfil?.papel === "empresario"
                  ? "Cliente"
                  : "sem perfil"}
          </p>
          <BotaoTourCompleto />
          <form action="/auth/signout" method="post">
            <button className="text-xs text-slate-500 underline hover:text-slate-800">Sair</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
      <TourBoasVindas
        vistos={(toursRes.data ?? []).map((t) => t.tela as string)}
        papel={(perfil?.papel as "plataforma" | "gestor" | "empresario") ?? "empresario"}
        autoInicio={!toursRes.error}
      />
      <TourGuiado
        vistos={(toursRes.data ?? []).map((t) => t.tela as string)}
        papel={(perfil?.papel as "plataforma" | "gestor" | "empresario") ?? "empresario"}
        autoInicio={!toursRes.error}
      />
    </div>
  );
}
