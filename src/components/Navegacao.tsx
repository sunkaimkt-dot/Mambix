"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const GRUPOS = [
  {
    titulo: "Lançamentos",
    itens: [
      { href: "/pagamentos", rotulo: "Pagamentos" },
      { href: "/receitas", rotulo: "Receitas" },
      { href: "/caixa", rotulo: "Caixa Diário" },
      { href: "/parametros", rotulo: "Parâmetros do mês" },
    ],
  },
  {
    titulo: "Relatórios",
    itens: [
      { href: "/dre", rotulo: "DRE Gerencial" },
      { href: "/dfc", rotulo: "Fluxo de Caixa (DFC)" },
      { href: "/fluxo-diario", rotulo: "Fluxo Diário" },
      { href: "/faturamento-diario", rotulo: "Faturamento Diário" },
    ],
  },
  {
    titulo: "Análises",
    itens: [
      { href: "/evolucao-dre", rotulo: "Evolução DRE" },
      { href: "/evolucao-dfc", rotulo: "Evolução DFC" },
      { href: "/simulador", rotulo: "Simulador" },
      { href: "/familia", rotulo: "DRE Família" },
    ],
  },
];

export default function Navegacao() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();

  return (
    <nav className="space-y-6">
      <Link
        href={`/dashboard${qs ? `?${qs}` : ""}`}
        className={`block rounded-lg px-3 py-2 text-sm font-medium ${
          pathname === "/dashboard" ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        Painel
      </Link>
      {GRUPOS.map((g) => (
        <div key={g.titulo}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {g.titulo}
          </p>
          <ul className="space-y-0.5">
            {g.itens.map((i) => (
              <li key={i.href}>
                <Link
                  href={`${i.href}${qs ? `?${qs}` : ""}`}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    pathname === i.href
                      ? "bg-emerald-50 font-medium text-emerald-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {i.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
