import { readFileSync } from 'fs';

export const loadJsonFixture = <T>(filePath: string): T => {
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
};
