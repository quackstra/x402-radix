use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

mod builder;

/// Result type returned to JS as JSON
#[derive(Serialize, Deserialize)]
pub struct WasmResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

impl WasmResult {
    fn ok(data: String) -> String {
        serde_json::to_string(&WasmResult {
            success: true,
            data: Some(data),
            error: None,
        })
        .unwrap()
    }

    fn err(error: String) -> String {
        serde_json::to_string(&WasmResult {
            success: false,
            data: None,
            error: Some(error),
        })
        .unwrap()
    }
}

/// Build a SignedPartialTransactionV2 for x402 sponsored mode.
///
/// Returns JSON: { success: bool, data?: hex_string, error?: string }
///
/// Parameters (all as JSON string):
/// {
///   "manifest_string": "VERIFY_PARENT ... YIELD_TO_PARENT ...",
///   "network_id": 2,
///   "intent_discriminator": "8374029156381940237",
///   "max_proposer_timestamp_secs": 1711000000,
///   "start_epoch": 1000,
///   "end_epoch": 2000,
///   "signer_private_key_hex": "deadbeef..."
/// }
#[wasm_bindgen]
pub fn build_signed_partial_transaction(input_json: &str) -> String {
    let input: builder::SponsoredInput = match serde_json::from_str(input_json) {
        Ok(v) => v,
        Err(e) => return WasmResult::err(format!("Invalid input JSON: {e}")),
    };
    match builder::build_signed_partial_tx(input) {
        Ok(hex) => WasmResult::ok(hex),
        Err(e) => WasmResult::err(format!("{e}")),
    }
}

/// Build a NotarizedTransactionV2 for x402 non-sponsored mode.
///
/// Returns JSON: { success: bool, data?: hex_string, error?: string }
#[wasm_bindgen]
pub fn build_notarized_transaction_v2(input_json: &str) -> String {
    let input: builder::NonSponsoredInput = match serde_json::from_str(input_json) {
        Ok(v) => v,
        Err(e) => return WasmResult::err(format!("Invalid input JSON: {e}")),
    };
    match builder::build_notarized_tx_v2(input) {
        Ok(hex) => WasmResult::ok(hex),
        Err(e) => WasmResult::err(format!("{e}")),
    }
}

/// Wrap a SignedPartialTransactionV2 (hex) in a root NotarizedTransactionV2.
/// Used by the facilitator to compose the final settlement transaction.
///
/// Returns JSON: { success: bool, data?: hex_string, error?: string }
#[wasm_bindgen]
pub fn wrap_subintent_in_root_transaction(input_json: &str) -> String {
    let input: builder::WrapInput = match serde_json::from_str(input_json) {
        Ok(v) => v,
        Err(e) => return WasmResult::err(format!("Invalid input JSON: {e}")),
    };
    match builder::wrap_subintent_in_root_tx(input) {
        Ok(hex) => WasmResult::ok(hex),
        Err(e) => WasmResult::err(format!("{e}")),
    }
}

/// Decompile a SignedPartialTransactionV2 from hex and return its manifest string + header.
/// Used by the server/facilitator for verification.
///
/// Returns JSON: { success: bool, data?: decompiled_json, error?: string }
#[wasm_bindgen]
pub fn decompile_signed_partial_transaction(input_json: &str) -> String {
    let input: builder::DecompileInput = match serde_json::from_str(input_json) {
        Ok(v) => v,
        Err(e) => return WasmResult::err(format!("Invalid input JSON: {e}")),
    };
    match builder::decompile_signed_partial_tx(input) {
        Ok(json) => WasmResult::ok(json),
        Err(e) => WasmResult::err(format!("{e}")),
    }
}

/// Decompile a NotarizedTransactionV2 from hex and return its manifest string + header.
/// Used by the server/facilitator for verification of non-sponsored payments.
///
/// Returns JSON: { success: bool, data?: decompiled_json, error?: string }
#[wasm_bindgen]
pub fn decompile_notarized_transaction_v2(input_json: &str) -> String {
    let input: builder::DecompileInput = match serde_json::from_str(input_json) {
        Ok(v) => v,
        Err(e) => return WasmResult::err(format!("Invalid input JSON: {e}")),
    };
    match builder::decompile_notarized_tx_v2(input) {
        Ok(json) => WasmResult::ok(json),
        Err(e) => WasmResult::err(format!("{e}")),
    }
}
