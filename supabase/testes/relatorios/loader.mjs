// Loader do teste de relatorios (Node >= 22.6, com --experimental-strip-types).
// Resolve o alias "@/..." do tsconfig e troca o que depende do Next/Supabase
// por versoes falsas em memoria:
//   @/lib/supabase-server -> fake-supabase.mjs (banco em memoria)
//   next/headers          -> stub (cookies vazios)
//   react (cache)         -> stub
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SRC = join(AQUI, "..", "..", "..", "src");

const TROCAS = {
  "@/lib/supabase-server": join(AQUI, "fake-supabase.mjs"),
  "next/headers": join(AQUI, "stub-next-headers.mjs"),
  react: join(AQUI, "stub-react.mjs"),
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
