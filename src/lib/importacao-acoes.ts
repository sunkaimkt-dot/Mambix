"use server";
/**
 * Importacao em massa (Combo 3) -- parte que fala com o banco.
 *
 * Regra de ouro: lancamento NUNCA e gravado direto aqui. Cada linha passa pela
 * MESMA action da tela correspondente:
 *   pagamentos   -> salvarPagamento (com "ja_pago" quando a linha traz data de
 *                   pagamento: baixa integral, trigger sincroniza_pago dispara)
 *   receitas     -> salvarReceita
 *   caixa_diario -> salvarCaixa
 * e desfazer usa excluirLancamento / salvarCaixa. Assim RLS, triggers e
 * qualquer regra futura dessas actions valem igual para a importacao.
 *
 * O que fica gravado direto e so o recibo do lote (importacoes /
 * importacao_itens, migration 0120).
 */
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase-server";
import { salvarPagamento, salvarReceita, salvarCaixa, excluirLancamento } from "@/lib/acoes";
import type {
  TipoImportacao,
  Existentes,
  Referencias,
  LinhaPagamento,
  LinhaReceita,
  LinhaCaixa,
} from "@/lib/importacao";

const PAGINA = 1000;

/** Valor no formato que as actions entendem: numero() delas tira o ponto de milhar e troca a virgula. */
function valorBR(v: number) {
  return v.toFixed(2).replace(".", ",");
}

/** Listas usadas para validar o arquivo (as mesmas que as telas de lancamento oferecem). */
export async function carregarReferencias(empresaId: string): Promise<Referencias> {
  const supabase = await supabaseServer();
  const [cod, formas, tr, tv, bancos] = await Promise.all([
    supabase.from("codigos_despesa").select("codigo, nome, grupo").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("formas_pagamento").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("tipos_recebimento").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("tipos_venda").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("bancos").select("id, nome").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
  ]);
  return {
    codigos: cod.data ?? [],
    formas: formas.data ?? [],
    tiposRecebimento: tr.data ?? [],
    tiposVenda: tv.data ?? [],
    bancos: bancos.data ?? [],
  };
}

/**
 * O que ja existe no banco no periodo do arquivo, para marcar duplicados antes
 * de gravar. Paginado: o Supabase corta em 1.000 linhas sem avisar.
 */
export async function buscarExistentes(
  empresaId: string,
  tipo: TipoImportacao,
  ini: string,
  fim: string
): Promise<Existentes> {
  const supabase = await supabaseServer();
  const tabela = tipo === "pagamentos" ? "pagamentos" : tipo;
  const colData = tipo === "pagamentos" ? "vencimento" : "data";
  const cols =
    tipo === "pagamentos"
      ? "loja_id, vencimento, cd, valor, descricao"
      : tipo === "receitas"
        ? "loja_id, data, tipo_recebimento, valor, descricao"
        : "loja_id, data, tipo_venda, valor";

  const todas: Record<string, unknown>[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from(tabela)
      .select(cols)
      .eq("empresa_id", empresaId)
      .gte(colData, ini)
      .lte(colData, fim)
      .order("id")
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    todas.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < PAGINA) break;
  }
  const num = (r: Record<string, unknown>) => ({ ...r, valor: Number(r.valor) });
  if (tipo === "pagamentos") return { pagamentos: todas.map(num) as Existentes["pagamentos"] };
  if (tipo === "receitas") return { receitas: todas.map(num) as Existentes["receitas"] };
  return { caixa: todas.map(num) as Existentes["caixa"] };
}

export async function criarLote(dados: {
  empresaId: string;
  tipo: TipoImportacao;
  arquivo: string;
  lojaId: string;
  linhasArquivo: number;
}): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("importacoes")
    .insert({
      empresa_id: dados.empresaId,
      tipo: dados.tipo,
      arquivo: dados.arquivo.slice(0, 200),
      loja_id: dados.lojaId,
      linhas_arquivo: dados.linhasArquivo,
    })
    .select("id")
    .single();
  if (error || !data) {
    const msg = error?.message ?? "";
    return {
      ok: false,
      erro: msg.includes("row-level security")
        ? "Você não tem permissão para importar nesta empresa."
        : msg.includes("importacoes")
          ? "A tabela de importações ainda não foi criada no banco (migration 0120)."
          : msg || "Não foi possível iniciar a importação.",
    };
  }
  return { ok: true, id: data.id };
}

export type LinhaParaGravar = {
  numero: number;
  pagamento?: LinhaPagamento;
  receita?: LinhaReceita;
  caixa?: LinhaCaixa;
};

