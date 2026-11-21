# ChainPay — Permissioned DLT Trade Finance & Automated Accounts Payable (PoC)

> **Course:** MBA 546F — Digital Technologies in Finance (DTF)  
> **Assessment:** CIA III — Proof of Concept using Blockchain / DLT  
> **Institution:** School of Business and Management, CHRIST (Deemed to be University), Bangalore

---

## 🚀 Launch Live Demo

**[👉 Click Here to Open the Live ChainPay Web App](https://chainpay.ai.studio/)**  
*(Runs directly in the browser — no installation or login required.)*

---

## 📌 Project Overview

**ChainPay** is an interactive Proof of Concept (PoC) built upon our CIA II use-case analysis (*FinTech Disruption in Corporate Working Capital*). It demonstrates how a **Permissioned Distributed Ledger (DLT)** and deterministic **Smart Contracts** resolve legacy Procure-to-Pay (P2P) frictions—eliminating 7–21 day manual verification delays, 15%–25% invoice exception rates, double-financing fraud, and liquidity bottlenecks for Tier-2/3 MSMEs.

---

## ✨ Core Features & Modules

1. **Guided P2P Workflow (3-Way Match & Smart Tolerances)**
   - Role-based pipeline connecting the **Corporate Buyer (Apex Industrials)**, **3PL / IoT Oracle**, **Tier-1 Supplier**, and **Smart Contract Engine**.
   - Automates three-way reconciliation (Purchase Order + Goods Receipt Note + Commercial Invoice) using a **2% smart tolerance band**.
   - Computes real **SHA-256 cryptographic hashes** (via the Web Crypto API) to detect and block duplicate invoice submissions (double-financing fraud).

2. **Liquidity & Deep-Tier MSME Finance (Social Impact — Unit 5)**
   - **Dynamic Discounting:** Allows Tier-1 suppliers to accept an early payment discount (e.g., 2% for Day-2 settlement) instead of waiting 45 days, generating immediate EBITDA savings for the buyer.
   - **Deep-Tier Tokenization:** Enables Tier-1 suppliers to fractionalize their **Validated Payment Obligation (VPO)** tokens and transfer them to **Tier-2 MSMEs**, unlocking anchor-backed prime financing rates (~7% APR) instead of predatory local lending rates (~18% APR).

3. **Permissioned Ledger & RegTech Audit Trail (Compliance — Unit 4)**
   - Live chronological **Block Explorer** linking every network action with immutable SHA-256 hashes for 100% continuous SupTech/RegTech auditability.
   - **DPDP / GDPR Privacy Architecture:** Keeps sensitive invoice PDFs and PII off-chain while storing only cryptographic hashes on-chain.

4. **Working Capital Dashboard & Solidity Smart Contract**
   - Live KPIs tracking auto-match rates, fraud attempts blocked, MSME liquidity unlocked, and AP processing cost reductions ($12 legacy vs. $2.50 DLT).
   - Interactive **Enterprise Scale ROI Simulator** modeled on *Apex Industrials*.
   - Built-in viewer for the companion Solidity smart contract (`ChainPaySettlement.sol`).

---

## 🛠️ Technology Stack & Smart Contract

- **Frontend:** React, Tailwind CSS, Lucide Icons
- **Cryptography:** Browser Web Crypto API (SHA-256)
- **Smart Contract Logic:** Solidity (`ChainPaySettlement.sol` included in the root of this repository)

---

## 🧪 Quick Viva Demo Scenarios

Use the one-click sample buttons inside the app to test all four core workflows:
1. **Happy Path:** Load a sample PO, log the 3PL GRN, and submit a matching invoice to trigger auto-approval and VPO minting.
2. **Smart Tolerance Exception:** Simulate a 5% variance to trigger an automated smart-contract hold and manual governance override.
3. **Fraud Prevention:** Simulate a duplicate invoice to trigger the SHA-256 double-financing blocker.
4. **MSME Liquidity & Discounting:** Go to Tab 2 to execute a 2% dynamic discount or fractionalize a VPO token to a Tier-2 MSME.

*(Use the **Reset Demo Data** button in the top navigation bar at any time to restore the initial state.)*

---

## 💻 Running Locally (For Technical Review)

To run this application locally on your machine, ensure you have **Node.js** installed, then run:

```bash
git clone https://github.com/YOUR-USERNAME/chainpay-dlt-poc.git
cd chainpay-dlt-poc
npm install
npm run dev
```

Open the local URL shown in your terminal (typically `http://localhost:5173`).

---

## 👥 Team Members

| Name | Registration No. |
| :--- | :--- |
| Member 1 | 2527XXX |
| Member 2 | 2527XXX |
| Member 3 | 2527XXX |
| Member 4 | 2527XXX |
| Member 5 | 2527XXX |

*Guided by Prof. Dr. P. A. Manojkumar*
