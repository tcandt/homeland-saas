# Contract State Machine (FSM)

> **Module:** Contract
> **Version:** 1.0
> **Last Updated:** 2026-07-08

This document defines the strict lifecycle and state transitions for a Contract within the HomeLand SaaS platform.

## State Diagram

```text
       [CREATE]
          │
          ▼
        DRAFT
          │
          ├───────────┐ (Cancel)
          │           │
 [Submit for Review]  │
          │           │
          ▼           │
 PENDING_APPROVAL     │
          │           │
   [Approve]          │
          │           │
          ▼           │
       APPROVED       │
          │           │
  [Activate / Start]  │
          │           │
          ▼           │
        ACTIVE        │
          │           │
   [N days to end]    │
          │           │
          ▼           │
       EXPIRING       │
          │           │
     [End Date]       │
          │           │
          ▼           ▼
       EXPIRED    CANCELLED
          │
     [Move Out]
          │
          ▼
      TERMINATED
```

## State Transitions

### 1. `DRAFT`
* **Trigger:** Initial creation of a contract by a Sales or Manager role.
* **Conditions:**
  * Room must exist and be `AVAILABLE`.
  * Customer must exist.
* **Side Effects:**
  * Room status changes to `RESERVED`.
* **Allowed Roles:** Admin, Manager, Sales
* **Audit Event:** `CONTRACT_CREATE_DRAFT`

### 2. `PENDING_APPROVAL`
* **Trigger:** Sales user submits the draft for manager approval.
* **Conditions:**
  * All required fields (rent, deposit, start/end dates) must be valid.
  * Tenant signatures (if digital) might be attached.
* **Side Effects:**
  * Notification sent to Manager/Admin for approval.
* **Allowed Roles:** Admin, Manager, Sales
* **Audit Event:** `CONTRACT_SUBMIT_APPROVAL`

### 3. `APPROVED`
* **Trigger:** Manager or Admin approves the pending contract.
* **Conditions:**
  * Must be in `PENDING_APPROVAL` state.
* **Side Effects:**
  * Room status changes to `OCCUPIED`.
  * Deposit record (Invoice/Receipt) is generated.
  * First month's rent Invoice is scheduled/generated.
  * Notification sent to Tenant.
  * `ContractApproved` event published.
* **Allowed Roles:** Admin, Manager
* **Audit Event:** `CONTRACT_APPROVE`

### 4. `ACTIVE`
* **Trigger:** The `startDate` of the contract arrives, and deposit has been paid.
* **Conditions:**
  * Contract must be `APPROVED`.
  * Deposit must be `PAID`.
* **Side Effects:**
  * Customer status is updated (e.g., active resident).
* **Allowed Roles:** System (Cron/Event driven) or manual trigger by Admin.
* **Audit Event:** `CONTRACT_ACTIVATE`

### 5. `EXPIRING`
* **Trigger:** Contract `endDate` is approaching (e.g., within 30 days).
* **Conditions:**
  * Contract must be `ACTIVE`.
* **Side Effects:**
  * Renewal notification sent to Tenant and Manager.
* **Allowed Roles:** System (Cron).
* **Audit Event:** `CONTRACT_EXPIRING`

### 6. `EXPIRED`
* **Trigger:** The `endDate` passes without a renewal or extension.
* **Conditions:**
  * Contract must be `ACTIVE` or `EXPIRING`.
* **Side Effects:**
  * Move-out process initiated.
* **Allowed Roles:** System (Cron).
* **Audit Event:** `CONTRACT_EXPIRE`

### 7. `TERMINATED`
* **Trigger:** The contract is prematurely ended by mutual agreement or eviction, OR move-out is completed after expiration.
* **Conditions:**
  * Contract must be `ACTIVE`, `EXPIRING`, or `EXPIRED`.
* **Side Effects:**
  * Room status changes to `CLEANING` or `AVAILABLE`.
  * Final utility/deposit reconciliation triggered.
* **Allowed Roles:** Admin, Manager
* **Audit Event:** `CONTRACT_TERMINATE`

### 8. `CANCELLED`
* **Trigger:** The contract is voided before it ever becomes active.
* **Conditions:**
  * Contract must be in `DRAFT`, `PENDING_APPROVAL`, or `APPROVED` (but not yet started/moved in).
* **Side Effects:**
  * Room status reverts to `AVAILABLE`.
  * Any pending draft invoices/deposits are cancelled.
* **Allowed Roles:** Admin, Manager, Sales
* **Audit Event:** `CONTRACT_CANCEL`
