import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Copy,
  Check,
  Cpu,
  FileText,
  RotateCcw,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CommercialInvoice,
  ExceptionRecord,
  GoodsReceiptNote,
  MatchEvaluation,
  PurchaseOrder,
  WorkflowDraft,
  WorkflowStep,
} from '../types/chainpay';
import {
  computeSha256,
  formatCurrency,
  formatShortHash,
  formatTimestamp,
  serializeInvoicePayload,
  SMART_TOLERANCE_PCT,
} from '../utils/crypto';
import { InfoTooltip } from './InfoTooltip';

interface P2PWorkflowTabProps {
  step: WorkflowStep;
  draft: WorkflowDraft;
  activeScenario: 'custom' | 'clean' | 'variance' | 'duplicate';
  committedPo: PurchaseOrder | null;
  committedGrn: GoodsReceiptNote | null;
  committedInvoice: CommercialInvoice | null;
  evaluation: MatchEvaluation | null;
  exceptions: ExceptionRecord[];
  onUpdateDraft: (patch: Partial<WorkflowDraft>) => void;
  onLoadPreset: (preset: 'clean' | 'variance' | 'duplicate') => void;
  onIssuePO: () => Promise<void>;
  onLogGRN: () => Promise<void>;
  onSubmitInvoice: () => Promise<void>;
  onOverrideException: (exceptionId: string, note: string) => Promise<void>;
  onRejectException: (exceptionId: string, note: string) => Promise<void>;
  onResetWorkflow: () => void;
  onGoToLiquidity: () => void;
  onGoToLedger: () => void;
}

const PIPELINE_STEPS: {
  step: WorkflowStep;
  index: string;
  role: string;
  actor: string;
  action: string;
}[] = [
  {
    step: 1,
    index: '01',
    role: 'Corporate Buyer',
    actor: 'Apex Industrials',
    action: 'Issue Purchase Order',
  },
  {
    step: 2,
    index: '02',
    role: '3PL / IoT Oracle',
    actor: 'Logistics Telemetry',
    action: 'Log Goods Receipt',
  },
  {
    step: 3,
    index: '03',
    role: 'Tier-1 Supplier',
    actor: 'Commercial Billing',
    action: 'Submit Invoice & Hash',
  },
  {
    step: 4,
    index: '04',
    role: 'Smart Contract Engine',
    actor: 'ChainPaySettlement.sol',
    action: '3-Way Match & VPO Mint',
  },
];

