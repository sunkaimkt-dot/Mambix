import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { carregarMarca, urlDaLogo, MARCA_PADRAO } from "@/lib/marca";
import FormLogin from "@/components/FormLogin";

/**
 * Raiz do dominio = tela de entrada da Mambix.
 *
 * Equipe da Mambix e clientes entram pelo mesmo lugar; o que cada um enxerga
 * depois do login e decidido pelo RLS, nao pela porta.
 */
export const dynamic = "force-dynamic";

export default async function Entrada() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const marca = await carregarMarca();
  const logo = urlDaLogo(marca.logo_url);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={marca.nome_exibido ?? ""} className="mb-2 h-10 w-auto max-w-full object-contain" />
        ) : (
          <h1 className="mb-1 text-2xl font-bold tracking-tight">
            {marca.nome_exibido ?? MARCA_PADRAO.nome_exibido}
          </h1>
        )}
        {marca.tagline && <p className="mb-6 text-sm text-slate-500">{marca.tagline}</p>}
        <FormLogin />
      </div>
    </main>
  );
}
