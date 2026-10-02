import BotaoTour from "@/components/BotaoTour";
import { headers } from "next/headers";
import { meuAcesso } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import { Cartao, Vazio } from "@/components/ui";
import {
  FormClienteCompleto, FormCliente, FormEmpresa, FormConvite,
  BotaoRevogar, EmpresaChip, LinhaDaEquipe,
} from "./Formularios";

/**
 * Clientes da Mambix: clientes, empresas, equipe e convites.
 *
 * Desde 02/10/2026 o sistema tem um BPO so -- a Mambix. O dono (papel
 * plataforma) e a equipe (papel gestor) veem a mesma lista; quem filtra
 * continua sendo o RLS.
 */
export default async function Carteira() {
  const { papel, funcao } = await meuAcesso();

  if (papel === "empresario") {
    return (
      <main className="p-6">
        <h1 className="text-lg font-bold">Clientes</h1>
        <p className="mt-2 text-sm text-slate-500">Esta área é da equipe da Mambix.</p>
      </main>
    );
  }

  /* Espelha administro_a_carteira() do banco. Serve para a tela nao oferecer o
     que o Postgres vai recusar -- a regra que vale continua sendo a de la. */
  const souAdmin = papel === "plataforma" || funcao === "admin";
  const supabase = await supabaseServer();
  const h = await headers();
  const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  const { data: sessao } = await supabase.auth.getUser();

  const [clientesRes, empresasRes, convitesRes, equipeRes] = await Promise.all([
    supabase.from("clientes").select("id, nome").order("nome"),
    supabase.from("empresas").select("id, nome, cliente_id, ativa").order("nome"),
    supabase
      .from("convites")
      .select("id, email, papel, funcao, cliente_id, expira_em")
      .is("aceito_em", null)
      .order("criado_em", { ascending: false }),
    supabase.from("perfis").select("user_id, nome, papel, funcao").eq("papel", "gestor").order("nome"),
  ]);

  const clientes = clientesRes.data ?? [];
  const empresas = empresasRes.data ?? [];
  const convites = convitesRes.data ?? [];
  const equipe = equipeRes.data ?? [];

  const empresasPor = new Map<string, { id: string; nome: string; ativa: boolean }[]>();
  for (const e of empresas) {
    const arr = empresasPor.get(e.cliente_id) ?? [];
    arr.push({ id: e.id, nome: e.nome, ativa: e.ativa });
    empresasPor.set(e.cliente_id, arr);
  }
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  const nomesDeFuncao: Record<string, string> = { admin: "administrador", operador: "operador", consulta: "consulta" };

  return (
    <main className="p-6">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold">Clientes</h1>
          <BotaoTour />
        </div>
        <p className="text-sm text-slate-500">Os clientes da Mambix, as empresas de cada um e a equipe.</p>
      </div>

      {souAdmin ? (
        <>
          <Cartao tour="novo-cliente" className="mb-6 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Novo cliente</p>
            <FormClienteCompleto />
          </Cartao>

          <details data-tour="mais-opcoes" className="group mb-6 rounded-xl border border-slate-200 bg-white open:pb-4">
            <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700">
              Mais opções — cliente com mais de uma empresa, reenviar acesso, convidar alguém da equipe
            </summary>

            <div className="space-y-6 px-4 pt-1">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mais uma empresa (mesmo cliente já tem CNPJ cadastrado)
                </p>
                {clientes.length === 0 ? (
                  <p className="text-sm text-slate-500">Cadastre um cliente primeiro.</p>
                ) : (
                  <FormEmpresa clientes={clientes} />
                )}
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reenviar acesso a um cliente ou convidar alguém da equipe
                </p>
                <FormConvite clientes={clientes} baseUrl={baseUrl} />
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cliente sem empresa ainda
                </p>
                <FormCliente />
              </div>
            </div>
          </details>
        </>
      ) : (
        <Cartao className="mb-6 p-4">
          <p className="text-sm text-slate-500">
            Cadastro de clientes, empresas e convites é do administrador da Mambix. Você continua com acesso normal
            aos lançamentos e relatórios.
          </p>
        </Cartao>
      )}

      {equipe.length > 0 && (
        <Cartao tour="equipe" className="mb-6">
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Equipe Mambix
          </p>
          <ul className="divide-y divide-slate-100">
            {equipe.map((p) => (
              <LinhaDaEquipe
                key={p.user_id}
                userId={p.user_id}
                nome={p.nome ?? "sem nome"}
                funcao={(p.funcao as "admin" | "operador" | "consulta") ?? "operador"}
                souEu={p.user_id === sessao.user?.id}
                podeEditar={souAdmin}
              />
            ))}
          </ul>
        </Cartao>
      )}

      {convites.length > 0 && (
        <Cartao tour="convites" className="mb-6 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Convites pendentes</p>
          <ul className="space-y-1.5 text-sm">
            {convites.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {c.papel === "gestor" ? `equipe · ${nomesDeFuncao[c.funcao ?? "operador"]}` : "cliente"}
                </span>
                <span className="font-medium">{c.email}</span>
                {c.papel !== "gestor" && (
                  <span className="text-slate-500">→ {nomeCliente.get(c.cliente_id ?? "") ?? "—"}</span>
                )}
                <span className="text-xs text-slate-400">
                  expira {new Date(c.expira_em).toLocaleDateString("pt-BR")}
                </span>
                {souAdmin && <BotaoRevogar id={c.id} />}
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao tour="clientes">
        <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Clientes e empresas
        </p>
        {clientes.length === 0 ? (
          <Vazio texto="Nenhum cliente cadastrado ainda." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {clientes.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <span className="font-medium">{c.nome}</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(empresasPor.get(c.id) ?? []).map((e) => (
                    <EmpresaChip key={e.id} id={e.id} nome={e.nome} ativa={e.ativa} />
                  ))}
                  {(empresasPor.get(c.id) ?? []).length === 0 && (
                    <span className="text-xs text-slate-400">sem empresa cadastrada</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </main>
  );
}
