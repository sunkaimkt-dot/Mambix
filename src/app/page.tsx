import { redirect, notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { consultorDoCookie } from "@/lib/marca";

/**
 * Raiz do dominio.
 *
 * Nao existe tela generica de entrada: ou a pessoa esta autenticada, ou ela
 * chegou por uma porta -- /admin (plataforma) ou /<apelido> (consultor). Quem
 * cai aqui sem nenhuma das duas coisas leva 404, porque um endereco nu nao diz
 * de quem e a casa.
 */
export default async function Home() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  // Ja entrou por um consultor um dia: volta para a porta dele.
  const consultor = await consultorDoCookie();
  if (consultor) redirect(`/${consultor}`);

  notFound();
}
