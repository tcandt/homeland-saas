-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContractStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "ContractStatus" ADD VALUE 'APPROVED';
ALTER TYPE "ContractStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "ContractStatus" ADD VALUE 'TERMINATED';
