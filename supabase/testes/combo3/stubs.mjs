// next/headers
export async function cookies() {
  return { get: () => undefined, getAll: () => [], set: () => {} };
}
export async function headers() {
  return new Map();
}
// next/cache
export const revalidados = [];
export function revalidatePath(p) {
  revalidados.push(p);
}
// react
export const cache = (fn) => fn;
