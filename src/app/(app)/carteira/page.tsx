import { headers } from "next/headers";
import { meuPapel } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import { Cartao, Vazio } from "@/components/ui";
import { FormGestor, FormCliente, FormEmpresa, FormConvite, BotaoRevogar, EmpresaChip } from "./Formularios";

/**
 * Carteira: gestores, clientes, empresas e convites.
 *
 * Todas as consultas aqui sao iguais para todo mundo -- quem filtra e o RLS.
 * A plataforma recebe a base inteira; o gestor recebe so a carteira dele e nem
 * sabe que existem outras.
 */
export default async function Carteira() {
  const papel = await meuPapel();

  if (papel === "empresario") {
    return (
      <main className="p-6">
        <h1 className="text-lg font-bold">Carteira</h1>
        <p className="mt-2 text-sm text-slate-500">Esta área é do seu consultor financeiro.</p>
      </main>
    );
  }

  const ehPlataforma = papel === "plataforma";
  const supabase = await supabaseServer();
  const h = await headers();
  const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  const { data: sessao } = await supabase.auth.getUser();

  const [gestoresRes, clientesRes, empresasRes, convitesRes, perfilRes] = await Promise.all([
    supabase.from("gestores").select("id, nome, ativo").order("nome"),
    supabase.from("clientes").select("id, nome, gestor_id").order("nome"),
    supabase.from("empresas").select("id, nome, cliente_id, ativa").order("nome"),
    supabase
      .from("convites")
      .select("id, email, papel, cliente_id, gestor_id, expira_em")
      .is("aceito_em", null)
      .order("criado_em", { ascending: false }),
    // Filtrar por user_id e obrigatorio: a plataforma le todos os perfis.
    supabase.from("perfis").select("gestor_id").eq("user_id", sessao.user?.id ?? "").maybeSingle(),
  ]);

  const gestores = gestoresRes.data ?? [];
  const clientes = clientesRes.data ?? [];
  const empresas = empresasRes.data ?? [];
  const convites = convitesRes.data ?? [];
  const meuGestorId = (perfilRes.data?.gestor_id as string | null) ?? null;

  const empresasPor = new Map<string, { id: string; nome: string; ativa: boolean }[]>();
  for (const e of empresas) {
    const arr = empresasPor.get(e.cliente_id) ?? [];
    arr.push({ id: e.id, nome: e.nome, ativa: e.ativa });
    empresasPor.set(e.cliente_id, arr);
  }
  const clientesPor = new Map<string, typeof clientes>();
  for (const c of clientes) {
    const arr = clientesPor.get(c.gestor_id) ?? [];
    arr.push(c);
    clientesPor.set(c.gestor_id, arr);
  }
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  const nomeGestor = new Map(gestores.map((g) => [g.id, g.nome]));

  const contaEmpresas = (gestorId: string) =>
    (clientesPor.get(gestorId) ?? []).reduce((s, c) => s + (empresasPor.get(c.id)?.length ?? 0), 0);

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold">{ehPlataforma ? "Plataforma" : "Minha carteira"}</h1>
        <p className="text-sm text-slate-500">
          {ehPlataforma
            ? "Todos os gestores e suas carteiras."
            : "Seus clientes e as empresas de cada um."}
        </p>
      </div>

      {ehPlataforma && (
        <Cartao className="mb-6 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Novo gestor financeiro
          </p>
          <FormGestor />
        </Cartao>
      )}

      <Cartao className="mb-6 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Novo cliente</p>
        <FormCliente gestorId={ehPlataforma ? null : meuGestorId} gestores={gestores} />
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
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Dar acesso</p>
        {clientes.length === 0 && gestores.length === 0 ? (
          <p className="text-sm text-slate-500">Cadastre um gestor ou cliente primeiro.</p>
        ) : (
          <FormConvite
            clientes={clientes}
            gestores={gestores}
            podeConvidarGestor={ehPlataforma}
            baseUrl={baseUrl}
          />
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
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {c.papel === "gestor" ? "gestor" : "cliente"}
                </span>
                <span className="font-medium">{c.email}</span>
                <span className="text-slate-500">
                  →{" "}
                  {c.papel === "gestor"
                    ? nomeGestor.get(c.gestor_id ?? "") ?? "—"
                    : nomeCliente.get(c.cliente_id ?? "") ?? "—"}
                </span>
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
          {ehPlataforma ? "Gestores e carteiras" : "Clientes e empresas"}
        </p>

        {ehPlataforma ? (
          gestores.length === 0 ? (
            <Vazio texto="Nenhum gestor cadastrado ainda." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {gestores.map((g) => (
                <li key={g.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold">{g.nome}</span>
                    <span className="text-xs text-slate-400">
                      {(clientesPor.get(g.id) ?? []).length} cliente(s) · {contaEmpresas(g.id)} empresa(s)
                    </span>
                    {!g.ativo && (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                        inativo
                      </span>
                    )}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {(clientesPor.get(g.id) ?? []).map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-1.5 pl-3 text-sm">
                        <span className="text-slate-600">{c.nome}</span>
                        {(empresasPor.get(c.id) ?? []).map((e) => (
                          <EmpresaChip key={e.id} id={e.id} nome={e.nome} ativa={e.ativa} />
                        ))}
                      </li>
                    ))}
                    {(clientesPor.get(g.id) ?? []).length === 0 && (
                      <li className="pl-3 text-xs text-slate-400">sem cliente cadastrado</li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )
        ) : clientes.length === 0 ? (
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
