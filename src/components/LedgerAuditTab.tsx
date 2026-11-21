import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  Link2,
  Lock,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { LedgerActionType, LedgerBlock } from '../types/chainpay';
import {
  computeSha256,
  formatShortHash,
  formatTimestamp,
  GENESIS_PREV_HASH,
  serializeBlockForHash,
} from '../utils/crypto';
import { InfoTooltip } from './InfoTooltip';

interface LedgerAuditTabProps {
  blocks: LedgerBlock[];
}

type FilterGroup = 'all' | 'po_grn' | 'match_vpo' | 'fraud_exception' | 'liquidity';

export function LedgerAuditTab({ blocks }: LedgerAuditTabProps) {
  const [filter, setFilter] = useState<FilterGroup>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<{
    valid: boolean;
    checkedCount: number;
    checkedAt: string;
  } | null>(null);

  const filteredBlocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...blocks]
      .reverse()
      .filter((block) => {
        if (filter === 'po_grn' && !['PO_HASHED', 'GRN_LOGGED'].includes(block.action)) {
          return false;
        }
        if (
          filter === 'match_vpo' &&
          !['MATCH_EXECUTED', 'VPO_MINTED', 'GOVERNANCE_OVERRIDE'].includes(block.action)
        ) {
          return false;
        }
        if (
          filter === 'fraud_exception' &&
          !['FRAUD_BLOCKED', 'EXCEPTION_ROUTED'].includes(block.action)
        ) {
          return false;
        }
        if (
          filter === 'liquidity' &&
          !['DYNAMIC_DISCOUNT', 'TOKEN_FRACTIONALIZED', 'MSME_FINANCED'].includes(block.action)
        ) {
          return false;
        }
        if (!q) return true;
        return (
          block.referenceId.toLowerCase().includes(q) ||
          block.actionLabel.toLowerCase().includes(q) ||
          block.role.toLowerCase().includes(q) ||
          block.nodeName.toLowerCase().includes(q) ||
          block.summary.toLowerCase().includes(q) ||
          block.hash.toLowerCase().includes(q) ||
          String(block.blockNumber).includes(q)
        );
      });
  }, [blocks, filter, searchQuery]);

  const handleCopy = (blockNumber: number, hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedBlock(blockNumber);
    setTimeout(() => setCopiedBlock(null), 1600);
  };

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      let allValid = true;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const expectedPrev = i === 0 ? GENESIS_PREV_HASH : blocks[i - 1].hash;
        if (b.previousHash !== expectedPrev) {
          allValid = false;
          break;
        }
        const recomputed = await computeSha256(
          serializeBlockForHash({
            blockNumber: b.blockNumber,
            timestamp: b.timestamp,
            role: b.role,
            nodeName: b.nodeName,
            action: b.action,
            summary: b.summary,
            referenceId: b.referenceId,
            offChainRef: b.offChainRef,
            previousHash: b.previousHash,
          })
        );
        if (recomputed !== b.hash) {
          allValid = false;
          break;
        }
      }
      setIntegrityResult({
        valid: allValid,
        checkedCount: blocks.length,
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setVerifying(false);
    }
  };

  const getActionTone = (action: LedgerActionType) => {
    if (action === 'FRAUD_BLOCKED') {
      return {
        colorClass: 'text-rose-600',
        icon: <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />,
      };
    }
    if (action === 'EXCEPTION_ROUTED') {
      return {
        colorClass: 'text-amber-600',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />,
      };
    }
    if (
      action === 'VPO_MINTED' ||
      action === 'MATCH_EXECUTED' ||
      action === 'DYNAMIC_DISCOUNT' ||
      action === 'MSME_FINANCED' ||
      action === 'GOVERNANCE_OVERRIDE'
    ) {
      return {
        colorClass: 'text-emerald-700',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />,
      };
    }
    return {
      colorClass: 'text-slate-900',
      icon: <Link2 className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />,
    };
  };

  const filterButtons: { id: FilterGroup; label: string }[] = [
    { id: 'all', label: 'All Events' },
    { id: 'po_grn', label: 'PO & GRN' },
    { id: 'match_vpo', label: 'Match & VPO' },
    { id: 'fraud_exception', label: 'Fraud & Exceptions' },
    { id: 'liquidity', label: 'Liquidity & MSME' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Permissioned Ledger & RegTech Audit Trail
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Every trade finance state transition is cryptographically linked using SHA-256 block
            chaining across authorized consortium nodes for real-time regulatory auditability.
          </p>
        </div>

        <button
          type="button"
          disabled={verifying}
          onClick={handleVerifyIntegrity}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          <span>{verifying ? 'Re-Hashing Ledger…' : 'Verify Chain Integrity (SHA-256)'}</span>
        </button>
      </div>

      {/* Compact 3-Pill RegTech Compliance Summary Bar */}
      <div
        aria-label="RegTech Compliance Summary"
        className="flex flex-wrap items-center gap-2.5"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-800 whitespace-nowrap">
          <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>DPDP / GDPR: Off-Chain PII Only</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-800 whitespace-nowrap">
          <FileCheck2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>MLETR-Ready: Cryptographic Title Hash</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 whitespace-nowrap">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">Audit Coverage: 100% Continuous</span>
        </div>
      </div>

      {/* DPDP / GDPR Privacy Architecture Compliance Notice */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                DPDP & GDPR Privacy-by-Design Architecture
              </h2>
              <span className="text-xs font-medium text-emerald-700">
                · Zero PII On-Chain
              </span>
              <InfoTooltip
                title="Off-Chain Vault + On-Chain Hash"
                content="India's DPDP Act and EU GDPR restrict storing personally identifiable or commercially sensitive documents on immutable ledgers. ChainPay keeps invoice PDFs, tax IDs, and line-item pricing strictly off-chain while anchoring only non-reversible SHA-256 digests on-chain."
              />
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-3xl">
              Sensitive commercial invoice PDFs, supplier tax IDs, and banking PII remain encrypted
              inside private off-chain ERP vaults. Only immutable SHA-256 cryptographic hashes and
              settlement state proofs are written to the permissioned DLT ledger.
            </p>
          </div>
        </div>

        {integrityResult && (
          <div className="shrink-0 text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                integrityResult.valid ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>
                {integrityResult.valid
                  ? `All ${integrityResult.checkedCount} Blocks Cryptographically Valid`
                  : 'Hash Chain Mismatch Detected'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
              Verified {formatTimestamp(integrityResult.checkedAt)}
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilter(btn.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === btn.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO, hash, role, or block #…"
            aria-label="Search ledger blocks"
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Chronological Block Explorer */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
        {filteredBlocks.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No ledger blocks match your current filter or search query.
          </div>
        ) : (
          filteredBlocks.map((block) => {
            const tone = getActionTone(block.action);
            return (
              <div
                key={block.blockNumber}
                className="p-5 hover:bg-slate-50/70 transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      Block #{String(block.blockNumber).padStart(4, '0')}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${tone.colorClass}`}>
                      {tone.icon}
                      <span>{block.actionLabel}</span>
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="font-mono text-xs text-slate-600">{block.referenceId}</span>
                  </div>

                  <div className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                    {formatTimestamp(block.timestamp)}
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">{block.summary}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <div className="text-slate-400">Role / Permissioned Node</div>
                    <div className="text-slate-800 font-medium mt-0.5">
                      {block.role} · <span className="text-slate-500 font-normal">{block.nodeName}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Previous Block Hash</div>
                    <div className="font-mono text-slate-600 mt-0.5 tabular-nums">
                      {formatShortHash(block.previousHash, 12, 8)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Current SHA-256 Block Hash</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(block.blockNumber, block.hash)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        {copiedBlock === block.blockNumber ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" aria-hidden="true" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-slate-900 font-medium mt-0.5 tabular-nums">
                      {formatShortHash(block.hash, 12, 8)}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500">
                  Off-Chain Vault Reference: {block.offChainRef}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
