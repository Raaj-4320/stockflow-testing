import {
  ArrayMaxSize,
  IsArray,
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

export class CreateProductStockRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  variant!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  color!: string;

  @IsNumber()
  @Min(0)
  stock!: number;
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  barcode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  category!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @IsNumber()
  @Min(0)
  buyPrice!: number;

  @IsNumber()
  @Min(0)
  sellPrice!: number;

  @IsNumber()
  @Min(0)
  stock!: number;

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
}
