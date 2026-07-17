import { PartyCreditLedgerEntry, PurchaseOrder, PurchaseParty, SupplierPaymentLedgerEntry } from '../types';

export type PurchasePartyIdentityDraft = {
  id?: string | null;
  name?: string;
  phone?: string;
  gst?: string;
  location?: string;
  contactPerson?: string;
  notes?: string;
};

export type PurchasePartyResolution =
  | {
      status: 'matched';
      party: PurchaseParty;
      reason: 'id' | 'gst' | 'phone';
      candidates: PurchaseParty[];
    }
  | {
      status: 'ambiguous';
      reason: 'name';
      candidates: PurchaseParty[];
    }
  | {
      status: 'none';
      candidates: PurchaseParty[];
    };

export type PurchasePartyCanonicalEvidence = 'self' | 'merged' | 'gst' | 'phone_name';

export type PurchasePartyCanonicalActivity = {
  purchaseOrders?: Array<Pick<PurchaseOrder, 'id' | 'partyId' | 'partyName' | 'partyPhone' | 'partyGst' | 'totalAmount' | 'orderDate' | 'createdAt'>>;
  supplierPayments?: Array<Pick<SupplierPaymentLedgerEntry, 'id' | 'partyId' | 'partyName' | 'amount' | 'paidAt' | 'effectiveAt' | 'createdAt' | 'deletedAt'>>;
  partyCreditLedger?: Array<Pick<PartyCreditLedgerEntry, 'id' | 'partyId' | 'partyName' | 'amountCreated' | 'paidAt' | 'createdAt' | 'updatedAt'>>;
};

export type PurchasePartyCanonicalView = {
  visibleParties: PurchaseParty[];
  canonicalPartyById: Map<string, PurchaseParty>;
  partyIdToCanonicalId: Map<string, string>;
  canonicalIdToRelatedIds: Map<string, string[]>;
  canonicalIdToEvidence: Map<string, Set<PurchasePartyCanonicalEvidence>>;
  hiddenPartyIds: Set<string>;
};

export type PurchasePartyDuplicateCheckMatchReason = 'Merged into canonical' | 'Exact GST' | 'Phone + Name';
export type PurchasePartyDuplicateCheckStatus = 'Hidden by canonical layer' | 'Already merged' | 'Active duplicate alias';

export type PurchasePartyDuplicateCheckAlias = {
  canonicalPartyId: string;
  canonicalPartyName: string;
  duplicatePartyId: string;
  duplicatePartyName: string;
  matchReason: PurchasePartyDuplicateCheckMatchReason;
  status: PurchasePartyDuplicateCheckStatus;
  isDeleted: boolean;
  mergedIntoPartyId?: string;
};

export type PurchasePartyDuplicateCheckGroup = {
  canonicalPartyId: string;
  canonicalPartyName: string;
  canonicalParty: PurchaseParty | null;
  relatedPartyIds: string[];
  relatedParties: PurchaseParty[];
  aliases: PurchasePartyDuplicateCheckAlias[];
  evidence: PurchasePartyCanonicalEvidence[];
  activityCountsByPartyId: Record<string, { purchaseOrders: number; supplierPayments: number; partyCreditEntries: number }>;
};

export type PurchasePartyDuplicateWarningGroup = {
  warningKey: string;
  parties: PurchaseParty[];
  canonicalPartyIds: string[];
  reason: 'Same normalized name only' | 'Similar name only';
};

export type PurchasePartyReferenceStatus =
  | 'ACTIVE_PARTY'
  | 'CANONICAL_PARTY'
  | 'MERGED_ALIAS'
  | 'HIDDEN_ALIAS'
  | 'MISSING_PARTY';

export type PurchasePartyOrphanMatchConfidence = 'HIGH' | 'MEDIUM' | 'AMBIGUOUS';

export type PurchasePartyOrphanRecoveryCandidate = {
  canonicalPartyId: string;
  canonicalPartyName: string;
  reason: 'Exact GST' | 'Phone + Name' | 'Name only warning';
  confidence: PurchasePartyOrphanMatchConfidence;
};

export type PurchasePartyReferenceClassification = {
  status: PurchasePartyReferenceStatus;
  partyId: string;
  canonicalPartyId: string;
  party: PurchaseParty | null;
  canonicalParty: PurchaseParty | null;
};

export type PurchasePartyOrphanGroup = {
  partyId: string;
  snapshotName: string;
  snapshotGst: string;
  snapshotPhone: string;
  status: 'MISSING PARTY MASTER';
  purchaseOrderCount: number;
  supplierPaymentCount: number;
  partyCreditCount: number;
  purchaseOrderTotalAmount: number;
  supplierPaymentTotalAmount: number;
  partyCreditTotalAmount: number;
  earliestOrderAt: string;
  latestOrderAt: string;
  earliestPaymentAt: string;
  latestPaymentAt: string;
  earliestCreditAt: string;
  latestCreditAt: string;
  possibleCanonical: PurchasePartyOrphanRecoveryCandidate | null;
  relatedPurchaseOrderIds: string[];
  relatedSupplierPaymentIds: string[];
  relatedPartyCreditIds: string[];
};

