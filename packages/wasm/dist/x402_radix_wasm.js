/* @ts-self-types="./x402_radix_wasm.d.ts" */

/**
 * Build a NotarizedTransactionV2 for x402 non-sponsored mode.
 *
 * Returns JSON: { success: bool, data?: hex_string, error?: string }
 * @param {string} input_json
 * @returns {string}
 */
function build_notarized_transaction_v2(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.build_notarized_transaction_v2(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}
exports.build_notarized_transaction_v2 = build_notarized_transaction_v2;

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
 * @param {string} input_json
 * @returns {string}
 */
function build_signed_partial_transaction(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.build_signed_partial_transaction(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}
exports.build_signed_partial_transaction = build_signed_partial_transaction;

/**
 * Decompile a NotarizedTransactionV2 from hex and return its manifest string + header.
 * Used by the server/facilitator for verification of non-sponsored payments.
 *
 * Returns JSON: { success: bool, data?: decompiled_json, error?: string }
 * @param {string} input_json
 * @returns {string}
 */
function decompile_notarized_transaction_v2(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.decompile_notarized_transaction_v2(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}
exports.decompile_notarized_transaction_v2 = decompile_notarized_transaction_v2;

/**
 * Decompile a SignedPartialTransactionV2 from hex and return its manifest string + header.
 * Used by the server/facilitator for verification.
 *
 * Returns JSON: { success: bool, data?: decompiled_json, error?: string }
 * @param {string} input_json
 * @returns {string}
 */
function decompile_signed_partial_transaction(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.decompile_signed_partial_transaction(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}
exports.decompile_signed_partial_transaction = decompile_signed_partial_transaction;

/**
 * Derive account address, public key, and notary badge from an Ed25519 private key.
 *
 * Returns JSON: { success: bool, data?: derive_json, error?: string }
 * where derive_json = { account_address, public_key_hex, notary_badge }
 * @param {string} input_json
 * @returns {string}
 */
function derive_account_info(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.derive_account_info(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}
exports.derive_account_info = derive_account_info;

/**
 * Compute the intent hash of a NotarizedTransactionV2 (hex-encoded SBOR).
 * Returns the bech32m-encoded intent hash used for polling transaction status.
 *
 * Returns JSON: { success: bool, data?: intent_hash_bech32m, error?: string }
 * @param {string} input_json
 * @returns {string}
 */
function hash_notarized_transaction_v2(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.hash_notarized_transaction_v2(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}
exports.hash_notarized_transaction_v2 = hash_notarized_transaction_v2;

/**
 * Wrap a SignedPartialTransactionV2 (hex) in a root NotarizedTransactionV2.
 * Used by the facilitator to compose the final settlement transaction.
 *
 * Returns JSON: { success: bool, data?: hex_string, error?: string }
 * @param {string} input_json
 * @returns {string}
 */
function wrap_subintent_in_root_transaction(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wrap_subintent_in_root_transaction(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}
exports.wrap_subintent_in_root_transaction = wrap_subintent_in_root_transaction;

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./x402_radix_wasm_bg.js": import0,
    };
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
function decodeText(ptr, len) {
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

const wasmPath = `${__dirname}/x402_radix_wasm_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
let wasm = new WebAssembly.Instance(wasmModule, __wbg_get_imports()).exports;
wasm.__wbindgen_start();
