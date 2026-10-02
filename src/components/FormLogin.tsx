"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";

export default function FormLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      // A mensagem antiga dizia "senha invalida" para QUALQUER erro -- inclusive
      // banco fora do ar ou chave errada na Vercel, o que custou um dia de
      // investigacao em 02/10. Credencial errada continua com a frase de sempre.
      setErro(
        /invalid login|invalid credentials/i.test(error.message)
          ? "E-mail ou senha inválidos."
          : `Não foi possível entrar: ${error.message}`
      );
      return;
    }
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
