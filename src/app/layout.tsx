import type { Metadata } from "next";
import { carregarMarca, variaveisDaMarca } from "@/lib/marca";
import "./globals.css";

/* O nome da aba tambem e white-label: quem abre o sistema pela conta de um
   consultor le a marca dele, nao a do produto. */
export async function generateMetadata(): Promise<Metadata> {
  const marca = await carregarMarca();
  const nome = marca.nome_exibido ?? "MAMBIX";
  return {
    title: marca.tagline ? `${nome} — ${marca.tagline}` : nome,
    description: "DRE gerencial, fluxo de caixa e evolução financeira",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const marca = await carregarMarca();

  /* As variaveis entram no <html> para valerem em tudo -- inclusive nas telas
     de login e de convite, que ficam fora do layout do aplicativo. */
  return (
    <html lang="pt-BR" style={variaveisDaMarca(marca)}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
