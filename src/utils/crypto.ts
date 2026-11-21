export const GENESIS_PREV_HASH = '0'.repeat(64);
export const SMART_TOLERANCE_PCT = 2.0;
export const LEGACY_COST_PER_INVOICE = 12.0;
export const DLT_COST_PER_INVOICE = 2.5;
export const ANCHOR_PRIME_RATE_PCT = 7.0;
export const LOCAL_MSME_LENDING_RATE_PCT = 18.0;

/**
 * Computes a genuine SHA-256 cryptographic digest using the browser Web Crypto API.
 */
export async function computeSha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deterministic canonical payload serializer for Commercial Invoices.
 * Identical commercial invoice fields always yield the exact same SHA-256 fingerprint,
 * enabling cryptographic double-financing detection across lenders and ERP nodes.
 */
export function serializeInvoicePayload(params: {
  invoiceNumber: string;
  poNumber: string;
  supplierName: string;
  billedQuantity: number;
  unitPrice: number;
  totalAmount: number;
  invoiceDate: string;
}): string {
  return JSON.stringify({
    invoiceNumber: params.invoiceNumber.trim().toUpperCase(),
    poNumber: params.poNumber.trim().toUpperCase(),
    supplierName: params.supplierName.trim().toLowerCase(),
    billedQuantity: Number(params.billedQuantity),
    unitPrice: Number(params.unitPrice.toFixed(2)),
    totalAmount: Number(params.totalAmount.toFixed(2)),
    invoiceDate: params.invoiceDate.trim(),
  });
}

export function serializeBlockForHash(block: {
  blockNumber: number;
  timestamp: string;
  role: string;
  nodeName: string;
  action: string;
  summary: string;
  referenceId: string;
  offChainRef: string;
  previousHash: string;
}): string {
  return JSON.stringify({
    blockNumber: block.blockNumber,
    timestamp: block.timestamp,
    role: block.role,
    nodeName: block.nodeName,
    action: block.action,
    summary: block.summary,
    referenceId: block.referenceId,
    offChainRef: block.offChainRef,
    previousHash: block.previousHash,
  });
}

export function formatCurrency(amount: number, showCents = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount);
}

export function formatShortHash(hash: string, prefix = 10, suffix = 8): string {
  if (!hash || hash.length <= prefix + suffix + 3) return hash;
  return `${hash.slice(0, prefix)}…${hash.slice(-suffix)}`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function calculateMsmeFinancingEconomics(
  amount: number,
  maturityDays: number,
  anchorRatePct = ANCHOR_PRIME_RATE_PCT,
  localRatePct = LOCAL_MSME_LENDING_RATE_PCT
) {
  const yearFraction = maturityDays / 365;
  const financingCostAtPrime = Number((amount * (anchorRatePct / 100) * yearFraction).toFixed(2));
  const financingCostAtLocal = Number((amount * (localRatePct / 100) * yearFraction).toFixed(2));
  const msmeInterestSaved = Number((financingCostAtLocal - financingCostAtPrime).toFixed(2));
  const netCashToMsme = Number((amount - financingCostAtPrime).toFixed(2));
  return {
    financingCostAtPrime,
    financingCostAtLocal,
    msmeInterestSaved,
    netCashToMsme,
  };
}
