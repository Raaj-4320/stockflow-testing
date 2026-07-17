#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const normalizeName = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .replace(/[^\p{L}\p{N}\s]/gu, '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizePhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
};

const normalizeGst = (value = '') => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizeText = (value = '') => String(value || '').trim();
const isPlaceholder = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized || ['-', '—', 'na', 'n/a', 'none', 'null', 'undefined'].includes(normalized);
};

const fuzzySignature = (value = '') => normalizeName(value).replace(/\b(the|and|of|private|limited|ltd|pvt|llp)\b/g, '').replace(/\s+/g, ' ').trim();
const parseDateMs = (value) => {
  const ms = new Date(String(value || '')).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const makeDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const toArray = (value) => Array.isArray(value) ? value : [];

const compareByDateAsc = (a, b) => {
  const aMs = parseDateMs(a) ?? 0;
  const bMs = parseDateMs(b) ?? 0;
  return aMs - bMs;
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const getArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    input: '',
    artifactsDir: path.resolve(process.cwd(), 'artifacts'),
  };
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--input') parsed.input = String(args[i + 1] || '');
    if (token === '--artifacts-dir') parsed.artifactsDir = path.resolve(process.cwd(), String(args[i + 1] || 'artifacts'));
  }
  return parsed;
};

const loadTenantDatasets = (inputPath) => {
  if (!inputPath) return [];
  const absoluteInput = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(absoluteInput)) throw new Error(`Input path not found: ${absoluteInput}`);

  const fromSinglePayload = (payload, filePathHint) => {
    if (Array.isArray(payload?.tenants)) {
      return payload.tenants.map((tenant, index) => ({
        tenantId: String(tenant.tenantId || tenant.uid || tenant.id || `tenant-${index + 1}`),
        source: filePathHint,
        data: tenant.data || tenant.state || tenant,
      }));
    }
    if (Array.isArray(payload)) {
      return payload.map((tenant, index) => ({
        tenantId: String(tenant.tenantId || tenant.uid || tenant.id || `tenant-${index + 1}`),
        source: filePathHint,
        data: tenant.data || tenant.state || tenant,
      }));
    }
    return [{
      tenantId: String(payload.tenantId || payload.uid || payload.id || path.basename(filePathHint, path.extname(filePathHint))),
      source: filePathHint,
      data: payload.data || payload.state || payload,
    }];
  };

  const stat = fs.statSync(absoluteInput);
  if (stat.isDirectory()) {
    return fs.readdirSync(absoluteInput)
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .flatMap((entry) => fromSinglePayload(readJson(path.join(absoluteInput, entry)), path.join(absoluteInput, entry)));
  }
  return fromSinglePayload(readJson(absoluteInput), absoluteInput);
};

const getExplicitPartyLinks = (party) => {
  const raw = [
    party.mergedIntoPartyId,
    party.canonicalPartyId,
    party.originalPartyId,
    party.parentPartyId,
    party.previousPartyId,
    party.legacyPartyId,
    party.rootPartyId,
    party.continuationOf,
    party.externalId,
  ];
  return unique(raw.map((value) => String(value || '').trim()));
};

const getMasterFieldConflicts = (parties) => {
  const fields = ['name', 'gst', 'phone', 'email', 'location', 'address', 'contactPerson', 'openingBalance', 'creditTerms', 'notes', 'supplierCategory'];
  const conflicts = {};
  fields.forEach((field) => {
    const values = unique(parties.map((party) => normalizeText(party[field])));
    const meaningful = values.filter((value) => !isPlaceholder(value));
    if (meaningful.length > 1) {
      conflicts[field] = meaningful;
    }
  });
  return conflicts;
};

