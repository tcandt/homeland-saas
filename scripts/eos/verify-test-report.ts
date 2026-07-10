import * as fs from 'fs';

export function verifyTestReport(reportLines: string[], expectedIds: string[]): string {
    const foundIds = reportLines.filter(l => l.startsWith('| Test ')).map(l => l.split('|')[1].trim());
    if (foundIds.length !== expectedIds.length) return 'REPORT_INCONSISTENT';
    const uniqueFound = new Set(foundIds);
    if (uniqueFound.size !== foundIds.length) return 'REPORT_INCONSISTENT';
    for (const id of expectedIds) {
        if (!uniqueFound.has(id)) return 'REPORT_INCONSISTENT';
    }
    for (const id of foundIds) {
        if (!expectedIds.includes(id)) return 'REPORT_INCONSISTENT';
    }
    return 'VALID';
}
