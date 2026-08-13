import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

function findModuleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findModuleFiles(path);
    return entry.name.endsWith('.module.ts') ? [path] : [];
  });
}

describe('PrismaModule architecture', () => {
  it('owns the only PrismaService provider declaration', () => {
    const sourceRoot = __dirname;
    const duplicateModules = findModuleFiles(sourceRoot)
      .filter((path) => !path.endsWith('prisma.module.ts'))
      .filter((path) => readFileSync(path, 'utf8').includes('PrismaService'));

    expect(duplicateModules).toEqual([]);
  });

  it('is global and exports PrismaService', () => {
    const source = readFileSync(join(__dirname, 'prisma.module.ts'), 'utf8');

    expect(source).toContain('@Global()');
    expect(source).toMatch(/exports:\s*\[PrismaService\]/);
  });
});
