#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const getArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    input: '',
    output: path.resolve(process.cwd(), 'artifacts', 'purchase-party-audit-source.json'),
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--input') parsed.input = String(args[index + 1] || '');
    if (token === '--output') parsed.output = path.resolve(process.cwd(), String(args[index + 1] || ''));
  }

  return parsed;
};

const ensureDir = (filePath) => {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const normalizeDoc = (doc) => {
  if (!doc || typeof doc !== 'object') return {};
  const normalized = {};
  Object.entries(doc).forEach(([key, value]) => {
    if (key === '__id' || key === '__path') return;
    normalized[key] = value;
  });
  return normalized;
};

const getStoreCollectionsFromFullExport = (collections) => {
  const stores = new Map();

  Object.entries(collections || {}).forEach(([collectionPath, docs]) => {
    const match = /^stores\/([^/]+)\/([^/]+)$/.exec(collectionPath);
    if (!match) return;
    const [, storeId, collectionName] = match;
    const current = stores.get(storeId) || {};
    current[collectionName] = Array.isArray(docs) ? docs.map(normalizeDoc) : [];
    stores.set(storeId, current);
  });

  return stores;
};

const getBusinessCollectionsFromFullExport = (collections) => {
  const businesses = new Map();

  Object.entries(collections || {}).forEach(([collectionPath, docs]) => {
    const match = /^businesses\/([^/]+)\/([^/]+)$/.exec(collectionPath);
    if (!match) return;
    const [, businessId, collectionName] = match;
    const current = businesses.get(businessId) || {};
    current[collectionName] = Array.isArray(docs) ? docs.map(normalizeDoc) : [];
    businesses.set(businessId, current);
  });

  return businesses;
};

const buildTenants = (tenantMap) => [...tenantMap.entries()].map(([tenantId, data]) => ({
  tenantId,
  data,
}));

const main = () => {
  const args = getArgs();
  if (!args.input) {
    throw new Error('Missing --input. Example: node scripts/prepare-purchase-party-audit-input.mjs --input X:\\testing-export-firestore-mahant\\firestore-full-export.json');
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const payload = readJson(inputPath);
  const collections = payload?.collections;
  if (!collections || typeof collections !== 'object') {
    throw new Error('Unsupported input format. Expected a firestore-clone export JSON with a top-level "collections" object.');
  }

  let tenants = buildTenants(getStoreCollectionsFromFullExport(collections));
  let sourceKind = 'stores';

  if (!tenants.length) {
    tenants = buildTenants(getBusinessCollectionsFromFullExport(collections));
    sourceKind = 'businesses';
  }

  ensureDir(args.output);
  const outputPayload = {
    generatedAt: new Date().toISOString(),
    sourceFile: inputPath,
    sourceProjectId: payload?.__meta?.sourceProjectId || '',
    sourceDatabaseId: payload?.__meta?.sourceDatabaseId || '',
    sourceKind,
    tenants,
  };

  fs.writeFileSync(args.output, `${JSON.stringify(outputPayload, null, 2)}\n`);

  const counts = tenants.reduce((acc, tenant) => {
    const state = tenant.data || {};
    acc.tenants += 1;
    acc.purchaseParties += Array.isArray(state.purchaseParties) ? state.purchaseParties.length : 0;
    acc.purchaseOrders += Array.isArray(state.purchaseOrders) ? state.purchaseOrders.length : 0;
    acc.supplierPayments += Array.isArray(state.supplierPayments) ? state.supplierPayments.length : 0;
    acc.partyCreditLedger += Array.isArray(state.partyCreditLedger) ? state.partyCreditLedger.length : 0;
    return acc;
  }, { tenants: 0, purchaseParties: 0, purchaseOrders: 0, supplierPayments: 0, partyCreditLedger: 0 });

  console.log('PURCHASE PARTY AUDIT INPUT PREPARED');
  console.log(`Source project: ${outputPayload.sourceProjectId || '(unknown)'}`);
  console.log(`Source kind: ${sourceKind}`);
  console.log(`Tenants prepared: ${counts.tenants}`);
  console.log(`Purchase parties: ${counts.purchaseParties}`);
  console.log(`Purchase orders: ${counts.purchaseOrders}`);
  console.log(`Supplier payments: ${counts.supplierPayments}`);
  console.log(`Party credit ledger entries: ${counts.partyCreditLedger}`);
  console.log(`Output JSON: ${args.output}`);
};

main();