export function P2PWorkflowTab({
  step,
  draft,
  activeScenario,
  committedPo,
  committedGrn,
  committedInvoice,
  evaluation,
  exceptions,
  onUpdateDraft,
  onLoadPreset,
  onIssuePO,
  onLogGRN,
  onSubmitInvoice,
  onOverrideException,
  onRejectException,
  onResetWorkflow,
  onGoToLiquidity,
  onGoToLedger,
}: P2PWorkflowTabProps) {
  const [liveInvoiceHash, setLiveInvoiceHash] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [overrideNotes, setOverrideNotes] = useState<Record<string, string>>({});

  const poTotal = Number((draft.poQuantity * draft.poUnitPrice).toFixed(2));
  const grnExpectedValue = Number((draft.deliveredQuantity * draft.poUnitPrice).toFixed(2));
  const invoiceTotal = Number((draft.billedQuantity * draft.invoiceUnitPrice).toFixed(2));

  // Real-time variance preview for right-hand reconciliation monitor
  const qtyVarPct =
    draft.deliveredQuantity > 0
      ? Math.abs((draft.billedQuantity - draft.deliveredQuantity) / draft.deliveredQuantity) * 100
      : 0;
  const priceVarPct =
    draft.poUnitPrice > 0
      ? Math.abs((draft.invoiceUnitPrice - draft.poUnitPrice) / draft.poUnitPrice) * 100
      : 0;
  const valueVarPct = poTotal > 0 ? Math.abs((invoiceTotal - poTotal) / poTotal) * 100 : 0;
  const maxLiveVariance = Math.max(qtyVarPct, priceVarPct, valueVarPct);

  // Live Web Crypto SHA-256 preview for Step 3
  useEffect(() => {
    let active = true;
    const payload = serializeInvoicePayload({
      invoiceNumber: draft.invoiceNumber,
      poNumber: draft.poNumber,
      supplierName: draft.supplierName,
      billedQuantity: draft.billedQuantity,
      unitPrice: draft.invoiceUnitPrice,
      totalAmount: invoiceTotal,
      invoiceDate: draft.invoiceDate,
    });
    computeSha256(payload).then((digest) => {
      if (active) setLiveInvoiceHash(digest);
    });
    return () => {
      active = false;
    };
  }, [
    draft.invoiceNumber,
    draft.poNumber,
    draft.supplierName,
    draft.billedQuantity,
    draft.invoiceUnitPrice,
    invoiceTotal,
    draft.invoiceDate,
  ]);

  const handleStepSubmit = async (fn: () => Promise<void>) => {
    setSubmitting(true);
    try {
      await fn();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 1800);
  };

  const pendingExceptions = exceptions.filter((e) => e.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Page Intro & One-Click Demo Scenario Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Guided P2P Workflow & Automated 3-Way Match
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Execute a permissioned procure-to-pay cycle from Purchase Order to cryptographic invoice
            verification. Use any one-click scenario below to test auto-approval, variance routing,
            or double-financing prevention.
          </p>
        </div>

        {/* One-Click Demo Presets */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onLoadPreset('clean')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeScenario === 'clean'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:text-slate-900'
            }`}
          >
            Load Sample PO
          </button>
          <button
            type="button"
            onClick={() => onLoadPreset('variance')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeScenario === 'variance'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
            }`}
          >
            Simulate 5% Variance
          </button>
          <button
            type="button"
            onClick={() => onLoadPreset('duplicate')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeScenario === 'duplicate'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            Simulate Duplicate Invoice
          </button>
        </div>
      </div>

      {/* 4-Stage Institutional Role Pipeline */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {PIPELINE_STEPS.map((item) => {
            const isCompleted = step > item.step || (step === 4 && item.step === 4 && evaluation !== null);
            const isCurrent = step === item.step;
            const isFraudStop = step === 4 && item.step === 4 && evaluation?.verdict === 'fraud_blocked';
            const isExceptionStop = step === 4 && item.step === 4 && evaluation?.verdict === 'exception';

            return (
              <div
                key={item.step}
                className={`p-4 transition-colors ${
                  isCurrent ? 'bg-slate-50/90' : 'bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs font-semibold text-slate-400 tabular-nums">
                    Step {item.index}
                  </span>
                  {isFraudStop ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                      <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                      Blocked
                    </span>
                  ) : isExceptionStop ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      Exception
                    </span>
                  ) : isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Verified
                    </span>
                  ) : isCurrent ? (
                    <span className="text-xs font-semibold text-slate-900">Active Step</span>
                  ) : (
                    <span className="text-xs text-slate-400">Pending</span>
                  )}
                </div>
                <div className="font-display text-sm font-semibold text-slate-900">
                  {item.role}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {item.actor} · {item.action}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Interactive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Column: Active Stage Execution */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Building2 className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                    <span>Role: Corporate Buyer</span>
                    <span aria-hidden="true">·</span>
                    <span>Apex Industrials ERP Node</span>
                  </div>
                  <h2 className="font-display text-lg font-semibold text-slate-900 mt-1 flex items-center">
                    01. Issue Purchase Order
                    <InfoTooltip
                      title="On-Chain PO Anchoring"
                      content="Apex Industrials creates a formal Purchase Order. Only a SHA-256 fingerprint and settlement terms are committed to the permissioned ledger; pricing sheets and contract PDFs stay private in the ERP."
                    />
                  </h2>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                  Net {draft.paymentTermsDays} Days
                </span>
              </div>

              {activeScenario === 'duplicate' && (
                <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-900 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-rose-900">
                      Duplicate Invoice Fraud Simulation Loaded
                    </p>
                    <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                      This preset references previously settled <span className="font-mono font-semibold">PO-2026-0842</span> and will attempt to re-submit <span className="font-mono font-semibold">INV-2026-0842</span> ($148,750). Proceed through the steps to watch the Smart Contract catch the identical SHA-256 hash.
                    </p>
                  </div>
                </div>
              )}

              {activeScenario === 'variance' && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-amber-900">
                      5% Variance Exception Simulation Loaded
                    </p>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      Buyer orders 200 units and the 3PL Oracle confirms 200 delivered, while the Supplier bills 210 units (+5.00%). Because 5.00% exceeds the 2.00% Smart Tolerance Band, the contract will route this to the Exception Queue.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="poNumber" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Purchase Order Number
                  </label>
                  <input
                    id="poNumber"
                    type="text"
                    value={draft.poNumber}
                    onChange={(e) => onUpdateDraft({ poNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="supplierName" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Tier-1 Supplier
                  </label>
                  <input
                    id="supplierName"
                    type="text"
                    value={draft.supplierName}
                    onChange={(e) => onUpdateDraft({ supplierName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="itemDescription" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Item / Component Specification
                  </label>
                  <input
                    id="itemDescription"
                    type="text"
                    value={draft.itemDescription}
                    onChange={(e) => onUpdateDraft({ itemDescription: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="poQuantity" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Ordered Quantity (Units)
                  </label>
                  <input
                    id="poQuantity"
                    type="number"
                    min={1}
                    value={draft.poQuantity}
                    onChange={(e) =>
                      onUpdateDraft({ poQuantity: Math.max(1, Number(e.target.value) || 0) })
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="poUnitPrice" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Contract Unit Price (USD)
                  </label>
                  <input
                    id="poUnitPrice"
                    type="number"
                    min={1}
                    step="0.01"
                    value={draft.poUnitPrice}
                    onChange={(e) =>
                      onUpdateDraft({ poUnitPrice: Math.max(0.01, Number(e.target.value) || 0) })
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">Total Purchase Order Value</div>
                  <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-0.5">
                    {formatCurrency(poTotal, true)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleStepSubmit(onIssuePO)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>{submitting ? 'Hashing PO…' : 'Issue & Hash Purchase Order'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Truck className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                    <span>Role: 3PL / IoT Oracle</span>
                    <span aria-hidden="true">·</span>
                    <span>{draft.oracleNode}</span>
                  </div>
                  <h2 className="font-display text-lg font-semibold text-slate-900 mt-1 flex items-center">
                    02. Log Automated Goods Receipt Note (GRN)
                    <InfoTooltip
                      title="3PL / IoT Oracle Verification"
                      content="An authorized third-party logistics oracle confirms physical arrival via dock RFID/IoT weight sensors, removing manual paper receiving delays from the 3-way match."
                    />
                  </h2>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                  Ref: {draft.poNumber}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="grnNumber" className="block text-xs font-medium text-slate-700 mb-1.5">
                    GRN Reference ID
                  </label>
                  <input
                    id="grnNumber"
                    type="text"
                    value={draft.grnNumber}
                    onChange={(e) => onUpdateDraft({ grnNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="oracleNode" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Authorized 3PL Oracle Node
                  </label>
                  <input
                    id="oracleNode"
                    type="text"
                    value={draft.oracleNode}
                    onChange={(e) => onUpdateDraft({ oracleNode: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="deliveredQuantity" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Physical Quantity Delivered (Units)
                  </label>
                  <input
                    id="deliveredQuantity"
                    type="number"
                    min={1}
                    value={draft.deliveredQuantity}
                    onChange={(e) =>
                      onUpdateDraft({ deliveredQuantity: Math.max(1, Number(e.target.value) || 0) })
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    PO Ordered: <span className="font-mono tabular-nums">{draft.poQuantity}</span> units
                  </p>
                </div>
                <div>
                  <label htmlFor="iotSealId" className="block text-xs font-medium text-slate-700 mb-1.5">
                    IoT Container Seal ID
                  </label>
                  <input
                    id="iotSealId"
                    type="text"
                    value={draft.iotSealId}
                    onChange={(e) => onUpdateDraft({ iotSealId: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="deliveryLocation" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Receiving Warehouse & Dock
                  </label>
                  <input
                    id="deliveryLocation"
                    type="text"
                    value={draft.deliveryLocation}
                    onChange={(e) => onUpdateDraft({ deliveryLocation: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">Confirmed Goods Value (at PO Unit Price)</div>
                  <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-0.5">
                    {formatCurrency(grnExpectedValue, true)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleStepSubmit(onLogGRN)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>{submitting ? 'Logging GRN…' : 'Sign & Log GRN on Ledger'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <FileText className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                    <span>Role: Tier-1 Supplier</span>
                    <span aria-hidden="true">·</span>
                    <span>{draft.supplierName}</span>
                  </div>
                  <h2 className="font-display text-lg font-semibold text-slate-900 mt-1 flex items-center">
                    03. Submit Commercial Invoice
                    <InfoTooltip
                      title="Real SHA-256 Cryptographic Fingerprint"
                      content="Your browser's Web Crypto API computes a unique 256-bit cryptographic hash of this invoice. If this exact hash already exists on the permissioned ledger, the smart contract blocks it immediately as a double-financing fraud attempt."
                    />
                  </h2>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                  PO: {draft.poNumber}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="invoiceNumber" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Commercial Invoice Number
                  </label>
                  <input
                    id="invoiceNumber"
                    type="text"
                    value={draft.invoiceNumber}
                    onChange={(e) => onUpdateDraft({ invoiceNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="invoiceDate" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Invoice Issue Date
                  </label>
                  <input
                    id="invoiceDate"
                    type="date"
                    value={draft.invoiceDate}
                    onChange={(e) => onUpdateDraft({ invoiceDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="billedQuantity" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Invoiced Quantity (Units)
                  </label>
                  <input
                    id="billedQuantity"
                    type="number"
                    min={1}
                    value={draft.billedQuantity}
                    onChange={(e) =>
                      onUpdateDraft({ billedQuantity: Math.max(1, Number(e.target.value) || 0) })
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="invoiceUnitPrice" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Invoiced Unit Price (USD)
                  </label>
                  <input
                    id="invoiceUnitPrice"
                    type="number"
                    min={1}
                    step="0.01"
                    value={draft.invoiceUnitPrice}
                    onChange={(e) =>
                      onUpdateDraft({
                        invoiceUnitPrice: Math.max(0.01, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Live Web Crypto SHA-256 Digest Preview */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-700">
                    Live Web Crypto SHA-256 Payload Fingerprint
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyHash(liveInvoiceHash)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    {copiedHash ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copy Hash</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-800 break-all leading-relaxed">
                  {liveInvoiceHash || 'Computing SHA-256 digest…'}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">Total Commercial Invoice Amount</div>
                  <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-0.5">
                    {formatCurrency(invoiceTotal, true)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleStepSubmit(onSubmitInvoice)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Cpu className="w-4 h-4" aria-hidden="true" />
                  <span>{submitting ? 'Executing Smart Contract…' : 'Execute Smart Contract Match'}</span>
                </button>
              </div>
            </div>
          )}

          {step === 4 && evaluation && committedInvoice && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Cpu className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                    <span>Role: Smart Contract Engine</span>
                    <span aria-hidden="true">·</span>
                    <span>ChainPaySettlement.sol</span>
                  </div>
                  <h2 className="font-display text-lg font-semibold text-slate-900 mt-1">
                    04. Automated Settlement Verdict
                  </h2>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {formatTimestamp(evaluation.evaluatedAt)}
                </span>
              </div>

              {/* CASE A: FRAUD ALERT */}
              {evaluation.verdict === 'fraud_blocked' && (
                <div
                  role="alert"
                  className="p-5 rounded-xl bg-rose-600 text-white space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-white" aria-hidden="true" />
                    <div>
                      <h3 className="font-display text-base font-bold tracking-tight">
                        FRAUD ALERT: Duplicate Invoice / Double-Financing Attempt Blocked
                      </h3>
                      <p className="text-sm text-rose-100 mt-1 leading-relaxed">
                        {evaluation.reason}
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-rose-500/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-rose-200">Conflicting On-Chain Record</div>
                      <div className="font-mono font-semibold text-white mt-0.5">
                        {evaluation.duplicateOfInvoiceNumber}
                      </div>
                    </div>
                    <div>
                      <div className="text-rose-200">Exposure Prevented</div>
                      <div className="font-mono font-semibold text-white tabular-nums mt-0.5">
                        {formatCurrency(committedInvoice.totalAmount, true)}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-rose-200">Matched SHA-256 Cryptographic Hash</div>
                      <div className="font-mono text-white break-all mt-0.5">
                        {committedInvoice.sha256Hash}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CASE B: AUTO-APPROVED & VPO MINTED */}
              {evaluation.verdict === 'approved' && (
                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <h3 className="font-display text-base font-bold text-emerald-950">
                        3-Way Match Approved — Validated Payment Obligation Minted
                      </h3>
                      <p className="text-sm text-emerald-900 mt-1 leading-relaxed">
                        {evaluation.reason}
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-emerald-200/80 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-emerald-700">Minted VPO Token</div>
                      <div className="font-mono font-semibold text-emerald-950 mt-0.5">
                        {evaluation.mintedVpoId}
                      </div>
                    </div>
                    <div>
                      <div className="text-emerald-700">Validated Amount</div>
                      <div className="font-mono font-semibold text-emerald-950 tabular-nums mt-0.5">
                        {formatCurrency(committedInvoice.totalAmount, true)}
                      </div>
                    </div>
                    <div>
                      <div className="text-emerald-700">Max Variance</div>
                      <div className="font-mono font-semibold text-emerald-950 tabular-nums mt-0.5">
                        {evaluation.maxVariancePct.toFixed(2)}% (≤ {SMART_TOLERANCE_PCT.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CASE C: VARIANCE > 2% EXCEPTION QUEUE */}
              {evaluation.verdict === 'exception' && (
                <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <h3 className="font-display text-base font-bold text-amber-950">
                        Smart Tolerance Exceeded — Routed to Exception Queue
                      </h3>
                      <p className="text-sm text-amber-900 mt-1 leading-relaxed">
                        {evaluation.reason}
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-amber-200/80 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-amber-800">Quantity Variance</div>
                      <div className="font-mono font-semibold text-amber-950 tabular-nums mt-0.5">
                        {evaluation.qtyVariancePct.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-amber-800">Total Value Variance</div>
                      <div className="font-mono font-semibold text-amber-950 tabular-nums mt-0.5">
                        {evaluation.valueVariancePct.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-amber-800">Allowed Band</div>
                      <div className="font-mono font-semibold text-amber-950 tabular-nums mt-0.5">
                        ≤ {SMART_TOLERANCE_PCT.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cryptographic Proof Details */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">On-Chain Invoice SHA-256 Proof</span>
                  <span className="text-slate-500">PDF & PII stored off-chain</span>
                </div>
                <div className="font-mono text-slate-800 break-all">{committedInvoice.sha256Hash}</div>
              </div>

              {/* Next Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onResetWorkflow}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Run Another Transaction</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onGoToLedger}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Inspect Block Explorer
                  </button>
                  {evaluation.verdict === 'approved' && (
                    <button
                      type="button"
                      onClick={onGoToLiquidity}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>Manage VPO in Liquidity Tab</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Context Column: Live 3-Way Match Monitor + Governance Exception Queue */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live 3-Way Match Reconciliation Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center">
                Live 3-Way Match Monitor
                <InfoTooltip
                  align="right"
                  title="2% Smart Tolerance Band"
                  content="The smart contract cross-checks PO ordered terms, 3PL Oracle delivered quantity, and Supplier invoice totals. Variances within ±2.00% settle straight-through; anything above 2.00% triggers manual buyer governance."
                />
              </h3>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Band: ±{SMART_TOLERANCE_PCT.toFixed(2)}%
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-2 font-medium">Document</th>
                    <th className="pb-2 font-medium text-right">Qty</th>
                    <th className="pb-2 font-medium text-right">Unit Price</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  <tr className={committedPo ? 'text-slate-900' : 'text-slate-500'}>
                    <td className="py-2.5 font-sans font-medium text-slate-700">
                      01. PO {committedPo ? '· Signed' : '· Draft'}
                    </td>
                    <td className="py-2.5 text-right">{draft.poQuantity}</td>
                    <td className="py-2.5 text-right">{formatCurrency(draft.poUnitPrice, true)}</td>
                    <td className="py-2.5 text-right font-semibold">{formatCurrency(poTotal)}</td>
                  </tr>
                  <tr className={committedGrn ? 'text-slate-900' : 'text-slate-500'}>
                    <td className="py-2.5 font-sans font-medium text-slate-700">
                      02. GRN {committedGrn ? '· Signed' : '· Pending'}
                    </td>
                    <td className="py-2.5 text-right">{draft.deliveredQuantity}</td>
                    <td className="py-2.5 text-right text-slate-400">—</td>
                    <td className="py-2.5 text-right font-semibold">
                      {formatCurrency(grnExpectedValue)}
                    </td>
                  </tr>
                  <tr className={committedInvoice ? 'text-slate-900' : 'text-slate-500'}>
                    <td className="py-2.5 font-sans font-medium text-slate-700">
                      03. Invoice {committedInvoice ? '· Hashed' : '· Pending'}
                    </td>
                    <td className="py-2.5 text-right">{draft.billedQuantity}</td>
                    <td className="py-2.5 text-right">
                      {formatCurrency(draft.invoiceUnitPrice, true)}
                    </td>
                    <td className="py-2.5 text-right font-semibold">
                      {formatCurrency(invoiceTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Variance Tolerance Meter */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-600 font-medium">Computed Max Variance</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    maxLiveVariance <= SMART_TOLERANCE_PCT ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {maxLiveVariance.toFixed(2)}%{' '}
                  {maxLiveVariance <= SMART_TOLERANCE_PCT ? '(Within Band)' : '(Exceeds 2.00%)'}
                </span>
              </div>
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                {/* 2% Threshold marker at 20% of 10% scale */}
                <div
                  aria-hidden="true"
                  className="absolute top-0 bottom-0 left-[20%] w-0.5 bg-slate-400 z-10"
                />
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    maxLiveVariance <= SMART_TOLERANCE_PCT ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, (maxLiveVariance / 10) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                <span>0%</span>
                <span>2% Auto-Match Cap</span>
                <span>10%+</span>
              </div>
            </div>
          </div>

          {/* Governance Exception Queue */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center">
                Exception Queue & Governance Override
                <InfoTooltip
                  align="right"
                  title="Manual Governance Override"
                  content="Invoices with >2% price or quantity variance pause automatically. An authorized Corporate Buyer approver can inspect the variance and record an auditable override to mint the VPO or reject the invoice."
                />
              </h3>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {pendingExceptions.length} Pending
              </span>
            </div>

            {exceptions.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-500">
                  No variance exceptions recorded yet. Click{' '}
                  <button
                    type="button"
                    onClick={() => onLoadPreset('variance')}
                    className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 cursor-pointer"
                  >
                    Simulate 5% Variance
                  </button>{' '}
                  to test governance routing.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-2">
                {exceptions.map((ex) => {
                  const note = overrideNotes[ex.id] ?? 'Approved after supplier shipping manifest reconciliation';
                  return (
                    <div key={ex.id} className="py-4 first:pt-2 last:pb-0 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            {ex.invoice.invoiceNumber} · {ex.po.poNumber}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {ex.invoice.supplierName} · {formatCurrency(ex.invoice.totalAmount, true)}
                          </div>
                        </div>
                        {ex.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                            +{ex.evaluation.maxVariancePct.toFixed(2)}% Var
                          </span>
                        ) : ex.status === 'overridden_approved' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Overridden
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 shrink-0">
                            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                            Rejected
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 font-mono tabular-nums">
                        GRN: {ex.grn.deliveredQuantity} u · Billed: {ex.invoice.billedQuantity} u ·
                        Hash: {formatShortHash(ex.invoice.sha256Hash, 8, 6)}
                      </div>

                      {ex.status === 'pending' ? (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            aria-label={`Governance override justification for ${ex.invoice.invoiceNumber}`}
                            value={note}
                            onChange={(e) =>
                              setOverrideNotes((prev) => ({ ...prev, [ex.id]: e.target.value }))
                            }
                            placeholder="Enter governance audit justification…"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOverrideException(ex.id, note)}
                              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Approve Override & Mint VPO
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectException(ex.id, note)}
                              className="px-3 py-2 text-xs font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          Resolution: {ex.overrideReason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