const gatherPartyReferences = (state, partiesById, targetPartyIds) => {
  const purchaseOrders = toArray(state.purchaseOrders);
  const supplierPayments = toArray(state.supplierPayments);
  const partyCreditLedger = toArray(state.partyCreditLedger);
  const purchaseReceiptPostings = toArray(state.purchaseReceiptPostings);
  const products = toArray(state.products);
  const repairHistoryEntries = toArray(state.repairHistoryEntries);

  const orders = purchaseOrders.filter((order) => targetPartyIds.has(String(order.partyId || '').trim()));
  const payments = supplierPayments.filter((payment) => !payment.deletedAt && targetPartyIds.has(String(payment.partyId || '').trim()));
  const credits = partyCreditLedger.filter((entry) => targetPartyIds.has(String(entry.partyId || '').trim()));
  const receipts = purchaseReceiptPostings.filter((posting) => orders.some((order) => order.id === posting.sourcePurchaseId));
  const repairs = repairHistoryEntries.filter((entry) => entry.entityType === 'purchase_party' && targetPartyIds.has(String(entry.entityId || '').trim()));

  const productReferences = [];
  const orderIds = new Set(orders.map((order) => order.id));
  products.forEach((product) => {
    const historyRows = toArray(product.purchaseHistory);
    historyRows.forEach((row) => {
      const partyName = normalizeName(row.partyName);
      const matchesPartyName = [...targetPartyIds].some((partyId) => normalizeName(partiesById.get(partyId)?.name) === partyName);
      if (orderIds.has(String(row.purchaseOrderId || '').trim()) || matchesPartyName) {
        productReferences.push({
          productId: String(product.id || ''),
          productName: String(product.name || ''),
          purchaseOrderId: String(row.purchaseOrderId || ''),
          partyName: String(row.partyName || ''),
          date: String(row.date || ''),
        });
      }
    });
  });

  return { orders, payments, credits, receipts, repairs, productReferences };
};

const summarizeParty = (party, refs) => {
  const orderDates = refs.orders.map((order) => order.orderDate || order.createdAt).filter(Boolean);
  const paymentDates = refs.payments.map((payment) => payment.paidAt || payment.createdAt).filter(Boolean);
  const creditDates = refs.credits.map((entry) => entry.paidAt || entry.createdAt).filter(Boolean);
  const productDates = refs.productReferences.map((entry) => entry.date).filter(Boolean);
  const allDates = [...orderDates, ...paymentDates, ...creditDates, ...productDates].sort(compareByDateAsc);
  const legacyPayments = refs.orders.reduce((sum, order) => sum + toArray(order.paymentHistory)
    .filter((payment) => String(payment.method || '').toLowerCase() !== 'party_credit' && !payment.supplierPaymentId)
    .reduce((rowSum, payment) => rowSum + Math.max(0, Number(payment.amount || 0)), 0), 0);
  const creditApplied = refs.orders.reduce((sum, order) => sum + toArray(order.paymentHistory)
    .filter((payment) => String(payment.method || '').toLowerCase() === 'party_credit')
    .reduce((rowSum, payment) => rowSum + Math.max(0, Number(payment.amount || 0)), 0), 0);

  return {
    partyId: String(party.id || ''),
    name: String(party.name || ''),
    createdAt: String(party.createdAt || ''),
    updatedAt: String(party.updatedAt || ''),
    gst: String(party.gst || ''),
    phone: String(party.phone || ''),
    purchaseOrdersCount: refs.orders.length,
    purchaseTransactionsCount: refs.orders.length,
    supplierPaymentsCount: refs.payments.length,
    creditEntriesCount: refs.credits.length,
    returnsCount: 0,
    productReferencesCount: refs.productReferences.length,
    purchaseReceiptPostingsCount: refs.receipts.length,
    repairHistoryCount: refs.repairs.length,
    totalPurchaseValue: Number(refs.orders.reduce((sum, order) => sum + Math.max(0, Number(order.totalAmount || 0)), 0).toFixed(2)),
    totalSupplierPayments: Number((refs.payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0) + legacyPayments).toFixed(2)),
    totalCreditRemaining: Number(refs.credits.reduce((sum, entry) => sum + Math.max(0, Number(entry.remainingAmount || 0)), 0).toFixed(2)),
    totalCreditCreated: Number(refs.credits.reduce((sum, entry) => sum + Math.max(0, Number(entry.amountCreated || 0)), 0).toFixed(2)),
    totalCreditApplied: Number(creditApplied.toFixed(2)),
    currentPayable: Number(refs.orders.reduce((sum, order) => sum + Math.max(0, Number(order.remainingAmount || 0)), 0).toFixed(2)),
    earliestTransactionDate: allDates[0] || '',
    latestTransactionDate: allDates[allDates.length - 1] || '',
    masterInfoScore: [
      !isPlaceholder(party.phone) ? 1 : 0,
      !isPlaceholder(party.gst) ? 1 : 0,
      !isPlaceholder(party.location) ? 1 : 0,
      !isPlaceholder(party.contactPerson) ? 1 : 0,
      !isPlaceholder(party.notes) ? 1 : 0,
    ].reduce((sum, item) => sum + item, 0),
  };
};

