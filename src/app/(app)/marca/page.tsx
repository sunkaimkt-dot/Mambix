import { meuPapel } from "@/lib/contexto";
import { supabaseServer } from "@/lib/supabase-server";
import { urlDaLogo, MARCA_PADRAO, type Marca } from "@/lib/marca";
import { Cartao } from "@/components/ui";
import FormMarca, { type Alvo } from "./FormMarca";

/**
 * Marca e cores.
 *
 * A tela nao decide quem pode o que -- ela lista o que o RLS deixou o usuario
 * enxergar. Plataforma recebe a base inteira; gestor, so a carteira dele; o
 * cliente final, so o proprio cliente e as empresas dele. Quem tentar salvar
 * fora disso leva recusa do banco, nao da interface.
 */
export default async function PaginaMarca() {
  const papel = await meuPapel();
  const supabase = await supabaseServer();

  const [gestoresRes, clientesRes, empresasRes, marcasRes] = await Promise.all([
    supabase.from("gestores").select("id, nome").order("nome"),
    supabase.from("clientes").select("id, nome, gestor_id").order("nome"),
    supabase.from("empresas").select("id, nome, cliente_id").order("nome"),
    supabase.from("marcas").select("*"),
  ]);

  const gestores = gestoresRes.data ?? [];
  const clientes = clientesRes.data ?? [];
  const empresas = empresasRes.data ?? [];
  const marcas = marcasRes.data ?? [];

  const chave = (nivel: string, id: string | null) => `${nivel}:${id ?? "geral"}`;

  const valores: Record<string, Marca> = {};
  for (const m of marcas) {
    const nivel = m.empresa_id ? "empresa" : m.cliente_id ? "cliente" : m.gestor_id ? "gestor" : "plataforma";
    const id = m.empresa_id ?? m.cliente_id ?? m.gestor_id ?? null;
    valores[chave(nivel, id)] = {
      logo_url: m.logo_url,
      logo_negativo_url: m.logo_negativo_url,
      nome_exibido: m.nome_exibido,
      tagline: m.tagline,
      cor_primaria: m.cor_primaria,
      cor_secundaria: m.cor_secundaria,
      cor_positivo: m.cor_positivo,
      cor_negativo: m.cor_negativo,
    };
  }

  const alvos: Alvo[] = [];

  // Só a plataforma mexe na marca do produto.
  if (papel === "plataforma") {
    const nomeDaPlataforma = valores[chave("plataforma", null)]?.nome_exibido ?? MARCA_PADRAO.nome_exibido;
    alvos.push({
      nivel: "plataforma",
      id: null,
      rotulo: `${nomeDaPlataforma} (a plataforma)`,
      grupo: "Produto",
      pai: null,
    });
  }
  // O gestor edita a propria; a plataforma edita a de todos.
  if (papel === "gestor" || papel === "plataforma") {
    for (const g of gestores) {
      alvos.push({ nivel: "gestor", id: g.id, rotulo: g.nome, grupo: "BPO financeiro", pai: chave("plataforma", null) });
    }
  }
  for (const c of clientes) {
    alvos.push({
      nivel: "cliente",
      id: c.id,
      rotulo: c.nome,
      grupo: "Clientes",
      pai: chave("gestor", c.gestor_id),
    });
  }
  for (const e of empresas) {
    const dono = clientes.find((c) => c.id === e.cliente_id);
    alvos.push({
      nivel: "empresa",
      id: e.id,
      rotulo: dono ? `${e.nome} — ${dono.nome}` : e.nome,
      grupo: "Empresas",
      pai: chave("cliente", e.cliente_id),
    });
  }

  const logos: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(valores)) logos[k] = urlDaLogo(v.logo_url);

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold">Marca e cores</h1>
        <p className="text-sm text-slate-500">
          Cada nível preenche o que quiser. O que ficar em branco desce do nível de cima — então dá para trocar só a
          logo de uma empresa e manter as cores do resto.
        </p>
      </div>

      {alvos.length === 0 ? (
        <Cartao className="p-4">
          <p className="text-sm text-slate-500">Não há nada para personalizar nesta conta ainda.</p>
        </Cartao>
      ) : (
        <FormMarca alvos={alvos} valores={valores} logos={logos} />
      )}
    </main>
  );
}
