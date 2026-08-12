"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { COOKIE_CONSULTOR } from "@/lib/marca-comum";

/**
 * @param consultor apelido de quem "dono" da porta por onde a pessoa entrou.
 *   Fica gravado em cookie para que a proxima visita -- e a sessao que expirar
 *   -- caiam na tela do consultor certo, e nao na porta da plataforma.
 */
export default function FormLogin({ consultor }: { consultor?: string }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    /* A porta de AGORA manda. Entrar por /admin apaga a lembranca de qualquer
       consultor -- senao quem entrasse uma vez por /mambix veria a marca dela
       para sempre, inclusive na porta da plataforma. */
    document.cookie = consultor
      ? `${COOKIE_CONSULTOR}=${consultor}; path=/; max-age=31536000; samesite=lax`
      : `${COOKIE_CONSULTOR}=; path=/; max-age=0; samesite=lax`;
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) { setErro("E-mail ou senha inválidos."); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">E-mail</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca-clara" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Senha</label>
        <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca-clara" />
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button disabled={carregando}
        className="w-full rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-escura disabled:opacity-50">
        {carregando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
