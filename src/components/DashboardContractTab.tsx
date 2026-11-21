import { Check, Code2, Copy, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { CHAINPAY_SOLIDITY_CONTRACT } from '../data/solidityContract';
import { FraudAttemptRecord, VPOToken } from '../types/chainpay';
import {
  ANCHOR_PRIME_RATE_PCT,
  DLT_COST_PER_INVOICE,
  formatCurrency,
  LEGACY_COST_PER_INVOICE,
  LOCAL_MSME_LENDING_RATE_PCT,
} from '../utils/crypto';
import { InfoTooltip } from './InfoTooltip';

interface DashboardContractTabProps {
  totalProcessedInvoices: number;
  autoApprovedCount: number;
  overrideApprovedCount: number;
  fraudAttempts: FraudAttemptRecord[];
  vpos: VPOToken[];
}

const SOLIDITY_KEYWORDS = new Set([
  'pragma',
  'solidity',
  'contract',
  'uint256',
  'uint16',
  'uint64',
  'address',
  'bool',
  'bytes32',
  'string',
  'mapping',
  'struct',
  'enum',
  'event',
  'modifier',
  'function',
  'constructor',
  'public',
  'external',
  'internal',
  'pure',
  'view',
  'constant',
  'immutable',
  'memory',
  'storage',
  'calldata',
  'indexed',
  'returns',
  'return',
  'require',
  'revert',
  'emit',
  'if',
  'true',
  'false',
]);

function highlightSolidityLine(line: string) {
  const commentIndex = line.indexOf('//');
  const codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : '';

  const tokens = codePart.split(/(".*?"|\b[A-Za-z_][A-Za-z0-9_]*\b)/g);

  return (
    <>
      {tokens.map((tok, idx) => {
        if (!tok) return null;
        if (tok.startsWith('"') && tok.endsWith('"')) {
          return (
            <span key={idx} className="text-emerald-300">
              {tok}
            </span>
          );
        }
        if (SOLIDITY_KEYWORDS.has(tok)) {
          return (
            <span key={idx} className="text-sky-300 font-medium">
              {tok}
            </span>
          );
        }
        if (/^[A-Z][A-Za-z0-9_]+$/.test(tok)) {
          return (
            <span key={idx} className="text-amber-300">
              {tok}
            </span>
          );
        }
        return <span key={idx}>{tok}</span>;
      })}
      {commentPart && <span className="text-slate-400 italic">{commentPart}</span>}
    </>
  );
}

export function DashboardContractTab({
  totalProcessedInvoices,
  autoApprovedCount,
  overrideApprovedCount,
  fraudAttempts,
  vpos,
}: DashboardContractTabProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  // Enterprise Scale Simulator (Apex Industrials Model) sliders
  const [annualSpendMillions, setAnnualSpendMillions] = useState<number>(1000); // $100M - $2B (default $1B)
  const [discountAdoptionPct, setDiscountAdoptionPct] = useState<number>(30); // 10% - 50% (default 30%)

  const simulatedSpendDollars = annualSpendMillions * 1_000_000;
  const simulatedAnnualInvoices = Math.round((annualSpendMillions / 1000) * 500_000);
  const simulatedAnnualEbitdaSavings = simulatedSpendDollars * (discountAdoptionPct / 100) * 0.02;
  const simulatedAnnualApSavings =
    simulatedAnnualInvoices * (LEGACY_COST_PER_INVOICE - DLT_COST_PER_INVOICE);
  const simulatedTotalAnnualImpact = simulatedAnnualEbitdaSavings + simulatedAnnualApSavings;

  const formatSpendLabel = (millions: number) =>
    millions >= 1000
      ? `$${(millions / 1000).toFixed(millions % 1000 === 0 ? 1 : 2)}B`
      : `$${millions}M`;

  const formatMillionsCompact = (dollars: number) => {
    if (dollars >= 1_000_000) {
      return `$${(dollars / 1_000_000).toFixed(2)}M`;
    }
    return formatCurrency(dollars);
  };

  const autoMatchRatePct =
    totalProcessedInvoices > 0 ? (autoApprovedCount / totalProcessedInvoices) * 100 : 0;

  const totalFraudExposureBlocked = fraudAttempts.reduce((sum, f) => sum + f.attemptedAmount, 0);

  const buyerEbitdaSavings = vpos.reduce(
    (sum, v) => sum + (v.discountSettlement?.buyerEbitdaSavings ?? 0),
    0
  );

  const msmeLiquidityUnlocked = vpos.reduce(
    (sum, v) => sum + v.fractionalizations.reduce((s, f) => s + f.amount, 0),
    0
  );

  const msmeInterestSaved = vpos.reduce(
    (sum, v) =>
      sum + v.fractionalizations.reduce((s, f) => s + (f.financed ? f.msmeInterestSaved : 0), 0),
    0
  );

  const unitSavingsPerInvoice = LEGACY_COST_PER_INVOICE - DLT_COST_PER_INVOICE;
  const totalProcessingCostSavings = totalProcessedInvoices * unitSavingsPerInvoice;
  const processingCostReductionPct = (unitSavingsPerInvoice / LEGACY_COST_PER_INVOICE) * 100;

  const contractLines = CHAINPAY_SOLIDITY_CONTRACT.trim().split('\n');

  const handleCopyContract = () => {
    navigator.clipboard.writeText(CHAINPAY_SOLIDITY_CONTRACT);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-5 border-b border-slate-200">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Working Capital Dashboard & Smart Contract
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
          Live executive KPIs calculated dynamically from on-chain settlements, paired with the
          companion Solidity contract governing 3-way matching, SHA-256 fraud checks, and VPO
          minting.
        </p>
      </div>

      {/* Top Section: 6 Executive KPIs in Unified Hairline Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {/* KPI 1 */}
          <div className="p-6">
            <div className="text-xs font-medium text-slate-500">Total Invoices Processed</div>
            <div className="font-mono text-3xl font-semibold text-slate-900 tabular-nums mt-2">
              {totalProcessedInvoices}
            </div>
            <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
              {autoApprovedCount} auto-matched · {overrideApprovedCount} governance override
            </div>
          </div>

          {/* KPI 2 */}
          <div className="p-6">
            <div className="text-xs font-medium text-slate-500 flex items-center">
              Auto-Match Rate (%)
              <InfoTooltip
                title="Straight-Through Processing (STP)"
                content="Percentage of incoming invoices automatically verified within the 2.00% Smart Tolerance Band with zero manual AP clerk intervention."
              />
            </div>
            <div className="font-mono text-3xl font-semibold text-emerald-700 tabular-nums mt-2">
              {autoMatchRatePct.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              Within ±2.00% Smart Tolerance Band
            </div>
          </div>

          {/* KPI 3 */}
          <div className="p-6 sm:border-t lg:border-t-0 border-slate-200">
            <div className="text-xs font-medium text-slate-500">Fraud Attempts Blocked</div>
            <div
              className={`font-mono text-3xl font-semibold tabular-nums mt-2 ${
                fraudAttempts.length > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {fraudAttempts.length}
            </div>
            <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
              {fraudAttempts.length > 0
                ? `${formatCurrency(totalFraudExposureBlocked)} duplicate exposure prevented`
                : 'SHA-256 Double-Financing Blocker active'}
            </div>
          </div>

          {/* KPI 4 */}
          <div className="p-6 border-t border-slate-200">
            <div className="text-xs font-medium text-slate-500">
              Buyer EBITDA Savings (Dynamic Discounting)
            </div>
            <div className="font-mono text-3xl font-semibold text-emerald-700 tabular-nums mt-2">
              {formatCurrency(buyerEbitdaSavings, true)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              {buyerEbitdaSavings > 0
                ? 'Direct treasury capture from Day-2 early pay'
                : 'Execute a Dynamic Discount in Tab 2 to capture'}
            </div>
          </div>

          {/* KPI 5 */}
          <div className="p-6 border-t border-slate-200">
            <div className="text-xs font-medium text-slate-500">MSME Liquidity Unlocked</div>
            <div className="font-mono text-3xl font-semibold text-slate-900 tabular-nums mt-2">
              {formatCurrency(msmeLiquidityUnlocked)}
            </div>
            <div className="text-xs text-emerald-700 mt-1.5 font-mono tabular-nums">
              {formatCurrency(msmeInterestSaved, true)} interest saved vs {LOCAL_MSME_LENDING_RATE_PCT}% local rate
            </div>
          </div>

          {/* KPI 6 */}
          <div className="p-6 border-t border-slate-200">
            <div className="text-xs font-medium text-slate-500 flex items-center">
              AP Processing Cost Savings
              <InfoTooltip
                align="right"
                title="Unit Cost Economics"
                content="Industry benchmarks estimate $12.00 per invoice for legacy manual 3-way matching and reconciliation versus $2.50 per invoice on automated permissioned DLT rails ($9.50 saved per invoice)."
              />
            </div>
            <div className="font-mono text-3xl font-semibold text-emerald-700 tabular-nums mt-2">
              {formatCurrency(totalProcessingCostSavings, true)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
              ${LEGACY_COST_PER_INVOICE.toFixed(2)} legacy vs ${DLT_COST_PER_INVOICE.toFixed(2)} DLT (−
              {processingCostReductionPct.toFixed(1)}%)
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Scale Simulator (Apex Industrials Model) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-600" aria-hidden="true" />
              <span>Enterprise Scale Simulator (Apex Industrials Model)</span>
              <InfoTooltip
                title="Enterprise ROI Methodology"
                content="Models full-enterprise deployment across Apex Industrials' supplier base: 2.0% Dynamic Discount capture on participating spend plus $9.50 AP savings per invoice ($12.00 legacy vs. $2.50 DLT, scaling at 500,000 invoices per $1B spend)."
              />
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Project annual working capital and AP operational impact across enterprise procurement volume.
            </p>
          </div>
          <div className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
            Est. Volume:{' '}
            <strong className="text-slate-900">
              {simulatedAnnualInvoices.toLocaleString('en-US')} invoices/yr
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Interactive Sliders */}
          <div className="lg:col-span-6 p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <label htmlFor="sim-annual-spend" className="font-medium text-slate-700">
                  Annual Procurement Spend
                </label>
                <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {formatSpendLabel(annualSpendMillions)}
                </span>
              </div>
              <input
                id="sim-annual-spend"
                type="range"
                min={100}
                max={2000}
                step={50}
                value={annualSpendMillions}
                onChange={(e) => setAnnualSpendMillions(Number(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                <span>$100M</span>
                <span>$1.0B (Apex Baseline)</span>
                <span>$2.0B</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <label htmlFor="sim-adoption-rate" className="font-medium text-slate-700">
                  Supplier Dynamic Discount Adoption Rate
                </label>
                <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {discountAdoptionPct}% ({formatSpendLabel(Math.round((annualSpendMillions * discountAdoptionPct) / 100))} enrolled)
                </span>
              </div>
              <input
                id="sim-adoption-rate"
                type="range"
                min={10}
                max={50}
                step={1}
                value={discountAdoptionPct}
                onChange={(e) => setDiscountAdoptionPct(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                <span>10%</span>
                <span>30% Target Adoption</span>
                <span>50%</span>
              </div>
            </div>
          </div>

          {/* Calculated Annual Outputs */}
          <div className="lg:col-span-6 p-6 bg-slate-50/70 flex flex-col justify-between gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Annual EBITDA Savings (2% Discount)
                </div>
                <div className="font-mono text-2xl sm:text-3xl font-semibold text-emerald-700 tabular-nums mt-1.5">
                  {formatMillionsCompact(simulatedAnnualEbitdaSavings)}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
                  {formatCurrency(simulatedAnnualEbitdaSavings)} / yr
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500">
                  Annual AP Operational Savings
                </div>
                <div className="font-mono text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums mt-1.5">
                  {formatMillionsCompact(simulatedAnnualApSavings)}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
                  {simulatedAnnualInvoices.toLocaleString('en-US')} × $9.50 saved/inv
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Combined Annual Enterprise Value Created
              </span>
              <div className="text-right">
                <span className="font-mono text-xl font-bold text-emerald-700 tabular-nums">
                  {formatMillionsCompact(simulatedTotalAnnualImpact)}/yr
                </span>
                <span className="ml-2 font-mono text-xs text-slate-500 tabular-nums">
                  ({formatCurrency(simulatedTotalAnnualImpact)})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unit Economics Comparison Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Legacy AP vs. ChainPay DLT Unit Economics
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Side-by-side operational benchmark demonstrating working capital and cost efficiency gains.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Metric Bar 1: Cost per Invoice */}
          <div className="space-y-2.5">
            <div className="text-xs font-medium text-slate-700">AP Processing Cost / Invoice</div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-500">Legacy Manual AP</span>
                <span className="text-slate-700">${LEGACY_COST_PER_INVOICE.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 rounded-full w-full" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-emerald-700 font-medium">ChainPay DLT</span>
                <span className="text-emerald-700 font-semibold">
                  ${DLT_COST_PER_INVOICE.toFixed(2)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full"
                  style={{ width: `${(DLT_COST_PER_INVOICE / LEGACY_COST_PER_INVOICE) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Metric Bar 2: Settlement Cycle */}
          <div className="space-y-2.5">
            <div className="text-xs font-medium text-slate-700">Supplier Cash Conversion Cycle</div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-500">Standard Net-45 Wait</span>
                <span className="text-slate-700">45 Days</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 rounded-full w-full" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-emerald-700 font-medium">Dynamic Discount Settlement</span>
                <span className="text-emerald-700 font-semibold">2 Days</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full w-[5%]" />
              </div>
            </div>
          </div>

          {/* Metric Bar 3: Tier-2 Borrowing Cost */}
          <div className="space-y-2.5">
            <div className="text-xs font-medium text-slate-700">Tier-2 MSME Cost of Capital</div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-500">Unsecured Local Lending</span>
                <span className="text-rose-600">{LOCAL_MSME_LENDING_RATE_PCT}% APR</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full w-full" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-emerald-700 font-medium">Fractional VPO Prime</span>
                <span className="text-emerald-700 font-semibold">{ANCHOR_PRIME_RATE_PCT}% APR</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full"
                  style={{
                    width: `${(ANCHOR_PRIME_RATE_PCT / LOCAL_MSME_LENDING_RATE_PCT) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Companion Solidity Smart Contract Viewer */}
      <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Code2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <span className="font-mono text-sm font-medium text-slate-100">
              ChainPaySettlement.sol
            </span>
            <span className="text-xs text-slate-400 font-mono">
              · Solidity ^0.8.20 · Read-Only Audit Reference
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyContract}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-300">Copied Code</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <div className="overflow-x-auto max-h-[540px] overflow-y-auto p-4 font-mono text-xs leading-6 text-slate-200">
          <pre className="m-0">
            <code>
              {contractLines.map((line, i) => (
                <div key={i} className="flex hover:bg-slate-900/70 px-2 rounded-xs">
                  <span
                    aria-hidden="true"
                    className="select-none w-10 pr-4 text-right text-slate-600 tabular-nums shrink-0"
                  >
                    {i + 1}
                  </span>
                  <span className="whitespace-pre">{highlightSolidityLine(line)}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