export type PurchasePartyDuplicateCheckReport = {
  canonicalView: PurchasePartyCanonicalView;
  totalRawParties: number;
  canonicalVisibleParties: number;
  hiddenDuplicateAliasParties: number;
  duplicateGroupsFound: number;
  mergedArchivedAliases: number;
  ambiguousSameNameGroups: number;
  groups: PurchasePartyDuplicateCheckGroup[];
  warnings: PurchasePartyDuplicateWarningGroup[];
  missingPurchaseOrderPartyIds: number;
  missingSupplierPaymentPartyIds: number;
  missingPartyCreditIds: number;
  uniqueOrphanPartyIds: number;
  potentiallyRecoverableOrphanIds: number;
  unresolvedOrphanIds: number;
  integrityIssueCount: number;
  orphanGroups: PurchasePartyOrphanGroup[];
  orphanPartyIdsBySource: {
    purchaseOrders: string[];
    supplierPayments: string[];
    partyCreditLedger: string[];
  };
  investigatedPartyId?: {
    partyId: string;
    exists: boolean;
    status: PurchasePartyReferenceStatus;
    canonicalPartyId: string;
    canonicalPartyName: string;
    mergedIntoPartyId: string;
    isDeleted: boolean;
    possibleCanonical: PurchasePartyOrphanRecoveryCandidate | null;
  };
};