const chooseCanonicalParty = (parties, summaries) => {
  const byId = new Map(parties.map((party) => [party.id, party]));
  const linkedTargets = unique(parties.flatMap((party) => getExplicitPartyLinks(party)));
  const explicitTarget = linkedTargets.find((id) => byId.has(id));
  if (explicitTarget) return explicitTarget;

  return [...parties]
    .sort((a, b) => {
      const aSummary = summaries.get(a.id);
      const bSummary = summaries.get(b.id);
      const aRefCount = (aSummary?.purchaseOrdersCount || 0) + (aSummary?.supplierPaymentsCount || 0) + (aSummary?.creditEntriesCount || 0);
      const bRefCount = (bSummary?.purchaseOrdersCount || 0) + (bSummary?.supplierPaymentsCount || 0) + (bSummary?.creditEntriesCount || 0);
      if (bRefCount !== aRefCount) return bRefCount - aRefCount;
      if ((bSummary?.masterInfoScore || 0) !== (aSummary?.masterInfoScore || 0)) return (bSummary?.masterInfoScore || 0) - (aSummary?.masterInfoScore || 0);
      const aCreated = parseDateMs(a.createdAt) ?? Number.MAX_SAFE_INTEGER;
      const bCreated = parseDateMs(b.createdAt) ?? Number.MAX_SAFE_INTEGER;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return String(a.id).localeCompare(String(b.id));
    })[0]?.id || '';
};

const detectTimelineDrift = (parties, summaries, canonicalPartyId) => {
  if (parties.length < 2) return { detected: false, reasons: [] };
  const canonical = summaries.get(canonicalPartyId);
  const others = parties.filter((party) => party.id !== canonicalPartyId).map((party) => summaries.get(party.id)).filter(Boolean);
  if (!canonical || !others.length) return { detected: false, reasons: [] };

  const reasons = [];
  others.forEach((summary) => {
    const canonicalFirst = parseDateMs(canonical.earliestTransactionDate);
    const canonicalLast = parseDateMs(canonical.latestTransactionDate);
    const duplicateCreated = parseDateMs(summary.createdAt);
    const duplicateFirst = parseDateMs(summary.earliestTransactionDate);
    if (duplicateCreated && canonicalFirst && duplicateCreated > canonicalFirst) {
      reasons.push(`NEWER_DUPLICATE:${summary.partyId}`);
    }
    if (duplicateFirst && canonicalLast && duplicateFirst >= canonicalLast) {
      reasons.push(`TRANSACTION_DRIFT:${summary.partyId}`);
    }
  });
  return { detected: reasons.some((reason) => reason.startsWith('TRANSACTION_DRIFT')), reasons };
};

const confidenceFromReasons = (reasonCodes) => {
  if (reasonCodes.includes('EXPLICIT_PARENT_LINK')) return 'DETERMINISTIC';
  if (reasonCodes.includes('EXACT_GST') && reasonCodes.includes('GST_AND_NAME')) return 'VERY_HIGH';
  if (reasonCodes.includes('EXACT_PHONE') && reasonCodes.includes('PHONE_AND_NAME')) return 'HIGH';
  if (reasonCodes.includes('EXACT_GST') || reasonCodes.includes('GST_AND_NAME')) return 'VERY_HIGH';
  if (reasonCodes.includes('EXACT_PHONE') || reasonCodes.includes('PHONE_AND_NAME')) return 'HIGH';
  if (reasonCodes.includes('NAME_ONLY')) return 'MEDIUM';
  if (reasonCodes.includes('FUZZY_NAME')) return 'LOW';
  return 'AMBIGUOUS';
};

const safeForAutomaticMerge = (confidence, reasonCodes, conflicts, parties, canonicalPartyId, summaries) => {
  if (!['DETERMINISTIC', 'VERY_HIGH'].includes(confidence)) return false;
  if (reasonCodes.includes('AMBIGUOUS') || reasonCodes.includes('FUZZY_NAME') || reasonCodes.includes('NAME_ONLY')) return false;
  if (conflicts.gst || conflicts.phone) return false;
  const activeParties = parties
    .filter((party) => party.id !== canonicalPartyId)
    .map((party) => summaries.get(party.id))
    .filter(Boolean)
    .filter((summary) => summary.purchaseOrdersCount > 0 || summary.supplierPaymentsCount > 0 || summary.creditEntriesCount > 0);
  if (activeParties.length > 1) return false;
  return true;
};