export type ResultadoLinha = { numero: number; ok: boolean; erro?: string; valor: number };

/**
 * Grava um pedaco do arquivo (a tela manda de 25 em 25, para caber no tempo de
 * uma funcao da Vercel e mostrar progresso). Cada linha passa pela action da
 * tela; o que entrou vira item do lote.
 */
export async function gravarLinhas(
  loteId: string,
  empresaId: string,
  lojaId: string,
  tipo: TipoImportacao,
  linhas: LinhaParaGravar[]
): Promise<ResultadoLinha[]> {
  const supabase = await supabaseServer();
  const resultados: ResultadoLinha[] = [];
  const itens: Record<string, unknown>[] = [];

  for (const l of linhas) {
    const fd = new FormData();
    fd.set("empresa_id", empresaId);
    fd.set("loja_id", lojaId);

    if (tipo === "pagamentos" && l.pagamento) {
      const p = l.pagamento;
      fd.set("vencimento", p.vencimento);
      fd.set("cfc", String(p.cfc));
      fd.set("cd", String(p.cd));
      fd.set("descricao", p.descricao);
      fd.set("comp_mes", String(p.comp_mes));
      fd.set("comp_ano", String(p.comp_ano));
      fd.set("valor", valorBR(p.valor));
      if (p.banco_id) fd.set("banco_id", p.banco_id);
      if (p.cp) fd.set("cp", String(p.cp));
      if (p.data_pagamento) {
        fd.set("ja_pago", "on");
        fd.set("data_pagamento", p.data_pagamento);
      }
      const r = await salvarPagamento(fd);
      // Se a baixa falhar, salvarPagamento deixa a conta gravada (em aberto) e
      // devolve o id: entra no lote mesmo assim, para o "desfazer" alcancar.
      if (r.id) itens.push({ tabela: "pagamentos", registro_id: r.id, valor: p.valor, linha_arquivo: l.numero });
      resultados.push({
        numero: l.numero,
        ok: r.ok,
        erro: r.ok ? undefined : r.id ? `lançado em aberto, mas a baixa falhou: ${r.erro}` : r.erro,
        valor: p.valor,
      });
    } else if (tipo === "receitas" && l.receita) {
      const rc = l.receita;
      fd.set("data", rc.data);
      fd.set("descricao", rc.descricao);
      fd.set("valor", valorBR(rc.valor));
      fd.set("tipo_recebimento", String(rc.tipo_recebimento));
      if (rc.banco_id) fd.set("banco_id", rc.banco_id);
      const r = await salvarReceita(fd);
      if (r.ok && r.id) itens.push({ tabela: "receitas", registro_id: r.id, valor: rc.valor, linha_arquivo: l.numero });
      resultados.push({ numero: l.numero, ok: r.ok, erro: r.erro, valor: rc.valor });
    } else if (tipo === "caixa_diario" && l.caixa) {
      const c = l.caixa;
      // salvarCaixa SUBSTITUI o valor do dia: guarda o anterior para desfazer.
      const { data: antes, error: e1 } = await supabase
        .from("caixa_diario")
        .select("valor")
        .eq("empresa_id", empresaId)
        .eq("loja_id", lojaId)
        .eq("data", c.data)
        .eq("tipo_venda", c.tipo_venda)
        .maybeSingle();
      if (e1) {
        resultados.push({ numero: l.numero, ok: false, erro: e1.message, valor: c.valor });
        continue;
      }
      fd.set("data", c.data);
      fd.set("tipo_venda", String(c.tipo_venda));
      fd.set("valor", valorBR(c.valor));
      const r = await salvarCaixa(fd);
      if (r.ok) {
        itens.push({
          tabela: "caixa_diario",
          loja_id: lojaId,
          data: c.data,
          tipo_venda: c.tipo_venda,
          valor: c.valor,
          valor_anterior: antes ? Number(antes.valor) : null,
          linha_arquivo: l.numero,
        });
      }
      resultados.push({ numero: l.numero, ok: r.ok, erro: r.erro, valor: c.valor });
    } else {
      resultados.push({ numero: l.numero, ok: false, erro: "linha sem dados válidos", valor: 0 });
    }
  }

  if (itens.length) {
    const { error } = await supabase
      .from("importacao_itens")
      .insert(itens.map((i) => ({ ...i, importacao_id: loteId, empresa_id: empresaId })));
    if (error) {
      // Os lancamentos entraram; so o recibo falhou. Avisa em cada linha para
      // ninguem achar que pode desfazer esse pedaco pelo lote.
      for (const r of resultados) {
        if (r.ok) r.erro = `gravado, mas não ficou registrado no lote (não sai no "desfazer"): ${error.message}`;
      }
    }
  }
  return resultados;
}