const normalizeBasePartyName = (value?: string) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const normalizePurchasePartyNameForMatch = (value?: string) => normalizeBasePartyName(value)
  .replace(/[^a-z0-9\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const normalizePurchasePartyPhoneForMatch = (value?: string) => String(value || '').replace(/\D/g, '');
export const normalizePurchasePartyGstForMatch = (value?: string) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const hasIdentityDetail = (party: Pick<PurchasePartyIdentityDraft, 'phone' | 'gst' | 'location' | 'contactPerson'>) => (
  Boolean(normalizePurchasePartyPhoneForMatch(party.phone))
  || Boolean(normalizePurchasePartyGstForMatch(party.gst))
  || Boolean(String(party.location || '').trim())
  || Boolean(String(party.contactPerson || '').trim())
);

const asCreatedAtMs = (value?: string) => {
  const ms = new Date(String(value || '')).getTime();
  return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
};

const addEdge = (graph: Map<string, Set<string>>, aId: string, bId: string) => {
  if (!aId || !bId || aId === bId) return;
  if (!graph.has(aId)) graph.set(aId, new Set());
  if (!graph.has(bId)) graph.set(bId, new Set());
  graph.get(aId)!.add(bId);
  graph.get(bId)!.add(aId);
};

const addEvidence = (
  evidenceByPair: Map<string, Set<PurchasePartyCanonicalEvidence>>,
  aId: string,
  bId: string,
  evidence: PurchasePartyCanonicalEvidence,
) => {
  if (!aId || !bId || aId === bId) return;
  const key = [aId, bId].sort().join('::');
  if (!evidenceByPair.has(key)) evidenceByPair.set(key, new Set());
  evidenceByPair.get(key)!.add(evidence);
};

const getPairKey = (aId: string, bId: string) => [aId, bId].sort().join('::');

const normalizeLoosePurchasePartyNameForWarning = (value?: string) => normalizePurchasePartyNameForMatch(value)
  .split(' ')
  .map((token) => token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token)
  .join(' ')
  .trim();

const arePartiesExactGstMatch = (a?: Pick<PurchaseParty, 'gst'> | null, b?: Pick<PurchaseParty, 'gst'> | null) => {
  const aGst = normalizePurchasePartyGstForMatch(a?.gst);
  const bGst = normalizePurchasePartyGstForMatch(b?.gst);
  return Boolean(aGst) && aGst === bGst;
};

const arePartiesPhoneAndNameMatch = (a?: Pick<PurchaseParty, 'phone' | 'name'> | null, b?: Pick<PurchaseParty, 'phone' | 'name'> | null) => {
  const aPhone = normalizePurchasePartyPhoneForMatch(a?.phone);
  const bPhone = normalizePurchasePartyPhoneForMatch(b?.phone);
  const aName = normalizePurchasePartyNameForMatch(a?.name);
  const bName = normalizePurchasePartyNameForMatch(b?.name);
  return Boolean(aPhone) && Boolean(aName) && aPhone === bPhone && aName === bName;
};

const toIsoOrEmpty = (value?: string) => String(value || '').trim();

const minDateString = (current: string, candidate?: string) => {
  const normalized = toIsoOrEmpty(candidate);
  if (!normalized) return current;
  if (!current) return normalized;
  return new Date(normalized).getTime() < new Date(current).getTime() ? normalized : current;
};

const maxDateString = (current: string, candidate?: string) => {
  const normalized = toIsoOrEmpty(candidate);
  if (!normalized) return current;
  if (!current) return normalized;
  return new Date(normalized).getTime() > new Date(current).getTime() ? normalized : current;
};

const getCanonicalRecoveryCandidate = (
  canonicalView: PurchasePartyCanonicalView,
  parties: PurchaseParty[],
  snapshot: { name?: string; gst?: string; phone?: string },
): PurchasePartyOrphanRecoveryCandidate | null => {
  const rawParties = (parties || []).filter(Boolean);
  const normalizedGst = normalizePurchasePartyGstForMatch(snapshot.gst);
  if (normalizedGst) {
    const candidateIds = [...new Set(
      rawParties
        .filter((party) => normalizePurchasePartyGstForMatch(party.gst) === normalizedGst)
        .map((party) => canonicalView.partyIdToCanonicalId.get(String(party.id || '').trim()) || String(party.id || '').trim())
        .filter(Boolean),
    )];
    if (candidateIds.length === 1) {
      const canonicalParty = canonicalView.canonicalPartyById.get(candidateIds[0]) || rawParties.find((party) => party.id === candidateIds[0]) || null;
      if (canonicalParty) {
        return {
          canonicalPartyId: canonicalParty.id,
          canonicalPartyName: canonicalParty.name || canonicalParty.id,
          reason: 'Exact GST',
          confidence: 'HIGH',
        };
      }
    }
  }

  const normalizedPhone = normalizePurchasePartyPhoneForMatch(snapshot.phone);
  const normalizedName = normalizePurchasePartyNameForMatch(snapshot.name);
  if (normalizedPhone && normalizedName) {
    const candidateIds = [...new Set(
      rawParties
        .filter((party) => (
          normalizePurchasePartyPhoneForMatch(party.phone) === normalizedPhone
          && normalizePurchasePartyNameForMatch(party.name) === normalizedName
        ))
        .map((party) => canonicalView.partyIdToCanonicalId.get(String(party.id || '').trim()) || String(party.id || '').trim())
        .filter(Boolean),
    )];
    if (candidateIds.length === 1) {
      const canonicalParty = canonicalView.canonicalPartyById.get(candidateIds[0]) || rawParties.find((party) => party.id === candidateIds[0]) || null;
      if (canonicalParty) {
        return {
          canonicalPartyId: canonicalParty.id,
          canonicalPartyName: canonicalParty.name || canonicalParty.id,
          reason: 'Phone + Name',
          confidence: 'MEDIUM',
        };
      }
    }
  }

  if (normalizedName) {
    const candidateIds = [...new Set(
      rawParties
        .filter((party) => normalizePurchasePartyNameForMatch(party.name) === normalizedName)
        .map((party) => canonicalView.partyIdToCanonicalId.get(String(party.id || '').trim()) || String(party.id || '').trim())
        .filter(Boolean),
    )];
    if (candidateIds.length >= 1) {
      const canonicalParty = canonicalView.canonicalPartyById.get(candidateIds[0]) || rawParties.find((party) => party.id === candidateIds[0]) || null;
      if (canonicalParty) {
        return {
          canonicalPartyId: canonicalParty.id,
          canonicalPartyName: canonicalParty.name || canonicalParty.id,
          reason: 'Name only warning',
          confidence: 'AMBIGUOUS',
        };
      }
    }
  }

  return null;
};

export const classifyPurchasePartyReference = (
  canonicalView: PurchasePartyCanonicalView,
  parties: PurchaseParty[],
  partyId?: string | null,
): PurchasePartyReferenceClassification => {
  const normalizedPartyId = String(partyId || '').trim();
  const rawPartyById = new Map((parties || []).filter(Boolean).map((party) => [String(party.id || '').trim(), party]));
  const party = normalizedPartyId ? rawPartyById.get(normalizedPartyId) || null : null;
  if (!normalizedPartyId || !party) {
    return {
      status: 'MISSING_PARTY',
      partyId: normalizedPartyId,
      canonicalPartyId: '',
      party: null,
      canonicalParty: null,
    };
  }

  const canonicalPartyId = canonicalView.partyIdToCanonicalId.get(normalizedPartyId) || normalizedPartyId;
  const canonicalParty = canonicalView.canonicalPartyById.get(canonicalPartyId) || rawPartyById.get(canonicalPartyId) || null;
  const mergedIntoPartyId = String(party.mergedIntoPartyId || '').trim();
  let status: PurchasePartyReferenceStatus = 'ACTIVE_PARTY';
  if (normalizedPartyId === canonicalPartyId) {
    status = canonicalParty && !canonicalParty.isDeleted ? 'CANONICAL_PARTY' : 'ACTIVE_PARTY';
  } else if (party.isDeleted && mergedIntoPartyId) {
    status = 'MERGED_ALIAS';
  } else if (canonicalView.hiddenPartyIds.has(normalizedPartyId)) {
    status = 'HIDDEN_ALIAS';
  }

  return {
    status,
    partyId: normalizedPartyId,
    canonicalPartyId,
    party,
    canonicalParty,
  };
};

const countPartyReferences = (activity: PurchasePartyCanonicalActivity, partyId: string) => {
  const purchaseOrders = (activity.purchaseOrders || []).filter((order) => String(order.partyId || '').trim() === partyId).length;
  const supplierPayments = (activity.supplierPayments || []).filter((payment) => !payment.deletedAt && String(payment.partyId || '').trim() === partyId).length;
  const partyCreditLedger = (activity.partyCreditLedger || []).filter((entry) => String(entry.partyId || '').trim() === partyId).length;
  return purchaseOrders + supplierPayments + partyCreditLedger;
};

const chooseCanonicalPartyId = (
  component: PurchaseParty[],
  refCounts: Map<string, number>,
): string => {
  const byId = new Map(component.map((party) => [party.id, party]));
  const explicitTargets = component
    .map((party) => String(party.mergedIntoPartyId || '').trim())
    .filter((partyId) => partyId && byId.has(partyId))
    .map((partyId) => byId.get(partyId)!)
    .filter((party, index, arr) => arr.findIndex((item) => item.id === party.id) === index);

  if (explicitTargets.length) {
    return explicitTargets
      .slice()
      .sort((a, b) => asCreatedAtMs(a.createdAt) - asCreatedAtMs(b.createdAt) || String(a.id).localeCompare(String(b.id)))[0].id;
  }

  const active = component.filter((party) => !party?.isDeleted);
  if (active.length) {
    return active
      .slice()
      .sort((a, b) => {
        const byAge = asCreatedAtMs(a.createdAt) - asCreatedAtMs(b.createdAt);
        if (byAge !== 0) return byAge;
        const byRefs = (refCounts.get(b.id) || 0) - (refCounts.get(a.id) || 0);
        if (byRefs !== 0) return byRefs;
        return String(a.id).localeCompare(String(b.id));
      })[0].id;
  }

  return component
    .slice()
    .sort((a, b) => {
      const byRefs = (refCounts.get(b.id) || 0) - (refCounts.get(a.id) || 0);
      if (byRefs !== 0) return byRefs;
      const byAge = asCreatedAtMs(a.createdAt) - asCreatedAtMs(b.createdAt);
      if (byAge !== 0) return byAge;
      return String(a.id).localeCompare(String(b.id));
    })[0]?.id || '';
};

export const buildPurchasePartyCanonicalView = (
  parties: PurchaseParty[],
  activity: PurchasePartyCanonicalActivity = {},
): PurchasePartyCanonicalView => {
  const allParties = (parties || []).filter(Boolean);
  const byId = new Map(allParties.map((party) => [String(party.id || '').trim(), party]));
  const graph = new Map<string, Set<string>>();
  const evidenceByPair = new Map<string, Set<PurchasePartyCanonicalEvidence>>();
  const refCounts = new Map<string, number>();

  allParties.forEach((party) => {
    const partyId = String(party.id || '').trim();
    if (!partyId) return;
    graph.set(partyId, graph.get(partyId) || new Set());
    refCounts.set(partyId, countPartyReferences(activity, partyId));
    const mergedIntoPartyId = String(party.mergedIntoPartyId || '').trim();
    if (mergedIntoPartyId && byId.has(mergedIntoPartyId)) {
      addEdge(graph, partyId, mergedIntoPartyId);
      addEvidence(evidenceByPair, partyId, mergedIntoPartyId, 'merged');
    }
  });

  const partiesByGst = new Map<string, PurchaseParty[]>();
  const partiesByPhoneAndName = new Map<string, PurchaseParty[]>();
  allParties.forEach((party) => {
    const normalizedGst = normalizePurchasePartyGstForMatch(party.gst);
    const normalizedPhone = normalizePurchasePartyPhoneForMatch(party.phone);
    const normalizedName = normalizePurchasePartyNameForMatch(party.name);
    if (normalizedGst) partiesByGst.set(normalizedGst, [...(partiesByGst.get(normalizedGst) || []), party]);
    if (normalizedPhone && normalizedName) {
      const key = `${normalizedPhone}::${normalizedName}`;
      partiesByPhoneAndName.set(key, [...(partiesByPhoneAndName.get(key) || []), party]);
    }
  });

  partiesByGst.forEach((group) => {
    if (group.length < 2) return;
    for (let index = 0; index < group.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < group.length; compareIndex += 1) {
        addEdge(graph, group[index].id, group[compareIndex].id);
        addEvidence(evidenceByPair, group[index].id, group[compareIndex].id, 'gst');
      }
    }
  });

  partiesByPhoneAndName.forEach((group) => {
    if (group.length < 2) return;
    for (let index = 0; index < group.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < group.length; compareIndex += 1) {
        addEdge(graph, group[index].id, group[compareIndex].id);
        addEvidence(evidenceByPair, group[index].id, group[compareIndex].id, 'phone_name');
      }
    }
  });

  const partyIdToCanonicalId = new Map<string, string>();
  const canonicalIdToRelatedIds = new Map<string, string[]>();
  const canonicalIdToEvidence = new Map<string, Set<PurchasePartyCanonicalEvidence>>();
  const canonicalPartyById = new Map<string, PurchaseParty>();
  const hiddenPartyIds = new Set<string>();
  const visited = new Set<string>();

  allParties.forEach((party) => {
    const startId = String(party.id || '').trim();
    if (!startId || visited.has(startId)) return;
    const queue = [startId];
    const componentIds: string[] = [];

    while (queue.length) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);
      componentIds.push(currentId);
      (graph.get(currentId) || []).forEach((neighborId) => {
        if (!visited.has(neighborId)) queue.push(neighborId);
      });
    }

    const component = componentIds.map((id) => byId.get(id)).filter((item): item is PurchaseParty => Boolean(item));
    if (!component.length) return;

    const canonicalId = chooseCanonicalPartyId(component, refCounts);
    const relatedIds = component
      .map((item) => String(item.id || '').trim())
      .filter(Boolean)
      .sort((a, b) => {
        const aParty = byId.get(a);
        const bParty = byId.get(b);
        return asCreatedAtMs(aParty?.createdAt) - asCreatedAtMs(bParty?.createdAt) || a.localeCompare(b);
      });

    const componentEvidence = new Set<PurchasePartyCanonicalEvidence>(['self']);
    relatedIds.forEach((id, index) => {
      partyIdToCanonicalId.set(id, canonicalId);
      if (id !== canonicalId) hiddenPartyIds.add(id);
      for (let compareIndex = index + 1; compareIndex < relatedIds.length; compareIndex += 1) {
        (evidenceByPair.get(getPairKey(id, relatedIds[compareIndex])) || []).forEach((evidence) => componentEvidence.add(evidence));
      }
    });
    canonicalIdToRelatedIds.set(canonicalId, relatedIds);
    canonicalIdToEvidence.set(canonicalId, componentEvidence);
    const canonicalParty = byId.get(canonicalId);
    if (canonicalParty && !canonicalParty.isDeleted) {
      canonicalPartyById.set(canonicalId, canonicalParty);
    }
  });

  allParties.forEach((party) => {
    const partyId = String(party.id || '').trim();
    if (!partyIdToCanonicalId.has(partyId)) {
      partyIdToCanonicalId.set(partyId, partyId);
      canonicalIdToRelatedIds.set(partyId, [partyId]);
      canonicalIdToEvidence.set(partyId, new Set<PurchasePartyCanonicalEvidence>(['self']));
      if (!party.isDeleted) canonicalPartyById.set(partyId, party);
    }
  });

  const visibleParties = [...canonicalPartyById.values()].sort((a, b) => {
    const byName = String(a.name || '').localeCompare(String(b.name || ''));
    if (byName !== 0) return byName;
    return asCreatedAtMs(a.createdAt) - asCreatedAtMs(b.createdAt);
  });

  return {
    visibleParties,
    canonicalPartyById,
    partyIdToCanonicalId,
    canonicalIdToRelatedIds,
    canonicalIdToEvidence,
    hiddenPartyIds,
  };
};

