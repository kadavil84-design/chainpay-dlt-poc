import {
  FraudAttemptRecord,
  InvoiceRegistryEntry,
  LedgerBlock,
  VPOToken,
  WorkflowDraft,
} from '../types/chainpay';
import {
  ANCHOR_PRIME_RATE_PCT,
  calculateMsmeFinancingEconomics,
  computeSha256,
  GENESIS_PREV_HASH,
  LOCAL_MSME_LENDING_RATE_PCT,
  serializeBlockForHash,
  serializeInvoicePayload,
} from '../utils/crypto';

export interface SeedState {
  blocks: LedgerBlock[];
  vpos: VPOToken[];
  invoiceRegistry: InvoiceRegistryEntry[];
  fraudAttempts: FraudAttemptRecord[];
  autoApprovedCount: number;
  overrideApprovedCount: number;
  totalProcessedInvoices: number;
}

/**
 * Exact invoice payload of seeded Transaction #2 (INV-2026-0842).
 * Used by the one-click "Simulate Duplicate Invoice" scenario to demonstrate
 * live Web Crypto SHA-256 collision detection against an existing on-chain obligation.
 */
export const DUPLICATE_DEMO_PRESET: WorkflowDraft = {
  poNumber: 'PO-2026-0842',
  buyerName: 'Apex Industrials',
  supplierName: 'Vanguard Motion Systems',
  itemDescription: 'Industrial Brushless Servo Motors (48V / 2.4kW)',
  poQuantity: 120,
  poUnitPrice: 1250,
  paymentTermsDays: 45,
  grnNumber: 'GRN-2026-0842',
  oracleNode: 'DHL SmartFreight IoT Oracle',
  deliveredQuantity: 119,
  deliveryLocation: 'Apex Detroit Assembly Hub — Dock 04',
  iotSealId: 'SEAL-IOT-9941B',
  invoiceNumber: 'INV-2026-0842',
  billedQuantity: 119,
  invoiceUnitPrice: 1250,
  invoiceDate: '2026-11-19',
};

export function createCleanSamplePreset(sequence: number): WorkflowDraft {
  const num = 843 + sequence;
  return {
    poNumber: `PO-2026-0${num}`,
    buyerName: 'Apex Industrials',
    supplierName: 'Helios Battery Systems',
    itemDescription: 'Modular LiFePO4 Industrial Power Packs (72V)',
    poQuantity: 400,
    poUnitPrice: 320,
    paymentTermsDays: 45,
    grnNumber: `GRN-2026-0${num}`,
    oracleNode: 'Maersk IoT Logistics Oracle',
    deliveredQuantity: 398, // -0.50% variance (within 2.00% Smart Tolerance Band)
    deliveryLocation: 'Apex Chicago Plant — Bay 11',
    iotSealId: `SEAL-IOT-${4200 + sequence}A`,
    invoiceNumber: `INV-2026-0${num}`,
    billedQuantity: 398,
    invoiceUnitPrice: 320,
    invoiceDate: '2026-11-21',
  };
}

export function createVarianceSamplePreset(sequence: number): WorkflowDraft {
  const num = 850 + sequence;
  return {
    poNumber: `PO-2026-0${num}`,
    buyerName: 'Apex Industrials',
    supplierName: 'Meridian Drivetrain Corp.',
    itemDescription: 'Helical Planetary Reduction Gearboxes (Ratio 12:1)',
    poQuantity: 200,
    poUnitPrice: 600,
    paymentTermsDays: 45,
    grnNumber: `GRN-2026-0${num}`,
    oracleNode: 'FedEx SupplyChain IoT Oracle',
    deliveredQuantity: 200,
    deliveryLocation: 'Apex Ohio Distribution Center — Gate 02',
    iotSealId: `SEAL-IOT-${7710 + sequence}C`,
    invoiceNumber: `INV-2026-0${num}`,
    billedQuantity: 210, // +5.00% over-billed vs GRN/PO (> 2.00% tolerance -> Exception Queue)
    invoiceUnitPrice: 600,
    invoiceDate: '2026-11-21',
  };
}

export const TIER2_MSME_DIRECTORY = [
  'Surya Micro-Tooling Ltd.',
  'Delta Precision Fasteners',
  'Narmada Alloy Forgings',
  'Kaveri CNC Coatings',
];

