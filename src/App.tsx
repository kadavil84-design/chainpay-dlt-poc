/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardContractTab } from './components/DashboardContractTab';
import { LedgerAuditTab } from './components/LedgerAuditTab';
import { LiquidityTab } from './components/LiquidityTab';
import { P2PWorkflowTab } from './components/P2PWorkflowTab';
import { TopNav } from './components/TopNav';
import {
  buildInitialSeedState,
  createCleanSamplePreset,
  createVarianceSamplePreset,
  DUPLICATE_DEMO_PRESET,
} from './data/seedData';
import {
  ActiveTab,
  CommercialInvoice,
  ExceptionRecord,
  FractionalTransfer,
  FraudAttemptRecord,
  GoodsReceiptNote,
  InvoiceRegistryEntry,
  LedgerActionType,
  LedgerBlock,
  LedgerRole,
  MatchEvaluation,
  PurchaseOrder,
  VPOToken,
  WorkflowDraft,
  WorkflowStep,
} from './types/chainpay';
import {
  ANCHOR_PRIME_RATE_PCT,
  calculateMsmeFinancingEconomics,
  computeSha256,
  formatCurrency,
  GENESIS_PREV_HASH,
  LOCAL_MSME_LENDING_RATE_PCT,
  serializeBlockForHash,
  serializeInvoicePayload,
  SMART_TOLERANCE_PCT,
} from './utils/crypto';