export const buildPurchasePartyDuplicateCheckReport = (
  parties: PurchaseParty[],
  activity: PurchasePartyCanonicalActivity = {},
): PurchasePartyDuplicateCheckReport => {
  const canonicalView = buildPurchasePartyCanonicalView(parties, activity);
  const rawParties = (parties || []).filter(Boolean);
  const partiesById = new Map(rawParties.map((party) => [String(party.id || '').trim(), party]));
  const purchaseOrderCountByPartyId = new Map<string, number>();
  const supplierPaymentCountByPartyId = new Map<string, number>();
  const partyCreditCountByPartyId = new Map<string, number>();

  (activity.purchaseOrders || []).forEach((order) => {
    const partyId = String(order.partyId || '').trim();
    if (!partyId) return;
    purchaseOrderCountByPartyId.set(partyId, (purchaseOrderCountByPartyId.get(partyId) || 0) + 1);
  });
  (activity.supplierPayments || []).forEach((payment) => {
    if (payment.deletedAt) return;
    const partyId = String(payment.partyId || '').trim();
    if (!partyId) return;
    supplierPaymentCountByPartyId.set(partyId, (supplierPaymentCountByPartyId.get(partyId) || 0) + 1);
  });
  (activity.partyCreditLedger || []).forEach((entry) => {
    const partyId = String(entry.partyId || '').trim();
    if (!partyId) return;
    partyCreditCountByPartyId.set(partyId, (partyCreditCountByPartyId.get(partyId) || 0) + 1);
  });

  const groups = [...canonicalView.canonicalIdToRelatedIds.entries()]
    .filter(([, relatedPartyIds]) => relatedPartyIds.length > 1)
    .map(([canonicalPartyId, relatedPartyIds]): PurchasePartyDuplicateCheckGroup => {
      const canonicalParty = partiesById.get(canonicalPartyId) || canonicalView.canonicalPartyById.get(canonicalPartyId) || null;
      const relatedParties = relatedPartyIds
        .map((partyId) => partiesById.get(partyId))
        .filter((party): party is PurchaseParty => Boolean(party));
      const aliases = relatedParties
        .filter((party) => party.id !== canonicalPartyId)
        .map((party): PurchasePartyDuplicateCheckAlias => {
          const mergedIntoPartyId = String(party.mergedIntoPartyId || '').trim() || undefined;

          let matchReason: PurchasePartyDuplicateCheckMatchReason = 'Phone + Name';
          if (mergedIntoPartyId && relatedPartyIds.includes(mergedIntoPartyId)) {
            matchReason = 'Merged into canonical';
          } else if (arePartiesExactGstMatch(canonicalParty, party) || relatedParties.some((relatedParty) => relatedParty.id !== party.id && arePartiesExactGstMatch(relatedParty, party))) {
            matchReason = 'Exact GST';
          } else if (arePartiesPhoneAndNameMatch(canonicalParty, party) || relatedParties.some((relatedParty) => relatedParty.id !== party.id && arePartiesPhoneAndNameMatch(relatedParty, party))) {
            matchReason = 'Phone + Name';
          }

          let status: PurchasePartyDuplicateCheckStatus = 'Active duplicate alias';
          if (party.isDeleted && mergedIntoPartyId) {
            status = 'Already merged';
          } else if (canonicalView.hiddenPartyIds.has(party.id)) {
            status = party.isDeleted ? 'Already merged' : 'Hidden by canonical layer';
          }

          return {
            canonicalPartyId,
            canonicalPartyName: canonicalParty?.name || canonicalPartyId,
            duplicatePartyId: party.id,
            duplicatePartyName: party.name,
            matchReason,
            status,
            isDeleted: Boolean(party.isDeleted),
            mergedIntoPartyId,
          };
        });
      const activityCountsByPartyId = relatedParties.reduce<Record<string, { purchaseOrders: number; supplierPayments: number; partyCreditEntries: number }>>((acc, party) => {
        acc[party.id] = {
          purchaseOrders: purchaseOrderCountByPartyId.get(party.id) || 0,
          supplierPayments: supplierPaymentCountByPartyId.get(party.id) || 0,
          partyCreditEntries: partyCreditCountByPartyId.get(party.id) || 0,
        };
        return acc;
      }, {});

      return {
        canonicalPartyId,
        canonicalPartyName: canonicalParty?.name || canonicalPartyId,
        canonicalParty,
        relatedPartyIds,
        relatedParties,
        aliases,
        evidence: [...(canonicalView.canonicalIdToEvidence.get(canonicalPartyId) || new Set<PurchasePartyCanonicalEvidence>())],
        activityCountsByPartyId,
      };
    });

  const exactNameWarnings = new Map<string, PurchaseParty[]>();
  const looseNameWarnings = new Map<string, PurchaseParty[]>();
  rawParties.forEach((party) => {
    const exactName = normalizePurchasePartyNameForMatch(party.name);
    const looseName = normalizeLoosePurchasePartyNameForWarning(party.name);
    if (exactName) exactNameWarnings.set(exactName, [...(exactNameWarnings.get(exactName) || []), party]);
    if (looseName) looseNameWarnings.set(looseName, [...(looseNameWarnings.get(looseName) || []), party]);
  });

  const warningsByKey = new Map<string, PurchasePartyDuplicateWarningGroup>();
  exactNameWarnings.forEach((warningParties, warningKey) => {
    const canonicalIds = [...new Set(warningParties.map((party) => canonicalView.partyIdToCanonicalId.get(party.id) || party.id))];
    if (warningParties.length < 2 || canonicalIds.length < 2) return;
    warningsByKey.set(`exact:${warningKey}`, {
      warningKey: `exact:${warningKey}`,
      parties: warningParties.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')) || String(a.id).localeCompare(String(b.id))),
      canonicalPartyIds: canonicalIds,
      reason: 'Same normalized name only',
    });
  });
  looseNameWarnings.forEach((warningParties, warningKey) => {
    const canonicalIds = [...new Set(warningParties.map((party) => canonicalView.partyIdToCanonicalId.get(party.id) || party.id))];
    const exactNames = [...new Set(warningParties.map((party) => normalizePurchasePartyNameForMatch(party.name)).filter(Boolean))];
    if (warningParties.length < 2 || canonicalIds.length < 2 || exactNames.length < 2) return;
    warningsByKey.set(`loose:${warningKey}`, {
      warningKey: `loose:${warningKey}`,
      parties: warningParties.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')) || String(a.id).localeCompare(String(b.id))),
      canonicalPartyIds: canonicalIds,
      reason: 'Similar name only',
    });
  });

  const orphanGroupsByPartyId = new Map<string, PurchasePartyOrphanGroup>();
  const missingPurchaseOrderPartyIds = new Set<string>();
  const missingSupplierPaymentPartyIds = new Set<string>();
  const missingPartyCreditIds = new Set<string>();

  const getOrCreateOrphanGroup = (partyId: string, snapshot: { name?: string; gst?: string; phone?: string }) => {
    const normalizedPartyId = String(partyId || '').trim();
    if (!orphanGroupsByPartyId.has(normalizedPartyId)) {
      orphanGroupsByPartyId.set(normalizedPartyId, {
        partyId: normalizedPartyId,
        snapshotName: String(snapshot.name || '').trim(),
        snapshotGst: String(snapshot.gst || '').trim(),
        snapshotPhone: String(snapshot.phone || '').trim(),
        status: 'MISSING PARTY MASTER',
        purchaseOrderCount: 0,
        supplierPaymentCount: 0,
        partyCreditCount: 0,
        purchaseOrderTotalAmount: 0,
        supplierPaymentTotalAmount: 0,
        partyCreditTotalAmount: 0,
        earliestOrderAt: '',
        latestOrderAt: '',
        earliestPaymentAt: '',
        latestPaymentAt: '',
        earliestCreditAt: '',
        latestCreditAt: '',
        possibleCanonical: null,
        relatedPurchaseOrderIds: [],
        relatedSupplierPaymentIds: [],
        relatedPartyCreditIds: [],
      });
    }
    const current = orphanGroupsByPartyId.get(normalizedPartyId)!;
    if (!current.snapshotName && snapshot.name) current.snapshotName = String(snapshot.name || '').trim();
    if (!current.snapshotGst && snapshot.gst) current.snapshotGst = String(snapshot.gst || '').trim();
    if (!current.snapshotPhone && snapshot.phone) current.snapshotPhone = String(snapshot.phone || '').trim();
    return current;
  };

  (activity.purchaseOrders || []).forEach((order) => {
    const classification = classifyPurchasePartyReference(canonicalView, rawParties, order.partyId);
    if (classification.status !== 'MISSING_PARTY') return;
    const orphanGroup = getOrCreateOrphanGroup(String(order.partyId || '').trim(), {
      name: order.partyName,
      gst: order.partyGst,
      phone: order.partyPhone,
    });
    missingPurchaseOrderPartyIds.add(orphanGroup.partyId);
    orphanGroup.purchaseOrderCount += 1;
    orphanGroup.purchaseOrderTotalAmount = Number((orphanGroup.purchaseOrderTotalAmount + Math.max(0, Number(order.totalAmount || 0))).toFixed(2));
    orphanGroup.earliestOrderAt = minDateString(orphanGroup.earliestOrderAt, order.orderDate || order.createdAt);
    orphanGroup.latestOrderAt = maxDateString(orphanGroup.latestOrderAt, order.orderDate || order.createdAt);
    if (order.id) orphanGroup.relatedPurchaseOrderIds = [...new Set([...orphanGroup.relatedPurchaseOrderIds, order.id])];
  });

  (activity.supplierPayments || []).forEach((payment) => {
    if (payment.deletedAt) return;
    const classification = classifyPurchasePartyReference(canonicalView, rawParties, payment.partyId);
    if (classification.status !== 'MISSING_PARTY') return;
    const orphanGroup = getOrCreateOrphanGroup(String(payment.partyId || '').trim(), {
      name: payment.partyName,
    });
    missingSupplierPaymentPartyIds.add(orphanGroup.partyId);
    orphanGroup.supplierPaymentCount += 1;
    orphanGroup.supplierPaymentTotalAmount = Number((orphanGroup.supplierPaymentTotalAmount + Math.max(0, Number(payment.amount || 0))).toFixed(2));
    orphanGroup.earliestPaymentAt = minDateString(orphanGroup.earliestPaymentAt, payment.effectiveAt || payment.paidAt || payment.createdAt);
    orphanGroup.latestPaymentAt = maxDateString(orphanGroup.latestPaymentAt, payment.effectiveAt || payment.paidAt || payment.createdAt);
    if (payment.id) orphanGroup.relatedSupplierPaymentIds = [...new Set([...orphanGroup.relatedSupplierPaymentIds, payment.id])];
  });

  (activity.partyCreditLedger || []).forEach((entry) => {
    const classification = classifyPurchasePartyReference(canonicalView, rawParties, entry.partyId);
    if (classification.status !== 'MISSING_PARTY') return;
    const orphanGroup = getOrCreateOrphanGroup(String(entry.partyId || '').trim(), {
      name: entry.partyName,
    });
    missingPartyCreditIds.add(orphanGroup.partyId);
    orphanGroup.partyCreditCount += 1;
    orphanGroup.partyCreditTotalAmount = Number((orphanGroup.partyCreditTotalAmount + Math.max(0, Number(entry.amountCreated || 0))).toFixed(2));
    orphanGroup.earliestCreditAt = minDateString(orphanGroup.earliestCreditAt, entry.createdAt || entry.paidAt);
    orphanGroup.latestCreditAt = maxDateString(orphanGroup.latestCreditAt, entry.updatedAt || entry.createdAt || entry.paidAt);
    if (entry.id) orphanGroup.relatedPartyCreditIds = [...new Set([...orphanGroup.relatedPartyCreditIds, entry.id])];
  });

  const orphanGroups = [...orphanGroupsByPartyId.values()]
    .map((group) => ({
      ...group,
      possibleCanonical: getCanonicalRecoveryCandidate(canonicalView, rawParties, {
        name: group.snapshotName,
        gst: group.snapshotGst,
        phone: group.snapshotPhone,
      }),
    }))
    .sort((a, b) => {
      const byOrders = b.purchaseOrderCount - a.purchaseOrderCount;
      if (byOrders !== 0) return byOrders;
      return a.partyId.localeCompare(b.partyId);
    });

  const potentiallyRecoverableOrphanIds = orphanGroups.filter((group) => group.possibleCanonical && group.possibleCanonical.confidence !== 'AMBIGUOUS').length;
  const unresolvedOrphanIds = orphanGroups.filter((group) => !group.possibleCanonical || group.possibleCanonical.confidence === 'AMBIGUOUS').length;
  const investigatedPartyId = 'party-1777736290060-44731';
  const investigatedClassification = classifyPurchasePartyReference(canonicalView, rawParties, investigatedPartyId);
  const investigatedOrphan = orphanGroups.find((group) => group.partyId === investigatedPartyId) || null;

  return {
    canonicalView,
    totalRawParties: rawParties.length,
    canonicalVisibleParties: canonicalView.visibleParties.length,
    hiddenDuplicateAliasParties: canonicalView.hiddenPartyIds.size,
    duplicateGroupsFound: groups.length,
    mergedArchivedAliases: rawParties.filter((party) => Boolean(party.isDeleted) && Boolean(String(party.mergedIntoPartyId || '').trim())).length,
    ambiguousSameNameGroups: warningsByKey.size,
    groups,
    warnings: [...warningsByKey.values()],
    missingPurchaseOrderPartyIds: missingPurchaseOrderPartyIds.size,
    missingSupplierPaymentPartyIds: missingSupplierPaymentPartyIds.size,
    missingPartyCreditIds: missingPartyCreditIds.size,
    uniqueOrphanPartyIds: orphanGroups.length,
    potentiallyRecoverableOrphanIds,
    unresolvedOrphanIds,
    integrityIssueCount: groups.length + orphanGroups.length,
    orphanGroups,
    orphanPartyIdsBySource: {
      purchaseOrders: [...missingPurchaseOrderPartyIds].sort(),
      supplierPayments: [...missingSupplierPaymentPartyIds].sort(),
      partyCreditLedger: [...missingPartyCreditIds].sort(),
    },
    investigatedPartyId: {
      partyId: investigatedPartyId,
      exists: Boolean(investigatedClassification.party),
      status: investigatedClassification.status,
      canonicalPartyId: investigatedClassification.canonicalPartyId,
      canonicalPartyName: investigatedClassification.canonicalParty?.name || investigatedClassification.canonicalPartyId || '',
      mergedIntoPartyId: String(investigatedClassification.party?.mergedIntoPartyId || '').trim(),
      isDeleted: Boolean(investigatedClassification.party?.isDeleted),
      possibleCanonical: investigatedOrphan?.possibleCanonical || null,
    },
  };
};

