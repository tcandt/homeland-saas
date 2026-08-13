import path from 'path';

const storageSubdirectory = path.join('storage', 'expense-bills');

export function resolveExpenseBillStorageDir(
  cwd = process.cwd(),
  configuredDir = process.env.EXPENSE_BILL_STORAGE_DIR,
) {
  if (configuredDir?.trim()) {
    return path.resolve(configuredDir.trim());
  }

  const normalizedCwd = path.resolve(cwd);
  const isWebWorkspace = path.basename(normalizedCwd).toLowerCase() === 'web'
    && path.basename(path.dirname(normalizedCwd)).toLowerCase() === 'apps';
  const workspaceRoot = isWebWorkspace
    ? path.resolve(normalizedCwd, '..', '..')
    : normalizedCwd;

  return path.join(workspaceRoot, storageSubdirectory);
}

export function resolveExpenseBillPath(filename: string, storageDir = resolveExpenseBillStorageDir()) {
  const safeName = path.basename(filename);
  if (!safeName || safeName !== filename) {
    throw new Error('UNSAFE_PATH');
  }

  const base = path.resolve(storageDir);
  const target = path.resolve(base, safeName);
  if (!target.startsWith(`${base}${path.sep}`)) {
    throw new Error('UNSAFE_PATH');
  }

  return target;
}