export async function finalizarLote(
  loteId: string,
  totais: { importadas: number; rejeitadas: number; valor: number }
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("importacoes")
    .update({
      linhas_importadas: totais.importadas,
      linhas_rejeitadas: totais.rejeitadas,
      valor_importado: Math.round(totais.valor * 100) / 100,
    })
    .eq("id", loteId);
  revalidatePath("/importar");
  revalidatePath("/dre");
  revalidatePath("/dfc");
  return error ? { ok: false, erro: error.message } : { ok: true };
}

/**
 * Desfaz o lote inteiro, pelos mesmos caminhos da tela:
 *   pagamentos / receitas -> excluirLancamento (as baixas do pagamento saem
 *     junto, "on delete cascade", e o DFC volta ao que era);
 *   caixa diario -> devolve o valor anterior (salvarCaixa) ou apaga o dia que
 *     estava vazio. Se o valor do dia foi mexido DEPOIS da importacao, nao toca:
 *     o numero atual e de outra pessoa, e o resumo avisa.
 */
export async function desfazerLote(
  loteId: string
): Promise<{ ok: boolean; erro?: string; desfeitos: number; mantidos: string[] }> {
  const supabase = await supabaseServer();
  const { data: lote, error: e0 } = await supabase
    .from("importacoes")
    .select("id, empresa_id, desfeita_em")
    .eq("id", loteId)
    .maybeSingle();
  if (e0 || !lote) return { ok: false, erro: e0?.message ?? "Importação não encontrada.", desfeitos: 0, mantidos: [] };
  if (lote.desfeita_em) return { ok: false, erro: "Esta importação já foi desfeita.", desfeitos: 0, mantidos: [] };

  const itens: Record<string, unknown>[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from("importacao_itens")
      .select("id, tabela, registro_id, loja_id, data, tipo_venda, valor, valor_anterior, linha_arquivo")
      .eq("importacao_id", loteId)
      .order("id")
      .range(de, de + PAGINA - 1);
    if (error) return { ok: false, erro: error.message, desfeitos: 0, mantidos: [] };
    itens.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }

  let desfeitos = 0;
  const mantidos: string[] = [];
  for (const it of itens) {
    const tabela = it.tabela as "pagamentos" | "receitas" | "caixa_diario";
    if (tabela === "pagamentos" || tabela === "receitas") {
      const r = await excluirLancamento(tabela, it.registro_id as string);
      if (!r.ok) return { ok: false, erro: r.erro, desfeitos, mantidos };
      desfeitos++;
      continue;
    }
    const { data: atual, error } = await supabase
      .from("caixa_diario")
      .select("id, valor")
      .eq("empresa_id", lote.empresa_id)
      .eq("loja_id", it.loja_id as string)
      .eq("data", it.data as string)
      .eq("tipo_venda", it.tipo_venda as number)
      .maybeSingle();
    if (error) return { ok: false, erro: error.message, desfeitos, mantidos };
    if (!atual) { desfeitos++; continue; }
    if (Math.round(Number(atual.valor) * 100) !== Math.round(Number(it.valor) * 100)) {
      mantidos.push(`linha ${it.linha_arquivo}: o dia ${it.data} foi alterado depois da importação e foi mantido`);
      continue;
    }
    if (it.valor_anterior === null || it.valor_anterior === undefined) {
      const r = await excluirLancamento("caixa_diario", atual.id);
      if (!r.ok) return { ok: false, erro: r.erro, desfeitos, mantidos };
    } else {
      const fd = new FormData();
      fd.set("empresa_id", lote.empresa_id);
      fd.set("loja_id", it.loja_id as string);
      fd.set("data", it.data as string);
      fd.set("tipo_venda", String(it.tipo_venda));
      fd.set("valor", valorBR(Number(it.valor_anterior)));
      const r = await salvarCaixa(fd);
      if (!r.ok) return { ok: false, erro: r.erro, desfeitos, mantidos };
    }
    desfeitos++;
  }

  const { data: sessao } = await supabase.auth.getUser();
  const { error: e2 } = await supabase
    .from("importacoes")
    .update({ desfeita_em: new Date().toISOString(), desfeita_por: sessao.user?.id ?? null })
    .eq("id", loteId);
  if (e2) return { ok: false, erro: e2.message, desfeitos, mantidos };

  revalidatePath("/importar");
  revalidatePath("/dre");
  revalidatePath("/dfc");
  return { ok: true, desfeitos, mantidos };
}
