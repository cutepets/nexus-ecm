import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import {
  CreateInteractionDto,
  CreateLeadDto,
  CreateOpportunityDto,
  CreateStageDto,
  MoveOpportunityDto,
  UpdateLeadStatusDto,
} from './dto/crm.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('crm')
@ApiBearerAuth()
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('stages') @RequirePermissions('crm:read') stages() { return this.crm.listStages(); }
  @Post('stages') @RequirePermissions('crm:create') createStage(@Body() dto: CreateStageDto) { return this.crm.createStage(dto); }

  // ---- Leads ----
  @Get('leads') @RequirePermissions('crm:read') leads(@Query('status') status?: string) { return this.crm.listLeads(status); }
  @Post('leads') @RequirePermissions('crm:create')
  createLead(@Body() dto: CreateLeadDto, @CurrentUser() user: RequestUser) { return this.crm.createLead(dto, { actorId: user.id }); }
  @Put('leads/:id/status') @RequirePermissions('crm:update')
  setLeadStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto, @CurrentUser() user: RequestUser) {
    return this.crm.setLeadStatus(id, dto, { actorId: user.id });
  }

  // ---- Opportunities ----
  @Get('opportunities') @RequirePermissions('crm:read') opportunities() { return this.crm.listOpportunities(); }
  @Get('opportunities/board')
  @RequirePermissions('crm:read')
  @ApiOperation({ summary: 'Opportunities grouped by stage (pipeline board + funnel)' })
  board() { return this.crm.board(); }
  @Post('opportunities') @RequirePermissions('crm:create')
  createOpp(@Body() dto: CreateOpportunityDto, @CurrentUser() user: RequestUser) { return this.crm.createOpportunity(dto, { actorId: user.id }); }
  @Put('opportunities/:id/stage') @RequirePermissions('crm:update')
  moveOpp(@Param('id') id: string, @Body() dto: MoveOpportunityDto, @CurrentUser() user: RequestUser) {
    return this.crm.moveOpportunity(id, dto, { actorId: user.id });
  }

  // ---- Interactions ----
  @Get('customers/:customerId/interactions') @RequirePermissions('crm:read')
  interactions(@Param('customerId') customerId: string) { return this.crm.listInteractions(customerId); }
  @Post('interactions') @RequirePermissions('crm:create')
  createInteraction(@Body() dto: CreateInteractionDto, @CurrentUser() user: RequestUser) {
    return this.crm.createInteraction(dto, { actorId: user.id });
  }
}
