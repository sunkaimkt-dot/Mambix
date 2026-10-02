import { supabaseServer } from "@/lib/supabase-server";
import { empresaDoCookie } from "@/lib/marca";

export type Papel = "plataforma" | "gestor" | "empresario";

/* Funcao dentro da equipe da Mambix. So existe para papel "gestor".
   admin  = administrador: cadastra cliente, convida, mexe na marca
   operador = o dia a dia: lanca, edita, da baixa
   consulta = so le */
export type Funcao = "admin" | "operador" | "consulta";

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

/**
 * Papel e funcao numa consulta so.
 *
 * O mesmo aviso do meuPapel() vale aqui: o filtro por user_id nao e opcional.
 * Quem tem papel "plataforma" enxerga todos os perfis, e sem o filtro o
 * maybeSingle() recebe varias linhas e falha -- justamente para quem tem mais
 * acesso.
 */
export async function meuAcesso(): Promise<{ papel: Papel; funcao: Funcao | null }> {
  const supabase = await supabaseServer();
  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return { papel: "empresario", funcao: null };

  const { data } = await supabase
    .from("perfis")
    .select("papel, funcao")
    .eq("user_id", sessao.user.id)
    .maybeSingle();

  return {
    papel: (data?.papel as Papel) ?? "empresario",
    funcao: (data?.funcao as Funcao | null) ?? null,
  };
}

/* Quem manda na carteira: cadastra cliente e empresa, convida, mexe na marca.
   Espelha administro_a_carteira() do banco -- aqui e so para a tela nao
   oferecer o que vai ser recusado. A regra que vale e a do Postgres. */
export async function souAdministrador(): Promise<boolean> {
  const { papel, funcao } = await meuAcesso();
  return papel === "plataforma" || (papel === "gestor" && funcao === "admin");
}

export async function possoGravar(): Promise<boolean> {
  const { papel, funcao } = await meuAcesso();
  return !(papel === "gestor" && funcao === "consulta");
}

export async function carregarContexto(sp: Record<string, string | string[] | undefined>): Promise<Contexto | null> {
  const supabase = await supabaseServer();
  // Empresa desligada some do seletor, mas continua no banco com todo o historico.
  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, nome")
    .eq("ativa", true)
    .order("nome");
  if (!empresas || empresas.length === 0) return null;

  /* Ordem de preferencia: o que veio na URL, depois a ultima empresa escolhida
     (cookie), e so entao a primeira da lista. Sem o cookie, abrir uma pagina por
     um link sem ?empresa= jogava o usuario de volta para a primeira empresa. */
  const pedido = typeof sp.empresa === "string" ? sp.empresa : undefined;
  const lembrada = await empresaDoCookie();
  const empresa =
    empresas.find((e) => e.id === pedido) ??
    empresas.find((e) => e.id === lembrada) ??
    empresas[0];

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
