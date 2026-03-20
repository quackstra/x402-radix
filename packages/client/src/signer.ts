/**
 * RadixSigner interface — retained for API compatibility.
 *
 * With the WASM-based transaction builder, signing happens inside the WASM
 * module (private key hex is passed directly). This interface is kept so that
 * downstream code that references RadixSigner types continues to compile.
 * The ExactRadixClientScheme now takes `privateKeyHex` directly instead of
 * a full signer instance.
 */
export interface RadixSigner {
  publicKeyHex(): string;
  sign(hash: Uint8Array): Promise<Uint8Array>;
}

/**
 * Lightweight Ed25519 signer stub.
 *
 * Actual signing is performed inside @x402/radix-wasm. This class exists
 * only to satisfy code that needs a RadixSigner reference. The private key
 * hex should be passed to ExactRadixClientSchemeOptions.privateKeyHex for
 * real transaction building.
 */
export class RadixEd25519Signer implements RadixSigner {
  private _privateKeyHex: string;

  constructor(privateKeyHex: string) {
    this._privateKeyHex = privateKeyHex;
  }

  /** Returns the raw private key hex. Useful when constructing scheme options. */
  getPrivateKeyHex(): string { return this._privateKeyHex; }

  publicKeyHex(): string {
    // Public key derivation is handled inside WASM during transaction building.
    // If standalone derivation is needed, use @x402/radix-wasm directly.
    throw new Error(
      "Public key derivation is handled inside @x402/radix-wasm. " +
      "Pass privateKeyHex to ExactRadixClientSchemeOptions instead."
    );
  }

  async sign(_hash: Uint8Array): Promise<Uint8Array> {
    // Signing is handled inside WASM during transaction building.
    throw new Error(
      "Signing is handled inside @x402/radix-wasm. " +
      "Pass privateKeyHex to ExactRadixClientSchemeOptions instead."
    );
  }
}
