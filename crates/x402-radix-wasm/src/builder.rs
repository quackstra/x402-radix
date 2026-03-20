use radix_common::prelude::*;
use radix_transactions::manifest::compile_manifest;
use radix_transactions::manifest::MockBlobProvider;
use radix_transactions::prelude::*;
use serde::{Deserialize, Serialize};

// ─── Input types ───

#[derive(Deserialize)]
pub struct SponsoredInput {
    pub manifest_string: String,
    pub network_id: u8,
    pub intent_discriminator: String,
    pub max_proposer_timestamp_secs: i64,
    pub start_epoch: u64,
    pub end_epoch: u64,
    pub signer_private_key_hex: String,
}

#[derive(Deserialize)]
pub struct NonSponsoredInput {
    pub manifest_string: String,
    pub network_id: u8,
    pub intent_discriminator: String,
    pub max_proposer_timestamp_secs: i64,
    pub start_epoch: u64,
    pub end_epoch: u64,
    pub signer_private_key_hex: String,
    pub notary_private_key_hex: String,
}

#[derive(Deserialize)]
pub struct WrapInput {
    pub signed_partial_tx_hex: String,
    pub root_manifest_string: String,
    pub network_id: u8,
    pub notary_private_key_hex: String,
    pub start_epoch: u64,
    pub end_epoch: u64,
}

#[derive(Deserialize)]
pub struct DecompileInput {
    pub tx_hex: String,
    pub network_id: u8,
}

// ─── Output types ───

#[derive(Serialize)]
pub struct DecompiledOutput {
    pub manifest: String,
    pub network_id: u8,
    pub intent_discriminator: String,
    pub start_epoch: u64,
    pub end_epoch: u64,
    pub max_proposer_timestamp_secs: Option<i64>,
    pub min_proposer_timestamp_secs: Option<i64>,
}

// ─── Helpers ───

fn network_definition(network_id: u8) -> NetworkDefinition {
    match network_id {
        1 => NetworkDefinition::mainnet(),
        2 => NetworkDefinition::stokenet(),
        n => NetworkDefinition {
            id: n,
            logical_name: format!("network-{n}").into(),
            hrp_suffix: format!("tdx_{n}_").into(),
        },
    }
}

fn parse_ed25519_private_key(hex_str: &str) -> Result<Ed25519PrivateKey, String> {
    let bytes = hex::decode(hex_str).map_err(|e| format!("Invalid hex key: {e}"))?;
    Ed25519PrivateKey::from_bytes(&bytes).map_err(|_| "Invalid Ed25519 private key".to_string())
}

fn compile_subintent_manifest(
    manifest_string: &str,
    network_id: u8,
) -> Result<SubintentManifestV2, String> {
    let nd = network_definition(network_id);
    let blob_provider = MockBlobProvider::new();
    compile_manifest::<SubintentManifestV2>(manifest_string, &nd, blob_provider)
        .map_err(|e| format!("Subintent manifest compilation failed: {e:?}"))
}

fn compile_tx_manifest(
    manifest_string: &str,
    network_id: u8,
) -> Result<TransactionManifestV2, String> {
    let nd = network_definition(network_id);
    let blob_provider = MockBlobProvider::new();
    compile_manifest::<TransactionManifestV2>(manifest_string, &nd, blob_provider)
        .map_err(|e| format!("Transaction manifest compilation failed: {e:?}"))
}

fn build_intent_header(
    network_id: u8,
    discriminator: u64,
    max_timestamp_secs: i64,
    start_epoch: u64,
    end_epoch: u64,
) -> IntentHeaderV2 {
    IntentHeaderV2 {
        network_id,
        start_epoch_inclusive: Epoch::of(start_epoch),
        end_epoch_exclusive: Epoch::of(end_epoch),
        min_proposer_timestamp_inclusive: None,
        max_proposer_timestamp_exclusive: Some(Instant::new(max_timestamp_secs)),
        intent_discriminator: discriminator,
    }
}