async function createChainedBlock(
  blocks: LedgerBlock[],
  params: Omit<LedgerBlock, 'blockNumber' | 'previousHash' | 'hash'>
): Promise<LedgerBlock> {
  const previousHash = blocks.length === 0 ? GENESIS_PREV_HASH : blocks[blocks.length - 1].hash;
  const blockNumber = blocks.length + 1;
  const payload = serializeBlockForHash({
    blockNumber,
    timestamp: params.timestamp,
    role: params.role,
    nodeName: params.nodeName,
    action: params.action,
    summary: params.summary,
    referenceId: params.referenceId,
    offChainRef: params.offChainRef,
    previousHash,
  });
  const hash = await computeSha256(payload);
  const block: LedgerBlock = {
    blockNumber,
    ...params,
    previousHash,
    hash,
  };
  blocks.push(block);
  return block;
}

/**
 * Generates 2 realistic completed trade finance transactions with authentic
 * chained Web Crypto SHA-256 hashes so the dashboard, VPO wallet, and
 * block explorer look rich and verifiable immediately on load.
 */
export async function buildInitialSeedState(): Promise<SeedState> {
  const blocks: LedgerBlock[] = [];

  // Block 1: Genesis
  await createChainedBlock(blocks, {
    timestamp: '2026-11-17T08:00:00.000Z',
    role: 'Governance Committee',
    nodeName: 'ChainPay Consortium Validator #01',
    action: 'GENESIS',
    actionLabel: 'Consortium Network Initialized',
    summary:
      'Permissioned trade finance network initialized for Apex Industrials supply chain. Smart tolerance set to 2.00%; off-chain ERP vault enabled.',
    referenceId: 'NET-APEX-01',
    offChainRef: 'erp-vault://governance/charter-v1.pdf (Off-Chain)',
  });

  // --- TRANSACTION 1: PO-2026-0841 ($120,000, 0.0% variance, Auto-Approved + 30% Tier-2 Fractionalization) ---
  const inv1Payload = serializeInvoicePayload({
    invoiceNumber: 'INV-2026-0841',
    poNumber: 'PO-2026-0841',
    supplierName: 'Kestrel Precision Components',
    billedQuantity: 250,
    unitPrice: 480,
    totalAmount: 120000,
    invoiceDate: '2026-11-18',
  });
  const inv1Hash = await computeSha256(inv1Payload);

  await createChainedBlock(blocks, {
    timestamp: '2026-11-17T10:14:22.000Z',
    role: 'Corporate Buyer',
    nodeName: 'Apex Industrials ERP Node',
    action: 'PO_HASHED',
    actionLabel: 'PO Hashed',
    summary:
      'Issued PO-2026-0841 to Kestrel Precision Components for 250 Precision CNC Hydraulic Valves ($120,000 · Net 45 Days).',
    referenceId: 'PO-2026-0841',
    offChainRef: 'erp-vault://po/PO-2026-0841.pdf (SHA-256 anchored)',
  });

  await createChainedBlock(blocks, {
    timestamp: '2026-11-18T09:42:10.000Z',
    role: '3PL / IoT Oracle',
    nodeName: 'Maersk IoT Logistics Oracle',
    action: 'GRN_LOGGED',
    actionLabel: 'GRN Logged',
    summary:
      'Confirmed physical receipt of 250 units for PO-2026-0841 at Apex Detroit Hub (IoT Seal #SEAL-IOT-8812A).',
    referenceId: 'GRN-2026-0841',
    offChainRef: 'iot-telemetry://grn/GRN-2026-0841.json (Off-Chain)',
  });

  await createChainedBlock(blocks, {
    timestamp: '2026-11-18T11:05:44.000Z',
    role: 'Smart Contract Engine',
    nodeName: 'ChainPaySettlement.sol',
    action: 'MATCH_EXECUTED',
    actionLabel: '3-Way Match Executed',
    summary:
      'INV-2026-0841 verified against PO-2026-0841 & GRN-2026-0841. Variance 0.00% (<= 2.00% tolerance). Unique SHA-256 fingerprint confirmed.',
    referenceId: 'INV-2026-0841',
    offChainRef: `sha256://${inv1Hash.slice(0, 16)}… (PDF Off-Chain)`,
  });

  await createChainedBlock(blocks, {
    timestamp: '2026-11-18T11:05:46.000Z',
    role: 'Smart Contract Engine',
    nodeName: 'ChainPaySettlement.sol',
    action: 'VPO_MINTED',
    actionLabel: 'VPO Minted',
    summary:
      'Minted Validated Payment Obligation VPO-0841 for $120,000 payable to Kestrel Precision Components (Net 45 Days).',
    referenceId: 'VPO-0841',
    offChainRef: 'vpo-ledger://tokens/VPO-0841',
  });

  const fracAmount = 36000; // 30% of $120,000
  const msmeEcon = calculateMsmeFinancingEconomics(
    fracAmount,
    45,
    ANCHOR_PRIME_RATE_PCT,
    LOCAL_MSME_LENDING_RATE_PCT
  );

  const fracBlock = await createChainedBlock(blocks, {
    timestamp: '2026-11-18T15:20:09.000Z',
    role: 'Tier-1 Supplier',
    nodeName: 'Kestrel Precision Treasury Node',
    action: 'TOKEN_FRACTIONALIZED',
    actionLabel: 'Token Fractionalized',
    summary:
      'Split 30% ($36,000) of VPO-0841 and transferred fractional obligation VPO-0841-T2 to Tier-2 MSME Surya Micro-Tooling Ltd.',
    referenceId: 'VPO-0841-T2',
    offChainRef: 'vpo-ledger://splits/VPO-0841-T2',
  });

  await createChainedBlock(blocks, {
    timestamp: '2026-11-18T16:04:31.000Z',
    role: 'Tier-2 MSME',
    nodeName: 'Surya Micro-Tooling Finance Portal',
    action: 'MSME_FINANCED',
    actionLabel: 'MSME Prime Financing',
    summary: `Surya Micro-Tooling redeemed $36,000 at Apex Anchor Prime Rate (${ANCHOR_PRIME_RATE_PCT}% vs ${LOCAL_MSME_LENDING_RATE_PCT}% local), saving $${msmeEcon.msmeInterestSaved.toFixed(2)} in financing cost.`,
    referenceId: 'VPO-0841-T2',
    offChainRef: 'liquidity-pool://prime-anchor/VPO-0841-T2',
  });

  // --- TRANSACTION 2: PO-2026-0842 ($148,750, 0.83% variance within 2% tolerance, Auto-Approved & Active VPO) ---
  const inv2Payload = serializeInvoicePayload({
    invoiceNumber: DUPLICATE_DEMO_PRESET.invoiceNumber,
    poNumber: DUPLICATE_DEMO_PRESET.poNumber,
    supplierName: DUPLICATE_DEMO_PRESET.supplierName,
    billedQuantity: DUPLICATE_DEMO_PRESET.billedQuantity,
    unitPrice: DUPLICATE_DEMO_PRESET.invoiceUnitPrice,
    totalAmount: DUPLICATE_DEMO_PRESET.billedQuantity * DUPLICATE_DEMO_PRESET.invoiceUnitPrice,
    invoiceDate: DUPLICATE_DEMO_PRESET.invoiceDate,
  });
  const inv2Hash = await computeSha256(inv2Payload);

  await createChainedBlock(blocks, {
    timestamp: '2026-11-19T08:30:15.000Z',
    role: 'Corporate Buyer',
    nodeName: 'Apex Industrials ERP Node',
    action: 'PO_HASHED',
    actionLabel: 'PO Hashed',
    summary:
      'Issued PO-2026-0842 to Vanguard Motion Systems for 120 Industrial Brushless Servo Motors ($150,000 · Net 45 Days).',
    referenceId: 'PO-2026-0842',
    offChainRef: 'erp-vault://po/PO-2026-0842.pdf (SHA-256 anchored)',
  });

  await createChainedBlock(blocks, {
    timestamp: '2026-11-19T13:18:52.000Z',
    role: '3PL / IoT Oracle',
    nodeName: 'DHL SmartFreight IoT Oracle',
    action: 'GRN_LOGGED',
    actionLabel: 'GRN Logged',
    summary:
      'Confirmed physical receipt of 119 units for PO-2026-0842 at Apex Detroit Hub (IoT Seal #SEAL-IOT-9941B).',
    referenceId: 'GRN-2026-0842',
    offChainRef: 'iot-telemetry://grn/GRN-2026-0842.json (Off-Chain)',
  });

  await createChainedBlock(blocks, {
    timestamp: '2026-11-19T14:11:04.000Z',
    role: 'Smart Contract Engine',
    nodeName: 'ChainPaySettlement.sol',
    action: 'MATCH_EXECUTED',
    actionLabel: '3-Way Match Executed',
    summary:
      'INV-2026-0842 ($148,750) matched against PO-2026-0842 & GRN-2026-0842. Variance 0.83% within 2.00% Smart Tolerance Band.',
    referenceId: 'INV-2026-0842',
    offChainRef: `sha256://${inv2Hash.slice(0, 16)}… (PDF Off-Chain)`,
  });

  await createChainedBlock(blocks, {
    timestamp: '2026-11-19T14:11:06.000Z',
    role: 'Smart Contract Engine',
    nodeName: 'ChainPaySettlement.sol',
    action: 'VPO_MINTED',
    actionLabel: 'VPO Minted',
    summary:
      'Minted Validated Payment Obligation VPO-0842 for $148,750 payable to Vanguard Motion Systems (Net 45 Days).',
    referenceId: 'VPO-0842',
    offChainRef: 'vpo-ledger://tokens/VPO-0842',
  });

  const vpos: VPOToken[] = [
    {
      tokenId: 'VPO-0842',
      poNumber: 'PO-2026-0842',
      invoiceNumber: 'INV-2026-0842',
      invoiceHash: inv2Hash,
      itemDescription: 'Industrial Brushless Servo Motors (48V / 2.4kW)',
      issuer: 'Apex Industrials',
      currentHolder: 'Vanguard Motion Systems',
      originalAmount: 148750,
      remainingAmount: 148750,
      maturityDays: 45,
      issuedAt: '2026-11-19T14:11:06.000Z',
      status: 'active',
      approvalMethod: 'auto_match',
      variancePct: 0.83,
      fractionalizations: [],
    },
    {
      tokenId: 'VPO-0841',
      poNumber: 'PO-2026-0841',
      invoiceNumber: 'INV-2026-0841',
      invoiceHash: inv1Hash,
      itemDescription: 'Precision CNC Hydraulic Valves (316L Stainless)',
      issuer: 'Apex Industrials',
      currentHolder: 'Kestrel Precision Components',
      originalAmount: 120000,
      remainingAmount: 84000,
      maturityDays: 45,
      issuedAt: '2026-11-18T11:05:46.000Z',
      status: 'partially_fractionalized',
      approvalMethod: 'auto_match',
      variancePct: 0.0,
      fractionalizations: [
        {
          id: 'VPO-0841-T2',
          parentVpoId: 'VPO-0841',
          recipientName: 'Surya Micro-Tooling Ltd.',
          recipientTier: 'Tier-2 MSME',
          percentage: 30,
          amount: fracAmount,
          transferredAt: '2026-11-18T15:20:09.000Z',
          financed: true,
          financedAt: '2026-11-18T16:04:31.000Z',
          anchorPrimeRatePct: ANCHOR_PRIME_RATE_PCT,
          localLenderRatePct: LOCAL_MSME_LENDING_RATE_PCT,
          maturityDays: 45,
          financingCostAtPrime: msmeEcon.financingCostAtPrime,
          financingCostAtLocal: msmeEcon.financingCostAtLocal,
          msmeInterestSaved: msmeEcon.msmeInterestSaved,
          netCashToMsme: msmeEcon.netCashToMsme,
          txHash: fracBlock.hash,
        },
      ],
    },
  ];

  const invoiceRegistry: InvoiceRegistryEntry[] = [
    {
      invoiceHash: inv1Hash,
      invoiceNumber: 'INV-2026-0841',
      poNumber: 'PO-2026-0841',
      supplierName: 'Kestrel Precision Components',
      totalAmount: 120000,
      recordedAt: '2026-11-18T11:05:44.000Z',
    },
    {
      invoiceHash: inv2Hash,
      invoiceNumber: 'INV-2026-0842',
      poNumber: 'PO-2026-0842',
      supplierName: 'Vanguard Motion Systems',
      totalAmount: 148750,
      recordedAt: '2026-11-19T14:11:04.000Z',
    },
  ];

  return {
    blocks,
    vpos,
    invoiceRegistry,
    fraudAttempts: [],
    autoApprovedCount: 2,
    overrideApprovedCount: 0,
    totalProcessedInvoices: 2,
  };
}
