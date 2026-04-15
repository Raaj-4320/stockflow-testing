import { IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { TransactionSettlementPayloadDto } from './mutation-common.dto';

export class CreatePaymentTransactionDto {
  @IsString()
  @MaxLength(120)
  customerId!: string;

  @IsNumber()
  @Min(0.000001)
  amount!: number;

  @ValidateNested()
  @Type(() => TransactionSettlementPayloadDto)
  settlement!: TransactionSettlementPayloadDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
