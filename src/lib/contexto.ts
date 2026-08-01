import { supabaseServer } from "@/lib/supabase-server";

export type Papel = "plataforma" | "gestor" | "empresario";

export type Contexto = {
  empresaId: string;
  empresaNome: string;
  mes: number;
  ano: number;
  empresas: { id: string; nome: string }[];
  lojas: { id: string; nome: string; is_matriz: boolean }[];
  lojaId: string | null;
  papel: Papel;
};

/**
 * Papel do usuario logado.
 *
 * O filtro por user_id NAO e opcional: quem tem papel 'plataforma' enxerga todos
 * os perfis, entao sem ele o maybeSingle() recebe varias linhas, falha, e a
 * funcao devolvia 'empresario' -- justamente para quem tem mais acesso.
 */
export async function meuPapel(): Promise<Papel> {
  const supabase = await supabaseServer();
  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return "empresario";

  const { data } = await supabase
    .from("perfis")
    .select("papel")
    .eq("user_id", sessao.user.id)
    .maybeSingle();

  return (data?.papel as Papel) ?? "empresario";
}

export async function carregarContexto(sp: Record<string, string | string[] | undefined>): Promise<Contexto | null> {
  const supabase = await supabaseServer();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");
  if (!empresas || empresas.length === 0) return null;

  const pedido = typeof sp.empresa === "string" ? sp.empresa : undefined;
  const empresa = empresas.find((e) => e.id === pedido) ?? empresas[0];

  const hoje = new Date();
  const mes = Number(sp.mes) || hoje.getMonth() + 1;
  const ano = Number(sp.ano) || hoje.getFullYear();

  const { data: lojas } = await supabase
    .from("lojas")
    .select("id, nome, is_matriz")
    .eq("empresa_id", empresa.id)
    .order("is_matriz", { ascending: false });

  const lojaPedida = typeof sp.loja === "string" ? sp.loja : null;

  return {
    empresaId: empresa.id,
    empresaNome: empresa.nome,
    mes,
    ano,
    empresas,
    lojas: lojas ?? [],
    lojaId: lojaPedida && lojaPedida !== "todas" ? lojaPedida : null,
    papel: await meuPapel(),
  };
}

export function primeiroDia(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

export function ultimoDia(ano: number, mes: number) {
  const d = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