fn empty_children() -> ChildSubintentSpecifiersV2 {
    ChildSubintentSpecifiersV2 {
        children: indexmap::IndexSet::new(),
    }
}

// ─── Build functions ───

/// Build a SignedPartialTransactionV2 for sponsored mode.
pub fn build_signed_partial_tx(input: SponsoredInput) -> Result<String, String> {
    let discriminator: u64 = input
        .intent_discriminator
        .parse()
        .map_err(|e| format!("Invalid discriminator: {e}"))?;

    let private_key = parse_ed25519_private_key(&input.signer_private_key_hex)?;

    let manifest = compile_subintent_manifest(&input.manifest_string, input.network_id)?;

    let header = build_intent_header(
        input.network_id,
        discriminator,
        input.max_proposer_timestamp_secs,
        input.start_epoch,
        input.end_epoch,
    );

    let subintent = SubintentV2 {
        intent_core: IntentCoreV2 {
            header,
            blobs: BlobsV1 { blobs: vec![] },
            message: MessageV2::None,
            children: empty_children(),
            instructions: InstructionsV2(manifest.instructions),
        },
    };

    let partial_transaction = PartialTransactionV2 {
        root_subintent: subintent,
        non_root_subintents: NonRootSubintentsV2(vec![]),
    };

    // Prepare to get the hash for signing
    let prepared = partial_transaction
        .prepare(&PreparationSettings::latest())
        .map_err(|e| format!("Preparation failed: {e:?}"))?;

    let subintent_hash = prepared.subintent_hash();

    // Sign the subintent hash
    let signature = private_key.sign_with_public_key(&subintent_hash);

    let signed_partial = SignedPartialTransactionV2 {
        partial_transaction,
        root_subintent_signatures: IntentSignaturesV2 {
            signatures: vec![IntentSignatureV1(signature)],
        },
        non_root_subintent_signatures: NonRootSubintentSignaturesV2 {
            by_subintent: vec![],
        },
    };

    let payload_bytes = signed_partial
        .to_raw()
        .map_err(|e| format!("SBOR encode failed: {e:?}"))?;

    Ok(hex::encode(payload_bytes.as_slice()))
}

/// Build a NotarizedTransactionV2 for non-sponsored mode.
pub fn build_notarized_tx_v2(input: NonSponsoredInput) -> Result<String, String> {
    let discriminator: u64 = input
        .intent_discriminator
        .parse()
        .map_err(|e| format!("Invalid discriminator: {e}"))?;

    let signer_key = parse_ed25519_private_key(&input.signer_private_key_hex)?;
    let notary_key = parse_ed25519_private_key(&input.notary_private_key_hex)?;

    let manifest = compile_tx_manifest(&input.manifest_string, input.network_id)?;

    let header = build_intent_header(
        input.network_id,
        discriminator,
        input.max_proposer_timestamp_secs,
        input.start_epoch,
        input.end_epoch,
    );

    let transaction_header = TransactionHeaderV2 {
        notary_public_key: notary_key.public_key().into(),
        notary_is_signatory: true,
        tip_basis_points: 0,
    };

    let root_intent_core = IntentCoreV2 {
        header,
        blobs: BlobsV1 { blobs: vec![] },
        message: MessageV2::None,
        children: empty_children(),
        instructions: InstructionsV2(manifest.instructions),
    };

    let transaction_intent = TransactionIntentV2 {
        transaction_header,
        root_intent_core,
        non_root_subintents: NonRootSubintentsV2(vec![]),
    };

    // Prepare and sign
    let prepared = transaction_intent
        .prepare(&PreparationSettings::latest())
        .map_err(|e| format!("Preparation failed: {e:?}"))?;

    let intent_hash = prepared.transaction_intent_hash();
    let signer_signature = signer_key.sign_with_public_key(&intent_hash);

    let signed_intent = SignedTransactionIntentV2 {
        transaction_intent,
        transaction_intent_signatures: IntentSignaturesV2 {
            signatures: vec![IntentSignatureV1(signer_signature)],
        },
        non_root_subintent_signatures: NonRootSubintentSignaturesV2 {
            by_subintent: vec![],
        },
    };

    // Notarize
    let prepared_signed = signed_intent
        .prepare(&PreparationSettings::latest())
        .map_err(|e| format!("Signed preparation failed: {e:?}"))?;

    let signed_hash = prepared_signed.signed_transaction_intent_hash();
    let notary_signature = notary_key.sign_without_public_key(&signed_hash);

    let notarized = NotarizedTransactionV2 {
        signed_transaction_intent: signed_intent,
        notary_signature: NotarySignatureV2(notary_signature),
    };

    let payload_bytes = notarized
        .to_raw()
        .map_err(|e| format!("SBOR encode failed: {e:?}"))?;

    Ok(hex::encode(payload_bytes.as_slice()))
}

