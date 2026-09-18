-- Explicit baseline-owned prelude. The extension is owned by historical migration
-- 20260706150701_auth_foundation; this approved empty-schema path creates it before
-- Prisma emits the vector-backed AiKnowledgeChunk table.
CREATE EXTENSION IF NOT EXISTS "vector";
