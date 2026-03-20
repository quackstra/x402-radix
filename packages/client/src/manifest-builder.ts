import { RadixPaymentRequirements } from "@x402/radix-core";

/**
 * Build sponsored subintent manifest (5 instructions, per canonical spec).
 * VERIFY_PARENT uses the facilitator's notaryBadge from requirements.extra.
 */
export function buildSponsoredManifest(
  requirements: RadixPaymentRequirements,
  agentAccountAddress: string,
): string {
  const notaryBadge = requirements.extra.notaryBadge;
  if (!notaryBadge) {
    throw new Error("Sponsored mode requires extra.notaryBadge in PaymentRequirements");
  }

  return `
VERIFY_PARENT
    Enum<AccessRule::Protected>(
        Enum<CompositeRequirement::BasicRequirement>(
            Enum<BasicRequirement::Require>(
                Enum<ResourceOrNonFungible::NonFungible>(
                    NonFungibleGlobalId("${notaryBadge}")
                )
            )
        )
    )
;

ASSERT_WORKTOP_IS_EMPTY;

CALL_METHOD
    Address("${agentAccountAddress}")
    "withdraw"
    Address("${requirements.asset}")
    Decimal("${requirements.amount}")
;

TAKE_ALL_FROM_WORKTOP
    Address("${requirements.asset}")
    Bucket("payment")
;

YIELD_TO_PARENT Bucket("payment");
`.trim();
}

/**
 * Build non-sponsored transaction manifest (4 instructions, per canonical spec).
 */
export function buildNonSponsoredManifest(
  requirements: RadixPaymentRequirements,
  agentAccountAddress: string,
  gasAmountXrd: string = "5",
): string {
  return `
CALL_METHOD
    Address("${agentAccountAddress}")
    "lock_fee"
    Decimal("${gasAmountXrd}")
;

CALL_METHOD
    Address("${agentAccountAddress}")
    "withdraw"
    Address("${requirements.asset}")
    Decimal("${requirements.amount}")
;

TAKE_ALL_FROM_WORKTOP
    Address("${requirements.asset}")
    Bucket("payment")
;

CALL_METHOD
    Address("${requirements.payTo}")
    "try_deposit_or_abort"
    Bucket("payment")
    None
;
`.trim();
}
