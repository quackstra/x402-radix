import { GasBudgetState } from "@x402/radix-core";

export class GasBudgetTracker {
  private state: GasBudgetState;
  private maxPerRequest: number;
  private maxPerWindow: number;
  private windowDuration: number;

  constructor(maxPerRequestXrd: string, maxPerWindowXrd: string, windowDurationSeconds: number) {
    this.maxPerRequest = parseFloat(maxPerRequestXrd);
    this.maxPerWindow = parseFloat(maxPerWindowXrd);
    this.windowDuration = windowDurationSeconds;
    this.state = { windowStart: Date.now() / 1000, totalGasInWindow: 0 };
  }

  canSpend(amountXrd: number): boolean {
    this.maybeResetWindow();
    if (amountXrd > this.maxPerRequest) return false;
    if (this.state.totalGasInWindow + amountXrd > this.maxPerWindow) return false;
    return true;
  }

  record(amountXrd: number): void {
    this.maybeResetWindow();
    this.state.totalGasInWindow += amountXrd;
  }

  private maybeResetWindow(): void {
    const now = Date.now() / 1000;
    if (now - this.state.windowStart > this.windowDuration) {
      this.state = { windowStart: now, totalGasInWindow: 0 };
    }
  }
}
