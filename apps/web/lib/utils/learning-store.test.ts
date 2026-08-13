import path from 'path';
import { describe, expect, it } from 'vitest';
import { resolveLearningDataDir } from './learning-store';

describe('resolveLearningDataDir', () => {
  it('uses a scoped local directory when no external storage is configured', () => {
    const cwd = path.resolve('C:/workspace/homeland-saas/apps/web');

    expect(resolveLearningDataDir(cwd, '')).toBe(path.join(cwd, '.local-data', 'learning'));
  });

  it('uses an explicit production storage directory', () => {
    expect(resolveLearningDataDir('C:/ignored', 'D:/homeland-learning')).toBe(
      path.resolve('D:/homeland-learning'),
    );
  });
});
