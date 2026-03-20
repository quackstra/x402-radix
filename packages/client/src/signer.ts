export interface RadixSigner {
  publicKeyHex(): string;
  sign(hash: Uint8Array): Promise<Uint8Array>;
}

export class RadixEd25519Signer implements RadixSigner {
  private privateKeyHex: string;
  private _publicKeyHex: string;

  constructor(privateKeyHex: string) {
    this.privateKeyHex = privateKeyHex;
    // TODO: Derive via RadixEngineToolkit: new PrivateKey.Ed25519(hex).publicKeyHex()
    this._publicKeyHex = "";
  }

  publicKeyHex(): string { return this._publicKeyHex; }

  async sign(_hash: Uint8Array): Promise<Uint8Array> {
    // TODO: PrivateKey.Ed25519(this.privateKeyHex).sign(hash)
    void this.privateKeyHex;
    throw new Error("Not implemented — requires Radix Engine Toolkit");
  }
}
