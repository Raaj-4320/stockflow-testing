import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionMutationLineItemDto {
  @IsString()
  @MaxLength(120)
  productId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  variant?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  color?: string;

  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class TransactionSettlementPayloadDto {
  @IsNumber()
  @Min(0)
  cashPaid!: number;

  @IsNumber()
  @Min(0)
  onlinePaid!: number;

  @IsNumber()
  @Min(0)
  creditDue!: number;

  @IsNumber()
  @Min(0)
  storeCreditUsed!: number;

  @IsIn(['cash', 'online', 'mixed', 'credit', 'return'])
  paymentMethod!: 'cash' | 'online' | 'mixed' | 'credit' | 'return';
}

export class ReturnHandlingPayloadDto {
  @IsIn(['refund_cash', 'refund_online', 'reduce_due', 'store_credit'])
  mode!: 'refund_cash' | 'refund_online' | 'reduce_due' | 'store_credit';

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class DeleteCompensationPayloadDto {
  @IsIn(['none', 'cash_refund', 'online_refund', 'store_credit'])
  mode!: 'none' | 'cash_refund' | 'online_refund' | 'store_credit';

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class MutationPreviewImpactDto {
  stockEffects!: Array<{
    productId: string;
    variant?: string | null;
    color?: string | null;
    delta: number;
  }>;

  customerEffects!: {
    customerId?: string | null;
    dueDelta: number;
    storeCreditDelta: number;
  };

  financeEffects!: {
    cashInDelta: number;
    cashOutDelta: number;
    onlineInDelta: number;
    onlineOutDelta: number;
  };
}

export class TransactionMutationPreviewRequestDto {
  @IsIn(['create_sale', 'create_payment', 'create_return', 'update_transaction', 'delete_transaction'])
  operation!:
    | 'create_sale'
    | 'create_payment'
    | 'create_return'
    | 'update_transaction'
    | 'delete_transaction';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetTransactionId?: string;

  @IsOptional()
  payload?: unknown;
}

export class TransactionMutationPreviewResponseDto {
  operation!: string;
  previewId!: string;
  tenantStoreId!: string;
  impact!: MutationPreviewImpactDto;
  warnings!: string[];
  computedAt!: string;
}

export class TransactionMutationAcceptedResponseDto {
  operation!: string;
  accepted!: boolean;
  mutationId!: string;
  idempotencyKey!: string;
  requestId!: string;
  status!: 'accepted' | 'applied' | 'replayed';
}
