import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { urlDaLogo, variaveisDaMarca, MARCA_PADRAO, type Marca } from "@/lib/marca";
import AceitarConvite from "./AceitarConvite";
import CriarConta from "./CriarConta";

/**
 * Pagina do convite -- e a unica porta de entrada de gente nova no sistema.
 *
 * Sem sessao, ela CRIA a conta: antes disto nao havia tela de cadastro em lugar
 * nenhum, e o convite levava a uma pagina que exigia estar logado. Quem ja tem
 * conta so confirma o vinculo.
 *
 * A tela ja aparece com a marca de quem convidou -- quem foi chamado pela
 * Mambix nunca ve a marca da plataforma.
 */
export const dynamic = "force-dynamic";

export default async function Convite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await supabaseServer();
  const { data: sessao } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("convite_publico", { p_token: token });
  const c = (Array.isArray(data) ? data[0] : data) as
    | (Partial<Marca> & { valido: boolean; papel: string | null; funcao: string | null })
    | null;
  const valido = c?.valido === true;

  const marca: Marca = {
    ...MARCA_PADRAO,
    logo_url: c?.logo_url ?? null,
    nome_exibido: c?.nome_exibido ?? null,
    tagline: c?.tagline ?? null,
    cor_primaria: c?.cor_primaria ?? MARCA_PADRAO.cor_primaria,
    cor_positivo: c?.cor_positivo ?? MARCA_PADRAO.cor_positivo,
    cor_negativo: c?.cor_negativo ?? MARCA_PADRAO.cor_negativo,
  };
  const logo = urlDaLogo(marca.logo_url);

  const tipoDeAcesso =
    c?.papel === "gestor"
      ? c?.funcao === "admin"
        ? "administrador do BPO"
        : c?.funcao === "consulta"
          ? "acesso de consulta no BPO"
          : "operador do BPO"
      : "acesso de cliente";

  return (
    <main className="flex min-h-screen items-center justify-center p-4" style={variaveisDaMarca(marca)}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={marca.nome_exibido ?? ""} className="mb-4 h-10 w-auto max-w-full object-contain" />
        ) : (
          marca.nome_exibido && <h2 className="mb-1 text-xl font-bold tracking-tight">{marca.nome_exibido}</h2>
        )}

        {!valido ? (
          <>
            <h1 className="text-lg font-bold">Convite inválido</h1>
            <p className="mt-2 text-sm text-slate-500">
              Este convite não existe, já foi usado ou passou da validade. Peça um novo a quem te chamou.
            </p>
          </>
        ) : sessao.user ? (
          <>
            <h1 className="text-lg font-bold">Convite de acesso</h1>
            <p className="mt-1 text-sm text-slate-500">
              Você está logado como <strong>{sessao.user.email}</strong>. O convite precisa ter sido enviado
              para este mesmo e-mail.
            </p>
            <div className="mt-5">
              <AceitarConvite token={token} />
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Não é você?{" "}
              <Link href="/auth/signout" className="text-marca hover:underline">
                Sair desta conta
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold">Criar seu acesso</h1>
            <p className="mt-1 mb-5 text-sm text-slate-500">
              Você foi convidado com <strong>{tipoDeAcesso}</strong>. Defina uma senha para entrar.
            </p>
            <CriarConta token={token} />
          </>
        )}
      </div>
    </main>
  );
}
