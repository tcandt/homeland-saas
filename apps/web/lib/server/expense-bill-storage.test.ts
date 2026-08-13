import path from 'path';
import { describe, expect, it } from 'vitest';
import { resolveExpenseBillPath, resolveExpenseBillStorageDir } from './expense-bill-storage';

describe('expense bill storage', () => {
  it('resolves the same workspace storage from repo and web working directories', () => {
    const workspace = path.resolve('C:/workspace/homeland-saas');

    expect(resolveExpenseBillStorageDir(workspace, '')).toBe(path.join(workspace, 'storage', 'expense-bills'));
    expect(resolveExpenseBillStorageDir(path.join(workspace, 'apps', 'web'), '')).toBe(
      path.join(workspace, 'storage', 'expense-bills'),
    );
  });

  it('uses the configured production storage directory', () => {
    expect(resolveExpenseBillStorageDir('C:/ignored', 'D:/homeland-bills')).toBe(path.resolve('D:/homeland-bills'));
  });

  it('rejects traversal and nested paths', () => {
    const storage = path.resolve('C:/workspace/storage/expense-bills');

    expect(() => resolveExpenseBillPath('../secret.txt', storage)).toThrow('UNSAFE_PATH');
    expect(() => resolveExpenseBillPath('nested/secret.txt', storage)).toThrow('UNSAFE_PATH');
    expect(resolveExpenseBillPath('bill.png', storage)).toBe(path.join(storage, 'bill.png'));
  });
});
