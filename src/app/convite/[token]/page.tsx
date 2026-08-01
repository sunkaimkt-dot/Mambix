import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import AceitarConvite from "./AceitarConvite";

/**
 * Pagina de aceite do convite.
 * Quem nao estiver logado e mandado para o login e volta para ca depois -- o
 * vinculo so pode ser feito com sessao ativa, porque a funcao no banco confere
 * se o e-mail logado bate com o e-mail do convite.
 */
export default async function Convite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await supabaseServer();
  const { data: sessao } = await supabase.auth.getUser();

  if (!sessao.user) {
    redirect(`/login?proximo=${encodeURIComponent(`/convite/${token}`)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-bold">Convite de acesso</h1>
        <p className="mt-1 text-sm text-slate-500">
          Você está logado como <strong>{sessao.user.email}</strong>. O convite precisa ter sido
          enviado para este mesmo e-mail.
        </p>

        <div className="mt-5">
          <AceitarConvite token={token} />
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Não é você?{" "}
          <Link href="/auth/signout" className="text-emerald-700 hover:underline">
            Sair desta conta
          </Link>
        </p>
      </div>
    </main>
  );
}
