import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { urlDaLogo, variaveisDaMarca, MARCA_PADRAO, type Marca } from "@/lib/marca";
import FormLogin from "@/components/FormLogin";

/**
 * Porta de entrada do consultor:  nortex.app/mambix
 *
 * Existe porque na tela de login ninguem esta autenticado -- sem isto, o
 * cliente da Mambix abriria o sistema e veria a marca da Nortex. O apelido na
 * URL diz de quem e a tela antes de qualquer login.
 *
 * Esta rota fica na raiz e por isso captura qualquer caminho que nao seja uma
 * tela conhecida. Apelido que nao existe vira 404 -- e a lista de palavras
 * reservadas, no banco, impede que um consultor tome o endereco de uma tela.
 */
export const dynamic = "force-dynamic";

export default async function EntradaDoConsultor({
  params,
}: {
  params: Promise<{ consultor: string }>;
}) {
  const { consultor } = await params;

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("marca_publica", { p_apelido: consultor });
  const m = (Array.isArray(data) ? data[0] : data) as Partial<Marca> | null;

  // Apelido desconhecido nao ganha pagina: nao se confirma nem se nega nada
  // alem do que um 404 comum diria.
  if (error || !m) notFound();

  const marca: Marca = {
    logo_url: m.logo_url ?? null,
    logo_negativo_url: m.logo_negativo_url ?? null,
    nome_exibido: m.nome_exibido ?? MARCA_PADRAO.nome_exibido,
    tagline: m.tagline ?? null,
    cor_primaria: m.cor_primaria ?? MARCA_PADRAO.cor_primaria,
    cor_secundaria: m.cor_secundaria ?? MARCA_PADRAO.cor_secundaria,
    cor_positivo: m.cor_positivo ?? MARCA_PADRAO.cor_positivo,
    cor_negativo: m.cor_negativo ?? MARCA_PADRAO.cor_negativo,
  };
  const logo = urlDaLogo(marca.logo_url);

  return (
    /* As variaveis entram aqui tambem, e nao so no <html>: o layout raiz ja
       resolveu a marca da plataforma antes desta pagina existir. */
    <main className="flex min-h-screen items-center justify-center p-4" style={variaveisDaMarca(marca)}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={marca.nome_exibido ?? ""} className="mb-2 h-10 w-auto max-w-full object-contain" />
        ) : (
          <h1 className="mb-1 text-2xl font-bold tracking-tight">{marca.nome_exibido}</h1>
        )}
        {marca.tagline && <p className="mb-6 text-sm text-slate-500">{marca.tagline}</p>}
        <FormLogin consultor={consultor.toLowerCase()} />
      </div>
    </main>
  );
}
