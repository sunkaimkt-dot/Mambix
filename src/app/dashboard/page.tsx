import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";

export default async function Dashboard() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfis").select("nome, papel").eq("user_id", user.id).single();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MAMBIX</h1>
          <p className="text-sm text-slate-500">
            Olá, {perfil?.nome ?? user.email} — perfil: {perfil?.papel ?? "sem perfil"}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">Sair</button>
        </form>
      </header>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Empresas</h2>
        {(empresas ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma empresa cadastrada ainda.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {empresas!.map((e) => (
              <li key={e.id} className="rounded-xl bg-white p-4 shadow">{e.nome}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
