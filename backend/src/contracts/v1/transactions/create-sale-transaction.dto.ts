import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import {
  TransactionMutationLineItemDto,
  TransactionSettlementPayloadDto,
} from './mutation-common.dto';

export class CreateSaleTransactionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionMutationLineItemDto)
  items!: TransactionMutationLineItemDto[];

  @ValidateNested()
  @Type(() => TransactionSettlementPayloadDto)
  settlement!: TransactionSettlementPayloadDto;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
