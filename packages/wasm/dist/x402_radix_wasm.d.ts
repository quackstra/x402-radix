/* tslint:disable */
/* eslint-disable */

/**
 * Build a NotarizedTransactionV2 for x402 non-sponsored mode.
 *
 * Returns JSON: { success: bool, data?: hex_string, error?: string }
 */
export function build_notarized_transaction_v2(input_json: string): string;

/**
 * Build a SignedPartialTransactionV2 for x402 sponsored mode.
 *
 * Returns JSON: { success: bool, data?: hex_string, error?: string }
 *
 * Parameters (all as JSON string):
 * {
 *   "manifest_string": "VERIFY_PARENT ... YIELD_TO_PARENT ...",
 *   "network_id": 2,
 *   "intent_discriminator": "8374029156381940237",
 *   "max_proposer_timestamp_secs": 1711000000,
 *   "start_epoch": 1000,
 *   "end_epoch": 2000,
 *   "signer_private_key_hex": "deadbeef..."
 * }
 */
export function build_signed_partial_transaction(input_json: string): string;

/**
 * Decompile a NotarizedTransactionV2 from hex and return its manifest string + header.
 * Used by the server/facilitator for verification of non-sponsored payments.
 *
 * Returns JSON: { success: bool, data?: decompiled_json, error?: string }
 */
export function decompile_notarized_transaction_v2(input_json: string): string;

/**
 * Decompile a SignedPartialTransactionV2 from hex and return its manifest string + header.
 * Used by the server/facilitator for verification.
 *
 * Returns JSON: { success: bool, data?: decompiled_json, error?: string }
 */
export function decompile_signed_partial_transaction(input_json: string): string;

/**
 * Compute the intent hash of a NotarizedTransactionV2 (hex-encoded SBOR).
 * Returns the bech32m-encoded intent hash used for polling transaction status.
 *
 * Returns JSON: { success: bool, data?: intent_hash_bech32m, error?: string }
 */
export function hash_notarized_transaction_v2(input_json: string): string;

/**
 * Wrap a SignedPartialTransactionV2 (hex) in a root NotarizedTransactionV2.
 * Used by the facilitator to compose the final settlement transaction.
 *
 * Returns JSON: { success: bool, data?: hex_string, error?: string }
 */
export function wrap_subintent_in_root_transaction(input_json: string): string;
