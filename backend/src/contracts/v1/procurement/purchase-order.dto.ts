import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class PurchaseOrderLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  productName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  productId?: string;

  @IsEnum(['inventory', 'new'])
  sourceType!: 'inventory' | 'new';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  variant?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pendingProductBarcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  image?: string;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  partyId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  billNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  billDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstPercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdatePurchaseOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id!: string;

  @IsOptional()
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  partyId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines?: PurchaseOrderLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  billNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  billDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstPercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ListPurchaseOrdersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(['draft', 'placed', 'received', 'cancelled'])
  status?: 'draft' | 'placed' | 'received' | 'cancelled';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  partyId?: string;
}

export class PurchaseOrderDto {
  id!: string;
  storeId!: string;
  partyId!: string;
  partyName!: string;
  status!: 'draft' | 'placed' | 'received' | 'cancelled';
  orderDate!: string;
  billNumber!: string | null;
  billDate!: string | null;
  gstPercent!: number;
  lines!: PurchaseOrderLineDto[];
  totalQuantity!: number;
  totalAmount!: number;
  notes!: string | null;
  receivedQuantity!: number;
  createdAt!: string;
  updatedAt!: string;
  version!: number;
}

export class PurchaseOrderResponseDto {
  order!: PurchaseOrderDto;
}

export class PurchaseOrderListResponseDto {
  items!: PurchaseOrderDto[];
}
