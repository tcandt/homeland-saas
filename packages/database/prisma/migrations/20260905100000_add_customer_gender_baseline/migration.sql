-- Contract history snapshots from 20260905103000 include Customer.gender.
-- Keep the source field nullable so existing customer records remain valid.
ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "gender" TEXT;
