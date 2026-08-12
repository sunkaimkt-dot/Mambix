import { marcaDaPlataforma, urlDaLogo, MARCA_PADRAO } from "@/lib/marca";
import FormLogin from "@/components/FormLogin";

/**
 * Porta da plataforma.
 *
 * O nome Nortex so aparece aqui. Cliente de consultor entra por /<apelido> e ve
 * a marca dele; qualquer outro endereco e 404. Isso e de proposito: o cliente
 * da Mambix nao precisa saber -- nem deveria ver -- em cima de que produto a
 * consultoria dele roda.
 */
export const dynamic = "force-dynamic";

export default async function EntradaDaPlataforma() {
  const marca = await marcaDaPlataforma();
  const logo = urlDaLogo(marca.logo_url);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={marca.nome_exibido ?? ""} className="mb-2 h-10 w-auto max-w-full object-contain" />
        ) : (
          <h1 className="mb-1 text-2xl font-bold tracking-tight">
            {marca.nome_exibido ?? MARCA_PADRAO.nome_exibido}
          </h1>
        )}
        {marca.tagline && <p className="mb-6 text-sm text-slate-500">{marca.tagline}</p>}
        <FormLogin />
      </div>
    </main>
  );
}
