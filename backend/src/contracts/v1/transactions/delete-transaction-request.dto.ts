import { IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { DeleteCompensationPayloadDto } from './mutation-common.dto';

export class DeleteTransactionRequestDto {
  @IsString()
  @MaxLength(120)
  transactionId!: string;

  @IsNumber()
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ValidateNested()
  @Type(() => DeleteCompensationPayloadDto)
  compensation!: DeleteCompensationPayloadDto;
}