const buildGroupsForTenant = (tenantId, state) => {
  const parties = toArray(state.purchaseParties).filter((party) => !party?.isDeleted);
  const partiesById = new Map(parties.map((party) => [String(party.id || '').trim(), party]));
  const pairEvidence = new Map();

  const addPairReason = (aId, bId, reasonCode, payload = {}) => {
    if (!aId || !bId || aId === bId) return;
    const key = [aId, bId].sort().join('::');
    const current = pairEvidence.get(key) || { partyIds: [aId, bId].sort(), reasonCodes: new Set(), evidence: [] };
    current.reasonCodes.add(reasonCode);
    current.evidence.push({ reasonCode, ...payload });
    pairEvidence.set(key, current);
  };

  parties.forEach((party) => {
    getExplicitPartyLinks(party).forEach((linkedId) => {
      if (partiesById.has(linkedId)) {
        addPairReason(party.id, linkedId, 'EXPLICIT_PARENT_LINK', { sourcePartyId: party.id, linkedPartyId: linkedId });
      }
    });
  });

  const byName = new Map();
  const byGst = new Map();
  const byPhone = new Map();
  const byFuzzy = new Map();
  parties.forEach((party) => {
    const name = normalizeName(party.name);
    const gst = normalizeGst(party.gst);
    const phone = normalizePhone(party.phone);
    const fuzzy = fuzzySignature(party.name);
    if (name) byName.set(name, [...(byName.get(name) || []), party]);
    if (gst && !isPlaceholder(gst)) byGst.set(gst, [...(byGst.get(gst) || []), party]);
    if (phone && !isPlaceholder(phone)) byPhone.set(phone, [...(byPhone.get(phone) || []), party]);
    if (fuzzy) byFuzzy.set(fuzzy, [...(byFuzzy.get(fuzzy) || []), party]);
  });

  const connectGroup = (items, reasonCode, extraBuilder) => {
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        addPairReason(items[i].id, items[j].id, reasonCode, extraBuilder?.(items[i], items[j]) || {});
      }
    }
  };

  [...byGst.entries()].forEach(([gst, items]) => {
    if (items.length > 1) connectGroup(items, 'EXACT_GST', () => ({ normalizedGst: gst, rawGstValues: unique(items.map((item) => item.gst)) }));
  });
  [...byPhone.entries()].forEach(([phone, items]) => {
    if (items.length > 1) connectGroup(items, 'EXACT_PHONE', () => ({ normalizedPhone: phone, rawPhoneValues: unique(items.map((item) => item.phone)) }));
  });
  [...byName.entries()].forEach(([name, items]) => {
    if (items.length > 1) connectGroup(items, 'NAME_ONLY', () => ({ normalizedName: name }));
  });
  [...byFuzzy.entries()].forEach(([name, items]) => {
    if (items.length > 1) connectGroup(items, 'FUZZY_NAME', () => ({ fuzzyName: name }));
  });

  parties.forEach((partyA, index) => {
    for (let i = index + 1; i < parties.length; i += 1) {
      const partyB = parties[i];
      const sameName = normalizeName(partyA.name) && normalizeName(partyA.name) === normalizeName(partyB.name);
      const sameGst = normalizeGst(partyA.gst) && normalizeGst(partyA.gst) === normalizeGst(partyB.gst);
      const samePhone = normalizePhone(partyA.phone) && normalizePhone(partyA.phone) === normalizePhone(partyB.phone);
      if (sameName && sameGst) addPairReason(partyA.id, partyB.id, 'GST_AND_NAME', { normalizedName: normalizeName(partyA.name), normalizedGst: normalizeGst(partyA.gst) });
      if (sameName && samePhone) addPairReason(partyA.id, partyB.id, 'PHONE_AND_NAME', { normalizedName: normalizeName(partyA.name), normalizedPhone: normalizePhone(partyA.phone) });
      const identicalMaster = [
        normalizeName(partyA.name) === normalizeName(partyB.name),
        normalizeGst(partyA.gst) === normalizeGst(partyB.gst),
        normalizePhone(partyA.phone) === normalizePhone(partyB.phone),
        normalizeText(partyA.location) === normalizeText(partyB.location),
        normalizeText(partyA.contactPerson) === normalizeText(partyB.contactPerson),
      ].every(Boolean);
      if (identicalMaster) addPairReason(partyA.id, partyB.id, 'IDENTICAL_MASTER', {});
    }
  });

  const adjacency = new Map();
  pairEvidence.forEach(({ partyIds }) => {
    const [aId, bId] = partyIds;
    adjacency.set(aId, [...(adjacency.get(aId) || []), bId]);
    adjacency.set(bId, [...(adjacency.get(bId) || []), aId]);
  });

  const visited = new Set();
  const groups = [];
  parties.forEach((party) => {
    if (visited.has(party.id) || !adjacency.has(party.id)) return;
    const queue = [party.id];
    const partyIds = [];
    while (queue.length) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      partyIds.push(current);
      (adjacency.get(current) || []).forEach((neighbor) => {
        if (!visited.has(neighbor)) queue.push(neighbor);
      });
    }
    if (partyIds.length > 1) groups.push(partyIds);
  });

  return groups.map((partyIds, index) => {
    const groupParties = partyIds.map((partyId) => partiesById.get(partyId)).filter(Boolean);
    const refsByPartyId = new Map(groupParties.map((party) => [party.id, gatherPartyReferences(state, partiesById, new Set([party.id]))]));
    const summaries = new Map(groupParties.map((party) => [party.id, summarizeParty(party, refsByPartyId.get(party.id))]));
    const canonicalPartyId = chooseCanonicalParty(groupParties, summaries);
    const reasonCodes = unique(
      [...pairEvidence.values()]
        .filter((item) => item.partyIds.every((partyId) => partyIds.includes(partyId)))
        .flatMap((item) => [...item.reasonCodes]),
    );
    const timeline = detectTimelineDrift(groupParties, summaries, canonicalPartyId);
    timeline.reasons.forEach((reason) => {
      const code = reason.split(':')[0];
      if (!reasonCodes.includes(code)) reasonCodes.push(code);
    });
    if (!reasonCodes.length) reasonCodes.push('AMBIGUOUS');
    const confidence = confidenceFromReasons(reasonCodes);
    const conflicts = getMasterFieldConflicts(groupParties);
    const combinedRefs = gatherPartyReferences(state, partiesById, new Set(partyIds));
    const combinedSummary = summarizeParty({ id: 'combined', name: 'combined' }, combinedRefs);
    const canonicalSummary = summaries.get(canonicalPartyId);
    const duplicateSummaries = groupParties.filter((party) => party.id !== canonicalPartyId).map((party) => summaries.get(party.id));
    const safe = safeForAutomaticMerge(confidence, reasonCodes, conflicts, groupParties, canonicalPartyId, summaries);

    return {
      id: `${tenantId}-group-${index + 1}`,
      tenantId,
      proposedCanonicalPartyId: canonicalPartyId,
      duplicatePartyIds: groupParties.filter((party) => party.id !== canonicalPartyId).map((party) => party.id),
      allPartyIds: partyIds,
      confidence,
      reasonCodes,
      safeForPotentialAutomaticMerge: safe,
      identityEvidence: {
        explicitLinks: groupParties.flatMap((party) => getExplicitPartyLinks(party).map((linkedId) => ({ partyId: party.id, linkedPartyId: linkedId }))),
        normalizedNames: unique(groupParties.map((party) => normalizeName(party.name))),
        rawNames: unique(groupParties.map((party) => party.name)),
        normalizedGstValues: unique(groupParties.map((party) => normalizeGst(party.gst)).filter(Boolean)),
        rawGstValues: unique(groupParties.map((party) => party.gst).filter(Boolean)),
        normalizedPhoneValues: unique(groupParties.map((party) => normalizePhone(party.phone)).filter(Boolean)),
        rawPhoneValues: unique(groupParties.map((party) => party.phone).filter(Boolean)),
      },
      masterFieldConflicts: conflicts,
      timeline: {
        driftDetected: timeline.detected,
        driftReasons: timeline.reasons,
        parties: groupParties.map((party) => summaries.get(party.id)),
      },
      references: {
        purchaseOrders: combinedRefs.orders.map((order) => ({ id: order.id, partyId: order.partyId, partyName: order.partyName, totalAmount: order.totalAmount, orderDate: order.orderDate || order.createdAt })),
        supplierPayments: combinedRefs.payments.map((payment) => ({ id: payment.id, partyId: payment.partyId, partyName: payment.partyName, amount: payment.amount, paidAt: payment.paidAt || payment.createdAt })),
        partyCreditLedger: combinedRefs.credits.map((entry) => ({ id: entry.id, partyId: entry.partyId, partyName: entry.partyName, amountCreated: entry.amountCreated, remainingAmount: entry.remainingAmount })),
        purchaseReceiptPostings: combinedRefs.receipts.map((posting) => ({ id: posting.id, sourcePurchaseId: posting.sourcePurchaseId, postedAt: posting.postedAt })),
        repairHistoryEntries: combinedRefs.repairs.map((entry) => ({ id: entry.id, entityId: entry.entityId, repairKind: entry.repairKind, createdAt: entry.createdAt })),
        productReferences: combinedRefs.productReferences,
      },
      financialSummary: {
        canonicalOnly: canonicalSummary,
        duplicatesOnly: duplicateSummaries,
        combinedLogicalSupplier: combinedSummary,
        fragmentedBalancesLikely: duplicateSummaries.some((summary) => (summary?.currentPayable || 0) > 0 || (summary?.totalCreditRemaining || 0) > 0 || (summary?.purchaseOrdersCount || 0) > 0),
      },
    };
  });
};

