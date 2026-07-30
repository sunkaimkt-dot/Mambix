"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase-server";

function texto(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function numero(fd: FormData, k: string) {
  const v = texto(fd, k);
  if (v === null) return null;
  return Number(v.replace(/\./g, "").replace(",", "."));
}

export async function salvarPagamento(fd: FormData) {
  const supabase = await supabaseServer();
  const empresa_id = texto(fd, "empresa_id")!;
  const { error } = await supabase.from("pagamentos").insert({
    empresa_id,
    loja_id: texto(fd, "loja_id"),
    data: texto(fd, "data")!,
    cfc: Number(fd.get("cfc")),
    cd: Number(fd.get("cd")),
    descricao: texto(fd, "descricao") ?? "",
    comp_mes: Number(fd.get("comp_mes")),
    comp_ano: Number(fd.get("comp_ano")),
    valor: numero(fd, "valor"),
    banco_id: texto(fd, "banco_id"),
    cp: fd.get("cp") ? Number(fd.get("cp")) : null,
    pago: fd.get("pago") === "on",
    cod_familia: fd.get("cod_familia") ? Number(fd.get("cod_familia")) : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/pagamentos");
}

export async function salvarReceita(fd: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("receitas").insert({
    empresa_id: texto(fd, "empresa_id")!,
    loja_id: texto(fd, "loja_id"),
    data: texto(fd, "data")!,
    descricao: texto(fd, "descricao") ?? "",
    valor: numero(fd, "valor"),
    banco_id: texto(fd, "banco_id"),
    tipo_recebimento: Number(fd.get("tipo_recebimento")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/receitas");
}

export async function salvarCaixa(fd: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("caixa_diario").upsert(
    {
      empresa_id: texto(fd, "empresa_id")!,
      loja_id: texto(fd, "loja_id"),
      data: texto(fd, "data")!,
      tipo_venda: Number(fd.get("tipo_venda")),
      valor: numero(fd, "valor"),
    },
    { onConflict: "empresa_id,loja_id,data,tipo_venda" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/caixa");
}

export async function alternarPago(id: string, pago: boolean) {
  const supabase = await supabaseServer();
  await supabase.from("pagamentos").update({ pago }).eq("id", id);
  revalidatePath("/pagamentos");
}

export async function excluirLancamento(tabela: "pagamentos" | "receitas" | "caixa_diario", id: string) {
  const supabase = await supabaseServer();
  await supabase.from(tabela).delete().eq("id", id);
  revalidatePath("/pagamentos");
  revalidatePath("/receitas");
  revalidatePath("/caixa");
}