interface ToastMessage {
  id: number;
  tone: 'emerald' | 'amber' | 'rose';
  text: string;
}

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('workflow');

  // Core ledger & financial state
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const blocksRef = useRef<LedgerBlock[]>([]);
  const [vpos, setVpos] = useState<VPOToken[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [invoiceRegistry, setInvoiceRegistry] = useState<InvoiceRegistryEntry[]>([]);
  const [fraudAttempts, setFraudAttempts] = useState<FraudAttemptRecord[]>([]);

  // KPI counters
  const [totalProcessedInvoices, setTotalProcessedInvoices] = useState(0);
  const [autoApprovedCount, setAutoApprovedCount] = useState(0);
  const [overrideApprovedCount, setOverrideApprovedCount] = useState(0);

  // Guided P2P workflow state
  const [sequenceCounter, setSequenceCounter] = useState(0);
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(1);
  const [activeScenario, setActiveScenario] = useState<'custom' | 'clean' | 'variance' | 'duplicate'>('clean');
  const [draft, setDraft] = useState<WorkflowDraft>(() => createCleanSamplePreset(0));
  const [committedPo, setCommittedPo] = useState<PurchaseOrder | null>(null);
  const [committedGrn, setCommittedGrn] = useState<GoodsReceiptNote | null>(null);
  const [committedInvoice, setCommittedInvoice] = useState<CommercialInvoice | null>(null);
  const [evaluation, setEvaluation] = useState<MatchEvaluation | null>(null);

  // Subtle toast notification & reset state
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((tone: ToastMessage['tone'], text: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), tone, text });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 4200);
  }, []);

  // Initialize realistic pre-populated seed data with real Web Crypto SHA-256 hashes
  useEffect(() => {
    let mounted = true;
    buildInitialSeedState().then((seed) => {
      if (!mounted) return;
      blocksRef.current = seed.blocks;
      setBlocks(seed.blocks);
      setVpos(seed.vpos);
      setInvoiceRegistry(seed.invoiceRegistry);
      setFraudAttempts(seed.fraudAttempts);
      setAutoApprovedCount(seed.autoApprovedCount);
      setOverrideApprovedCount(seed.overrideApprovedCount);
      setTotalProcessedInvoices(seed.totalProcessedInvoices);
      setInitialized(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Appends one or more cryptographically linked SHA-256 blocks to the permissioned ledger.
   * Uses blocksRef so consecutive blocks emitted in the same workflow step always link accurately.
   */
  const appendLedgerBlocks = useCallback(
    async (
      entries: {
        role: LedgerRole;
        nodeName: string;
        action: LedgerActionType;
        actionLabel: string;
        summary: string;
        referenceId: string;
        offChainRef: string;
      }[]
    ): Promise<LedgerBlock[]> => {
      const current = [...blocksRef.current];
      const added: LedgerBlock[] = [];

      for (const entry of entries) {
        const previousHash =
          current.length === 0 ? GENESIS_PREV_HASH : current[current.length - 1].hash;
        const blockNumber = current.length + 1;
        const timestamp = new Date().toISOString();
        const payload = serializeBlockForHash({
          blockNumber,
          timestamp,
          role: entry.role,
          nodeName: entry.nodeName,
          action: entry.action,
          summary: entry.summary,
          referenceId: entry.referenceId,
          offChainRef: entry.offChainRef,
          previousHash,
        });
        const hash = await computeSha256(payload);
        const block: LedgerBlock = {
          blockNumber,
          timestamp,
          ...entry,
          previousHash,
          hash,
        };
        current.push(block);
        added.push(block);
      }

      blocksRef.current = current;
      setBlocks(current);
      return added;
    },
    []
  );

  const handleUpdateDraft = (patch: Partial<WorkflowDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleLoadPreset = async (preset: 'clean' | 'variance' | 'duplicate') => {
    setActiveTab('workflow');
    setEvaluation(null);
    setCommittedInvoice(null);

    if (preset === 'clean') {
      const nextSeq = sequenceCounter + 1;
      setSequenceCounter(nextSeq);
      setDraft(createCleanSamplePreset(nextSeq));
      setActiveScenario('clean');
      setCommittedPo(null);
      setCommittedGrn(null);
      setWorkflowStep(1);
      showToast('emerald', 'Loaded clean 3-way match sample PO (0.50% variance — auto-approve).');
      return;
    }

    if (preset === 'variance') {
      const nextSeq = sequenceCounter + 1;
      setSequenceCounter(nextSeq);
      setDraft(createVarianceSamplePreset(nextSeq));
      setActiveScenario('variance');
      setCommittedPo(null);
      setCommittedGrn(null);
      setWorkflowStep(1);
      showToast('amber', 'Loaded 5% variance scenario (routes to Exception Queue on Step 4).');
      return;
    }

    // Duplicate invoice preset: Pre-populates existing PO-2026-0842 & GRN-2026-0842 and takes presenter directly to Step 3
    setDraft(DUPLICATE_DEMO_PRESET);
    setActiveScenario('duplicate');
    const poHash = await computeSha256(
      JSON.stringify({
        poNumber: DUPLICATE_DEMO_PRESET.poNumber,
        quantity: DUPLICATE_DEMO_PRESET.poQuantity,
        unitPrice: DUPLICATE_DEMO_PRESET.poUnitPrice,
      })
    );
    const grnHash = await computeSha256(
      JSON.stringify({
        grnNumber: DUPLICATE_DEMO_PRESET.grnNumber,
        deliveredQuantity: DUPLICATE_DEMO_PRESET.deliveredQuantity,
      })
    );

    setCommittedPo({
      poNumber: DUPLICATE_DEMO_PRESET.poNumber,
      buyerName: DUPLICATE_DEMO_PRESET.buyerName,
      supplierName: DUPLICATE_DEMO_PRESET.supplierName,
      itemDescription: DUPLICATE_DEMO_PRESET.itemDescription,
      quantity: DUPLICATE_DEMO_PRESET.poQuantity,
      unitPrice: DUPLICATE_DEMO_PRESET.poUnitPrice,
      totalValue: DUPLICATE_DEMO_PRESET.poQuantity * DUPLICATE_DEMO_PRESET.poUnitPrice,
      paymentTermsDays: DUPLICATE_DEMO_PRESET.paymentTermsDays,
      issuedAt: '2026-11-19T08:30:15.000Z',
      payloadHash: poHash,
    });
    setCommittedGrn({
      grnNumber: DUPLICATE_DEMO_PRESET.grnNumber,
      poNumber: DUPLICATE_DEMO_PRESET.poNumber,
      oracleNode: DUPLICATE_DEMO_PRESET.oracleNode,
      deliveredQuantity: DUPLICATE_DEMO_PRESET.deliveredQuantity,
      deliveryLocation: DUPLICATE_DEMO_PRESET.deliveryLocation,
      iotSealId: DUPLICATE_DEMO_PRESET.iotSealId,
      timestamp: '2026-11-19T13:18:52.000Z',
      payloadHash: grnHash,
    });
    setWorkflowStep(3);
    showToast(
      'rose',
      'Duplicate invoice INV-2026-0842 staged at Step 3 — click Execute Smart Contract Match to trigger SHA-256 Fraud Alert.'
    );
  };

  const handleResetWorkflow = () => {
    const nextSeq = sequenceCounter + 1;
    setSequenceCounter(nextSeq);
    setDraft(createCleanSamplePreset(nextSeq));
    setActiveScenario('clean');
    setCommittedPo(null);
    setCommittedGrn(null);
    setCommittedInvoice(null);
    setEvaluation(null);
    setWorkflowStep(1);
    setActiveTab('workflow');
  };

  const handleResetDemoData = async () => {
    setIsResettingDemo(true);
    try {
      const seed = await buildInitialSeedState();
      blocksRef.current = seed.blocks;
      setBlocks(seed.blocks);
      setVpos(seed.vpos);
      setExceptions([]);
      setInvoiceRegistry(seed.invoiceRegistry);
      setFraudAttempts(seed.fraudAttempts);
      setAutoApprovedCount(seed.autoApprovedCount);
      setOverrideApprovedCount(seed.overrideApprovedCount);
      setTotalProcessedInvoices(seed.totalProcessedInvoices);
      setSequenceCounter(0);
      setDraft(createCleanSamplePreset(0));
      setActiveScenario('clean');
      setCommittedPo(null);
      setCommittedGrn(null);
      setCommittedInvoice(null);
      setEvaluation(null);
      setWorkflowStep(1);
      showToast('emerald', 'Demo reset complete — restored the 2 initial pre-populated transactions.');
    } finally {
      setIsResettingDemo(false);
    }
  };

  // Step 1: Buyer Issues & Hashes Purchase Order
  const handleIssuePO = async () => {
    const totalValue = Number((draft.poQuantity * draft.poUnitPrice).toFixed(2));
    const issuedAt = new Date().toISOString();
    const payloadHash = await computeSha256(
      JSON.stringify({
        poNumber: draft.poNumber,
        buyerName: draft.buyerName,
        supplierName: draft.supplierName,
        itemDescription: draft.itemDescription,
        quantity: draft.poQuantity,
        unitPrice: draft.poUnitPrice,
        totalValue,
        paymentTermsDays: draft.paymentTermsDays,
        issuedAt,
      })
    );

    const po: PurchaseOrder = {
      poNumber: draft.poNumber,
      buyerName: draft.buyerName,
      supplierName: draft.supplierName,
      itemDescription: draft.itemDescription,
      quantity: draft.poQuantity,
      unitPrice: draft.poUnitPrice,
      totalValue,
      paymentTermsDays: draft.paymentTermsDays,
      issuedAt,
      payloadHash,
    };

    await appendLedgerBlocks([
      {
        role: 'Corporate Buyer',
        nodeName: 'Apex Industrials ERP Node',
        action: 'PO_HASHED',
        actionLabel: 'PO Hashed',
        summary: `Issued ${po.poNumber} to ${po.supplierName} for ${po.quantity} units of ${po.itemDescription} (${formatCurrency(po.totalValue)} · Net ${po.paymentTermsDays} Days).`,
        referenceId: po.poNumber,
        offChainRef: `erp-vault://po/${po.poNumber}.pdf (SHA-256 anchored)`,
      },
    ]);

    setCommittedPo(po);
    setWorkflowStep(2);
    showToast('emerald', `${po.poNumber} hashed and committed to the permissioned ledger.`);
  };

  // Step 2: 3PL / IoT Oracle Logs Goods Receipt Note
  const handleLogGRN = async () => {
    const timestamp = new Date().toISOString();
    const payloadHash = await computeSha256(
      JSON.stringify({
        grnNumber: draft.grnNumber,
        poNumber: draft.poNumber,
        oracleNode: draft.oracleNode,
        deliveredQuantity: draft.deliveredQuantity,
        iotSealId: draft.iotSealId,
        timestamp,
      })
    );

    const grn: GoodsReceiptNote = {
      grnNumber: draft.grnNumber,
      poNumber: draft.poNumber,
      oracleNode: draft.oracleNode,
      deliveredQuantity: draft.deliveredQuantity,
      deliveryLocation: draft.deliveryLocation,
      iotSealId: draft.iotSealId,
      timestamp,
      payloadHash,
    };

    await appendLedgerBlocks([
      {
        role: '3PL / IoT Oracle',
        nodeName: grn.oracleNode,
        action: 'GRN_LOGGED',
        actionLabel: 'GRN Logged',
        summary: `Confirmed physical delivery of ${grn.deliveredQuantity} units for ${grn.poNumber} at ${grn.deliveryLocation} (IoT Seal #${grn.iotSealId}).`,
        referenceId: grn.grnNumber,
        offChainRef: `iot-telemetry://grn/${grn.grnNumber}.json (Off-Chain)`,
      },
    ]);

    setCommittedGrn(grn);
    setWorkflowStep(3);
    showToast('emerald', `${grn.grnNumber} signed by ${grn.oracleNode}.`);
  };

  // Step 3 -> 4: Tier-1 Supplier Submits Invoice & Smart Contract Executes
  const handleSubmitInvoice = async () => {
    const po: PurchaseOrder =
      committedPo ?? {
        poNumber: draft.poNumber,
        buyerName: draft.buyerName,
        supplierName: draft.supplierName,
        itemDescription: draft.itemDescription,
        quantity: draft.poQuantity,
        unitPrice: draft.poUnitPrice,
        totalValue: Number((draft.poQuantity * draft.poUnitPrice).toFixed(2)),
        paymentTermsDays: draft.paymentTermsDays,
        issuedAt: new Date().toISOString(),
        payloadHash: '',
      };

    const grn: GoodsReceiptNote =
      committedGrn ?? {
        grnNumber: draft.grnNumber,
        poNumber: draft.poNumber,
        oracleNode: draft.oracleNode,
        deliveredQuantity: draft.deliveredQuantity,
        deliveryLocation: draft.deliveryLocation,
        iotSealId: draft.iotSealId,
        timestamp: new Date().toISOString(),
        payloadHash: '',
      };

    const totalAmount = Number((draft.billedQuantity * draft.invoiceUnitPrice).toFixed(2));
    const canonicalPayload = serializeInvoicePayload({
      invoiceNumber: draft.invoiceNumber,
      poNumber: draft.poNumber,
      supplierName: draft.supplierName,
      billedQuantity: draft.billedQuantity,
      unitPrice: draft.invoiceUnitPrice,
      totalAmount,
      invoiceDate: draft.invoiceDate,
    });
    const sha256Hash = await computeSha256(canonicalPayload);

    const invoice: CommercialInvoice = {
      invoiceNumber: draft.invoiceNumber,
      poNumber: draft.poNumber,
      supplierName: draft.supplierName,
      billedQuantity: draft.billedQuantity,
      unitPrice: draft.invoiceUnitPrice,
      totalAmount,
      invoiceDate: draft.invoiceDate,
      sha256Hash,
    };

    const evaluatedAt = new Date().toISOString();

    // 1. DOUBLE-FINANCING BLOCKER: Check SHA-256 hash against immutable ledger registry
    const existingDuplicate = invoiceRegistry.find((entry) => entry.invoiceHash === sha256Hash);
    if (existingDuplicate) {
      const fraudEval: MatchEvaluation = {
        verdict: 'fraud_blocked',
        qtyVariancePct: 0,
        priceVariancePct: 0,
        valueVariancePct: 0,
        maxVariancePct: 0,
        tolerancePct: SMART_TOLERANCE_PCT,
        duplicateOfInvoiceNumber: existingDuplicate.invoiceNumber,
        reason: `Cryptographic SHA-256 fingerprint matches previously processed invoice ${existingDuplicate.invoiceNumber} (${existingDuplicate.poNumber}). Settlement aborted to prevent duplicate financing.`,
        evaluatedAt,
      };

      await appendLedgerBlocks([
        {
          role: 'Smart Contract Engine',
          nodeName: 'ChainPaySettlement.sol',
          action: 'FRAUD_BLOCKED',
          actionLabel: 'Fraud Blocked',
          summary: `FRAUD ALERT: Blocked duplicate submission of ${invoice.invoiceNumber} (${formatCurrency(invoice.totalAmount)}). Exact SHA-256 collision detected with settled invoice ${existingDuplicate.invoiceNumber}.`,
          referenceId: invoice.invoiceNumber,
          offChainRef: `sha256://${sha256Hash.slice(0, 16)}… (Duplicate Rejected)`,
        },
      ]);

      setFraudAttempts((prev) => [
        {
          id: `FRD-${Date.now()}`,
          attemptedInvoiceNumber: invoice.invoiceNumber,
          duplicateOfInvoiceNumber: existingDuplicate.invoiceNumber,
          poNumber: invoice.poNumber,
          supplierName: invoice.supplierName,
          attemptedAmount: invoice.totalAmount,
          duplicateHash: sha256Hash,
          blockedAt: evaluatedAt,
        },
        ...prev,
      ]);

      setCommittedInvoice(invoice);
      setEvaluation(fraudEval);
      setWorkflowStep(4);
      showToast('rose', 'FRAUD ALERT: Duplicate SHA-256 invoice hash blocked on-chain.');
      return;
    }

    // 2. Register unique invoice hash to prevent any future double-financing
    setInvoiceRegistry((prev) => [
      {
        invoiceHash: sha256Hash,
        invoiceNumber: invoice.invoiceNumber,
        poNumber: invoice.poNumber,
        supplierName: invoice.supplierName,
        totalAmount: invoice.totalAmount,
        recordedAt: evaluatedAt,
      },
      ...prev,
    ]);
    setTotalProcessedInvoices((prev) => prev + 1);

    // 3. 2% SMART TOLERANCE BAND COMPARISON (PO vs GRN vs Invoice)
    const qtyVariancePct =
      grn.deliveredQuantity > 0
        ? Math.abs((invoice.billedQuantity - grn.deliveredQuantity) / grn.deliveredQuantity) * 100
        : 100;
    const priceVariancePct =
      po.unitPrice > 0
        ? Math.abs((invoice.unitPrice - po.unitPrice) / po.unitPrice) * 100
        : 100;
    const valueVariancePct =
      po.totalValue > 0
        ? Math.abs((invoice.totalAmount - po.totalValue) / po.totalValue) * 100
        : 100;
    const maxVariancePct = Number(
      Math.max(qtyVariancePct, priceVariancePct, valueVariancePct).toFixed(2)
    );

    if (maxVariancePct <= SMART_TOLERANCE_PCT) {
      // Auto-Approve & Mint VPO Token
      const vpoSuffix = po.poNumber.replace(/[^0-9]/g, '').slice(-4) || String(1000 + vpos.length);
      const tokenId = `VPO-${vpoSuffix}`;

      const newVpo: VPOToken = {
        tokenId,
        poNumber: po.poNumber,
        invoiceNumber: invoice.invoiceNumber,
        invoiceHash: sha256Hash,
        itemDescription: po.itemDescription,
        issuer: po.buyerName,
        currentHolder: invoice.supplierName,
        originalAmount: invoice.totalAmount,
        remainingAmount: invoice.totalAmount,
        maturityDays: po.paymentTermsDays,
        issuedAt: evaluatedAt,
        status: 'active',
        approvalMethod: 'auto_match',
        variancePct: maxVariancePct,
        fractionalizations: [],
      };

      await appendLedgerBlocks([
        {
          role: 'Smart Contract Engine',
          nodeName: 'ChainPaySettlement.sol',
          action: 'MATCH_EXECUTED',
          actionLabel: '3-Way Match Executed',
          summary: `${invoice.invoiceNumber} (${formatCurrency(invoice.totalAmount)}) matched PO ${po.poNumber} & GRN ${grn.grnNumber}. Max variance ${maxVariancePct.toFixed(2)}% within 2.00% Smart Tolerance Band.`,
          referenceId: invoice.invoiceNumber,
          offChainRef: `sha256://${sha256Hash.slice(0, 16)}… (PDF Off-Chain)`,
        },
        {
          role: 'Smart Contract Engine',
          nodeName: 'ChainPaySettlement.sol',
          action: 'VPO_MINTED',
          actionLabel: 'VPO Minted',
          summary: `Minted Validated Payment Obligation ${tokenId} for ${formatCurrency(invoice.totalAmount)} payable to ${invoice.supplierName} (Net ${po.paymentTermsDays} Days).`,
          referenceId: tokenId,
          offChainRef: `vpo-ledger://tokens/${tokenId}`,
        },
      ]);

      setVpos((prev) => [newVpo, ...prev]);
      setAutoApprovedCount((prev) => prev + 1);
      setCommittedInvoice(invoice);
      setEvaluation({
        verdict: 'approved',
        qtyVariancePct: Number(qtyVariancePct.toFixed(2)),
        priceVariancePct: Number(priceVariancePct.toFixed(2)),
        valueVariancePct: Number(valueVariancePct.toFixed(2)),
        maxVariancePct,
        tolerancePct: SMART_TOLERANCE_PCT,
        mintedVpoId: tokenId,
        reason: `PO, GRN, and Commercial Invoice reconciled with ${maxVariancePct.toFixed(2)}% variance (≤ 2.00% Smart Tolerance Band). Validated Payment Obligation ${tokenId} minted automatically.`,
        evaluatedAt,
      });
      setWorkflowStep(4);
      showToast('emerald', `3-Way Match auto-approved. ${tokenId} minted for ${formatCurrency(invoice.totalAmount)}.`);
    } else {
      // Exceeds 2% Smart Tolerance -> Route to Exception Queue
      const exceptionEval: MatchEvaluation = {
        verdict: 'exception',
        qtyVariancePct: Number(qtyVariancePct.toFixed(2)),
        priceVariancePct: Number(priceVariancePct.toFixed(2)),
        valueVariancePct: Number(valueVariancePct.toFixed(2)),
        maxVariancePct,
        tolerancePct: SMART_TOLERANCE_PCT,
        reason: `Detected ${maxVariancePct.toFixed(2)}% variance between GRN (${grn.deliveredQuantity} u) / PO (${formatCurrency(po.totalValue)}) and Invoice (${invoice.billedQuantity} u / ${formatCurrency(invoice.totalAmount)}). Exceeds 2.00% threshold — routed to Exception Queue for manual governance review.`,
        evaluatedAt,
      };

      const exceptionRecord: ExceptionRecord = {
        id: `EXC-${Date.now()}`,
        po,
        grn,
        invoice,
        evaluation: exceptionEval,
        status: 'pending',
      };

      await appendLedgerBlocks([
        {
          role: 'Smart Contract Engine',
          nodeName: 'ChainPaySettlement.sol',
          action: 'EXCEPTION_ROUTED',
          actionLabel: 'Routed to Exception Queue',
          summary: `${invoice.invoiceNumber} paused with ${maxVariancePct.toFixed(2)}% variance (exceeds 2.00% smart tolerance). Awaiting Corporate Buyer governance override.`,
          referenceId: invoice.invoiceNumber,
          offChainRef: `sha256://${sha256Hash.slice(0, 16)}… (Exception Hold)`,
        },
      ]);

      setExceptions((prev) => [exceptionRecord, ...prev]);
      setCommittedInvoice(invoice);
      setEvaluation(exceptionEval);
      setWorkflowStep(4);
      showToast(
        'amber',
        `${invoice.invoiceNumber} routed to Exception Queue (${maxVariancePct.toFixed(2)}% variance > 2.00%).`
      );
    }
  };

  // Manual Governance Override (Approve & Mint VPO)
  const handleOverrideException = async (exceptionId: string, note: string) => {
    const target = exceptions.find((e) => e.id === exceptionId);
    if (!target || target.status !== 'pending') return;

    const resolvedAt = new Date().toISOString();
    const vpoSuffix =
      target.po.poNumber.replace(/[^0-9]/g, '').slice(-4) || String(1000 + vpos.length);
    const tokenId = `VPO-${vpoSuffix}`;

    const newVpo: VPOToken = {
      tokenId,
      poNumber: target.po.poNumber,
      invoiceNumber: target.invoice.invoiceNumber,
      invoiceHash: target.invoice.sha256Hash,
      itemDescription: target.po.itemDescription,
      issuer: target.po.buyerName,
      currentHolder: target.invoice.supplierName,
      originalAmount: target.invoice.totalAmount,
      remainingAmount: target.invoice.totalAmount,
      maturityDays: target.po.paymentTermsDays,
      issuedAt: resolvedAt,
      status: 'active',
      approvalMethod: 'governance_override',
      variancePct: target.evaluation.maxVariancePct,
      fractionalizations: [],
    };

    await appendLedgerBlocks([
      {
        role: 'Governance Committee',
        nodeName: 'Apex Controller Multisig',
        action: 'GOVERNANCE_OVERRIDE',
        actionLabel: 'Governance Override Approved',
        summary: `Manual override approved for ${target.invoice.invoiceNumber} (${target.evaluation.maxVariancePct.toFixed(2)}% variance). Audit note: "${note || 'Approved by Corporate Controller'}".`,
        referenceId: target.invoice.invoiceNumber,
        offChainRef: `governance://overrides/${target.invoice.invoiceNumber}.sig`,
      },
      {
        role: 'Smart Contract Engine',
        nodeName: 'ChainPaySettlement.sol',
        action: 'VPO_MINTED',
        actionLabel: 'VPO Minted',
        summary: `Minted ${tokenId} (${formatCurrency(target.invoice.totalAmount)}) following manual governance override for ${target.invoice.supplierName}.`,
        referenceId: tokenId,
        offChainRef: `vpo-ledger://tokens/${tokenId}`,
      },
    ]);

    setExceptions((prev) =>
      prev.map((ex) =>
        ex.id === exceptionId
          ? {
              ...ex,
              status: 'overridden_approved',
              overrideReason: note || 'Approved by Corporate Controller',
              resolvedAt,
              resolvedBy: 'Apex Controller Multisig',
            }
          : ex
      )
    );
    setVpos((prev) => [newVpo, ...prev]);
    setOverrideApprovedCount((prev) => prev + 1);
    showToast('emerald', `Governance override recorded. ${tokenId} minted and available in VPO Liquidity.`);
  };

  // Manual Governance Reject
  const handleRejectException = async (exceptionId: string, note: string) => {
    const target = exceptions.find((e) => e.id === exceptionId);
    if (!target || target.status !== 'pending') return;

    const resolvedAt = new Date().toISOString();
    await appendLedgerBlocks([
      {
        role: 'Governance Committee',
        nodeName: 'Apex Controller Multisig',
        action: 'EXCEPTION_ROUTED',
        actionLabel: 'Exception Rejected',
        summary: `Rejected ${target.invoice.invoiceNumber} (${target.evaluation.maxVariancePct.toFixed(2)}% variance). Reason: "${note || 'Returned to supplier for credit memo'}".`,
        referenceId: target.invoice.invoiceNumber,
        offChainRef: `governance://rejections/${target.invoice.invoiceNumber}.sig`,
      },
    ]);

    setExceptions((prev) =>
      prev.map((ex) =>
        ex.id === exceptionId
          ? {
              ...ex,
              status: 'rejected',
              overrideReason: note || 'Returned to supplier for credit memo',
              resolvedAt,
              resolvedBy: 'Apex Controller Multisig',
            }
          : ex
      )
    );
    showToast('rose', `${target.invoice.invoiceNumber} rejected and logged to Audit Trail.`);
  };

  // Tab 2 Action 1: Dynamic Discounting
  const handleExecuteDynamicDiscount = async (
    tokenId: string,
    discountPct: number,
    settlementDay: number
  ) => {
    const target = vpos.find((v) => v.tokenId === tokenId);
    if (!target || target.remainingAmount <= 0) return;

    const daysAccelerated = Math.max(1, target.maturityDays - settlementDay);
    const buyerEbitdaSavings = Number((target.remainingAmount * (discountPct / 100)).toFixed(2));
    const supplierCashReceived = Number((target.remainingAmount - buyerEbitdaSavings).toFixed(2));
    const annualizedBuyerYieldPct = Number(
      ((discountPct / (100 - discountPct)) * (365 / daysAccelerated) * 100).toFixed(1)
    );
    const settledAt = new Date().toISOString();

    const [block] = await appendLedgerBlocks([
      {
        role: 'Tier-1 Supplier',
        nodeName: `${target.currentHolder} Treasury Node`,
        action: 'DYNAMIC_DISCOUNT',
        actionLabel: 'Dynamic Discount Settled',
        summary: `Settled ${tokenId} on Day ${settlementDay} at ${discountPct.toFixed(1)}% discount. Supplier received ${formatCurrency(supplierCashReceived, true)} immediately; Apex Industrials captured ${formatCurrency(buyerEbitdaSavings, true)} EBITDA savings (${annualizedBuyerYieldPct}% APR).`,
        referenceId: tokenId,
        offChainRef: `settlement-rail://rtgs/${tokenId}-D${settlementDay}`,
      },
    ]);

    setVpos((prev) =>
      prev.map((v) =>
        v.tokenId === tokenId
          ? {
              ...v,
              remainingAmount: 0,
              status: 'discounted',
              discountSettlement: {
                discountPct,
                settlementDay,
                daysAccelerated,
                buyerEbitdaSavings,
                supplierCashReceived,
                annualizedBuyerYieldPct,
                settledAt,
                txHash: block.hash,
              },
            }
          : v
      )
    );
    showToast(
      'emerald',
      `Instant Day-${settlementDay} settlement executed: +${formatCurrency(buyerEbitdaSavings, true)} Buyer EBITDA saved.`
    );
  };

  // Tab 2 Action 2: Deep-Tier MSME Fractionalization
  const handleFractionalizeVpo = async (
    tokenId: string,
    recipientName: string,
    splitPct: number
  ) => {
    const target = vpos.find((v) => v.tokenId === tokenId);
    if (!target || target.remainingAmount <= 0) return;

    const amount = Number(((target.remainingAmount * splitPct) / 100).toFixed(2));
    const newRemaining = Number((target.remainingAmount - amount).toFixed(2));
    const transferIndex = target.fractionalizations.length + 1;
    const splitId = `${tokenId}-T2${transferIndex > 1 ? `B${transferIndex}` : ''}`;
    const transferredAt = new Date().toISOString();

    const econ = calculateMsmeFinancingEconomics(
      amount,
      target.maturityDays,
      ANCHOR_PRIME_RATE_PCT,
      LOCAL_MSME_LENDING_RATE_PCT
    );

    const [block] = await appendLedgerBlocks([
      {
        role: 'Tier-1 Supplier',
        nodeName: `${target.currentHolder} Treasury Node`,
        action: 'TOKEN_FRACTIONALIZED',
        actionLabel: 'Token Fractionalized',
        summary: `Split ${splitPct}% (${formatCurrency(amount, true)}) of ${tokenId} and transferred fractional obligation ${splitId} to Tier-2 MSME ${recipientName}.`,
        referenceId: splitId,
        offChainRef: `vpo-ledger://splits/${splitId}`,
      },
    ]);

    const newTransfer: FractionalTransfer = {
      id: splitId,
      parentVpoId: tokenId,
      recipientName,
      recipientTier: 'Tier-2 MSME',
      percentage: splitPct,
      amount,
      transferredAt,
      financed: false,
      anchorPrimeRatePct: ANCHOR_PRIME_RATE_PCT,
      localLenderRatePct: LOCAL_MSME_LENDING_RATE_PCT,
      maturityDays: target.maturityDays,
      financingCostAtPrime: econ.financingCostAtPrime,
      financingCostAtLocal: econ.financingCostAtLocal,
      msmeInterestSaved: econ.msmeInterestSaved,
      netCashToMsme: econ.netCashToMsme,
      txHash: block.hash,
    };

    setVpos((prev) =>
      prev.map((v) =>
        v.tokenId === tokenId
          ? {
              ...v,
              remainingAmount: newRemaining,
              status: newRemaining === 0 ? 'fully_settled' : 'partially_fractionalized',
              fractionalizations: [...v.fractionalizations, newTransfer],
            }
          : v
      )
    );
    showToast(
      'emerald',
      `Fractional token ${splitId} (${formatCurrency(amount)}) transferred to ${recipientName}.`
    );
  };

  // Tab 2 Action 2b: Tier-2 MSME Redeems Fractional VPO at Anchor Prime Rate
  const handleFinanceMsmeTransfer = async (tokenId: string, transferId: string) => {
    const parent = vpos.find((v) => v.tokenId === tokenId);
    const transfer = parent?.fractionalizations.find((f) => f.id === transferId);
    if (!parent || !transfer || transfer.financed) return;

    const financedAt = new Date().toISOString();
    await appendLedgerBlocks([
      {
        role: 'Tier-2 MSME',
        nodeName: `${transfer.recipientName} Finance Portal`,
        action: 'MSME_FINANCED',
        actionLabel: 'MSME Prime Financing',
        summary: `${transfer.recipientName} financed ${transfer.id} (${formatCurrency(transfer.amount, true)}) at Apex Anchor Prime Rate (${transfer.anchorPrimeRatePct}% vs ${transfer.localLenderRatePct}% local), saving ${formatCurrency(transfer.msmeInterestSaved, true)} in interest.`,
        referenceId: transfer.id,
        offChainRef: `liquidity-pool://prime-anchor/${transfer.id}`,
      },
    ]);

    setVpos((prev) =>
      prev.map((v) =>
        v.tokenId === tokenId
          ? {
              ...v,
              fractionalizations: v.fractionalizations.map((f) =>
                f.id === transferId ? { ...f, financed: true, financedAt } : f
              ),
            }
          : v
      )
    );
    showToast(
      'emerald',
      `${transfer.recipientName} unlocked ${formatCurrency(transfer.netCashToMsme, true)} at ${transfer.anchorPrimeRatePct}% Anchor Prime.`
    );
  };

  const pendingExceptionsCount = exceptions.filter((e) => e.status === 'pending').length;
  const activeVpoCount = vpos.filter((v) => v.remainingAmount > 0).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewTransaction={handleResetWorkflow}
        onResetDemo={handleResetDemoData}
        isResettingDemo={isResettingDemo}
        pendingExceptionsCount={pendingExceptionsCount}
        activeVpoCount={activeVpoCount}
        blockCount={blocks.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!initialized ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
            <div className="h-6 w-64 bg-slate-100 rounded" />
            <div className="h-4 w-96 bg-slate-100 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
              <div className="h-24 bg-slate-100 rounded-lg" />
              <div className="h-24 bg-slate-100 rounded-lg" />
              <div className="h-24 bg-slate-100 rounded-lg" />
              <div className="h-24 bg-slate-100 rounded-lg" />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'workflow' && (
              <P2PWorkflowTab
                step={workflowStep}
                draft={draft}
                activeScenario={activeScenario}
                committedPo={committedPo}
                committedGrn={committedGrn}
                committedInvoice={committedInvoice}
                evaluation={evaluation}
                exceptions={exceptions}
                onUpdateDraft={handleUpdateDraft}
                onLoadPreset={handleLoadPreset}
                onIssuePO={handleIssuePO}
                onLogGRN={handleLogGRN}
                onSubmitInvoice={handleSubmitInvoice}
                onOverrideException={handleOverrideException}
                onRejectException={handleRejectException}
                onResetWorkflow={handleResetWorkflow}
                onGoToLiquidity={() => setActiveTab('liquidity')}
                onGoToLedger={() => setActiveTab('ledger')}
              />
            )}

            {activeTab === 'liquidity' && (
              <LiquidityTab
                vpos={vpos}
                onExecuteDynamicDiscount={handleExecuteDynamicDiscount}
                onFractionalizeVpo={handleFractionalizeVpo}
                onFinanceMsmeTransfer={handleFinanceMsmeTransfer}
                onGoToWorkflow={() => setActiveTab('workflow')}
              />
            )}

            {activeTab === 'ledger' && <LedgerAuditTab blocks={blocks} />}

            {activeTab === 'dashboard' && (
              <DashboardContractTab
                totalProcessedInvoices={totalProcessedInvoices}
                autoApprovedCount={autoApprovedCount}
                overrideApprovedCount={overrideApprovedCount}
                fraudAttempts={fraudAttempts}
                vpos={vpos}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>ChainPay · Permissioned DLT Trade Finance & Automated Accounts Payable PoC</div>
          <div>Apex Industrials Consortium · Off-Chain ERP Privacy · Web Crypto SHA-256</div>
        </div>
      </footer>

      {/* Non-intrusive Action Confirmation Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-800 flex items-center gap-2.5 text-xs"
        >
          {toast.tone === 'rose' ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
          ) : toast.tone === 'amber' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          )}
          <span className="leading-snug">{toast.text}</span>
        </div>
      )}
    </div>
  );
}
