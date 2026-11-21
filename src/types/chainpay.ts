export type ActiveTab = 'workflow' | 'liquidity' | 'ledger' | 'dashboard';

export type WorkflowStep = 1 | 2 | 3 | 4;

export type LedgerRole =
  | 'Corporate Buyer'
  | '3PL / IoT Oracle'
  | 'Tier-1 Supplier'
  | 'Smart Contract Engine'
  | 'Governance Committee'
  | 'Tier-2 MSME';

export type LedgerActionType =
  | 'GENESIS'
  | 'PO_HASHED'
  | 'GRN_LOGGED'
  | 'MATCH_EXECUTED'
  | 'FRAUD_BLOCKED'
  | 'EXCEPTION_ROUTED'
  | 'GOVERNANCE_OVERRIDE'
  | 'VPO_MINTED'
  | 'DYNAMIC_DISCOUNT'
  | 'TOKEN_FRACTIONALIZED'
  | 'MSME_FINANCED';

export interface PurchaseOrder {
  poNumber: string;
  buyerName: string;
  supplierName: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  paymentTermsDays: number;
  issuedAt: string;
  payloadHash: string;
}

export interface GoodsReceiptNote {
  grnNumber: string;
  poNumber: string;
  oracleNode: string;
  deliveredQuantity: number;
  deliveryLocation: string;
  iotSealId: string;
  timestamp: string;
  payloadHash: string;
}

export interface CommercialInvoice {
  invoiceNumber: string;
  poNumber: string;
  supplierName: string;
  billedQuantity: number;
  unitPrice: number;
  totalAmount: number;
  invoiceDate: string;
  sha256Hash: string;
}

export type MatchVerdict = 'approved' | 'exception' | 'fraud_blocked';

export interface MatchEvaluation {
  verdict: MatchVerdict;
  qtyVariancePct: number;
  priceVariancePct: number;
  valueVariancePct: number;
  maxVariancePct: number;
  tolerancePct: number;
  reason: string;
  duplicateOfInvoiceNumber?: string;
  mintedVpoId?: string;
  evaluatedAt: string;
}

export interface DynamicDiscountSettlement {
  discountPct: number;
  settlementDay: number;
  daysAccelerated: number;
  buyerEbitdaSavings: number;
  supplierCashReceived: number;
  annualizedBuyerYieldPct: number;
  settledAt: string;
  txHash: string;
}

export interface FractionalTransfer {
  id: string;
  parentVpoId: string;
  recipientName: string;
  recipientTier: string;
  percentage: number;
  amount: number;
  transferredAt: string;
  financed: boolean;
  financedAt?: string;
  anchorPrimeRatePct: number;
  localLenderRatePct: number;
  maturityDays: number;
  financingCostAtPrime: number;
  financingCostAtLocal: number;
  msmeInterestSaved: number;
  netCashToMsme: number;
  txHash: string;
}

export type VPOStatus = 'active' | 'partially_fractionalized' | 'discounted' | 'fully_settled';

export interface VPOToken {
  tokenId: string;
  poNumber: string;
  invoiceNumber: string;
  invoiceHash: string;
  itemDescription: string;
  issuer: string;
  currentHolder: string;
  originalAmount: number;
  remainingAmount: number;
  maturityDays: number;
  issuedAt: string;
  status: VPOStatus;
  approvalMethod: 'auto_match' | 'governance_override';
  variancePct: number;
  discountSettlement?: DynamicDiscountSettlement;
  fractionalizations: FractionalTransfer[];
}

export interface ExceptionRecord {
  id: string;
  po: PurchaseOrder;
  grn: GoodsReceiptNote;
  invoice: CommercialInvoice;
  evaluation: MatchEvaluation;
  status: 'pending' | 'overridden_approved' | 'rejected';
  overrideReason?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface LedgerBlock {
  blockNumber: number;
  timestamp: string;
  role: LedgerRole;
  nodeName: string;
  action: LedgerActionType;
  actionLabel: string;
  summary: string;
  referenceId: string;
  offChainRef: string;
  previousHash: string;
  hash: string;
}

export interface InvoiceRegistryEntry {
  invoiceHash: string;
  invoiceNumber: string;
  poNumber: string;
  supplierName: string;
  totalAmount: number;
  recordedAt: string;
}

export interface FraudAttemptRecord {
  id: string;
  attemptedInvoiceNumber: string;
  duplicateOfInvoiceNumber: string;
  poNumber: string;
  supplierName: string;
  attemptedAmount: number;
  duplicateHash: string;
  blockedAt: string;
}

export interface WorkflowDraft {
  // Step 1: PO
  poNumber: string;
  buyerName: string;
  supplierName: string;
  itemDescription: string;
  poQuantity: number;
  poUnitPrice: number;
  paymentTermsDays: number;
  // Step 2: GRN
  grnNumber: string;
  oracleNode: string;
  deliveredQuantity: number;
  deliveryLocation: string;
  iotSealId: string;
  // Step 3: Invoice
  invoiceNumber: string;
  billedQuantity: number;
  invoiceUnitPrice: number;
  invoiceDate: string;
}
