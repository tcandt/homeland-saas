-- Supports tenant-scoped invoice keyset pagination ordered by newest first.
CREATE INDEX "Invoice_cursor_feed_idx"
  ON "Invoice" ("tenantId", "deletedAt", "createdAt" DESC, "id" DESC);
