import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReceivePurchaseOrderRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  orderId!: string;

  @IsOptional()
  expectedVersion?: number;

  @IsEnum(['avg_method_1', 'avg_method_2', 'no_change', 'latest_purchase'])
  receiveMethod!: 'avg_method_1' | 'avg_method_2' | 'no_change' | 'latest_purchase';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReceivePurchaseOrderResponseDto {
  status!: 'applied' | 'replayed';
  mutationId!: string;
  requestId!: string;
  idempotencyKey!: string;
  orderId!: string;
}
