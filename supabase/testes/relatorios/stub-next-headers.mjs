export async function cookies() {
  return { get: () => undefined, getAll: () => [], set: () => {} };
}
export async function headers() {
  return new Map();
}
