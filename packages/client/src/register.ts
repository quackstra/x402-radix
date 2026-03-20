import { ExactRadixClientScheme, ExactRadixClientSchemeOptions } from "./scheme.js";

export function registerExactRadixClientScheme(
  client: { register: (network: string, scheme: ExactRadixClientScheme) => void },
  opts: ExactRadixClientSchemeOptions,
): void {
  const scheme = new ExactRadixClientScheme(opts);
  client.register("radix:mainnet", scheme);
  client.register("radix:stokenet", scheme);
}
