import { souAdministrador } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import { urlDaLogo, type Marca } from "@/lib/marca";
import FormMarca, { type Alvo } from "./FormMarca";

/**
 * Marca e cores da Mambix.
 *
 * Desde 02/10/2026 existe uma marca so -- a da Mambix -- e ela vale para a
 * equipe e para todos os clientes. Quem edita: o dono e os administradores da
 * equipe (o banco confere em posso_editar_marca).
 */
export default async function PaginaMarca() {
  if (!(await souAdministrador())) {
    return (
      <main className="p-6">
        <h1 className="text-lg font-bold">Marca e cores</h1>
        <p className="mt-2 text-sm text-slate-500">A identidade visual é definida pela administração da Mambix.</p>
      </main>
    );
  }

  const supabase = await supabaseServer();
  const { data: m } = await supabase
    .from("marcas")
    .select("*")
    .is("gestor_id", null)
    .is("cliente_id", null)
    .is("empresa_id", null)
    .maybeSingle();

  const chave = "plataforma:geral";
  const valores: Record<string, Marca> = m
    ? {
        [chave]: {
          logo_url: m.logo_url,
          logo_negativo_url: m.logo_negativo_url,
          nome_exibido: m.nome_exibido,
          tagline: m.tagline,
          cor_primaria: m.cor_primaria,
          cor_secundaria: m.cor_secundaria,
          cor_positivo: m.cor_positivo,
          cor_negativo: m.cor_negativo,
        },
      }
    : {};

  const alvos: Alvo[] = [{ nivel: "plataforma", id: null, rotulo: "Mambix", grupo: "Mambix", pai: null }];
  const logos: Record<string, string | null> = { [chave]: urlDaLogo(m?.logo_url ?? null) };

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold">Marca e cores</h1>
        <p className="text-sm text-slate-500">
          Logo, nome e cores da Mambix. Vale para a equipe e para todos os clientes.
        </p>
      </div>
      <FormMarca alvos={alvos} valores={valores} logos={logos} />
    </main>
  );
}
