import { supabaseServer } from "@/lib/supabase-server";
import { primeiroDia, ultimoDia } from "@/lib/contexto";
import { GRUPOS_DRE, GRUPOS_DFC_EXTRA } from "@/lib/formato";

export type LinhaCodigo = { codigo: number; nome: string; valor: number };
export type Grupo = { chave: string; rotulo: string; de: number; ate: number; total: number };

/** DRE = regime de competencia: pagamentos cujo comp_mes/comp_ano batem, pagos ou nao. */
export async function dadosDRE(empresaId: string, ano: number, mes: number, lojaId: string | null) {
  const supabase = await supabaseServer();

  let q = supabase
    .from("pagamentos")
    .select("cd, valor, loja_id")
    .eq("empresa_id", empresaId)
    .eq("comp_ano", ano)
    .eq("comp_mes", mes);
  if (lojaId) q = q.eq("loja_id", lojaId);

  let qv = supabase
    .from("caixa_diario")
    .select("tipo_venda, valor, loja_id")
    .eq("empresa_id", empresaId)
    .gte("data", primeiroDia(ano, mes))
    .lte("data", ultimoDia(ano, mes));
  if (lojaId) qv = qv.eq("loja_id", lojaId);

  const [pagRes, vendasRes, codigosRes, tiposRes, paramRes] = await Promise.all([
    q,
    qv,
    supabase.from("codigos_despesa").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("tipos_venda").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("parametros_mes").select("margem_bruta_pct").eq("empresa_id", empresaId).eq("ano", ano).eq("mes", mes).maybeSingle(),
  ]);

  const pagamentos = pagRes.data ?? [];
  const codigos = codigosRes.data ?? [];

  const porCodigo: LinhaCodigo[] = codigos.map((c) => ({
    codigo: c.codigo,
    nome: c.nome,
    valor: pagamentos.filter((p) => p.cd === c.codigo).reduce((s, p) => s + Number(p.valor), 0),
  }));

  const grupos: Grupo[] = GRUPOS_DRE.map((g) => ({
    ...g,
    total: porCodigo.filter((c) => c.codigo >= g.de && c.codigo <= g.ate).reduce((s, c) => s + c.valor, 0),
  }));

  const vendas = vendasRes.data ?? [];
  const porTipoVenda = (tiposRes.data ?? [])
    .filter((t) => t.nome !== "")
    .map((t) => ({
      codigo: t.codigo,
      nome: t.nome,
      valor: vendas.filter((v) => v.tipo_venda === t.codigo).reduce((s, v) => s + Number(v.valor), 0),
    }));

  const faturamento = vendas.reduce((s, v) => s + Number(v.valor), 0);
  const despesas = grupos.reduce((s, g) => s + g.total, 0);
  const margem = Number(paramRes.data?.margem_bruta_pct ?? 0);
  const lucroBruto = faturamento * margem;
  const cmv = faturamento - lucroBruto;
  const resultado = lucroBruto - despesas;

  return { porCodigo, grupos, porTipoVenda, faturamento, despesas, margem, lucroBruto, cmv, resultado };
}

/** DFC = regime de caixa: so o que foi pago/recebido dentro do mes. */
export async function dadosDFC(empresaId: string, ano: number, mes: number, lojaId: string | null) {
  const supabase = await supabaseServer();
  const ini = primeiroDia(ano, mes);
  const fim = ultimoDia(ano, mes);

  let q = supabase
    .from("pagamentos")
    .select("cd, cfc, valor, loja_id")
    .eq("empresa_id", empresaId)
    .eq("pago", true)
    .gte("data", ini)
    .lte("data", fim);
  if (lojaId) q = q.eq("loja_id", lojaId);

  const [pagRes, recRes, codigosRes, tiposRes] = await Promise.all([
    q,
    supabase.from("receitas").select("tipo_recebimento, valor").eq("empresa_id", empresaId).gte("data", ini).lte("data", fim),
    supabase.from("codigos_despesa").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
    supabase.from("tipos_recebimento").select("codigo, nome").eq("empresa_id", empresaId).order("codigo"),
  ]);

  const pagamentos = pagRes.data ?? [];
  const porCodigo: LinhaCodigo[] = (codigosRes.data ?? []).map((c) => ({
    codigo: c.codigo,
    nome: c.nome,
    valor: pagamentos.filter((p) => p.cd === c.codigo).reduce((s, p) => s + Number(p.valor), 0),
  }));

  const grupos: Grupo[] = [...GRUPOS_DRE, ...GRUPOS_DFC_EXTRA].map((g) => ({
    ...g,
    total: porCodigo.filter((c) => c.codigo >= g.de && c.codigo <= g.ate).reduce((s, c) => s + c.valor, 0),
  }));

  const receitas = recRes.data ?? [];
  const porTipoRecebimento = (tiposRes.data ?? [])
    .filter((t) => t.nome !== "")
    .map((t) => ({
      codigo: t.codigo,
      nome: t.nome,
      valor: receitas.filter((r) => r.tipo_recebimento === t.codigo).reduce((s, r) => s + Number(r.valor), 0),
    }));

  const porCFC = [1, 2, 3, 4].map((c) => ({
    cfc: c,
    total: pagamentos.filter((p) => p.cfc === c).reduce((s, p) => s + Number(p.valor), 0),
  }));

  const entradas = receitas.reduce((s, r) => s + Number(r.valor), 0);
  const saidas = pagamentos.reduce((s, p) => s + Number(p.valor), 0);

  return { porCodigo, grupos, porTipoRecebimento, porCFC, entradas, saidas, resultado: entradas - saidas };
}
