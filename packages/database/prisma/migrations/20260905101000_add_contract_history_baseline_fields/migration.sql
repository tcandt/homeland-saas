-- Snapshot/backfill migrations need these legacy profile and contract fields.
-- They are nullable or defaulted so this repair is safe for established data.
ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nationality" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT,
ADD COLUMN IF NOT EXISTS "roomId" TEXT,
ADD COLUMN IF NOT EXISTS "idImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Contract"
ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "purpose" TEXT,
ADD COLUMN IF NOT EXISTS "firstPaymentDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "attachments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "coRepresentativeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