export const resolvePurchasePartyCanonicalId = (
  parties: PurchaseParty[],
  partyId?: string | null,
  activity: PurchasePartyCanonicalActivity = {},
) => {
  const normalizedId = String(partyId || '').trim();
  if (!normalizedId) return '';
  const view = buildPurchasePartyCanonicalView(parties, activity);
  return view.partyIdToCanonicalId.get(normalizedId) || normalizedId;
};

export const resolveCanonicalPurchasePartyForDraft = (
  parties: PurchaseParty[],
  draft: PurchasePartyIdentityDraft,
  activity: PurchasePartyCanonicalActivity = {},
): PurchaseParty | null => {
  const explicitId = String(draft.id || '').trim();
  const view = buildPurchasePartyCanonicalView(parties, activity);
  if (explicitId) {
    const canonicalId = view.partyIdToCanonicalId.get(explicitId) || explicitId;
    return view.canonicalPartyById.get(canonicalId) || parties.find((party) => party.id === canonicalId) || null;
  }

  const resolution = resolvePurchasePartyIdentity(parties, draft);
  if (resolution.status !== 'matched') return null;
  const canonicalId = view.partyIdToCanonicalId.get(resolution.party.id) || resolution.party.id;
  return view.canonicalPartyById.get(canonicalId) || parties.find((party) => party.id === canonicalId) || resolution.party;
};

