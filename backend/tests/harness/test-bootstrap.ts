import { fixtureRegistry } from './fixture-registry';

export const getFixtureNames = (): string[] => fixtureRegistry.map((f) => f.name);
