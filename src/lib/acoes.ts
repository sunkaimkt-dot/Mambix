"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase-server";

export type Resultado = { ok: boolean; erro?: string };

function texto(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function numero(fd: FormData, k: string) {
  const v = texto(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function amigavel(msg: string) {
  if (msg.includes("row-level security")) {
    return "Você não tem permissão para gravar nesta empresa. Fale com o consultor responsável.";
  }
  if (msg.includes("violates not-null")) return "Preencha todos os campos obrigatórios.";
  if (msg.includes("duplicate key")) return "Este lançamento já existe.";
  return msg;
}

export async function salvarPagamento(fd: FormData): Promise<Resultado> {
  const valor = numero(fd, "valor");
  const cd = Number(fd.get("cd"));
  if (valor === null || valor === 0) return { ok: false, erro: "Informe um valor válido." };
  if (!cd) return { ok: false, erro: "Selecione o código da despesa." };

  const supabase = await supabaseServer();
  const { error } = await supabase.from("pagamentos").insert({
    empresa_id: texto(fd, "empresa_id")!,
    loja_id: texto(fd, "loja_id"),
    data: texto(fd, "data")!,
    cfc: Number(fd.get("cfc")),
    cd,
    descricao: texto(fd, "descricao") ?? "",
    comp_mes: Number(fd.get("comp_mes")),
    comp_ano: Number(fd.get("comp_ano")),
    valor,
    banco_id: texto(fd, "banco_id"),
    cp: fd.get("cp") ? Number(fd.get("cp")) : null,
    pago: fd.get("pago") === "on",
    cod_familia: fd.get("cod_familia") ? Number(fd.get("cod_familia")) : null,
  });
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/pagamentos");
  return { ok: true };
}

export async function salvarReceita(fd: FormData): Promise<Resultado> {
  const valor = numero(fd, "valor");
  if (valor === null || valor === 0) return { ok: false, erro: "Informe um valor válido." };

  const supabase = await supabaseServer();
  const { error } = await supabase.from("receitas").insert({
    empresa_id: texto(fd, "empresa_id")!,
    loja_id: texto(fd, "loja_id"),
    data: texto(fd, "data")!,
    descricao: texto(fd, "descricao") ?? "",
    valor,
    banco_id: texto(fd, "banco_id"),
    tipo_recebimento: Number(fd.get("tipo_recebimento")),
  });
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/receitas");
  return { ok: true };
}

export async function salvarCaixa(fd: FormData): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("caixa_diario").upsert(
    {
      empresa_id: texto(fd, "empresa_id")!,
      loja_id: texto(fd, "loja_id"),
      data: texto(fd, "data")!,
      tipo_venda: Number(fd.get("tipo_venda")),
      valor: numero(fd, "valor") ?? 0,
    },
    { onConflict: "empresa_id,loja_id,data,tipo_venda" }
  );
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/caixa");
  return { ok: true };
}

export async function salvarParametros(fd: FormData): Promise<Resultado> {
  const supabase = await supabaseServer();
  const margemTxt = texto(fd, "margem");
  const clientesTxt = texto(fd, "clientes");
  const { error } = await supabase.from("parametros_mes").upsert(
    {
      empresa_id: texto(fd, "empresa_id")!,
      ano: Number(fd.get("ano")),
      mes: Number(fd.get("mes")),
      margem_bruta_pct: margemTxt ? Number(margemTxt.replace(",", ".")) / 100 : null,
      clientes: clientesTxt ? Number(clientesTxt) : null,
    },
    { onConflict: "empresa_id,ano,mes" }
  );
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/parametros");
  revalidatePath("/dre");
  return { ok: true };
}

export async function alternarPago(id: string, pago: boolean): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("pagamentos").update({ pago }).eq("id", id);
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/pagamentos");
  return { ok: true };
}

export async function excluirLancamento(
  tabela: "pagamentos" | "receitas" | "caixa_diario",
  id: string
): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error) return { ok: false, erro: amigavel(error.message) };
  revalidatePath("/pagamentos");
  revalidatePath("/receitas");
  revalidatePath("/caixa");
  return { ok: true };
}
