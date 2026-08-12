"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { aceitarConvite } from "@/lib/acoes";
import { inputCls } from "@/components/ui";

/**
 * Cadastro pela porta do convite.
 *
 * O e-mail nao vem preenchido de proposito: o convite nao entrega para quem
 * abre o link o endereco de quem foi convidado. A pessoa digita, e quem confere
 * se bate e o banco, dentro de aceitar_convite().
 */
export default function CriarConta({ token }: { token: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [repetida, setRepetida] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== repetida) return setErro("As duas senhas não são iguais.");

    setIndo(true);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha });

    if (error) {
      setIndo(false);
      // "User already registered" e o caso comum de quem ja tem conta.
      if (/already/i.test(error.message)) {
        return setErro("Já existe uma conta com este e-mail. Entre com ela e abra este link de novo.");
      }
      return setErro(error.message);
    }

    // Se o projeto exigir confirmacao de e-mail, nao vem sessao agora.
    if (!data.session) {
      setIndo(false);
      return setAviso(
        "Conta criada. Confirme o e-mail que acabamos de enviar e depois abra este mesmo link para concluir."
      );
    }

    const r = await aceitarConvite(token);
    setIndo(false);
    if (!r.ok) return setErro(r.erro ?? "Conta criada, mas o convite não pôde ser aceito.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={criar} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">E-mail que recebeu o convite</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Crie uma senha</label>
        <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
        <p className="mt-1 text-[11px] text-slate-400">Mínimo de 8 caracteres.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Repita a senha</label>
        <input type="password" required value={repetida} onChange={(e) => setRepetida(e.target.value)} className={inputCls} />
      </div>

      <button
        disabled={indo}
        className="w-full rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-escura disabled:opacity-50"
      >
        {indo ? "Criando…" : "Criar conta e entrar"}
      </button>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {aviso && <p className="text-sm text-marca">{aviso}</p>}
    </form>
  );
}
