import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { FinanceCorrectionsArtifactsQueryDto } from '../../contracts/v1/finance/finance-corrections-artifacts-query.dto';
import { FinanceSummaryQueryDto } from '../../contracts/v1/finance/finance-summary-query.dto';
import {
  FinanceCorrectionsArtifactsResponseDto,
  FinanceCorrectionsOverviewResponseDto,
  FinancePaymentMixResponseDto,
  FinanceReconciliationOverviewResponseDto,
  FinanceSummaryResponseDto,
} from '../../contracts/v1/finance/finance-response.dto';
import { CurrentTenantContext } from '../tenancy/decorators/current-tenant-context.decorator';
import { FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(AuthGuard, TenantGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  getSummary(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Query() query: FinanceSummaryQueryDto,
  ): Promise<FinanceSummaryResponseDto> {
    return this.financeService.getSummary(tenantContext.storeId, query);
  }

  @Get('payment-mix')
  getPaymentMix(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Query() query: FinanceSummaryQueryDto,
  ): Promise<FinancePaymentMixResponseDto> {
    return this.financeService.getPaymentMix(tenantContext.storeId, query);
  }

  @Get('reconciliation-overview')
  getReconciliationOverview(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Query() query: FinanceSummaryQueryDto,
  ): Promise<FinanceReconciliationOverviewResponseDto> {
    return this.financeService.getReconciliationOverview(tenantContext.storeId, query);
  }


  @Get('corrections/artifacts')
  getCorrectionsArtifacts(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Query() query: FinanceCorrectionsArtifactsQueryDto,
  ): Promise<FinanceCorrectionsArtifactsResponseDto> {
    return this.financeService.getCorrectionsArtifacts(tenantContext.storeId, query);
  }

  @Get('corrections/overview')
  getCorrectionsOverview(
    @CurrentTenantContext() tenantContext: { storeId: string },
    @Query() query: FinanceSummaryQueryDto,
  ): Promise<FinanceCorrectionsOverviewResponseDto> {
    return this.financeService.getCorrectionsOverview(tenantContext.storeId, query);
  }
}
