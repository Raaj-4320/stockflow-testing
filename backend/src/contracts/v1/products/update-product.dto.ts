import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { CreateProductStockRowDto } from './create-product.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  barcode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  buyPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  variants?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateProductStockRowDto)
  stockByVariantColor?: CreateProductStockRowDto[];

  @IsOptional()
  @IsBoolean()
  archive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedVersion?: number;
}
