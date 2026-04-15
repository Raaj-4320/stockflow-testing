import {
  DeletedTransactionDto,
  TransactionAuditEventDto,
  TransactionDto,
} from './transaction.types';

export class TransactionResponseDto {
  transaction!: TransactionDto;
}

export class TransactionListResponseDto {
  items!: TransactionDto[];
  page!: number;
  pageSize!: number;
  total!: number;
}

export class DeletedTransactionListResponseDto {
  items!: DeletedTransactionDto[];
}

export class TransactionAuditEventListResponseDto {
  items!: TransactionAuditEventDto[];
}
