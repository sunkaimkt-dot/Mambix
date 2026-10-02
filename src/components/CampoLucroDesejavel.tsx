/**
 * Campo do "lucro desejavel %" usado no PEE (ponto de equilibrio economico).
 * PERSONALIZAVEL: o consultor digita o que quer para aquele cliente. Fica na
 * URL (?ld=12) -- ainda nao e gravado no banco; gravar por mes em Parametros
 * depende de migration e fica para decidir com o Marcelo.
 * Formulario GET simples, sem JavaScript: repete os outros parametros da URL.
 */
export default function CampoLucroDesejavel({
  sp,
  valor,
}: {
  sp: Record<string, string | string[] | undefined>;
  valor: number;
}) {
  const outros = Object.entries(sp).filter(([k, v]) => k !== "ld" && typeof v === "string") as [string, string][];
  return (
    <form method="get" className="flex items-end gap-2 print:hidden">
      {outros.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lucro desejável (%)</span>
        <input
          name="ld"
          type="number"
          min={0}
          max={99}
          step="0.1"
          defaultValue={Math.round(valor * 1000) / 10}
          className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>
      <button className="rounded-lg bg-marca px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">Recalcular</button>
    </form>
  );
}
