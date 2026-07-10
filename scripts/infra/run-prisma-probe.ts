const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log('Running Prisma SELECT 1 probe...');
        const result = await prisma.$queryRaw`SELECT 1 AS ok`;
        console.log('Query result:', result);
        
        const evidencePath = path.join(__dirname, '../../docs/evidence/INFRASTRUCTURE/prisma-query.txt');
        fs.writeFileSync(evidencePath, 'PRISMA_QUERY_PASS: ' + JSON.stringify(result));
        
        console.log('Prisma Probe: PASS');
        process.exit(0);
    } catch (e) {
        console.error('Prisma Probe Failed:', e.message);
        const evidencePath = path.join(__dirname, '../../docs/evidence/INFRASTRUCTURE/prisma-query.txt');
        fs.writeFileSync(evidencePath, 'PRISMA_QUERY_FAIL: ' + e.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
