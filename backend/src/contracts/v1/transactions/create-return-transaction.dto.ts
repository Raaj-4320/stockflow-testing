import { IsArray, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import {
  ReturnHandlingPayloadDto,
  TransactionMutationLineItemDto,
  TransactionSettlementPayloadDto,
} from './mutation-common.dto';

export class CreateReturnTransactionDto {
  @IsString()
  @MaxLength(120)
  sourceTransactionId!: string;

  @IsOptional()
  @IsNumber()
  expectedSourceVersion?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionMutationLineItemDto)
  items!: TransactionMutationLineItemDto[];

  @ValidateNested()
  @Type(() => ReturnHandlingPayloadDto)
  returnHandling!: ReturnHandlingPayloadDto;

  @ValidateNested()
  @Type(() => TransactionSettlementPayloadDto)
  settlement!: TransactionSettlementPayloadDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
