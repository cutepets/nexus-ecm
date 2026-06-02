import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import {
  CreateInteractionDto,
  CreateLeadDto,
  CreateOpportunityDto,
  CreateStageDto,
  MoveOpportunityDto,
  UpdateLeadStatusDto,
} from './dto/crm.dto';

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Pipeline stages ----
  listStages() {
    return this.prisma.pipelineStage.findMany({ orderBy: { orderIndex: 'asc' } });
  }
  createStage(dto: CreateStageDto) {
    return this.prisma.pipelineStage.create({
      data: { name: dto.name, orderIndex: dto.orderIndex ?? 0, probability: dto.probability ?? 0 },
    });
  }

  // ---- Leads ----
  listLeads(status?: string) {
    return this.prisma.lead.findMany({
      where: status ? { status: status as Prisma.LeadWhereInput['status'] } : undefined,
      include: { owner: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  async createLead(dto: CreateLeadDto, ctx: AuditContext) {
    const lead = await this.prisma.lead.create({ data: dto });
    await this.audit.record({ action: 'CREATE', entity: 'Lead', entityId: lead.id, after: lead, ctx });
    return lead;
  }
  async setLeadStatus(id: string, dto: UpdateLeadStatusDto, ctx: AuditContext) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    const updated = await this.prisma.lead.update({ where: { id }, data: { status: dto.status } });
    await this.audit.record({ action: 'UPDATE', entity: 'Lead', entityId: id, after: { status: dto.status }, ctx });
    return updated;
  }

  // ---- Interactions ----
  listInteractions(customerId: string) {
    return this.prisma.interaction.findMany({
      where: { customerId },
      include: { owner: { select: { id: true, fullName: true } } },
      orderBy: { occurredAt: 'desc' },
    });
  }
  async createInteraction(dto: CreateInteractionDto, ctx: AuditContext) {
    const interaction = await this.prisma.interaction.create({ data: dto });
    await this.audit.record({ action: 'CREATE', entity: 'Interaction', entityId: interaction.id, after: interaction, ctx });
    return interaction;
  }

  // ---- Opportunities ----
  listOpportunities() {
    return this.prisma.opportunity.findMany({
      include: {
        stage: { select: { id: true, name: true, probability: true } },
        customer: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Opportunities grouped by pipeline stage (for the board) + funnel totals. */
  async board() {
    const [stages, opps] = await Promise.all([this.listStages(), this.listOpportunities()]);
    return stages.map((stage) => {
      const items = opps.filter((o) => o.stageId === stage.id);
      const value = items.reduce((s, o) => s + Number(o.value), 0);
      return { stage, count: items.length, value, opportunities: items };
    });
  }

  async createOpportunity(dto: CreateOpportunityDto, ctx: AuditContext) {
    const opp = await this.prisma.opportunity.create({
      data: {
        title: dto.title,
        stageId: dto.stageId,
        customerId: dto.customerId,
        leadId: dto.leadId,
        value: dto.value ? new Prisma.Decimal(dto.value) : undefined,
        expectedClose: dto.expectedClose ? new Date(dto.expectedClose) : null,
        ownerId: dto.ownerId,
      },
    });
    await this.audit.record({ action: 'CREATE', entity: 'Opportunity', entityId: opp.id, after: opp, ctx });
    return opp;
  }

  async moveOpportunity(id: string, dto: MoveOpportunityDto, ctx: AuditContext) {
    const opp = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!opp) throw new NotFoundException('Opportunity not found');
    const updated = await this.prisma.opportunity.update({ where: { id }, data: { stageId: dto.stageId } });
    await this.audit.record({ action: 'UPDATE', entity: 'Opportunity', entityId: id, after: { stageId: dto.stageId }, ctx });
    return updated;
  }
}
