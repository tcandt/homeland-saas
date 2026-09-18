-- BASELINE-V2: static canonical schema after historical migrations 1..18.

-- Generated only by scripts/generate-baseline-v2.js; bootstrap never derives SQL dynamically.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'MANAGER', 'SALES', 'FINANCE');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'CLEANING', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RoomRentalType" AS ENUM ('WHOLE', 'SHARED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalCycleStatus" AS ENUM ('PLANNED', 'RESERVED', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED', 'OVERPAID');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('SEPAY', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentSourceType" AS ENUM ('INVOICE', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('BOOKING', 'SECURITY', 'RESERVATION');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'CONVERTED_TO_CONTRACT', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RoomHoldKind" AS ENUM ('WHOLE', 'SHARED_SLOT');

-- CreateEnum
CREATE TYPE "RoomHoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DepositLedgerEntryType" AS ENUM ('CASH_IN', 'TRANSFER_OUT', 'TRANSFER_IN', 'REFUND', 'KEEP', 'DEDUCT', 'CREDIT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "DepositOperationType" AS ENUM ('COLLECT', 'CONVERT_TO_SECURITY', 'REFUND', 'CANCEL', 'COMPLETE_REFUND', 'RENEW_HOLD', 'TRANSFER_HOLD', 'RELEASE_HOLD', 'REVERSE_LEDGER');

-- CreateEnum
CREATE TYPE "DepositOperationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('CREATED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RETRYING', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING_VERIFICATION', 'DISABLED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('REGISTER', 'LOGIN', 'LOGOUT', 'REFRESH_TOKEN', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_SUCCESS', 'PASSWORD_CHANGE', 'EMAIL_VERIFIED', 'LOGIN_FAILED', 'LOGIN_SUCCESS', 'LOGOUT_SUCCESS', 'CHANGE_PASSWORD', 'CREATE', 'UPDATE', 'DELETE', 'SIGNED', 'COLLECT', 'REFUND', 'CANCEL', 'CONVERT_CONTRACT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('PAYMENT', 'DEPOSIT', 'REFUND', 'EXPENSE', 'INVOICE', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SUPPLIES', 'REPAIR', 'MAINTENANCE', 'UTILITY', 'CLEANING', 'REFUND', 'STAFF', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseSettlementStatus" AS ENUM ('NONE', 'PENDING_REIMBURSEMENT', 'REIMBURSED', 'DEDUCTED_FROM_PROFIT');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'CONSOLE', 'EMAIL', 'TELEGRAM', 'ZALO', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "SettingScope" AS ENUM ('TENANT', 'USER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'INVOICE', 'RECEIPT', 'PAYMENT', 'DEPOSIT', 'INSPECTION', 'HANDOVER', 'MAINTENANCE', 'REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'GENERATED', 'PENDING_APPROVAL', 'APPROVED', 'PENDING_SIGNATURE', 'PARTIALLY_SIGNED', 'SIGNED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignatureProviderType" AS ENUM ('INTERNAL', 'EXTERNAL_VNPT', 'EXTERNAL_DOCUSIGN');

-- CreateEnum
CREATE TYPE "InvoiceItemType" AS ENUM ('RENT', 'UTILITY_WATER', 'UTILITY_ELECTRICITY', 'SERVICE', 'PENALTY', 'DISCOUNT', 'OTHER');

-- CreateTable
CREATE TABLE "TenantOrg" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantOrg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "refreshTokenHash" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "lastUserAgent" TEXT,
    "passwordResetHash" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "emailVerificationHash" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "usageNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bedCount" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "area" DECIMAL(10,2),
    "monthlyPrice" DECIMAL(14,2) NOT NULL,
    "rentalType" "RoomRentalType" NOT NULL DEFAULT 'WHOLE',
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "identityNo" TEXT,
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "nationality" TEXT,
    "address" TEXT,
    "zaloPhone" TEXT,
    "zaloChatId" TEXT,
    "zaloUserId" TEXT,
    "emergencyPhone" TEXT,
    "roomId" TEXT,
    "relationship" TEXT,
    "idImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "RentalCycleStatus" NOT NULL DEFAULT 'PLANNED',
    "expectedMoveInAt" TIMESTAMP(3),
    "actualMoveInAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rentalCycleId" TEXT,
    "code" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "signedAt" TIMESTAMP(3),
    "purpose" TEXT,
    "firstPaymentDate" TIMESTAMP(3),
    "monthlyRent" DECIMAL(14,2) NOT NULL,
    "depositMoney" DECIMAL(14,2) NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coRepresentativeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actualMoveOutAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "customerSnapshot" JSONB,
    "roomSnapshot" JSONB,
    "termsSnapshot" JSONB,
    "moveInSnapshot" JSONB,
    "activatedAt" TIMESTAMP(3),
    "activationIdempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractParty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "customerId" TEXT,
    "role" TEXT NOT NULL,
    "identitySnapshot" JSONB NOT NULL,
    "signedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occupancy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contractId" TEXT,
    "rentalCycleId" TEXT,
    "role" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "leaveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractSettlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "rentalCycleId" TEXT,
    "actualMoveOutAt" TIMESTAMP(3) NOT NULL,
    "roomTurnoverStatus" "RoomStatus" NOT NULL,
    "chargeTotal" DECIMAL(14,2) NOT NULL,
    "creditTotal" DECIMAL(14,2) NOT NULL,
    "netReceivable" DECIMAL(14,2) NOT NULL,
    "refundToCustomer" DECIMAL(14,2) NOT NULL,
    "utilitySnapshot" JSONB,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DepositType" NOT NULL DEFAULT 'BOOKING',
    "roomId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contractId" TEXT,
    "rentalCycleId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'DRAFT',
    "expiredAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomHold" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentalCycleId" TEXT NOT NULL,
    "depositId" TEXT,
    "roomId" TEXT NOT NULL,
    "kind" "RoomHoldKind" NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "activeResourceKey" TEXT,
    "status" "RoomHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositOperation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentalCycleId" TEXT NOT NULL,
    "sourceDepositId" TEXT NOT NULL,
    "targetDepositId" TEXT,
    "contractId" TEXT,
    "type" "DepositOperationType" NOT NULL,
    "status" "DepositOperationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB,
    "errorCode" TEXT,
    "receiptId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DepositOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentalCycleId" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "contractId" TEXT,
    "operationId" TEXT NOT NULL,
    "type" "DepositLedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceEffect" DECIMAL(14,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT,
    "rentalCycleId" TEXT,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "period" TEXT,
    "usagePeriod" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "billingKind" TEXT,
    "baseInvoiceKey" TEXT,
    "adjustmentOfInvoiceId" TEXT,
    "adjustmentReason" TEXT,
    "adjustmentCreatedBy" TEXT,
    "adjustmentRequestHash" TEXT,
    "adjustmentIdempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "rentalCycleId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceInvoiceId" TEXT,
    "appliedInvoiceId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "remainingAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetry" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "tenantId" TEXT,
    "userId" TEXT,
    "module" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" "AuditAction" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "before" JSONB,
    "after" JSONB,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "branch" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPaymentAccountRoute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomPaymentAccountRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "buildingId" TEXT,
    "roomId" TEXT,
    "bankAccountId" TEXT,
    "sourceType" "PaymentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'SEPAY',
    "paymentCode" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "bankAccountName" TEXT,
    "qrUrl" TEXT NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "providerTransactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "PaymentWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "processingStartedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "buildingId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "ownerId" TEXT,
    "buildingId" TEXT,
    "roomId" TEXT,
    "paidByOwnerId" TEXT,
    "paidByName" TEXT,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "vendor" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "settlementStatus" "ExpenseSettlementStatus" NOT NULL DEFAULT 'NONE',
    "description" TEXT,
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reimbursedAt" TIMESTAMP(3),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" "JournalSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "postedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "type" "EntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "eventName" TEXT,
    "correlationId" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "triggeredBy" TEXT,
    "actorId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "error" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStepExecution" (
    "id" TEXT NOT NULL,
    "workflowExecutionId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "input" JSONB,
    "output" JSONB,
    "error" JSONB,
    "order" INTEGER NOT NULL,

    CONSTRAINT "WorkflowStepExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "eventName" TEXT,
    "correlationId" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "triggeredBy" TEXT,
    "actorId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "error" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'CREATED',
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationQueue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "providerId" TEXT,
    "providerResponse" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" "SettingScope" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HunonicMeterMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "buildingId" TEXT,
    "roomId" TEXT,
    "buildingCode" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'hunonic',
    "providerMeterId" TEXT NOT NULL,
    "providerDeviceId" TEXT,
    "providerRootId" TEXT,
    "providerHomeId" TEXT,
    "providerRoomId" TEXT,
    "homeName" TEXT,
    "roomName" TEXT,
    "deviceName" TEXT NOT NULL,
    "rootType" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" TEXT,
    "lastReadingKwh" DECIMAL(14,3),
    "lastAmountVnd" DECIMAL(14,0),
    "lastSyncedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HunonicMeterMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HunonicMeterReading" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meterMappingId" TEXT NOT NULL,
    "roomId" TEXT,
    "readingAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT,
    "powerCurrentW" DECIMAL(14,3),
    "energyMonthKwh" DECIMAL(14,3),
    "moneyMonthVnd" DECIMAL(14,0),
    "energyPrevMonthKwh" DECIMAL(14,3),
    "moneyPrevMonthVnd" DECIMAL(14,0),
    "currentMonth" TEXT,
    "sourceProvider" TEXT NOT NULL DEFAULT 'hunonic',
    "sourceProviderMeterId" TEXT NOT NULL,
    "sourcePeriod" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "aggregateBasis" TEXT NOT NULL DEFAULT 'MONTHLY_AGGREGATE_V1',
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HunonicMeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "meterMappingId" TEXT,
    "sourceReadingId" TEXT,
    "billingPeriod" TEXT NOT NULL,
    "usagePeriod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "provider" TEXT NOT NULL DEFAULT 'hunonic',
    "startReadingKwh" DECIMAL(14,3),
    "endReadingKwh" DECIMAL(14,3),
    "usageKwh" DECIMAL(14,3) NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "unitRateVnd" DECIMAL(14,2),
    "electricityAmount" DECIMAL(14,2) NOT NULL,
    "waterRatePerPersonVnd" DECIMAL(14,2) NOT NULL DEFAULT 100000,
    "waterAmount" DECIMAL(14,2) NOT NULL,
    "occupantCount" INTEGER NOT NULL,
    "occupants" JSONB NOT NULL,
    "allocations" JSONB NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "aggregateBasis" TEXT NOT NULL DEFAULT 'MONTHLY_AGGREGATE_V1',
    "sourcePayloadHash" TEXT NOT NULL,
    "sourceProvenance" JSONB NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySettlementRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlySettlementRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HunonicSyncLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "metersFound" INTEGER NOT NULL DEFAULT 0,
    "readingsSaved" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HunonicSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "costPer1kPrompt" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "costPer1kCompletion" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTokenUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "module" TEXT,
    "conversationId" TEXT,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiToolCall" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "result" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'INDEXING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "folderId" TEXT,
    "currentVersionId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "tags" TEXT[],
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFolder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentShare" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sharedWithId" TEXT,
    "sharedWithEmail" TEXT,
    "permission" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "provider" "SignatureProviderType" NOT NULL DEFAULT 'INTERNAL',
    "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureParty" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signatureData" TEXT,
    "declinedReason" TEXT,

    CONSTRAINT "SignatureParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureLog" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "billingSnapshotId" TEXT,
    "type" "InvoiceItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "servicePeriod" TEXT,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantOrg_code_key" ON "TenantOrg"("code");

-- CreateIndex
CREATE INDEX "Owner_tenantId_isActive_idx" ON "Owner"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_tenantId_code_key" ON "Owner"("tenantId", "code");

-- CreateIndex
CREATE INDEX "User_tenantId_status_idx" ON "User"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Building_tenantId_ownerId_idx" ON "Building"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "Building_tenantId_displayOrder_idx" ON "Building"("tenantId", "displayOrder");

-- CreateIndex
CREATE INDEX "Building_tenantId_deletedAt_idx" ON "Building"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Building_tenantId_code_key" ON "Building"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Floor_tenantId_buildingId_idx" ON "Floor"("tenantId", "buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_tenantId_buildingId_level_key" ON "Floor"("tenantId", "buildingId", "level");

-- CreateIndex
CREATE INDEX "Room_tenantId_status_idx" ON "Room"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Room_tenantId_buildingId_status_idx" ON "Room"("tenantId", "buildingId", "status");

-- CreateIndex
CREATE INDEX "Room_tenantId_floorId_status_idx" ON "Room"("tenantId", "floorId", "status");

-- CreateIndex
CREATE INDEX "Room_tenantId_deletedAt_idx" ON "Room"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Room_tenantId_buildingId_code_key" ON "Room"("tenantId", "buildingId", "code");

-- CreateIndex
CREATE INDEX "Customer_tenantId_phone_idx" ON "Customer"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "Customer_tenantId_zaloChatId_idx" ON "Customer"("tenantId", "zaloChatId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_zaloUserId_idx" ON "Customer"("tenantId", "zaloUserId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_fullName_idx" ON "Customer"("tenantId", "fullName");

-- CreateIndex
CREATE INDEX "Customer_tenantId_deletedAt_idx" ON "Customer"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "RentalCycle_tenantId_customerId_status_idx" ON "RentalCycle"("tenantId", "customerId", "status");

-- CreateIndex
CREATE INDEX "RentalCycle_tenantId_roomId_status_idx" ON "RentalCycle"("tenantId", "roomId", "status");

-- CreateIndex
CREATE INDEX "RentalCycle_tenantId_status_expectedMoveInAt_idx" ON "RentalCycle"("tenantId", "status", "expectedMoveInAt");

-- CreateIndex
CREATE INDEX "Contract_tenantId_roomId_status_idx" ON "Contract"("tenantId", "roomId", "status");

-- CreateIndex
CREATE INDEX "Contract_tenantId_customerId_status_idx" ON "Contract"("tenantId", "customerId", "status");

-- CreateIndex
CREATE INDEX "Contract_tenantId_rentalCycleId_idx" ON "Contract"("tenantId", "rentalCycleId");

-- CreateIndex
CREATE INDEX "Contract_tenantId_status_endDate_idx" ON "Contract"("tenantId", "status", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_tenantId_code_key" ON "Contract"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_tenantId_activationIdempotencyKey_key" ON "Contract"("tenantId", "activationIdempotencyKey");

-- CreateIndex
CREATE INDEX "ContractParty_tenantId_contractId_idx" ON "ContractParty"("tenantId", "contractId");

-- CreateIndex
CREATE INDEX "ContractParty_tenantId_customerId_idx" ON "ContractParty"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractParty_contractId_customerId_role_key" ON "ContractParty"("contractId", "customerId", "role");

-- CreateIndex
CREATE INDEX "Occupancy_tenantId_roomId_leftAt_idx" ON "Occupancy"("tenantId", "roomId", "leftAt");

-- CreateIndex
CREATE INDEX "Occupancy_tenantId_customerId_leftAt_idx" ON "Occupancy"("tenantId", "customerId", "leftAt");

-- CreateIndex
CREATE INDEX "Occupancy_tenantId_contractId_leftAt_idx" ON "Occupancy"("tenantId", "contractId", "leftAt");

-- CreateIndex
CREATE INDEX "Occupancy_tenantId_rentalCycleId_leftAt_idx" ON "Occupancy"("tenantId", "rentalCycleId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractSettlement_contractId_key" ON "ContractSettlement"("contractId");

-- CreateIndex
CREATE INDEX "ContractSettlement_tenantId_actualMoveOutAt_idx" ON "ContractSettlement"("tenantId", "actualMoveOutAt");

-- CreateIndex
CREATE INDEX "ContractSettlement_tenantId_rentalCycleId_idx" ON "ContractSettlement"("tenantId", "rentalCycleId");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_roomId_status_idx" ON "Deposit"("tenantId", "roomId", "status");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_customerId_status_idx" ON "Deposit"("tenantId", "customerId", "status");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_status_expiredAt_idx" ON "Deposit"("tenantId", "status", "expiredAt");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_rentalCycleId_status_idx" ON "Deposit"("tenantId", "rentalCycleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_tenantId_code_key" ON "Deposit"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RoomHold_activeResourceKey_key" ON "RoomHold"("activeResourceKey");

-- CreateIndex
CREATE INDEX "RoomHold_tenantId_roomId_status_expiresAt_idx" ON "RoomHold"("tenantId", "roomId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "RoomHold_tenantId_rentalCycleId_status_idx" ON "RoomHold"("tenantId", "rentalCycleId", "status");

-- CreateIndex
CREATE INDEX "RoomHold_tenantId_depositId_status_idx" ON "RoomHold"("tenantId", "depositId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoomHold_tenantId_idempotencyKey_key" ON "RoomHold"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DepositOperation_tenantId_sourceDepositId_status_idx" ON "DepositOperation"("tenantId", "sourceDepositId", "status");

-- CreateIndex
CREATE INDEX "DepositOperation_tenantId_rentalCycleId_status_idx" ON "DepositOperation"("tenantId", "rentalCycleId", "status");

-- CreateIndex
CREATE INDEX "DepositOperation_tenantId_receiptId_idx" ON "DepositOperation"("tenantId", "receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositOperation_tenantId_idempotencyKey_key" ON "DepositOperation"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DepositLedgerEntry_reversalOfId_key" ON "DepositLedgerEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "DepositLedgerEntry_tenantId_depositId_createdAt_idx" ON "DepositLedgerEntry"("tenantId", "depositId", "createdAt");

-- CreateIndex
CREATE INDEX "DepositLedgerEntry_tenantId_rentalCycleId_createdAt_idx" ON "DepositLedgerEntry"("tenantId", "rentalCycleId", "createdAt");

-- CreateIndex
CREATE INDEX "DepositLedgerEntry_tenantId_operationId_idx" ON "DepositLedgerEntry"("tenantId", "operationId");

-- CreateIndex
CREATE INDEX "DepositLedgerEntry_tenantId_sourceType_sourceId_idx" ON "DepositLedgerEntry"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositLedgerEntry_tenantId_idempotencyKey_key" ON "DepositLedgerEntry"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_createdAt_idx" ON "OutboxEvent"("status", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_tenantId_aggregateType_aggregateId_idx" ON "OutboxEvent"("tenantId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_tenantId_idempotencyKey_key" ON "OutboxEvent"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_period_idx" ON "Invoice"("tenantId", "period");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_customerId_dueDate_status_idx" ON "Invoice"("tenantId", "customerId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_dueDate_idx" ON "Invoice"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_contractId_status_idx" ON "Invoice"("tenantId", "contractId", "status");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_rentalCycleId_status_idx" ON "Invoice"("tenantId", "rentalCycleId", "status");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_adjustmentOfInvoiceId_idx" ON "Invoice"("tenantId", "adjustmentOfInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_deletedAt_idx" ON "Invoice"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_id_key" ON "Invoice"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_code_key" ON "Invoice"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_baseInvoiceKey_key" ON "Invoice"("tenantId", "baseInvoiceKey");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_adjustmentIdempotencyKey_key" ON "Invoice"("tenantId", "adjustmentIdempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_tenantId_invoiceId_status_idx" ON "Payment"("tenantId", "invoiceId", "status");

-- CreateIndex
CREATE INDEX "Payment_tenantId_provider_providerRef_idx" ON "Payment"("tenantId", "provider", "providerRef");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_paidAt_idx" ON "Payment"("tenantId", "status", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_tenantId_rentalCycleId_status_idx" ON "Payment"("tenantId", "rentalCycleId", "status");

-- CreateIndex
CREATE INDEX "CreditNote_tenantId_customerId_remainingAmount_idx" ON "CreditNote"("tenantId", "customerId", "remainingAmount");

-- CreateIndex
CREATE INDEX "CreditNote_tenantId_sourceInvoiceId_idx" ON "CreditNote"("tenantId", "sourceInvoiceId");

-- CreateIndex
CREATE INDEX "Task_tenantId_status_idx" ON "Task"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Task_tenantId_assigneeId_idx" ON "Task"("tenantId", "assigneeId");

-- CreateIndex
CREATE INDEX "Task_tenantId_assigneeId_status_idx" ON "Task"("tenantId", "assigneeId", "status");

-- CreateIndex
CREATE INDEX "SalesLead_tenantId_status_idx" ON "SalesLead"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SalesLead_tenantId_phone_idx" ON "SalesLead"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "NotificationJob_tenantId_status_nextRetryAt_idx" ON "NotificationJob"("tenantId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "NotificationJob_tenantId_provider_status_idx" ON "NotificationJob"("tenantId", "provider", "status");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entity_entityId_idx" ON "AuditLog"("tenantId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_userId_createdAt_idx" ON "AuditLog"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "ChartOfAccount_tenantId_type_idx" ON "ChartOfAccount"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_tenantId_code_key" ON "ChartOfAccount"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CashAccount_tenantId_code_key" ON "CashAccount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "BankAccount_tenantId_ownerId_idx" ON "BankAccount"("tenantId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_tenantId_accountNumber_key" ON "BankAccount"("tenantId", "accountNumber");

-- CreateIndex
CREATE INDEX "RoomPaymentAccountRoute_tenantId_roomId_validFrom_idx" ON "RoomPaymentAccountRoute"("tenantId", "roomId", "validFrom");

-- CreateIndex
CREATE INDEX "RoomPaymentAccountRoute_tenantId_bankAccountId_validFrom_idx" ON "RoomPaymentAccountRoute"("tenantId", "bankAccountId", "validFrom");

-- CreateIndex
CREATE INDEX "RoomPaymentAccountRoute_tenantId_validFrom_validTo_idx" ON "RoomPaymentAccountRoute"("tenantId", "validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPaymentAccountRoute_tenantId_roomId_validFrom_key" ON "RoomPaymentAccountRoute"("tenantId", "roomId", "validFrom");

-- CreateIndex
CREATE INDEX "PaymentRequest_tenantId_ownerId_idx" ON "PaymentRequest"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "PaymentRequest_tenantId_buildingId_idx" ON "PaymentRequest"("tenantId", "buildingId");

-- CreateIndex
CREATE INDEX "PaymentRequest_tenantId_bankAccountId_idx" ON "PaymentRequest"("tenantId", "bankAccountId");

-- CreateIndex
CREATE INDEX "PaymentRequest_tenantId_sourceType_sourceId_idx" ON "PaymentRequest"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "PaymentRequest_tenantId_status_idx" ON "PaymentRequest"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_tenantId_paymentCode_key" ON "PaymentRequest"("tenantId", "paymentCode");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_provider_providerTransactionId_key" ON "PaymentRequest"("provider", "providerTransactionId");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_status_createdAt_idx" ON "PaymentWebhookLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_tenantId_createdAt_idx" ON "PaymentWebhookLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookLog_provider_providerTransactionId_key" ON "PaymentWebhookLog"("provider", "providerTransactionId");

-- CreateIndex
CREATE INDEX "CostCenter_tenantId_ownerId_idx" ON "CostCenter"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX "CostCenter_tenantId_buildingId_idx" ON "CostCenter"("tenantId", "buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_tenantId_code_key" ON "CostCenter"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Expense_tenantId_costCenterId_status_idx" ON "Expense"("tenantId", "costCenterId", "status");

-- CreateIndex
CREATE INDEX "Expense_tenantId_ownerId_date_idx" ON "Expense"("tenantId", "ownerId", "date");

-- CreateIndex
CREATE INDEX "Expense_tenantId_paidByOwnerId_settlementStatus_idx" ON "Expense"("tenantId", "paidByOwnerId", "settlementStatus");

-- CreateIndex
CREATE INDEX "Expense_tenantId_buildingId_date_idx" ON "Expense"("tenantId", "buildingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_tenantId_code_key" ON "Expense"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_tenantId_code_key" ON "Receipt"("tenantId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_sourceType_sourceId_idx" ON "JournalEntry"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_entryDate_idx" ON "JournalEntry"("tenantId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_code_key" ON "JournalEntry"("tenantId", "code");

-- CreateIndex
CREATE INDEX "JournalLine_tenantId_accountId_type_idx" ON "JournalLine"("tenantId", "accountId", "type");

-- CreateIndex
CREATE INDEX "JournalLine_tenantId_costCenterId_idx" ON "JournalLine"("tenantId", "costCenterId");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_tenantId_code_key" ON "Reconciliation"("tenantId", "code");

-- CreateIndex
CREATE INDEX "WorkflowExecution_tenantId_workflowName_status_idx" ON "WorkflowExecution"("tenantId", "workflowName", "status");

-- CreateIndex
CREATE INDEX "WorkflowExecution_correlationId_idx" ON "WorkflowExecution"("correlationId");

-- CreateIndex
CREATE INDEX "WorkflowStepExecution_workflowExecutionId_status_idx" ON "WorkflowStepExecution"("workflowExecutionId", "status");

-- CreateIndex
CREATE INDEX "RuleExecution_tenantId_ruleName_status_idx" ON "RuleExecution"("tenantId", "ruleName", "status");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_status_idx" ON "Notification"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "Notification_tenantId_channel_status_idx" ON "Notification"("tenantId", "channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_tenantId_code_key" ON "NotificationTemplate"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_tenantId_userId_type_key" ON "NotificationPreference"("tenantId", "userId", "type");

-- CreateIndex
CREATE INDEX "NotificationQueue_tenantId_status_idx" ON "NotificationQueue"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "AppSetting_tenantId_scope_ownerId_idx" ON "AppSetting"("tenantId", "scope", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_tenantId_scope_ownerId_key_key" ON "AppSetting"("tenantId", "scope", "ownerId", "key");

-- CreateIndex
CREATE INDEX "HunonicMeterMapping_tenantId_buildingCode_roomCode_idx" ON "HunonicMeterMapping"("tenantId", "buildingCode", "roomCode");

-- CreateIndex
CREATE INDEX "HunonicMeterMapping_tenantId_buildingId_idx" ON "HunonicMeterMapping"("tenantId", "buildingId");

-- CreateIndex
CREATE INDEX "HunonicMeterMapping_tenantId_roomId_idx" ON "HunonicMeterMapping"("tenantId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "HunonicMeterMapping_tenantId_providerMeterId_key" ON "HunonicMeterMapping"("tenantId", "providerMeterId");

-- CreateIndex
CREATE INDEX "HunonicMeterReading_tenantId_roomId_readingAt_idx" ON "HunonicMeterReading"("tenantId", "roomId", "readingAt");

-- CreateIndex
CREATE INDEX "HunonicMeterReading_tenantId_readingAt_idx" ON "HunonicMeterReading"("tenantId", "readingAt");

-- CreateIndex
CREATE UNIQUE INDEX "HunonicMeterReading_tenantId_meterMappingId_payloadHash_key" ON "HunonicMeterReading"("tenantId", "meterMappingId", "payloadHash");

-- CreateIndex
CREATE INDEX "BillingSnapshot_tenantId_billingPeriod_idx" ON "BillingSnapshot"("tenantId", "billingPeriod");

-- CreateIndex
CREATE INDEX "BillingSnapshot_tenantId_status_usagePeriod_idx" ON "BillingSnapshot"("tenantId", "status", "usagePeriod");

-- CreateIndex
CREATE INDEX "BillingSnapshot_tenantId_meterMappingId_usagePeriod_idx" ON "BillingSnapshot"("tenantId", "meterMappingId", "usagePeriod");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSnapshot_tenantId_roomId_usagePeriod_key" ON "BillingSnapshot"("tenantId", "roomId", "usagePeriod");

-- CreateIndex
CREATE INDEX "MonthlySettlementRun_tenantId_status_startedAt_idx" ON "MonthlySettlementRun"("tenantId", "status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySettlementRun_tenantId_billingPeriod_scopeKey_key" ON "MonthlySettlementRun"("tenantId", "billingPeriod", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySettlementRun_tenantId_idempotencyKey_key" ON "MonthlySettlementRun"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "HunonicSyncLog_tenantId_startedAt_idx" ON "HunonicSyncLog"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "HunonicSyncLog_tenantId_status_idx" ON "HunonicSyncLog"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptTemplate_code_key" ON "AiPromptTemplate"("code");

-- CreateIndex
CREATE INDEX "AiPromptTemplate_tenantId_isActive_idx" ON "AiPromptTemplate"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AiModelConfig_provider_modelName_key" ON "AiModelConfig"("provider", "modelName");

-- CreateIndex
CREATE INDEX "AiTokenUsage_tenantId_createdAt_idx" ON "AiTokenUsage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AiTokenUsage_tenantId_userId_idx" ON "AiTokenUsage"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AiTokenUsage_provider_model_idx" ON "AiTokenUsage"("provider", "model");

-- CreateIndex
CREATE INDEX "AiConversation_tenantId_userId_idx" ON "AiConversation"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiToolCall_messageId_idx" ON "AiToolCall"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "AiKnowledgeDocument_tenantId_sourceType_sourceId_key" ON "AiKnowledgeDocument"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AiKnowledgeChunk_tenantId_idx" ON "AiKnowledgeChunk"("tenantId");

-- CreateIndex
CREATE INDEX "AiKnowledgeChunk_documentId_idx" ON "AiKnowledgeChunk"("documentId");

-- CreateIndex
CREATE INDEX "Document_tenantId_type_status_idx" ON "Document"("tenantId", "type", "status");

-- CreateIndex
CREATE INDEX "Document_tenantId_folderId_idx" ON "Document"("tenantId", "folderId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_tenantId_code_key" ON "Document"("tenantId", "code");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "DocumentFolder_tenantId_parentId_idx" ON "DocumentFolder"("tenantId", "parentId");

-- CreateIndex
CREATE INDEX "DocumentShare_documentId_idx" ON "DocumentShare"("documentId");

-- CreateIndex
CREATE INDEX "SignatureRequest_tenantId_status_idx" ON "SignatureRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SignatureRequest_documentId_idx" ON "SignatureRequest"("documentId");

-- CreateIndex
CREATE INDEX "SignatureParty_requestId_idx" ON "SignatureParty"("requestId");

-- CreateIndex
CREATE INDEX "SignatureLog_partyId_idx" ON "SignatureLog"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_tenantId_code_key" ON "DocumentTemplate"("tenantId", "code");

-- CreateIndex
CREATE INDEX "InvoiceItem_tenantId_invoiceId_idx" ON "InvoiceItem"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_tenantId_billingSnapshotId_idx" ON "InvoiceItem"("tenantId", "billingSnapshotId");

-- CreateIndex
CREATE INDEX "InvoiceItem_tenantId_servicePeriod_idx" ON "InvoiceItem"("tenantId", "servicePeriod");

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_invoiceId_idx" ON "PaymentAllocation"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_paymentId_idx" ON "PaymentAllocation"("tenantId", "paymentId");

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCycle" ADD CONSTRAINT "RentalCycle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCycle" ADD CONSTRAINT "RentalCycle_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSettlement" ADD CONSTRAINT "ContractSettlement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSettlement" ADD CONSTRAINT "ContractSettlement_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomHold" ADD CONSTRAINT "RoomHold_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomHold" ADD CONSTRAINT "RoomHold_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomHold" ADD CONSTRAINT "RoomHold_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositOperation" ADD CONSTRAINT "DepositOperation_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositOperation" ADD CONSTRAINT "DepositOperation_sourceDepositId_fkey" FOREIGN KEY ("sourceDepositId") REFERENCES "Deposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositOperation" ADD CONSTRAINT "DepositOperation_targetDepositId_fkey" FOREIGN KEY ("targetDepositId") REFERENCES "Deposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositOperation" ADD CONSTRAINT "DepositOperation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "DepositOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "DepositLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_adjustmentOfInvoiceId_fkey" FOREIGN KEY ("tenantId", "adjustmentOfInvoiceId") REFERENCES "Invoice"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPaymentAccountRoute" ADD CONSTRAINT "RoomPaymentAccountRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPaymentAccountRoute" ADD CONSTRAINT "RoomPaymentAccountRoute_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPaymentAccountRoute" ADD CONSTRAINT "RoomPaymentAccountRoute_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidByOwnerId_fkey" FOREIGN KEY ("paidByOwnerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepExecution" ADD CONSTRAINT "WorkflowStepExecution_workflowExecutionId_fkey" FOREIGN KEY ("workflowExecutionId") REFERENCES "WorkflowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HunonicMeterMapping" ADD CONSTRAINT "HunonicMeterMapping_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HunonicMeterMapping" ADD CONSTRAINT "HunonicMeterMapping_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HunonicMeterReading" ADD CONSTRAINT "HunonicMeterReading_meterMappingId_fkey" FOREIGN KEY ("meterMappingId") REFERENCES "HunonicMeterMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HunonicMeterReading" ADD CONSTRAINT "HunonicMeterReading_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_meterMappingId_fkey" FOREIGN KEY ("meterMappingId") REFERENCES "HunonicMeterMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_sourceReadingId_fkey" FOREIGN KEY ("sourceReadingId") REFERENCES "HunonicMeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToolCall" ADD CONSTRAINT "AiToolCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeChunk" ADD CONSTRAINT "AiKnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AiKnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureParty" ADD CONSTRAINT "SignatureParty_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureLog" ADD CONSTRAINT "SignatureLog_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "SignatureParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_billingSnapshotId_fkey" FOREIGN KEY ("billingSnapshotId") REFERENCES "BillingSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom checks omitted by Prisma schema representation.

-- Custom constraints not represented by the Prisma datamodel. Applied only by
-- scripts/ci-bootstrap-database.js after the generated final schema exists.
ALTER TABLE "RoomHold" ADD CONSTRAINT "RoomHold_active_state_check" CHECK (("status" = 'ACTIVE' AND "activeResourceKey" IS NOT NULL AND "releasedAt" IS NULL) OR ("status" <> 'ACTIVE' AND "activeResourceKey" IS NULL));
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_positive_amount_check" CHECK ("amount" > 0);
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_non_zero_effect_check" CHECK ("balanceEffect" <> 0);
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_effect_bound_check" CHECK (ABS("balanceEffect") = "amount");
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_usage_non_negative_check" CHECK ("usageKwh" >= 0);
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_electricity_non_negative_check" CHECK ("electricityAmount" >= 0);
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_water_non_negative_check" CHECK ("waterAmount" >= 0);
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_occupant_count_check" CHECK ("occupantCount" >= 0);
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_status_locked_check" CHECK ("status" = 'LOCKED');
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billing_kind_shape_check" CHECK (("billingKind" IS NULL AND "baseInvoiceKey" IS NULL AND "adjustmentOfInvoiceId" IS NULL AND "adjustmentReason" IS NULL AND "adjustmentCreatedBy" IS NULL AND "adjustmentRequestHash" IS NULL AND "adjustmentIdempotencyKey" IS NULL) OR ("billingKind" IN ('ENTRY', 'MONTHLY_BASE') AND "baseInvoiceKey" IS NOT NULL AND "adjustmentOfInvoiceId" IS NULL AND "adjustmentReason" IS NULL AND "adjustmentCreatedBy" IS NULL AND "adjustmentRequestHash" IS NULL AND "adjustmentIdempotencyKey" IS NULL) OR ("billingKind" IN ('DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT') AND "baseInvoiceKey" IS NULL AND "adjustmentOfInvoiceId" IS NOT NULL AND length(trim(COALESCE("adjustmentReason", ''))) > 0 AND length(trim(COALESCE("adjustmentCreatedBy", ''))) > 0 AND length(trim(COALESCE("adjustmentRequestHash", ''))) > 0 AND length(trim(COALESCE("adjustmentIdempotencyKey", ''))) BETWEEN 8 AND 128 AND "subtotal" > 0 AND "total" > 0 AND "discount" = 0 AND ("billingKind" <> 'CREDIT_ADJUSTMENT' OR ("paidAmount" = 0 AND "creditAmount" = 0))));

-- Partial unique index omitted by Prisma schema representation.

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_tenantId_provider_providerRef_nonempty_key"
  ON "Payment"("tenantId", "provider", "providerRef")
  WHERE "providerRef" IS NOT NULL AND "providerRef" <> '';

-- Custom functions and triggers preserved from immutable migration 17.

CREATE FUNCTION "prevent_deposit_ledger_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_deposit_ledger_mutation', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DepositLedgerEntry is append-only; create a REVERSAL entry instead'
      USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "DepositLedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "DepositLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "prevent_deposit_ledger_mutation"();

-- Custom functions and triggers preserved from immutable migration 18.

CREATE OR REPLACE FUNCTION "protect_invoice_economic_fields"()
RETURNS TRIGGER AS $$
DECLARE
    protected_issued_document BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD."status" <> 'DRAFT' THEN
            RAISE EXCEPTION 'INVOICE_APPEND_ONLY_DELETE_FORBIDDEN' USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;

    protected_issued_document :=
        OLD."status" <> 'DRAFT'
        AND OLD."billingKind" IN (
            'ENTRY',
            'MONTHLY_BASE',
            'DEBIT_ADJUSTMENT',
            'CREDIT_ADJUSTMENT'
        );

    IF protected_issued_document AND (
        NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt"
        OR NEW."deletedBy" IS DISTINCT FROM OLD."deletedBy"
        OR NEW."deleteReason" IS DISTINCT FROM OLD."deleteReason"
    ) THEN
        RAISE EXCEPTION 'INVOICE_APPEND_ONLY_SOFT_DELETE_FORBIDDEN' USING ERRCODE = '23514';
    END IF;

    IF protected_issued_document
       AND NEW."status" IS DISTINCT FROM OLD."status"
       AND NOT (
           OLD."billingKind" <> 'CREDIT_ADJUSTMENT'
           AND (
               (OLD."status" = 'ISSUED' AND NEW."status" IN ('PARTIALLY_PAID', 'PAID', 'OVERDUE'))
               OR (OLD."status" = 'PARTIALLY_PAID' AND NEW."status" IN ('PAID', 'OVERDUE'))
               OR (OLD."status" = 'OVERDUE' AND NEW."status" IN ('PARTIALLY_PAID', 'PAID'))
           )
       ) THEN
        RAISE EXCEPTION 'INVOICE_APPEND_ONLY_STATUS_TRANSITION_FORBIDDEN' USING ERRCODE = '23514';
    END IF;

    IF OLD."status" <> 'DRAFT' AND (
        NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
        OR NEW."contractId" IS DISTINCT FROM OLD."contractId"
        OR NEW."rentalCycleId" IS DISTINCT FROM OLD."rentalCycleId"
        OR NEW."customerId" IS DISTINCT FROM OLD."customerId"
        OR NEW."code" IS DISTINCT FROM OLD."code"
        OR NEW."period" IS DISTINCT FROM OLD."period"
        OR NEW."usagePeriod" IS DISTINCT FROM OLD."usagePeriod"
        OR NEW."dueDate" IS DISTINCT FROM OLD."dueDate"
        OR NEW."subtotal" IS DISTINCT FROM OLD."subtotal"
        OR NEW."discount" IS DISTINCT FROM OLD."discount"
        OR NEW."total" IS DISTINCT FROM OLD."total"
        OR NEW."billingKind" IS DISTINCT FROM OLD."billingKind"
        OR NEW."baseInvoiceKey" IS DISTINCT FROM OLD."baseInvoiceKey"
        OR NEW."adjustmentOfInvoiceId" IS DISTINCT FROM OLD."adjustmentOfInvoiceId"
        OR NEW."adjustmentReason" IS DISTINCT FROM OLD."adjustmentReason"
        OR NEW."adjustmentCreatedBy" IS DISTINCT FROM OLD."adjustmentCreatedBy"
        OR NEW."adjustmentRequestHash" IS DISTINCT FROM OLD."adjustmentRequestHash"
        OR NEW."adjustmentIdempotencyKey" IS DISTINCT FROM OLD."adjustmentIdempotencyKey"
    ) THEN
        RAISE EXCEPTION 'INVOICE_APPEND_ONLY_ECONOMIC_FIELDS' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "validate_invoice_adjustment_scope"()
RETURNS TRIGGER AS $$
DECLARE
    parent_invoice "Invoice"%ROWTYPE;
BEGIN
    IF NEW."billingKind" IN ('DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT') THEN
        IF NEW."adjustmentOfInvoiceId" IS NULL
           OR NEW."adjustmentOfInvoiceId" = NEW."id" THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_REQUIRES_ROOT_BASE' USING ERRCODE = '23514';
        END IF;

        SELECT *
          INTO parent_invoice
          FROM "Invoice"
         WHERE "id" = NEW."adjustmentOfInvoiceId";

        IF NOT FOUND THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_BASE_NOT_FOUND' USING ERRCODE = '23503';
        END IF;
        IF parent_invoice."tenantId" IS DISTINCT FROM NEW."tenantId" THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
        IF parent_invoice."billingKind" NOT IN ('ENTRY', 'MONTHLY_BASE')
           OR parent_invoice."adjustmentOfInvoiceId" IS NOT NULL THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_REQUIRES_ROOT_BASE' USING ERRCODE = '23514';
        END IF;
        IF NEW."customerId" IS DISTINCT FROM parent_invoice."customerId"
           OR NEW."contractId" IS DISTINCT FROM parent_invoice."contractId"
           OR NEW."rentalCycleId" IS DISTINCT FROM parent_invoice."rentalCycleId"
           OR NEW."period" IS DISTINCT FROM parent_invoice."period"
           OR NEW."usagePeriod" IS DISTINCT FROM parent_invoice."usagePeriod" THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_SCOPE_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "protect_issued_invoice_items"()
RETURNS TRIGGER AS $$
DECLARE
    old_parent_status TEXT;
    old_parent_kind TEXT;
    old_parent_tenant TEXT;
    new_parent_status TEXT;
    new_parent_kind TEXT;
    new_parent_tenant TEXT;
    snapshot_tenant TEXT;
    snapshot_usage_period TEXT;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT "status", "billingKind", "tenantId"
          INTO old_parent_status, old_parent_kind, old_parent_tenant
          FROM "Invoice"
         WHERE "id" = OLD."invoiceId";
        IF NOT FOUND OR old_parent_tenant IS DISTINCT FROM OLD."tenantId" THEN
            RAISE EXCEPTION 'INVOICE_ITEM_PARENT_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT "status", "billingKind", "tenantId"
          INTO new_parent_status, new_parent_kind, new_parent_tenant
          FROM "Invoice"
         WHERE "id" = NEW."invoiceId";
        IF NOT FOUND OR new_parent_tenant IS DISTINCT FROM NEW."tenantId" THEN
            RAISE EXCEPTION 'INVOICE_ITEM_PARENT_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
        IF NEW."billingSnapshotId" IS NOT NULL THEN
            SELECT "tenantId", "usagePeriod"
              INTO snapshot_tenant, snapshot_usage_period
              FROM "BillingSnapshot"
             WHERE "id" = NEW."billingSnapshotId";
            IF NOT FOUND OR snapshot_tenant IS DISTINCT FROM NEW."tenantId" THEN
                RAISE EXCEPTION 'INVOICE_ITEM_SNAPSHOT_TENANT_MISMATCH' USING ERRCODE = '23514';
            END IF;
            IF NEW."type" NOT IN ('UTILITY_ELECTRICITY', 'UTILITY_WATER')
               OR NEW."servicePeriod" IS DISTINCT FROM snapshot_usage_period THEN
                RAISE EXCEPTION 'INVOICE_ITEM_SNAPSHOT_PERIOD_MISMATCH' USING ERRCODE = '23514';
            END IF;
        END IF;
        IF new_parent_kind = 'MONTHLY_BASE'
           AND NEW."type" IN ('UTILITY_ELECTRICITY', 'UTILITY_WATER')
           AND NEW."billingSnapshotId" IS NULL THEN
            RAISE EXCEPTION 'MONTHLY_UTILITY_SNAPSHOT_REQUIRED' USING ERRCODE = '23514';
        END IF;
    END IF;

    IF TG_OP = 'INSERT'
       AND new_parent_kind IN ('DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')
       AND new_parent_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVOICE_ADJUSTMENT_ITEM_APPEND_FORBIDDEN' USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE'
       AND (old_parent_status <> 'DRAFT' OR new_parent_status <> 'DRAFT') THEN
        RAISE EXCEPTION 'INVOICE_ITEM_APPEND_ONLY' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' AND old_parent_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVOICE_ITEM_APPEND_ONLY' USING ERRCODE = '23514';
    END IF;

    IF TG_OP <> 'DELETE' AND new_parent_kind IN ('DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')
       AND (NEW."quantity" <= 0 OR NEW."unitPrice" <= 0 OR NEW."amount" <= 0) THEN
        RAISE EXCEPTION 'INVOICE_ADJUSTMENT_ITEM_MAGNITUDE_INVALID' USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "prevent_credit_adjustment_allocation"()
RETURNS TRIGGER AS $$
DECLARE
    payment_tenant TEXT;
    invoice_tenant TEXT;
    invoice_kind TEXT;
BEGIN
    SELECT "tenantId"
      INTO payment_tenant
      FROM "Payment"
     WHERE "id" = NEW."paymentId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_ALLOCATION_PAYMENT_NOT_FOUND' USING ERRCODE = '23503';
    END IF;

    SELECT "tenantId", "billingKind"
      INTO invoice_tenant, invoice_kind
      FROM "Invoice"
     WHERE "id" = NEW."invoiceId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_ALLOCATION_INVOICE_NOT_FOUND' USING ERRCODE = '23503';
    END IF;

    IF NEW."tenantId" IS DISTINCT FROM payment_tenant
       OR NEW."tenantId" IS DISTINCT FROM invoice_tenant
       OR payment_tenant IS DISTINCT FROM invoice_tenant THEN
        RAISE EXCEPTION 'PAYMENT_ALLOCATION_TENANT_MISMATCH' USING ERRCODE = '23514';
    END IF;
    IF invoice_kind = 'CREDIT_ADJUSTMENT' THEN
        RAISE EXCEPTION 'CREDIT_ADJUSTMENT_ALLOCATION_FORBIDDEN' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "validate_billing_snapshot_provenance"()
RETURNS TRIGGER AS $$
DECLARE
    room_tenant TEXT;
    mapping_tenant TEXT;
    mapping_room_id TEXT;
    reading_tenant TEXT;
    reading_period TEXT;
    reading_basis TEXT;
    reading_mapping_id TEXT;
    reading_room_id TEXT;
    reading_provider_meter_id TEXT;
    reading_payload_hash TEXT;
BEGIN
    SELECT "tenantId" INTO room_tenant FROM "Room" WHERE "id" = NEW."roomId";
    IF NOT FOUND OR room_tenant IS DISTINCT FROM NEW."tenantId" THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_ROOM_TENANT_MISMATCH' USING ERRCODE = '23514';
    END IF;
    IF NEW."meterMappingId" IS NOT NULL THEN
        SELECT "tenantId", "roomId" INTO mapping_tenant, mapping_room_id FROM "HunonicMeterMapping" WHERE "id" = NEW."meterMappingId";
        IF NOT FOUND OR mapping_tenant IS DISTINCT FROM NEW."tenantId"
           OR mapping_room_id IS DISTINCT FROM NEW."roomId" THEN
            RAISE EXCEPTION 'BILLING_SNAPSHOT_MAPPING_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW."sourceReadingId" IS NOT NULL THEN
        SELECT "tenantId", "sourcePeriod", "aggregateBasis", "meterMappingId", "roomId", "sourceProviderMeterId", "payloadHash"
          INTO reading_tenant, reading_period, reading_basis, reading_mapping_id, reading_room_id, reading_provider_meter_id, reading_payload_hash
          FROM "HunonicMeterReading" WHERE "id" = NEW."sourceReadingId";
        IF NOT FOUND OR reading_tenant IS DISTINCT FROM NEW."tenantId"
           OR reading_period IS DISTINCT FROM NEW."usagePeriod"
           OR reading_basis IS DISTINCT FROM NEW."aggregateBasis"
           OR reading_room_id IS DISTINCT FROM NEW."roomId"
           OR (NEW."meterMappingId" IS NOT NULL AND reading_mapping_id IS DISTINCT FROM NEW."meterMappingId") THEN
            RAISE EXCEPTION 'BILLING_SNAPSHOT_SOURCE_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW."aggregateBasis" <> 'MONTHLY_AGGREGATE_V1' THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_BASIS_UNSUPPORTED' USING ERRCODE = '23514';
    END IF;
    IF NEW."startReadingKwh" IS NOT NULL OR NEW."endReadingKwh" IS NOT NULL THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_MONTHLY_AGGREGATE_REQUIRES_NULL_ENDPOINTS' USING ERRCODE = '23514';
    END IF;
    IF length(trim(COALESCE(NEW."sourcePayloadHash", ''))) = 0
       OR NEW."sourcePayloadHash" !~ '^[0-9a-f]{64}$'
       OR NEW."sourceProvenance" IS NULL
       OR (NEW."sourceReadingId" IS NOT NULL AND (
           NEW."sourceProvenance"->>'sourceProviderMeterId' IS DISTINCT FROM reading_provider_meter_id
           OR NEW."sourceProvenance"->>'readingPayloadHash' IS DISTINCT FROM reading_payload_hash
       )) THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_PROVENANCE_REQUIRED' USING ERRCODE = '23514';
    END IF;
    IF (NEW."usageKwh" > 0 OR NEW."electricityAmount" > 0)
       AND (NEW."sourceReadingId" IS NULL OR NEW."meterMappingId" IS NULL) THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_REQUIRES_PERSISTED_OBSERVATION' USING ERRCODE = '23514';
    END IF;
    IF NEW."billingPeriod" !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       OR NEW."usagePeriod" !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       OR to_char((NEW."usagePeriod" || '-01')::date + interval '1 month', 'YYYY-MM') <> NEW."billingPeriod" THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_PERIOD_INVALID' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "validate_hunonic_meter_reading_source"()
RETURNS TRIGGER AS $$
DECLARE
    mapping_tenant TEXT;
    mapping_room_id TEXT;
    room_tenant TEXT;
    mapping_provider_meter_id TEXT;
BEGIN
    SELECT "tenantId", "roomId", "providerMeterId"
      INTO mapping_tenant, mapping_room_id, mapping_provider_meter_id
      FROM "HunonicMeterMapping" WHERE "id" = NEW."meterMappingId";
    IF NOT FOUND OR mapping_tenant IS DISTINCT FROM NEW."tenantId"
       OR (mapping_room_id IS NOT NULL AND mapping_room_id IS DISTINCT FROM NEW."roomId") THEN
        RAISE EXCEPTION 'HUNONIC_READING_MAPPING_SCOPE_MISMATCH' USING ERRCODE = '23514';
    END IF;
    IF NEW."roomId" IS NOT NULL THEN
        SELECT "tenantId" INTO room_tenant FROM "Room" WHERE "id" = NEW."roomId";
        IF NOT FOUND OR room_tenant IS DISTINCT FROM NEW."tenantId" THEN
            RAISE EXCEPTION 'HUNONIC_READING_ROOM_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW."sourcePeriod" !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       OR NEW."sourcePeriod" IS DISTINCT FROM NEW."currentMonth"
       OR NEW."observedAt" IS NULL
       OR length(trim(COALESCE(NEW."sourceProvider", ''))) = 0
       OR NEW."sourceProviderMeterId" IS DISTINCT FROM mapping_provider_meter_id
       OR NEW."payloadHash" !~ '^[0-9a-f]{64}$'
       OR NEW."aggregateBasis" <> 'MONTHLY_AGGREGATE_V1' THEN
        RAISE EXCEPTION 'HUNONIC_READING_SOURCE_INVALID' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "protect_billing_snapshot"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'BILLING_SNAPSHOT_IMMUTABLE' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "protect_hunonic_meter_reading"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'HUNONIC_READING_IMMUTABLE' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "protect_hunonic_mapping_identity"()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW."provider" IS DISTINCT FROM OLD."provider"
        OR NEW."providerMeterId" IS DISTINCT FROM OLD."providerMeterId"
        OR NEW."providerDeviceId" IS DISTINCT FROM OLD."providerDeviceId"
        OR NEW."providerRootId" IS DISTINCT FROM OLD."providerRootId"
        OR NEW."buildingId" IS DISTINCT FROM OLD."buildingId"
        OR NEW."roomId" IS DISTINCT FROM OLD."roomId"
        OR NEW."buildingCode" IS DISTINCT FROM OLD."buildingCode"
        OR NEW."roomCode" IS DISTINCT FROM OLD."roomCode")
       AND (EXISTS (SELECT 1 FROM "HunonicMeterReading" WHERE "meterMappingId" = OLD."id")
            OR EXISTS (SELECT 1 FROM "BillingSnapshot" WHERE "meterMappingId" = OLD."id")) THEN
        RAISE EXCEPTION 'HUNONIC_MAPPING_IDENTITY_IMMUTABLE_ONCE_USED' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Invoice_protect_economic_fields"
BEFORE UPDATE OR DELETE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION "protect_invoice_economic_fields"();

CREATE TRIGGER "Invoice_validate_adjustment_scope"
BEFORE INSERT OR UPDATE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION "validate_invoice_adjustment_scope"();

CREATE TRIGGER "InvoiceItem_protect_issued_items"
BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceItem"
FOR EACH ROW EXECUTE FUNCTION "protect_issued_invoice_items"();

CREATE TRIGGER "PaymentAllocation_prevent_credit_adjustment"
BEFORE INSERT OR UPDATE ON "PaymentAllocation"
FOR EACH ROW EXECUTE FUNCTION "prevent_credit_adjustment_allocation"();

CREATE TRIGGER "BillingSnapshot_validate_provenance"
BEFORE INSERT OR UPDATE ON "BillingSnapshot"
FOR EACH ROW EXECUTE FUNCTION "validate_billing_snapshot_provenance"();

CREATE TRIGGER "HunonicMeterReading_validate_source"
BEFORE INSERT OR UPDATE ON "HunonicMeterReading"
FOR EACH ROW EXECUTE FUNCTION "validate_hunonic_meter_reading_source"();

CREATE TRIGGER "BillingSnapshot_immutable"
BEFORE UPDATE OR DELETE ON "BillingSnapshot"
FOR EACH ROW EXECUTE FUNCTION "protect_billing_snapshot"();

CREATE TRIGGER "HunonicMeterReading_immutable"
BEFORE UPDATE OR DELETE ON "HunonicMeterReading"
FOR EACH ROW EXECUTE FUNCTION "protect_hunonic_meter_reading"();

CREATE TRIGGER "HunonicMeterMapping_identity_immutable_once_used"
BEFORE UPDATE ON "HunonicMeterMapping"
FOR EACH ROW EXECUTE FUNCTION "protect_hunonic_mapping_identity"();

