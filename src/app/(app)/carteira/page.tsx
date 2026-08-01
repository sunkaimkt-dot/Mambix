import { headers } from "next/headers";
import { meuPapel } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import { Cartao, Vazio } from "@/components/ui";
import { FormCliente, FormEmpresa, FormConvite, BotaoRevogar } from "./Formularios";

/**
 * Carteira do gestor: clientes, empresas e convites.
 *
 * Tudo que aparece aqui ja vem filtrado pelo RLS -- a consulta e a mesma para
 * todo mundo, mas o Postgres so devolve as linhas da carteira de quem consulta.
 * Um gestor nao ve nem a existencia de outro.
 */
export default async function Carteira() {
  const papel = await meuPapel();

  if (papel === "empresario") {
    return (
      <main className="p-6">
        <h1 className="text-lg font-bold">Carteira</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta área é do seu consultor financeiro.
        </p>
      </main>
    );
  }

  const supabase = await supabaseServer();
  const h = await headers();
  const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;

  const [clientesRes, empresasRes, convitesRes, gestoresRes, perfilRes] = await Promise.all([
    supabase.from("clientes").select("id, nome, gestor_id").order("nome"),
    supabase.from("empresas").select("id, nome, cliente_id").order("nome"),
    supabase
      .from("convites")
      .select("id, email, cliente_id, expira_em, aceito_em")
      .is("aceito_em", null)
      .order("criado_em", { ascending: false }),
    papel === "plataforma"
      ? supabase.from("gestores").select("id, nome").order("nome")
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    supabase.from("perfis").select("gestor_id").maybeSingle(),
  ]);

  const clientes = clientesRes.data ?? [];
  const empresas = empresasRes.data ?? [];
  const convites = convitesRes.data ?? [];
  const gestores = gestoresRes.data ?? [];
  const meuGestorId = (perfilRes.data?.gestor_id as string | null) ?? null;

  const empresasPor = new Map<string, { id: string; nome: string }[]>();
  for (const e of empresas) {
    const arr = empresasPor.get(e.cliente_id) ?? [];
    arr.push({ id: e.id, nome: e.nome });
    empresasPor.set(e.cliente_id, arr);
  }
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  const nomeGestor = new Map(gestores.map((g) => [g.id, g.nome]));

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold">Minha carteira</h1>
        <p className="text-sm text-slate-500">
          {papel === "plataforma"
            ? "Visão da plataforma — todos os gestores e clientes."
            : "Seus clientes e as empresas de cada um."}
        </p>
      </div>

      <Cartao className="mb-6 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Novo cliente</p>
        <FormCliente gestorId={papel === "plataforma" ? (gestores[0]?.id ?? null) : meuGestorId} />
      </Cartao>

      <Cartao className="mb-6 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Nova empresa</p>
        {clientes.length === 0 ? (
          <p className="text-sm text-slate-500">Cadastre um cliente primeiro.</p>
        ) : (
          <FormEmpresa clientes={clientes} />
        )}
      </Cartao>

      <Cartao className="mb-6 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Dar acesso a um cliente
        </p>
        {clientes.length === 0 ? (
          <p className="text-sm text-slate-500">Cadastre um cliente primeiro.</p>
        ) : (
          <FormConvite clientes={clientes} baseUrl={baseUrl} />
        )}
      </Cartao>

      {convites.length > 0 && (
        <Cartao className="mb-6 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Convites pendentes
          </p>
          <ul className="space-y-1.5 text-sm">
            {convites.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.email}</span>
                <span className="text-slate-500">→ {nomeCliente.get(c.cliente_id) ?? "—"}</span>
                <span className="text-xs text-slate-400">
                  expira {new Date(c.expira_em).toLocaleDateString("pt-BR")}
                </span>
                <BotaoRevogar id={c.id} />
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao>
        <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Clientes e empresas
        </p>
        {clientes.length === 0 ? (
          <Vazio texto="Nenhum cliente cadastrado ainda." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {clientes.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{c.nome}</span>
                  {papel === "plataforma" && (
                    <span className="text-xs text-slate-400">
                      carteira: {nomeGestor.get(c.gestor_id) ?? "—"}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(empresasPor.get(c.id) ?? []).map((e) => (
                    <span key={e.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {e.nome}
                    </span>
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
