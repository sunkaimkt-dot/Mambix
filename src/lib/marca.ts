import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";
import { COOKIE_EMPRESA, COOKIE_CONSULTOR, MARCA_PADRAO, type Marca } from "@/lib/marca-comum";

/* Lado servidor da marca: le o cookie e pergunta ao banco.
   Quem faz a heranca (empresa -> cliente -> gestor -> plataforma) e a funcao
   marca_efetiva(), campo a campo. Aqui so se busca. */

export { MARCA_PADRAO, COOKIE_EMPRESA, COOKIE_CONSULTOR, variaveisDaMarca, urlDaLogo } from "@/lib/marca-comum";
export type { Marca } from "@/lib/marca-comum";

/* Cookie que lembra por qual consultor a pessoa entrou. E o que faz a sessao
   expirada voltar para /mambix em vez de despejar o cliente na porta da
   Nortex. */
export async function consultorDoCookie(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(COOKIE_CONSULTOR)?.value ?? null;
  // Vem do navegador: so passa se tiver a cara de um apelido.
  return v && /^[a-z0-9][a-z0-9-]{1,30}$/.test(v) ? v : null;
}

/* Para onde mandar quem nao esta autenticado.
   Se a pessoa entrou um dia pela porta de um consultor, volta para la; senao,
   vai para a porta da plataforma. */
export async function portaDeEntrada(): Promise<string> {
  const consultor = await consultorDoCookie();
  return consultor ? `/${consultor}` : "/admin";
}

export async function empresaDoCookie(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(COOKIE_EMPRESA)?.value ?? null;
  // Vem do navegador, entao nao se confia no formato: uuid ou nada.
  return v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

/* Envolvida em cache() do React: o layout e o <title> pedem a mesma marca na
   mesma requisicao, e sem isso seriam duas idas ao banco por pagina. */
/* Marca da plataforma, sem passar pelo cookie de empresa.
   A tela /admin e a porta da Nortex e tem que mostrar a Nortex, mesmo que o
   navegador ainda carregue a ultima empresa aberta. */
export const marcaDaPlataforma = cache(async function marcaDaPlataforma(): Promise<Marca> {
  return carregarMarca(null, true);
});

export const carregarMarca = cache(async function carregarMarca(
  empresaId?: string | null,
  ignorarCookie = false,
): Promise<Marca> {
  const alvo = empresaId ?? (ignorarCookie ? null : await empresaDoCookie());
  // A porta de entrada entra como ultimo criterio: so vale quando nada mais
  // identifica de qual BPO a pessoa e. Ver comentario da migration 0011.
  const consultor = ignorarCookie ? null : await consultorDoCookie();
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc("marca_efetiva", {
      p_empresa: alvo,
      p_consultor: consultor,
    });
    if (error) return MARCA_PADRAO;
    const m = (Array.isArray(data) ? data[0] : data) as Partial<Marca> | null;
    if (!m) return MARCA_PADRAO;
    return {
      logo_url: m.logo_url ?? null,
      logo_negativo_url: m.logo_negativo_url ?? null,
      nome_exibido: m.nome_exibido ?? MARCA_PADRAO.nome_exibido,
      tagline: m.tagline ?? MARCA_PADRAO.tagline,
      cor_primaria: m.cor_primaria ?? MARCA_PADRAO.cor_primaria,
      cor_secundaria: m.cor_secundaria ?? MARCA_PADRAO.cor_secundaria,
      cor_positivo: m.cor_positivo ?? MARCA_PADRAO.cor_positivo,
      cor_negativo: m.cor_negativo ?? MARCA_PADRAO.cor_negativo,
    };
  } catch {
    return MARCA_PADRAO;
  }
});
