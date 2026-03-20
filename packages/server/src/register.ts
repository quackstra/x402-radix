import { ExactRadixServerScheme, ExactRadixServerSchemeOptions } from "./scheme.js";

export function registerExactRadixServerScheme(
  server: { register: (network: string, scheme: ExactRadixServerScheme) => void },
  opts: ExactRadixServerSchemeOptions,
): void {
  const scheme = new ExactRadixServerScheme(opts);
  server.register("radix:mainnet", scheme);
  server.register("radix:stokenet", scheme);
}