const summarizeAudit = (groups, tenantCount, totalParties, note = '') => {
  const countByConfidence = (value) => groups.filter((group) => group.confidence === value).length;
  const transactionDriftGroups = groups.filter((group) => group.timeline.driftDetected).length;
  const safeCount = groups.filter((group) => group.safeForPotentialAutomaticMerge).length;
  return {
    generatedAt: new Date().toISOString(),
    tenantsAnalyzed: tenantCount,
    totalParties,
    suspectedDuplicateGroups: groups.length,
    partiesInDuplicateGroups: groups.reduce((sum, group) => sum + group.allPartyIds.length, 0),
    deterministicGroups: countByConfidence('DETERMINISTIC'),
    veryHighConfidenceGroups: countByConfidence('VERY_HIGH'),
    highConfidenceGroups: countByConfidence('HIGH'),
    mediumConfidenceGroups: countByConfidence('MEDIUM'),
    lowConfidenceGroups: countByConfidence('LOW'),
    ambiguousGroups: countByConfidence('AMBIGUOUS'),
    potentiallyAutoMergeSafeGroups: safeCount,
    manualReviewRequiredGroups: groups.length - safeCount,
    transactionDriftGroups,
    fragmentedBalanceGroups: groups.filter((group) => group.financialSummary.fragmentedBalancesLikely).length,
    note,
  };
};

