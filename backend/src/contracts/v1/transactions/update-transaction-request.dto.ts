import { IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTransactionRequestDto {
  @IsString()
  @MaxLength(120)
  transactionId!: string;

  @IsNumber()
  expectedVersion!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  patch?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
