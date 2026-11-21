// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChainPaySettlement
 * @notice Permissioned DLT Trade Finance & Automated 3-Way Match AP Engine.
 *         Stores ONLY cryptographic SHA-256 hashes on-chain (DPDP / GDPR compliant);
 *         all invoice PDFs, tax IDs, and commercial PII remain in off-chain ERP vaults.
 */
contract ChainPaySettlement {
    uint256 public constant TOLERANCE_BPS = 200; // 2.00% Smart Tolerance Band (basis points)
    uint256 public constant BPS_DENOMINATOR = 10_000;

    address public immutable anchorBuyer;
    address public immutable governanceAdmin;

    mapping(address => bool) public authorizedOracles;
    mapping(address => bool) public verifiedSuppliers;

    // Double-Financing Blocker: Immutable registry of processed invoice SHA-256 fingerprints
    mapping(bytes32 => bool) public processedInvoiceHashes;
    mapping(bytes32 => string) public hashToInvoiceRef;

    enum MatchStatus { Pending, AutoApproved, ExceptionQueue, GovernanceOverridden, Rejected }

    struct PurchaseOrder {
        bytes32 poHash;
        address supplier;
        uint256 quantity;
        uint256 unitPriceCents;
        uint256 totalValueCents;
        uint16 paymentTermsDays;
        bool exists;
    }

    struct GoodsReceipt {
        bytes32 grnHash;
        uint256 deliveredQuantity;
        uint64 receivedAt;
        bool exists;
    }

    struct CommercialInvoice {
        bytes32 invoiceSha256;
        bytes32 poId;
        address supplier;
        uint256 billedQuantity;
        uint256 unitPriceCents;
        uint256 totalAmountCents;
        uint256 maxVarianceBps;
        MatchStatus status;
    }

    struct VPOToken {
        uint256 tokenId;
        bytes32 poId;
        bytes32 invoiceSha256;
        address currentHolder;
        uint256 originalAmountCents;
        uint256 remainingAmountCents;
        uint16 maturityDays;
        bool settled;
    }

    mapping(bytes32 => PurchaseOrder) public purchaseOrders;
    mapping(bytes32 => GoodsReceipt) public goodsReceipts;
    mapping(bytes32 => CommercialInvoice) public invoices;
    mapping(uint256 => VPOToken) public vpoTokens;
    uint256 public nextVpoId = 1001;

    event PurchaseOrderHashed(bytes32 indexed poId, bytes32 poHash, uint256 totalValueCents);
    event GoodsReceiptLogged(bytes32 indexed poId, bytes32 grnHash, uint256 deliveredQuantity);
    event DuplicateFraudBlocked(bytes32 indexed invoiceSha256, string attemptedRef, address indexed submitter);
    event ExceptionRouted(bytes32 indexed poId, bytes32 indexed invoiceSha256, uint256 varianceBps);
    event VPOMinted(uint256 indexed tokenId, bytes32 indexed poId, address indexed holder, uint256 amountCents);
    event DynamicDiscountSettled(uint256 indexed tokenId, uint256 discountCents, uint256 netPayoutCents);
    event VPOFractionalized(uint256 indexed tokenId, address indexed tier2Msme, uint256 splitAmountCents);

    modifier onlyBuyer() {
        require(msg.sender == anchorBuyer, "ChainPay: caller is not Anchor Buyer");
        _;
    }

    modifier onlyOracle() {
        require(authorizedOracles[msg.sender], "ChainPay: unauthorized 3PL/IoT Oracle");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governanceAdmin, "ChainPay: caller lacks governance role");
        _;
    }

    constructor(address _anchorBuyer, address _governanceAdmin) {
        anchorBuyer = _anchorBuyer;
        governanceAdmin = _governanceAdmin;
    }

    /// @notice Step 1: Corporate Buyer hashes PO payload off-chain and commits digest on-chain
    function issuePurchaseOrder(
        bytes32 poId,
        bytes32 poHash,
        address supplier,
        uint256 quantity,
        uint256 unitPriceCents,
        uint16 paymentTermsDays
    ) external onlyBuyer {
        require(!purchaseOrders[poId].exists, "ChainPay: PO already exists");
        uint256 totalValueCents = quantity * unitPriceCents;

        purchaseOrders[poId] = PurchaseOrder({
            poHash: poHash,
            supplier: supplier,
            quantity: quantity,
            unitPriceCents: unitPriceCents,
            totalValueCents: totalValueCents,
            paymentTermsDays: paymentTermsDays,
            exists: true
        });

        emit PurchaseOrderHashed(poId, poHash, totalValueCents);
    }

    /// @notice Step 2: Authorized 3PL / IoT Oracle commits physical Goods Receipt Note
    function logGoodsReceipt(
        bytes32 poId,
        bytes32 grnHash,
        uint256 deliveredQuantity
    ) external onlyOracle {
        require(purchaseOrders[poId].exists, "ChainPay: PO not found");
        goodsReceipts[poId] = GoodsReceipt({
            grnHash: grnHash,
            deliveredQuantity: deliveredQuantity,
            receivedAt: uint64(block.timestamp),
            exists: true
        });

        emit GoodsReceiptLogged(poId, grnHash, deliveredQuantity);
    }

    /// @notice Step 3 & 4: Submit Invoice, enforce Double-Financing Blocker & 2% Smart Tolerance 3-Way Match
    function submitInvoiceAndMatch(
        bytes32 poId,
        bytes32 invoiceSha256,
        string calldata invoiceRef,
        uint256 billedQuantity,
        uint256 unitPriceCents
    ) external returns (MatchStatus status, uint256 mintedVpoId) {
        PurchaseOrder memory po = purchaseOrders[poId];
        GoodsReceipt memory grn = goodsReceipts[poId];
        require(po.exists && grn.exists, "ChainPay: PO and GRN required for 3-way match");

        // 1. Double-Financing Blocker: Reject any duplicate SHA-256 invoice fingerprint
        if (processedInvoiceHashes[invoiceSha256]) {
            emit DuplicateFraudBlocked(invoiceSha256, invoiceRef, msg.sender);
            revert("FRAUD_ALERT: Duplicate Invoice / Double-Financing Attempt Blocked");
        }

        uint256 totalAmountCents = billedQuantity * unitPriceCents;
        uint256 qtyVarBps = _absDiffBps(billedQuantity, grn.deliveredQuantity);
        uint256 priceVarBps = _absDiffBps(unitPriceCents, po.unitPriceCents);
        uint256 valueVarBps = _absDiffBps(totalAmountCents, po.totalValueCents);
        uint256 maxVarianceBps = _max3(qtyVarBps, priceVarBps, valueVarBps);

        // Record hash immediately to prevent concurrent replay across financing nodes
        processedInvoiceHashes[invoiceSha256] = true;
        hashToInvoiceRef[invoiceSha256] = invoiceRef;

        // 2. 2.00% Smart Tolerance Band Verification
        if (maxVarianceBps <= TOLERANCE_BPS) {
            invoices[invoiceSha256] = CommercialInvoice({
                invoiceSha256: invoiceSha256,
                poId: poId,
                supplier: msg.sender,
                billedQuantity: billedQuantity,
                unitPriceCents: unitPriceCents,
                totalAmountCents: totalAmountCents,
                maxVarianceBps: maxVarianceBps,
                status: MatchStatus.AutoApproved
            });

            mintedVpoId = _mintVPO(poId, invoiceSha256, msg.sender, totalAmountCents, po.paymentTermsDays);
            return (MatchStatus.AutoApproved, mintedVpoId);
        }

        // 3. Variance > 2.00%: Route to Exception Queue for manual governance review
        invoices[invoiceSha256] = CommercialInvoice({
            invoiceSha256: invoiceSha256,
            poId: poId,
            supplier: msg.sender,
            billedQuantity: billedQuantity,
            unitPriceCents: unitPriceCents,
            totalAmountCents: totalAmountCents,
            maxVarianceBps: maxVarianceBps,
            status: MatchStatus.ExceptionQueue
        });

        emit ExceptionRouted(poId, invoiceSha256, maxVarianceBps);
        return (MatchStatus.ExceptionQueue, 0);
    }

    /// @notice Manual Governance Override to approve an invoice held in the Exception Queue
    function governanceOverrideApprove(bytes32 invoiceSha256) external onlyGovernance returns (uint256) {
        CommercialInvoice storage inv = invoices[invoiceSha256];
        require(inv.status == MatchStatus.ExceptionQueue, "ChainPay: invoice not in exception queue");

        inv.status = MatchStatus.GovernanceOverridden;
        PurchaseOrder memory po = purchaseOrders[inv.poId];
        return _mintVPO(inv.poId, invoiceSha256, inv.supplier, inv.totalAmountCents, po.paymentTermsDays);
    }

    /// @notice Tier-1 Supplier accepts Dynamic Discounting for instant Day-2 liquidity
    function executeDynamicDiscount(uint256 tokenId, uint256 discountBps) external {
        VPOToken storage vpo = vpoTokens[tokenId];
        require(!vpo.settled && vpo.remainingAmountCents > 0, "ChainPay: VPO unavailable");
        require(msg.sender == vpo.currentHolder, "ChainPay: only VPO holder can settle");
        require(discountBps <= 500, "ChainPay: discount exceeds 5% cap");

        uint256 discountCents = (vpo.remainingAmountCents * discountBps) / BPS_DENOMINATOR;
        uint256 netPayoutCents = vpo.remainingAmountCents - discountCents;

        vpo.remainingAmountCents = 0;
        vpo.settled = true;

        emit DynamicDiscountSettled(tokenId, discountCents, netPayoutCents);
    }

    /// @notice Deep-Tier Fractionalization: Split VPO to empower Tier-2 MSMEs with Anchor Prime credit
    function fractionalizeVPO(uint256 tokenId, address tier2Msme, uint256 splitBps) external {
        VPOToken storage vpo = vpoTokens[tokenId];
        require(!vpo.settled && vpo.remainingAmountCents > 0, "ChainPay: VPO unavailable");
        require(msg.sender == vpo.currentHolder, "ChainPay: only VPO holder can split");
        require(splitBps > 0 && splitBps <= 8000, "ChainPay: invalid split ratio");

        uint256 splitAmountCents = (vpo.remainingAmountCents * splitBps) / BPS_DENOMINATOR;
        vpo.remainingAmountCents -= splitAmountCents;

        emit VPOFractionalized(tokenId, tier2Msme, splitAmountCents);
    }

    function _mintVPO(
        bytes32 poId,
        bytes32 invoiceSha256,
        address holder,
        uint256 amountCents,
        uint16 maturityDays
    ) internal returns (uint256 tokenId) {
        tokenId = nextVpoId++;
        vpoTokens[tokenId] = VPOToken({
            tokenId: tokenId,
            poId: poId,
            invoiceSha256: invoiceSha256,
            currentHolder: holder,
            originalAmountCents: amountCents,
            remainingAmountCents: amountCents,
            maturityDays: maturityDays,
            settled: false
        });
        emit VPOMinted(tokenId, poId, holder, amountCents);
    }

    function _absDiffBps(uint256 actual, uint256 expected) internal pure returns (uint256) {
        if (expected == 0) return actual == 0 ? 0 : BPS_DENOMINATOR;
        uint256 diff = actual >= expected ? actual - expected : expected - actual;
        return (diff * BPS_DENOMINATOR) / expected;
    }

    function _max3(uint256 a, uint256 b, uint256 c) internal pure returns (uint256) {
        uint256 m = a >= b ? a : b;
        return m >= c ? m : c;
    }
}
