import {
  RadixPaymentPayload, RadixPaymentRequirements,
  RadixVerificationResult, FacilitatorConfig,
} from "@x402/radix-core";
import { verifyRadixPayment, ReplayStore } from "./verify.js";

export interface ExactRadixServerSchemeOptions {
  config: FacilitatorConfig;
  replayStore: ReplayStore;
  getCurrentProposerTimestamp: () => Promise<number>;
  getCurrentEpoch: () => Promise<number>;
}

export class ExactRadixServerScheme {
  private opts: ExactRadixServerSchemeOptions;

  constructor(opts: ExactRadixServerSchemeOptions) {
    this.opts = opts;
  }

  scheme(): string { return "exact"; }

  async verify(
    payload: RadixPaymentPayload,
    requirements: RadixPaymentRequirements,
  ): Promise<RadixVerificationResult> {
    const timestamp = await this.opts.getCurrentProposerTimestamp();
    const epoch = await this.opts.getCurrentEpoch();
    return verifyRadixPayment(
      payload, requirements, this.opts.config,
      this.opts.replayStore, timestamp, epoch,
    );
  }
}