const main = () => {
  const args = getArgs();
  makeDir(args.artifactsDir);

  let datasets = [];
  let note = '';
  if (args.input) {
    datasets = loadTenantDatasets(args.input);
  } else {
    note = 'No tenant export input was provided. Audit schema was generated, but no live tenant data was analyzed.';
  }

  const groups = [];
  let totalParties = 0;
  datasets.forEach((dataset) => {
    const parties = toArray(dataset.data?.purchaseParties).filter((party) => !party?.isDeleted);
    totalParties += parties.length;
    groups.push(...buildGroupsForTenant(dataset.tenantId, dataset.data || {}));
  });

  const summary = summarizeAudit(groups, datasets.length, totalParties, note);
  const detailedAudit = {
    ...summary,
    analyzedSources: datasets.map((dataset) => ({ tenantId: dataset.tenantId, source: dataset.source })),
    groups,
  };

  const detailPath = path.join(args.artifactsDir, 'purchase-party-duplicate-audit.json');
  const summaryPath = path.join(args.artifactsDir, 'purchase-party-duplicate-audit-summary.json');
  fs.writeFileSync(detailPath, `${JSON.stringify(detailedAudit, null, 2)}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log('PURCHASE PARTY DUPLICATE AUDIT');
  console.log(`Tenants analyzed: ${summary.tenantsAnalyzed}`);
  console.log(`Total purchase parties: ${summary.totalParties}`);
  console.log(`Suspected duplicate groups: ${summary.suspectedDuplicateGroups}`);
  console.log(`Parties involved: ${summary.partiesInDuplicateGroups}`);
  console.log(`Deterministic: ${summary.deterministicGroups}`);
  console.log(`Very high confidence: ${summary.veryHighConfidenceGroups}`);
  console.log(`High confidence: ${summary.highConfidenceGroups}`);
  console.log(`Medium confidence: ${summary.mediumConfidenceGroups}`);
  console.log(`Low confidence: ${summary.lowConfidenceGroups}`);
  console.log(`Ambiguous: ${summary.ambiguousGroups}`);
  console.log(`Potentially safe for automated repair: ${summary.potentiallyAutoMergeSafeGroups}`);
  console.log(`Manual review required: ${summary.manualReviewRequiredGroups}`);
  console.log(`Transaction drift detected: ${summary.transactionDriftGroups} groups`);
  if (note) console.log(note);
  console.log(`Detailed JSON: ${detailPath}`);
  console.log(`Summary JSON: ${summaryPath}`);
};

main();