/// Wrap a SignedPartialTransactionV2 in a root NotarizedTransactionV2.
/// Used by the facilitator for sponsored settlement.
pub fn wrap_subintent_in_root_tx(input: WrapInput) -> Result<String, String> {
    let notary_key = parse_ed25519_private_key(&input.notary_private_key_hex)?;

    // Decode the agent's SignedPartialTransactionV2
    let agent_bytes =
        hex::decode(&input.signed_partial_tx_hex).map_err(|e| format!("Invalid hex: {e}"))?;

    let signed_partial = SignedPartialTransactionV2::from_raw(&agent_bytes.into())
        .map_err(|e| format!("Decode SignedPartialTransactionV2 failed: {e:?}"))?;

    // Get the subintent hash for the child reference
    let child_hash = signed_partial
        .partial_transaction
        .prepare(&PreparationSettings::latest())
        .map_err(|e| format!("Prepare child failed: {e:?}"))?
        .subintent_hash();

    // Compile root manifest
    let root_manifest = compile_tx_manifest(&input.root_manifest_string, input.network_id)?;

    // Build root intent header (facilitator controls timing)
    let root_header = IntentHeaderV2 {
        network_id: input.network_id,
        start_epoch_inclusive: Epoch::of(input.start_epoch),
        end_epoch_exclusive: Epoch::of(input.end_epoch),
        min_proposer_timestamp_inclusive: None,
        max_proposer_timestamp_exclusive: None,
        intent_discriminator: 0,
    };

    let transaction_header = TransactionHeaderV2 {
        notary_public_key: notary_key.public_key().into(),
        notary_is_signatory: true, // CRITICAL: produces the Ed25519 badge
        tip_basis_points: 0,
    };

    let mut child_specifiers = indexmap::IndexSet::new();
    child_specifiers.insert(ChildSubintentSpecifier {
        hash: SubintentHash::from_hash(child_hash.into_hash()),
    });

    let root_intent_core = IntentCoreV2 {
        header: root_header,
        blobs: BlobsV1 { blobs: vec![] },
        message: MessageV2::None,
        children: ChildSubintentSpecifiersV2 {
            children: child_specifiers,
        },
        instructions: InstructionsV2(root_manifest.instructions),
    };

    // Extract the agent's subintent and signatures
    let agent_subintent = signed_partial.partial_transaction.root_subintent;
    let agent_signatures = signed_partial.root_subintent_signatures;

    let transaction_intent = TransactionIntentV2 {
        transaction_header,
        root_intent_core,
        non_root_subintents: NonRootSubintentsV2(vec![agent_subintent]),
    };

    // Root intent: no additional signers (notary_is_signatory covers it)
    let signed_intent = SignedTransactionIntentV2 {
        transaction_intent,
        transaction_intent_signatures: IntentSignaturesV2 {
            signatures: vec![],
        },
        non_root_subintent_signatures: NonRootSubintentSignaturesV2 {
            by_subintent: vec![agent_signatures],
        },
    };

    // Notarize with facilitator's key
    let prepared_signed = signed_intent
        .prepare(&PreparationSettings::latest())
        .map_err(|e| format!("Signed preparation failed: {e:?}"))?;

    let signed_hash = prepared_signed.signed_transaction_intent_hash();
    let notary_signature = notary_key.sign_without_public_key(&signed_hash);

    let notarized = NotarizedTransactionV2 {
        signed_transaction_intent: signed_intent,
        notary_signature: NotarySignatureV2(notary_signature),
    };

    let payload_bytes = notarized
        .to_raw()
        .map_err(|e| format!("SBOR encode failed: {e:?}"))?;

    Ok(hex::encode(payload_bytes.as_slice()))
}

