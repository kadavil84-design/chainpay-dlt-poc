import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  GitFork,
  Landmark,
  SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { TIER2_MSME_DIRECTORY } from '../data/seedData';
import { VPOToken } from '../types/chainpay';
import {
  ANCHOR_PRIME_RATE_PCT,
  calculateMsmeFinancingEconomics,
  formatCurrency,
  formatShortHash,
  formatTimestamp,
  LOCAL_MSME_LENDING_RATE_PCT,
} from '../utils/crypto';
import { InfoTooltip } from './InfoTooltip';

interface LiquidityTabProps {
  vpos: VPOToken[];
  onExecuteDynamicDiscount: (
    tokenId: string,
    discountPct: number,
    settlementDay: number
  ) => Promise<void>;
  onFractionalizeVpo: (
    tokenId: string,
    recipientName: string,
    splitPct: number
  ) => Promise<void>;
  onFinanceMsmeTransfer: (tokenId: string, transferId: string) => Promise<void>;
  onGoToWorkflow: () => void;
}

type ActionDrawerMode = 'discount' | 'fractionalize' | null;

export function LiquidityTab({
  vpos,
  onExecuteDynamicDiscount,
  onFractionalizeVpo,
  onFinanceMsmeTransfer,
  onGoToWorkflow,
}: LiquidityTabProps) {
  const [openDrawer, setOpenDrawer] = useState<Record<string, ActionDrawerMode>>({});
  const [discountRateByVpo, setDiscountRateByVpo] = useState<Record<string, number>>({});
  const [settlementDayByVpo, setSettlementDayByVpo] = useState<Record<string, number>>({});
  const [splitPctByVpo, setSplitPctByVpo] = useState<Record<string, number>>({});
  const [msmeRecipientByVpo, setMsmeRecipientByVpo] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const totalActiveVpoValue = vpos.reduce((acc, v) => acc + v.remainingAmount, 0);
  const totalEbitdaSaved = vpos.reduce(
    (acc, v) => acc + (v.discountSettlement?.buyerEbitdaSavings ?? 0),
    0
  );
  const totalMsmeUnlocked = vpos.reduce(
    (acc, v) => acc + v.fractionalizations.reduce((s, f) => s + f.amount, 0),
    0
  );
  const totalMsmeInterestSaved = vpos.reduce(
    (acc, v) =>
      acc + v.fractionalizations.reduce((s, f) => s + (f.financed ? f.msmeInterestSaved : 0), 0),
    0
  );

  const toggleDrawer = (tokenId: string, mode: ActionDrawerMode) => {
    setOpenDrawer((prev) => ({
      ...prev,
      [tokenId]: prev[tokenId] === mode ? null : mode,
    }));
  };

  const handleRunDiscount = async (vpo: VPOToken) => {
    const discountPct = discountRateByVpo[vpo.tokenId] ?? 2.0;
    const settlementDay = settlementDayByVpo[vpo.tokenId] ?? 2;
    setBusyId(vpo.tokenId);
    try {
      await onExecuteDynamicDiscount(vpo.tokenId, discountPct, settlementDay);
      setOpenDrawer((prev) => ({ ...prev, [vpo.tokenId]: null }));
    } finally {
      setBusyId(null);
    }
  };

  const handleRunFractionalize = async (vpo: VPOToken) => {
    const splitPct = splitPctByVpo[vpo.tokenId] ?? 30;
    const recipient = msmeRecipientByVpo[vpo.tokenId] ?? TIER2_MSME_DIRECTORY[0];
    setBusyId(vpo.tokenId);
    try {
      await onFractionalizeVpo(vpo.tokenId, recipient, splitPct);
      setOpenDrawer((prev) => ({ ...prev, [vpo.tokenId]: null }));
    } finally {
      setBusyId(null);
    }
  };

  const handleRunMsmeFinance = async (tokenId: string, transferId: string) => {
    setBusyId(transferId);
    try {
      await onFinanceMsmeTransfer(tokenId, transferId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Liquidity & Deep-Tier MSME Finance
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Validated Payment Obligations (VPOs) carry Apex Industrials&apos; investment-grade credit
            backing. Tier-1 suppliers can unlock instant Day-2 cash via Dynamic Discounting or split
            tokens down to Tier-2 MSMEs at prime rates.
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
          Anchor Prime: <span className="text-emerald-700 font-semibold">{ANCHOR_PRIME_RATE_PCT}% APR</span>
          <span className="mx-2 text-slate-300">/</span>
          Local MSME Avg: <span className="text-rose-600 font-semibold">{LOCAL_MSME_LENDING_RATE_PCT}% APR</span>
        </div>
      </div>

      {/* Unified Liquidity Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Available Tier-1 VPO Liquidity</div>
          <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1.5">
            {formatCurrency(totalActiveVpoValue)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Across {vpos.filter((v) => v.remainingAmount > 0).length} active obligations
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 flex items-center">
            Buyer EBITDA Savings
            <InfoTooltip
              title="Dynamic Discounting Yield"
              content="When Apex Industrials pays approved VPOs early (e.g., Day 2 instead of Day 45) for a 2% discount, that discount drops directly to Corporate Buyer EBITDA as a risk-free treasury return."
            />
          </div>
          <div className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums mt-1.5">
            {formatCurrency(totalEbitdaSaved, true)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Captured from early settlement</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 flex items-center">
            Tier-2 MSME Liquidity Unlocked
            <InfoTooltip
              title="Deep-Tier Fractionalization"
              content="Tier-1 suppliers split portions of a VPO and pass them to smaller Tier-2 sub-suppliers. Because the obligation is backed by Apex Industrials, the MSME can finance it at ~7% APR instead of ~18% APR local lending."
            />
          </div>
          <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1.5">
            {formatCurrency(totalMsmeUnlocked)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Transferred to Tier-2 suppliers</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">MSME Financing Cost Saved</div>
          <div className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums mt-1.5">
            {formatCurrency(totalMsmeInterestSaved, true)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            −{(LOCAL_MSME_LENDING_RATE_PCT - ANCHOR_PRIME_RATE_PCT).toFixed(1)}% APR spread saved
          </div>
        </div>
      </div>

      {/* VPO Token Portfolio */}
      {vpos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900">No Validated Payment Obligations minted yet</p>
          <p className="text-xs text-slate-500">
            Complete a 3-way match in the P2P Workflow tab to mint a VPO token.
          </p>
          <button
            type="button"
            onClick={onGoToWorkflow}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Go to P2P Workflow
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {vpos.map((vpo) => {
            const drawer = openDrawer[vpo.tokenId] ?? null;
            const discountPct = discountRateByVpo[vpo.tokenId] ?? 2.0;
            const settlementDay = settlementDayByVpo[vpo.tokenId] ?? 2;
            const splitPct = splitPctByVpo[vpo.tokenId] ?? 30;
            const msmeRecipient = msmeRecipientByVpo[vpo.tokenId] ?? TIER2_MSME_DIRECTORY[0];

            // Dynamic Discount live preview calculations
            const daysAccelerated = Math.max(1, vpo.maturityDays - settlementDay);
            const previewBuyerSavings = Number((vpo.remainingAmount * (discountPct / 100)).toFixed(2));
            const previewSupplierCash = Number((vpo.remainingAmount - previewBuyerSavings).toFixed(2));
            const previewAnnualizedYield = Number(
              ((discountPct / (100 - discountPct)) * (365 / daysAccelerated) * 100).toFixed(1)
            );

            // Fractionalization live preview calculations
            const previewSplitAmount = Number(((vpo.remainingAmount * splitPct) / 100).toFixed(2));
            const previewMsmeEcon = calculateMsmeFinancingEconomics(
              previewSplitAmount,
              vpo.maturityDays
            );

            const canAct = vpo.remainingAmount > 0 && vpo.status !== 'discounted' && vpo.status !== 'fully_settled';

            return (
              <div
                key={vpo.tokenId}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                {/* VPO Primary Row */}
                <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900">{vpo.tokenId}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{vpo.poNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{vpo.invoiceNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span>Net {vpo.maturityDays} Days</span>
                      <span aria-hidden="true">·</span>
                      {vpo.status === 'discounted' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Settled via Dynamic Discount
                        </span>
                      ) : vpo.status === 'partially_fractionalized' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <GitFork className="w-3.5 h-3.5" aria-hidden="true" />
                          Partially Fractionalized · Active Balance
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Active VPO Token
                        </span>
                      )}
                    </div>

                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      {vpo.currentHolder}{' '}
                      <span className="font-normal text-slate-500 text-sm">
                        — {vpo.itemDescription}
                      </span>
                    </h2>

                    <div className="text-xs text-slate-500 font-mono">
                      Obligor: {vpo.issuer} · Anchor Hash: {formatShortHash(vpo.invoiceHash, 12, 8)} ·
                      Minted {formatTimestamp(vpo.issuedAt)}
                    </div>
                  </div>

                  {/* Balances & Primary Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-5 shrink-0">
                    <div className="sm:text-right">
                      <div className="text-xs text-slate-500">
                        {vpo.remainingAmount < vpo.originalAmount
                          ? `Remaining Balance (of ${formatCurrency(vpo.originalAmount)})`
                          : 'Validated Face Value'}
                      </div>
                      <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(vpo.remainingAmount, true)}
                      </div>
                    </div>

                    {canAct && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleDrawer(vpo.tokenId, 'discount')}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                            drawer === 'discount'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <Banknote className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Dynamic Discounting</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleDrawer(vpo.tokenId, 'fractionalize')}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                            drawer === 'fractionalize'
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          <GitFork className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Fractionalize to MSME</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Action Drawer: Dynamic Discounting */}
                {drawer === 'discount' && canAct && (
                  <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <SlidersHorizontal className="w-4 h-4 text-slate-600" aria-hidden="true" />
                          Dynamic Discounting — Instant Early Settlement
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Accept an early payment discount to receive cash immediately instead of
                          waiting {vpo.maturityDays} days.
                        </p>
                      </div>
                      <span className="font-mono text-xs text-emerald-700 font-semibold tabular-nums">
                        Buyer Annualized Return: {previewAnnualizedYield}% APR
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <label htmlFor={`disc-${vpo.tokenId}`} className="font-medium text-slate-700">
                              Early Payment Discount Rate
                            </label>
                            <span className="font-mono font-semibold text-slate-900 tabular-nums">
                              {discountPct.toFixed(1)}%
                            </span>
                          </div>
                          <input
                            id={`disc-${vpo.tokenId}`}
                            type="range"
                            min={0.5}
                            max={3.5}
                            step={0.1}
                            value={discountPct}
                            onChange={(e) =>
                              setDiscountRateByVpo((prev) => ({
                                ...prev,
                                [vpo.tokenId]: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-slate-900 cursor-pointer"
                          />
                          <div className="flex justify-between text-[11px] font-mono text-slate-400">
                            <span>0.5%</span>
                            <span>2.0% Standard</span>
                            <span>3.5%</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <label htmlFor={`day-${vpo.tokenId}`} className="font-medium text-slate-700">
                              Target Settlement Day (vs. Net {vpo.maturityDays})
                            </label>
                            <span className="font-mono font-semibold text-slate-900 tabular-nums">
                              Day {settlementDay} ({daysAccelerated} days faster)
                            </span>
                          </div>
                          <input
                            id={`day-${vpo.tokenId}`}
                            type="range"
                            min={1}
                            max={30}
                            step={1}
                            value={settlementDay}
                            onChange={(e) =>
                              setSettlementDayByVpo((prev) => ({
                                ...prev,
                                [vpo.tokenId]: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-slate-900 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-slate-500">Supplier Instant Cash</div>
                            <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums mt-0.5">
                              {formatCurrency(previewSupplierCash, true)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Settled on Day {settlementDay}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Buyer EBITDA Savings</div>
                            <div className="font-mono text-xl font-semibold text-emerald-700 tabular-nums mt-0.5">
                              +{formatCurrency(previewBuyerSavings, true)}
                            </div>
                            <div className="text-[11px] text-emerald-700 mt-0.5">
                              {discountPct.toFixed(1)}% direct capture
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={busyId === vpo.tokenId}
                          onClick={() => handleRunDiscount(vpo)}
                          className="w-full py-2.5 px-4 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                        >
                          {busyId === vpo.tokenId
                            ? 'Settling On-Chain…'
                            : `Accept ${discountPct.toFixed(1)}% Discount & Settle Instantly`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inline Action Drawer: Deep-Tier MSME Fractionalization */}
                {drawer === 'fractionalize' && canAct && (
                  <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <GitFork className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                          Deep-Tier Fractionalization — Empower Tier-2 MSME Supplier
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Split a portion of this Apex-backed VPO and transfer it downstream so your
                          Tier-2 MSME accesses investment-grade working capital.
                        </p>
                      </div>
                      <span className="font-mono text-xs text-emerald-700 font-semibold tabular-nums">
                        Split Value: {formatCurrency(previewSplitAmount, true)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label htmlFor={`msme-${vpo.tokenId}`} className="block text-xs font-medium text-slate-700 mb-1.5">
                            Tier-2 MSME Beneficiary
                          </label>
                          <select
                            id={`msme-${vpo.tokenId}`}
                            value={msmeRecipient}
                            onChange={(e) =>
                              setMsmeRecipientByVpo((prev) => ({
                                ...prev,
                                [vpo.tokenId]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                          >
                            {TIER2_MSME_DIRECTORY.map((name) => (
                              <option key={name} value={name}>
                                {name} (Tier-2 Sub-Supplier)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <label htmlFor={`split-${vpo.tokenId}`} className="font-medium text-slate-700">
                              Fractional Allocation (% of Remaining VPO)
                            </label>
                            <span className="font-mono font-semibold text-slate-900 tabular-nums">
                              {splitPct}% ({formatCurrency(previewSplitAmount, true)})
                            </span>
                          </div>
                          <input
                            id={`split-${vpo.tokenId}`}
                            type="range"
                            min={10}
                            max={75}
                            step={5}
                            value={splitPct}
                            onChange={(e) =>
                              setSplitPctByVpo((prev) => ({
                                ...prev,
                                [vpo.tokenId]: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-emerald-600 cursor-pointer"
                          />
                          <div className="flex justify-between text-[11px] font-mono text-slate-400">
                            <span>10%</span>
                            <span>30% Typical Tier-2 Share</span>
                            <span>75%</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-4">
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">
                              Local Predatory Rate ({LOCAL_MSME_LENDING_RATE_PCT}% APR · {vpo.maturityDays}d)
                            </span>
                            <span className="font-mono text-rose-600 line-through tabular-nums">
                              {formatCurrency(previewMsmeEcon.financingCostAtLocal, true)} cost
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 font-medium">
                              Apex Anchor Prime Rate ({ANCHOR_PRIME_RATE_PCT}% APR · {vpo.maturityDays}d)
                            </span>
                            <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                              {formatCurrency(previewMsmeEcon.financingCostAtPrime, true)} cost
                            </span>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="font-medium text-slate-900">
                              Direct MSME Interest Saved
                            </span>
                            <span className="font-mono text-base font-semibold text-emerald-700 tabular-nums">
                              +{formatCurrency(previewMsmeEcon.msmeInterestSaved, true)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={busyId === vpo.tokenId}
                          onClick={() => handleRunFractionalize(vpo)}
                          className="w-full py-2.5 px-4 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                        >
                          {busyId === vpo.tokenId
                            ? 'Transferring Fractional Token…'
                            : `Transfer ${splitPct}% (${formatCurrency(previewSplitAmount)}) to Tier-2 MSME`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Executed Dynamic Discount Summary */}
                {vpo.discountSettlement && (
                  <div className="px-6 py-4 bg-emerald-50/60 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-2 text-emerald-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span>
                        Dynamic Discount Executed on Day {vpo.discountSettlement.settlementDay} (
                        {vpo.discountSettlement.discountPct.toFixed(1)}% discount)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
                      <span className="text-slate-700">
                        Supplier Received:{' '}
                        <strong className="text-slate-900">
                          {formatCurrency(vpo.discountSettlement.supplierCashReceived, true)}
                        </strong>
                      </span>
                      <span className="text-emerald-800">
                        Buyer EBITDA Saved:{' '}
                        <strong>
                          +{formatCurrency(vpo.discountSettlement.buyerEbitdaSavings, true)}
                        </strong>{' '}
                        ({vpo.discountSettlement.annualizedBuyerYieldPct}% APR)
                      </span>
                    </div>
                  </div>
                )}

                {/* Deep-Tier MSME Fractionalized Sub-Tokens */}
                {vpo.fractionalizations.length > 0 && (
                  <div className="border-t border-slate-200 divide-y divide-slate-200">
                    {vpo.fractionalizations.map((frac) => (
                      <div
                        key={frac.id}
                        className="px-6 py-5 bg-slate-50/70 space-y-4"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                              <span className="font-mono font-semibold text-slate-900">{frac.id}</span>
                              <span aria-hidden="true">·</span>
                              <span>{frac.recipientTier}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{frac.percentage}% split</span>
                              <span aria-hidden="true">·</span>
                              {frac.financed ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                  <Landmark className="w-3.5 h-3.5" aria-hidden="true" />
                                  Financed at Anchor Prime (~{frac.anchorPrimeRatePct.toFixed(0)}% APR)
                                </span>
                              ) : (
                                <span className="font-semibold text-amber-700">
                                  Held by MSME · Ready for Anchor-Backed Financing
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {frac.recipientName} —{' '}
                              <span className="font-mono tabular-nums">
                                {formatCurrency(frac.amount, true)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono tabular-nums">
                              Net MSME Cash Disbursed: {formatCurrency(frac.netCashToMsme, true)} ·
                              Term: {frac.maturityDays} Days
                            </div>
                          </div>

                          {!frac.financed && (
                            <button
                              type="button"
                              disabled={busyId === frac.id}
                              onClick={() => handleRunMsmeFinance(vpo.tokenId, frac.id)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <span>
                                {busyId === frac.id
                                  ? 'Redeeming…'
                                  : `Redeem at ~${frac.anchorPrimeRatePct.toFixed(0)}% Anchor Rate`}
                              </span>
                              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {/* Side-by-Side MSME Social Impact Comparison */}
                        <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                          <div className="p-3.5">
                            <div className="text-[11px] font-medium text-slate-500">
                              Traditional MSME Local Lending Rate (~18% APR)
                            </div>
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                              <span className="font-mono text-sm font-semibold text-rose-600 tabular-nums">
                                {formatCurrency(frac.financingCostAtLocal, true)} interest
                              </span>
                              <span className="font-mono text-[11px] text-rose-600 tabular-nums">
                                {frac.localLenderRatePct.toFixed(1)}% APR
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5">
                            <div className="text-[11px] font-medium text-slate-500">
                              ChainPay Anchor-Backed Rate (~7% APR)
                            </div>
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                              <span className="font-mono text-sm font-semibold text-emerald-700 tabular-nums">
                                {formatCurrency(frac.financingCostAtPrime, true)} interest
                              </span>
                              <span className="font-mono text-[11px] text-emerald-700 tabular-nums">
                                {frac.anchorPrimeRatePct.toFixed(1)}% APR
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-emerald-50/70">
                            <div className="text-[11px] font-semibold text-emerald-900">
                              Exact Dollar Interest Saved for MSME
                            </div>
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                              <span className="font-mono text-base font-bold text-emerald-700 tabular-nums">
                                +{formatCurrency(frac.msmeInterestSaved, true)}
                              </span>
                              <span className="font-mono text-[11px] font-semibold text-emerald-800 tabular-nums">
                                −{(frac.localLenderRatePct - frac.anchorPrimeRatePct).toFixed(0)}% APR spread
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
