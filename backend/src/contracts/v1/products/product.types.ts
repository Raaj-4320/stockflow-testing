export type ProductStockRowDto = {
  variant: string;
  color: string;
  stock: number;
};

export type ProductDto = {
  id: string;
  storeId: string;
  name: string;
  barcode: string;
  category: string;
  imageUrl: string | null;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  variants: string[];
  colors: string[];
  stockByVariantColor: ProductStockRowDto[];
  isArchived: boolean;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
