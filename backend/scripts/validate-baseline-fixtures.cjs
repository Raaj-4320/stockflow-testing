const fs = require('fs');
const path = require('path');

const registryPath = path.resolve(__dirname, '../tests/harness/fixture-registry.ts');
const registrySource = fs.readFileSync(registryPath, 'utf8');

const groupsToCheck = ['products', 'customers', 'transactions_create'];

const extractPaths = (group) => {
  const regex = new RegExp(`group: '${group}'[\\s\\S]*?path: '([^']+)'`, 'g');
  const matches = [];
  let m;
  while ((m = regex.exec(registrySource)) !== null) {
    matches.push(m[1]);
  }
  return matches;
};

let hasFailure = false;
for (const group of groupsToCheck) {
  const paths = extractPaths(group);
  if (paths.length === 0) {
    console.error(`[FAIL] No fixture entries found for group: ${group}`);
    hasFailure = true;
    continue;
  }

  for (const relPath of paths) {
    const full = path.resolve(__dirname, '..', relPath.replace(/^backend\//, ''));
    if (!fs.existsSync(full)) {
      console.error(`[FAIL] Missing fixture file: ${full}`);
      hasFailure = true;
      continue;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (!parsed.name) {
        console.error(`[FAIL] Fixture missing name: ${full}`);
        hasFailure = true;
      }
    } catch (err) {
      console.error(`[FAIL] Invalid JSON fixture: ${full}`);
      console.error(String(err));
      hasFailure = true;
    }
  }
}

const requiredSpecs = [
  path.resolve(__dirname, '../tests/products/products-baseline.spec.ts'),
  path.resolve(__dirname, '../tests/customers/customers-baseline.spec.ts'),
  path.resolve(__dirname, '../tests/transactions/transactions-create-path.spec.ts'),
];

for (const spec of requiredSpecs) {
  if (!fs.existsSync(spec)) {
    console.error(`[FAIL] Missing baseline spec: ${spec}`);
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log('[OK] Baseline fixture preflight passed for products + customers + transactions_create.');
