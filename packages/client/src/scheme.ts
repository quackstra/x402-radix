import { RadixPaymentRequirements, RadixPaymentPayload } from "@x402/radix-core";
import { networkIdFromCaip2, DEFAULT_EPOCH_SAFETY_WINDOW } from "@x402/radix-core";
import { buildSponsoredManifest, buildNonSponsoredManifest } from "./manifest-builder.js";
import {
  build_signed_partial_transaction,
  build_notarized_transaction_v2,
} from "@x402/radix-wasm";

export interface ExactRadixClientSchemeOptions {
  /** Ed25519 private key hex used for signing transactions. */
  privateKeyHex: string;
  /** The agent's Radix account address (bech32m). */
  accountAddress: string;
  /** Returns the current epoch from a Gateway API or similar provider. */
  getCurrentEpoch: () => Promise<number>;
}

interface WasmResult {
  success: boolean;
  data?: string;
  error?: string;
}

export class ExactRadixClientScheme {
  private privateKeyHex: string;
  private accountAddress: string;
  private getCurrentEpoch: () => Promise<number>;

  constructor(opts: ExactRadixClientSchemeOptions) {
    this.privateKeyHex = opts.privateKeyHex;
    this.accountAddress = opts.accountAddress;
    this.getCurrentEpoch = opts.getCurrentEpoch;
  }

  scheme(): string { return "exact"; }

  async createPaymentPayload(requirements: RadixPaymentRequirements): Promise<RadixPaymentPayload> {
    const mode = requirements.extra.mode;
    const networkId = networkIdFromCaip2(requirements.network);
    const discriminator = requirements.extra.intentDiscriminator;

    let txHex: string;

    if (mode === "sponsored") {
      txHex = await this.buildSponsored(requirements, networkId, discriminator);
    } else {
      txHex = await this.buildNonSponsored(requirements, networkId, discriminator);
    }

    return {
      x402Version: 2,
      resource: { url: "", description: "", mimeType: "" },
      accepted: requirements,
      payload: { transaction: txHex },
    };
  }

  private async buildSponsored(
    requirements: RadixPaymentRequirements,
    networkId: number,
    discriminator: string,
  ): Promise<string> {
    const manifest = buildSponsoredManifest(requirements, this.accountAddress);
    const currentEpoch = await this.getCurrentEpoch();
    const maxProposerTimestamp = Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds;

    const input = JSON.stringify({
      manifest_string: manifest,
      network_id: networkId,
      intent_discriminator: discriminator,
      max_proposer_timestamp_secs: maxProposerTimestamp,
      start_epoch: currentEpoch,
      end_epoch: currentEpoch + DEFAULT_EPOCH_SAFETY_WINDOW,
      signer_private_key_hex: this.privateKeyHex,
    });

    const resultJson = build_signed_partial_transaction(input);
    const result: WasmResult = JSON.parse(resultJson);

    if (!result.success || !result.data) {
      throw new Error(`WASM build_signed_partial_transaction failed: ${result.error ?? "unknown error"}`);
    }

    return result.data;
  }

  private async buildNonSponsored(
    requirements: RadixPaymentRequirements,
    networkId: number,
    discriminator: string,
  ): Promise<string> {
    const manifest = buildNonSponsoredManifest(requirements, this.accountAddress);
    const currentEpoch = await this.getCurrentEpoch();
    const maxProposerTimestamp = Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds;

    // In non-sponsored mode, the signer key also acts as notary.
    const input = JSON.stringify({
      manifest_string: manifest,
      network_id: networkId,
      intent_discriminator: discriminator,
      max_proposer_timestamp_secs: maxProposerTimestamp,
      start_epoch: currentEpoch,
      end_epoch: currentEpoch + DEFAULT_EPOCH_SAFETY_WINDOW,
      signer_private_key_hex: this.privateKeyHex,
      notary_private_key_hex: this.privateKeyHex,
    });

    const resultJson = build_notarized_transaction_v2(input);
    const result: WasmResult = JSON.parse(resultJson);

    if (!result.success || !result.data) {
      throw new Error(`WASM build_notarized_transaction_v2 failed: ${result.error ?? "unknown error"}`);
    }

    return result.data;
  }
}
