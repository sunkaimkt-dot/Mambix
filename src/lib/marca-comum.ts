/* Parte da marca que roda nos DOIS lados.
   Fica separada de `marca.ts` de proposito: aquele importa `next/headers`, que
   so existe no servidor, e o seletor de empresa e a tela de marca sao client
   components. Misturar os dois quebra o build. */

export type Marca = {
  logo_url: string | null;
  logo_negativo_url: string | null;
  nome_exibido: string | null;
  tagline: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  cor_positivo: string | null;
  cor_negativo: string | null;
};

/* Ultimo recurso, para o caso de o banco nao responder. Espelha a marca da
   Mambix gravada no banco (migration 0121) -- se as duas divergirem, a tela pisca
   uma cor no primeiro render e outra depois. */
export const MARCA_PADRAO: Marca = {
  logo_url: null,
  logo_negativo_url: null,
  nome_exibido: "MAMBIX",
  tagline: "Gestão financeira",
  cor_primaria: "#047857",
  cor_secundaria: "#059669",
  cor_positivo: "#047857",
  cor_negativo: "#DC2626",
};

/* O layout desenha a barra lateral, mas layouts do App Router nao recebem
   searchParams -- so a pagina recebe. Sem este cookie o layout nao teria como
   saber qual empresa esta aberta para pintar a marca certa.
   De quebra resolve um incomodo antigo: ao abrir uma pagina sem ?empresa= na
   URL, o sistema voltava para a primeira empresa da lista. */
export const COOKIE_EMPRESA = "empresa_ativa";

/* O banco so aceita #RRGGBB (constraint cores_hexadecimais), mas estes valores
   entram direto num atributo style: confere-se de novo antes de injetar. */
const HEX = /^#[0-9A-Fa-f]{6}$/;
const seguro = (cor: string | null, alternativa: string) => (cor && HEX.test(cor) ? cor : alternativa);

export function variaveisDaMarca(m: Marca): React.CSSProperties {
  return {
    "--marca": seguro(m.cor_primaria, MARCA_PADRAO.cor_primaria!),
    "--marca-2": seguro(m.cor_secundaria, MARCA_PADRAO.cor_secundaria!),
    "--positivo": seguro(m.cor_positivo, MARCA_PADRAO.cor_positivo!),
    "--negativo": seguro(m.cor_negativo, MARCA_PADRAO.cor_negativo!),
  } as React.CSSProperties;
}

/* O banco guarda o CAMINHO dentro do bucket (empresa/<id>/logo-123.png), nao a
   URL inteira: assim trocar de bucket ou de dominio nao exige reescrever linha.
   Se alguem colar uma URL completa, ela passa direto. */
export function urlDaLogo(caminho: string | null): string | null {
  if (!caminho) return null;
  if (caminho.startsWith("http://") || caminho.startsWith("https://")) return caminho;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/marcas/${caminho}`;
}
