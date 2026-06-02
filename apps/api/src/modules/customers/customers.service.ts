import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';

export interface UpsertCustomerInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  type?: string;
}

/**
 * Minimal customer master data — enough for invoicing (Phase 8). The full CRM
 * (interactions, leads, opportunities, pipeline) is layered on in Phase 10.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(search?: string) {
    return this.prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { company: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(input: UpsertCustomerInput, ctx: AuditContext) {
    const customer = await this.prisma.customer.create({
      data: { ...input, type: (input.type as Prisma.CustomerCreateInput['type']) ?? 'PROSPECT' },
    });
    await this.audit.record({ action: 'CREATE', entity: 'Customer', entityId: customer.id, after: customer, ctx });
    return customer;
  }

  async update(id: string, input: UpsertCustomerInput, ctx: AuditContext) {
    await this.getById(id);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: { ...input, type: input.type as Prisma.CustomerUpdateInput['type'] },
    });
    await this.audit.record({ action: 'UPDATE', entity: 'Customer', entityId: id, after: customer, ctx });
    return customer;
  }

  async remove(id: string, ctx: AuditContext) {
    await this.getById(id);
    await this.prisma.customer.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'Customer', entityId: id, ctx });
    return { success: true };
  }
}