/// Decompile a SignedPartialTransactionV2 from hex.
pub fn decompile_signed_partial_tx(input: DecompileInput) -> Result<String, String> {
    let bytes = hex::decode(&input.tx_hex).map_err(|e| format!("Invalid hex: {e}"))?;

    let signed_partial = SignedPartialTransactionV2::from_raw(&bytes.into())
        .map_err(|e| format!("Decode failed: {e:?}"))?;

    let core = &signed_partial.partial_transaction.root_subintent.intent_core;
    let header = &core.header;

    let nd = network_definition(header.network_id);

    // Reconstruct a SubintentManifestV2 to decompile
    let manifest = SubintentManifestV2 {
        instructions: core.instructions.0.clone(),
        blobs: core
            .blobs
            .blobs
            .iter()
            .map(|b| (hash(&b.0), b.0.clone()))
            .collect(),
        children: core.children.children.clone(),
        object_names: Default::default(),
    };

    let manifest_string = radix_transactions::manifest::decompile(&manifest, &nd)
        .map_err(|e| format!("Decompile manifest failed: {e:?}"))?;

    let output = DecompiledOutput {
        manifest: manifest_string,
        network_id: header.network_id,
        intent_discriminator: header.intent_discriminator.to_string(),
        start_epoch: header.start_epoch_inclusive.number(),
        end_epoch: header.end_epoch_exclusive.number(),
        max_proposer_timestamp_secs: header
            .max_proposer_timestamp_exclusive
            .map(|i| i.seconds_since_unix_epoch),
        min_proposer_timestamp_secs: header
            .min_proposer_timestamp_inclusive
            .map(|i| i.seconds_since_unix_epoch),
    };

    serde_json::to_string(&output).map_err(|e| format!("Serialize output failed: {e}"))
}

/// Decompile a NotarizedTransactionV2 from hex.
pub fn decompile_notarized_tx_v2(input: DecompileInput) -> Result<String, String> {
    let bytes = hex::decode(&input.tx_hex).map_err(|e| format!("Invalid hex: {e}"))?;

    let notarized = NotarizedTransactionV2::from_raw(&bytes.into())
        .map_err(|e| format!("Decode failed: {e:?}"))?;

    let core = &notarized
        .signed_transaction_intent
        .transaction_intent
        .root_intent_core;
    let header = &core.header;

    let nd = network_definition(header.network_id);

    // Reconstruct a TransactionManifestV2 to decompile
    let manifest = TransactionManifestV2 {
        instructions: core.instructions.0.clone(),
        blobs: core
            .blobs
            .blobs
            .iter()
            .map(|b| (hash(&b.0), b.0.clone()))
            .collect(),
        children: core.children.children.clone(),
        object_names: Default::default(),
    };

    let manifest_string = radix_transactions::manifest::decompile(&manifest, &nd)
        .map_err(|e| format!("Decompile manifest failed: {e:?}"))?;

    let output = DecompiledOutput {
        manifest: manifest_string,
        network_id: header.network_id,
        intent_discriminator: header.intent_discriminator.to_string(),
        start_epoch: header.start_epoch_inclusive.number(),
        end_epoch: header.end_epoch_exclusive.number(),
        max_proposer_timestamp_secs: header
            .max_proposer_timestamp_exclusive
            .map(|i| i.seconds_since_unix_epoch),
        min_proposer_timestamp_secs: header
            .min_proposer_timestamp_inclusive
            .map(|i| i.seconds_since_unix_epoch),
    };

    serde_json::to_string(&output).map_err(|e| format!("Serialize output failed: {e}"))
}
