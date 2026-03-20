import { RadixPaymentRequirements, RadixPaymentPayload } from "@x402/radix-core";
import { networkIdFromCaip2, DEFAULT_EPOCH_SAFETY_WINDOW } from "@x402/radix-core";
import { RadixSigner } from "./signer.js";
import { buildSponsoredManifest, buildNonSponsoredManifest } from "./manifest-builder.js";

export interface ExactRadixClientSchemeOptions {
  signer: RadixSigner;
  accountAddress: string;
}

export class ExactRadixClientScheme {
  private signer: RadixSigner;
  private accountAddress: string;

  constructor(opts: ExactRadixClientSchemeOptions) {
    this.signer = opts.signer;
    this.accountAddress = opts.accountAddress;
  }

  scheme(): string { return "exact"; }

  async createPaymentPayload(requirements: RadixPaymentRequirements): Promise<RadixPaymentPayload> {
    const mode = requirements.extra.mode;
    const networkId = networkIdFromCaip2(requirements.network);
    const discriminator = BigInt(requirements.extra.intentDiscriminator);

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
    _networkId: number,
    _discriminator: bigint,
  ): Promise<string> {
    // 1. Build manifest string
    const _manifest = buildSponsoredManifest(requirements, this.accountAddress);

    // 2. Build SubintentV2 with IntentHeaderV2:
    //    - network_id: networkId
    //    - intent_discriminator: discriminator (u64)
    //    - max_proposer_timestamp_exclusive: now + maxTimeoutSeconds
    //    - start_epoch_inclusive: currentEpoch (wide safety window)
    //    - end_epoch_exclusive: currentEpoch + DEFAULT_EPOCH_SAFETY_WINDOW
    //    - Compiled manifest, empty blobs/messages/children
    // 3. Sign -> SignedPartialTransactionV2
    // 4. SBOR-encode -> hex
    void this.signer;
    void DEFAULT_EPOCH_SAFETY_WINDOW;

    // TODO: Requires V2 SubintentBuilder. See SPEC-toolkit-strategy.md.
    throw new Error(
      "Sponsored mode requires V2 SubintentBuilder. " +
      "See SPEC-toolkit-strategy.md for implementation approach."
    );
  }

  private async buildNonSponsored(
    requirements: RadixPaymentRequirements,
    _networkId: number,
    _discriminator: bigint,
  ): Promise<string> {
    // 1. Build manifest string
    const _manifest = buildNonSponsoredManifest(requirements, this.accountAddress);

    // 2. Build TransactionV2 with:
    //    - TransactionHeaderV2 (notary = agent's key, notary_is_signatory: true)
    //    - IntentHeaderV2 for root intent (same temporal fields as sponsored)
    //    - No subintents (non_root_subintents: empty)
    // 3. Sign + notarize -> NotarizedTransactionV2
    // 4. SBOR-encode -> hex

    // TODO: Also requires V2 builder. TS toolkit only has V1 TransactionBuilder.
    throw new Error(
      "Non-sponsored mode requires V2 TransactionBuilder. " +
      "See SPEC-toolkit-strategy.md for implementation approach."
    );
  }
}
