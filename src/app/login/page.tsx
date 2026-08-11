import { carregarMarca, urlDaLogo, MARCA_PADRAO } from "@/lib/marca";
import FormLogin from "./FormLogin";

/* Server component so para conseguir ler a marca antes de desenhar: o nome e a
   logo do topo saem do banco, nao do codigo.

   Sem sessao, marca_efetiva() devolve a marca da plataforma -- e essa e a
   limitacao honesta desta tela: quem ainda nao entrou nao tem como ser
   identificado, entao ve a marca do produto. Marca de consultor no login exige
   um endereco proprio por consultor (ex: /entrar/<apelido>). */
export default async function LoginPage() {
  const marca = await carregarMarca();
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
        <p className="mb-6 text-sm text-slate-500">{marca.tagline}</p>
        <FormLogin />
      </div>
    </main>
  );
}
