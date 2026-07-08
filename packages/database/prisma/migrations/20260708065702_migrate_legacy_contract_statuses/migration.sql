-- Migrate naturally expired contracts
UPDATE "Contract" 
SET status = 'EXPIRED' 
WHERE status = 'ENDED' AND "endDate" < NOW();

-- Migrate manually terminated contracts or any remaining ENDED contracts
UPDATE "Contract" 
SET status = 'TERMINATED' 
WHERE status = 'ENDED';