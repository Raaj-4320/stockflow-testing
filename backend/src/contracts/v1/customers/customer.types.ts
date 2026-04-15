export type CustomerDto = {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  dueBalance: number;
  storeCreditBalance: number;
  isArchived: boolean;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
