"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Item = { href: string; rotulo: string; pronto: boolean };
type Grupo = { titulo: string; itens: Item[]; soGestor?: boolean };

const GRUPOS: Grupo[] = [
  {
    titulo: "Lançamentos",
    itens: [
      { href: "/pagamentos", rotulo: "Pagamentos", pronto: true },
      { href: "/em-aberto", rotulo: "Contas em aberto", pronto: true },
      { href: "/receitas", rotulo: "Receitas", pronto: true },
      { href: "/caixa", rotulo: "Caixa Diário", pronto: true },
      { href: "/parametros", rotulo: "Parâmetros do mês", pronto: true },
      { href: "/importar", rotulo: "Importar Excel / PDF", pronto: true },
    ],
  },
  {
    titulo: "Relatórios",
    itens: [
      { href: "/dre", rotulo: "DRE Gerencial", pronto: true },
      { href: "/dfc", rotulo: "Fluxo de Caixa (DFC)", pronto: true },
      { href: "/dre-contabil", rotulo: "DRE Contábil", pronto: true },
      { href: "/fluxo-contabil", rotulo: "Fluxo Contábil", pronto: true },
      { href: "/fluxo-diario", rotulo: "Fluxo Diário", pronto: true },
      { href: "/faturamento-diario", rotulo: "Faturamento Diário", pronto: true },
      { href: "/impressao", rotulo: "Impressão / PDF", pronto: true },
    ],
  },
  {
    titulo: "Análises",
    itens: [
      { href: "/evolucao-dre", rotulo: "Evolução DRE", pronto: true },
      { href: "/evolucao-dfc", rotulo: "Evolução DFC", pronto: true },
      { href: "/graficos", rotulo: "Gráficos", pronto: false },
      { href: "/simulador", rotulo: "Simulador de cenários", pronto: true },
      { href: "/familia", rotulo: "DRE Família", pronto: false },
    ],
  },
  {
    titulo: "Administração",
    soGestor: true,
    itens: [
      { href: "/carteira", rotulo: "Minha carteira", pronto: true },
      { href: "/codigos", rotulo: "Códigos e listas", pronto: true },
    ],
  },
  {
    // Fica fora do grupo acima porque o cliente final tambem personaliza a
    // propria marca -- o RLS e que limita ate onde ele mexe.
    titulo: "Personalização",
    itens: [{ href: "/marca", rotulo: "Marca e cores", pronto: true }],
  },
];

function Cadeado() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5V10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Navegacao({ papel = "empresario" }: { papel?: "plataforma" | "gestor" | "empresario" }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();

  // Cliente final nao ve a area de administracao. Isso e conveniencia de tela --
  // o bloqueio de verdade esta no RLS: mesmo digitando a URL ele nao ve dado alheio.
  const grupos = GRUPOS.filter((g) => !g.soGestor || papel !== "empresario");

  return (
    <nav className="space-y-6">
      <Link
        href={`/dashboard${qs ? `?${qs}` : ""}`}
        className={`block rounded-lg px-3 py-2 text-sm font-medium ${
          pathname === "/dashboard" ? "bg-marca-clara text-marca" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        Painel
      </Link>

      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.titulo}</p>
          <ul className="space-y-0.5">
            {g.itens.map((i) =>
              i.pronto ? (
                <li key={i.href}>
                  <Link
                    href={`${i.href}${qs ? `?${qs}` : ""}`}
                    className={`block rounded-lg px-3 py-2 text-sm ${
                      pathname === i.href
                        ? "bg-marca-clara font-medium text-marca"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {i.rotulo}
                  </Link>
                </li>
              ) : (
                <li key={i.href}>
                  <span
                    title="Em construção — ainda não disponível para teste"
                    className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-300"
                  >
                    <Cadeado />
                    {i.rotulo}
                  </span>
                </li>
              )
            )}
          </ul>
        </div>
      ))}

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
        Itens com cadeado estão em construção e serão liberados nas próximas etapas.
      </p>
    </nav>
  );
}