export const resolvePurchasePartyIdentity = (
  parties: PurchaseParty[],
  draft: PurchasePartyIdentityDraft,
): PurchasePartyResolution => {
  const visibleParties = (parties || []).filter((party) => !party?.isDeleted);
  const explicitId = String(draft.id || '').trim();
  if (explicitId) {
    const byId = visibleParties.find((party) => party.id === explicitId);
    if (byId) {
      return { status: 'matched', party: byId, reason: 'id', candidates: [byId] };
    }
  }

  const normalizedGst = normalizePurchasePartyGstForMatch(draft.gst);
  if (normalizedGst) {
    const gstMatches = visibleParties.filter((party) => normalizePurchasePartyGstForMatch(party.gst) === normalizedGst);
    if (gstMatches.length === 1) {
      return { status: 'matched', party: gstMatches[0], reason: 'gst', candidates: gstMatches };
    }
  }

  const normalizedPhone = normalizePurchasePartyPhoneForMatch(draft.phone);
  if (normalizedPhone) {
    const phoneMatches = visibleParties.filter((party) => normalizePurchasePartyPhoneForMatch(party.phone) === normalizedPhone);
    if (phoneMatches.length === 1) {
      return { status: 'matched', party: phoneMatches[0], reason: 'phone', candidates: phoneMatches };
    }
  }

  const normalizedName = normalizePurchasePartyNameForMatch(draft.name);
  if (!normalizedName) {
    return { status: 'none', candidates: [] };
  }

  const nameMatches = visibleParties.filter((party) => normalizePurchasePartyNameForMatch(party.name) === normalizedName);
  if (nameMatches.length > 1) {
    const withIdentity = nameMatches.filter((party) => hasIdentityDetail(party));
    if (withIdentity.length === 1 && nameMatches.every((party) => party.id === withIdentity[0].id || !hasIdentityDetail(party))) {
      return { status: 'ambiguous', reason: 'name', candidates: nameMatches };
    }
    return { status: 'ambiguous', reason: 'name', candidates: nameMatches };
  }

  return { status: 'none', candidates: [] };
};

export const mergePurchasePartyMasterData = (
  party: PurchaseParty,
  draft: PurchasePartyIdentityDraft,
): PurchaseParty => {
  const nextParty: PurchaseParty = { ...party };
  const maybeFill = <K extends keyof PurchaseParty>(key: K, value: PurchaseParty[K]) => {
    const current = String(nextParty[key] || '').trim();
    const incoming = String(value || '').trim();
    if (!current && incoming) {
      (nextParty[key] as PurchaseParty[K]) = value;
    }
  };

  maybeFill('phone', draft.phone?.trim() || undefined);
  maybeFill('gst', draft.gst?.trim() || undefined);
  maybeFill('location', draft.location?.trim() || undefined);
  maybeFill('contactPerson', draft.contactPerson?.trim() || undefined);
  maybeFill('notes', draft.notes?.trim() || undefined);

  return nextParty;
};
