// Loader do teste do Combo 3 (Node >= 22.6, com --experimental-strip-types).
// Resolve o alias "@/..." do tsconfig e troca o que depende do Next/Supabase:
//   @/lib/supabase-server -> pglite-supabase.mjs (Postgres REAL em memoria,
//                            com as migrations, RLS e triggers)
//   next/headers, next/cache, react -> stubs
// Assim o teste roda as actions e os relatorios DE VERDADE (acoes.ts,
// relatorios.ts, importacao-acoes.ts, simulador-dados.ts).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SRC = join(AQUI, "..", "..", "..", "src");

const TROCAS = {
  "@/lib/supabase-server": join(AQUI, "pglite-supabase.mjs"),
  "next/headers": join(AQUI, "stubs.mjs"),
  "next/cache": join(AQUI, "stubs.mjs"),
  react: join(AQUI, "stubs.mjs"),
};

export async function resolve(spec, ctx, next) {
  if (TROCAS[spec]) return { url: pathToFileURL(TROCAS[spec]).href, shortCircuit: true };
  if (spec.startsWith("@/")) {
    const base = join(SRC, spec.slice(2));
    for (const ext of ["", ".ts", ".tsx", "/index.ts"]) {
      if (existsSync(base + ext) && (ext !== "" || /\.[mc]?[jt]sx?$/.test(base))) {
        return { url: pathToFileURL(base + ext).href, shortCircuit: true };
      }
    }
  }
  return next(spec, ctx);
}
