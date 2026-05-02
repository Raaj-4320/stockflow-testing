import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePurchasePartyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  gst?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdatePurchasePartyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id!: string;

  @IsOptional()
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  gst?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  archive?: boolean;
}

export class ListPurchasePartiesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}

export class PurchasePartyDto {
  id!: string;
  storeId!: string;
  name!: string;
  phone!: string | null;
  gst!: string | null;
  location!: string | null;
  contactPerson!: string | null;
  notes!: string | null;
  isArchived!: boolean;
  archivedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
  version!: number;
}

export class PurchasePartyResponseDto {
  party!: PurchasePartyDto;
}

export class PurchasePartyListResponseDto {
  items!: PurchasePartyDto[];
}
