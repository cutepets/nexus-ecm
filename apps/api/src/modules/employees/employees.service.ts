import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto } from './dto/employee.dto';
import { CreateJobHistoryDto, CreateSalaryHistoryDto } from './dto/history.dto';
import { CreateDocumentDto, PresignUploadDto } from './dto/document.dto';

const LIST_SELECT = {
  id: true,
  employeeNo: true,
  fullName: true,
  email: true,
  phone: true,
  photoUrl: true,
  workStatus: true,
  joinDate: true,
  department: { select: { id: true, name: true, code: true } },
  position: { select: { id: true, title: true } },
} satisfies Prisma.EmployeeSelect;

const SORTABLE = new Set(['fullName', 'employeeNo', 'joinDate', 'createdAt', 'workStatus']);

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(query: EmployeeQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));
    const sortBy = SORTABLE.has(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const where: Prisma.EmployeeWhereInput = {
      deletedAt: null,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.workStatus ? { workStatus: query.workStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { employeeNo: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        department: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, title: true } },
        manager: { select: { id: true, fullName: true, employeeNo: true } },
        jobHistory: {
          include: {
            position: { select: { id: true, title: true } },
            department: { select: { id: true, name: true } },
          },
          orderBy: { startDate: 'desc' },
        },
        salaryHistory: { orderBy: { effectiveDate: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Turn stored object keys into temporary viewable URLs.
    const photoUrl = employee.photoUrl ? await this.storage.presignedDownload(employee.photoUrl) : null;
    const documents = await Promise.all(
      employee.documents.map(async (d) => ({ ...d, fileUrl: await this.storage.presignedDownload(d.fileUrl) })),
    );

    return { ...employee, photoUrl, documents };
  }

  async create(dto: CreateEmployeeDto, ctx: AuditContext) {
    const employeeNo = dto.employeeNo ?? (await this.nextEmployeeNo());
    const clash = await this.prisma.employee.findUnique({ where: { employeeNo } });
    if (clash) throw new BadRequestException('Employee number already exists');

    // Optionally provision a login account (email + password → EMPLOYEE role).
    const userId = dto.password ? await this.createLoginAccount(dto.email, dto.password, dto.fullName) : undefined;

    const employee = await this.prisma.employee.create({
      data: {
        employeeNo,
        userId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        managerId: dto.managerId,
        workStatus: dto.workStatus ?? 'PROBATION',
        joinDate: new Date(dto.joinDate),
        exitDate: dto.exitDate ? new Date(dto.exitDate) : null,
        photoUrl: dto.photoUrl,
        // Seed an initial job-history row when placement is known.
        jobHistory:
          dto.positionId || dto.departmentId
            ? {
                create: {
                  positionId: dto.positionId,
                  departmentId: dto.departmentId,
                  startDate: new Date(dto.joinDate),
                  note: 'Initial placement',
                },
              }
            : undefined,
      },
      select: LIST_SELECT,
    });

    await this.audit.record({ action: 'CREATE', entity: 'Employee', entityId: employee.id, after: employee, ctx });
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, ctx: AuditContext) {
    const before = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Employee not found');

    if (dto.employeeNo && dto.employeeNo !== before.employeeNo) {
      const clash = await this.prisma.employee.findUnique({ where: { employeeNo: dto.employeeNo } });
      if (clash) throw new BadRequestException('Employee number already exists');
    }

    // `password` is not an Employee column — strip it (account changes aren't handled here).
    const { password: _password, ...employeeData } = dto;
    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...employeeData,
        joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
        exitDate: dto.exitDate ? new Date(dto.exitDate) : undefined,
      },
      select: LIST_SELECT,
    });

    await this.audit.record({ action: 'UPDATE', entity: 'Employee', entityId: id, before, after: employee, ctx });
    return employee;
  }

  /** Soft delete: keep the row for history/referential integrity. */
  async remove(id: string, ctx: AuditContext) {
    const before = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Employee not found');

    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), workStatus: 'INACTIVE' },
    });
    await this.audit.record({ action: 'DELETE', entity: 'Employee', entityId: id, before, ctx });
    return { success: true };
  }

  async restore(id: string, ctx: AuditContext) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.deletedAt) throw new BadRequestException('Employee is not deleted');

    await this.prisma.employee.update({ where: { id }, data: { deletedAt: null } });
    await this.audit.record({ action: 'UPDATE', entity: 'Employee', entityId: id, after: { restored: true }, ctx });
    return { success: true };
  }

  // ---- Job history ----

  async addJobHistory(employeeId: string, dto: CreateJobHistoryDto, ctx: AuditContext) {
    await this.ensureExists(employeeId);
    const entry = await this.prisma.jobHistory.create({
      data: {
        employeeId,
        positionId: dto.positionId,
        departmentId: dto.departmentId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        note: dto.note,
      },
    });
    await this.audit.record({ action: 'CREATE', entity: 'JobHistory', entityId: entry.id, after: entry, ctx });
    return entry;
  }

  // ---- Salary history ----

  async addSalaryHistory(employeeId: string, dto: CreateSalaryHistoryDto, ctx: AuditContext) {
    await this.ensureExists(employeeId);
    const entry = await this.prisma.salaryHistory.create({
      data: {
        employeeId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? 'IDR',
        effectiveDate: new Date(dto.effectiveDate),
        reason: dto.reason,
      },
    });
    await this.audit.record({ action: 'CREATE', entity: 'SalaryHistory', entityId: entry.id, after: entry, ctx });
    return entry;
  }

  // ---- Documents (presigned upload flow) ----

  async presignUpload(employeeId: string, dto: PresignUploadDto) {
    await this.ensureExists(employeeId);
    const folder = `employees/${employeeId}/${dto.kind === 'photo' ? 'photo' : 'documents'}`;
    const key = this.storage.buildKey(folder, dto.fileName);
    return this.storage.presignedUpload(key);
  }

  async addDocument(employeeId: string, dto: CreateDocumentDto, ctx: AuditContext) {
    await this.ensureExists(employeeId);
    const doc = await this.prisma.employeeDocument.create({
      data: {
        employeeId,
        docType: dto.docType,
        fileUrl: dto.fileUrl, // stored as object key
        fileName: dto.fileName,
      },
    });
    await this.audit.record({ action: 'CREATE', entity: 'EmployeeDocument', entityId: doc.id, after: doc, ctx });
    return { ...doc, fileUrl: await this.storage.presignedDownload(doc.fileUrl) };
  }

  async removeDocument(employeeId: string, docId: string, ctx: AuditContext) {
    const doc = await this.prisma.employeeDocument.findFirst({ where: { id: docId, employeeId } });
    if (!doc) throw new NotFoundException('Document not found');

    await this.storage.remove(doc.fileUrl);
    await this.prisma.employeeDocument.delete({ where: { id: docId } });
    await this.audit.record({ action: 'DELETE', entity: 'EmployeeDocument', entityId: docId, before: doc, ctx });
    return { success: true };
  }

  // ---- Helpers ----

  /** Create a login account (User + EMPLOYEE role) for a new employee. Returns the user id. */
  private async createLoginAccount(email: string | undefined, password: string, fullName: string): Promise<string> {
    if (!email) throw new BadRequestException('Email wajib diisi untuk membuat akun login');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email sudah digunakan oleh akun lain');

    const role = await this.prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        fullName,
        isActive: true,
        roles: role ? { create: { roleId: role.id } } : undefined,
      },
    });
    return user.id;
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.employee.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException('Employee not found');
  }

  /** Generate the next sequential employee number, e.g. EMP-0042. */
  private async nextEmployeeNo() {
    const last = await this.prisma.employee.findFirst({
      where: { employeeNo: { startsWith: 'EMP-' } },
      orderBy: { employeeNo: 'desc' },
      select: { employeeNo: true },
    });
    const lastNum = last ? Number(last.employeeNo.replace('EMP-', '')) : 0;
    const next = Number.isFinite(lastNum) ? lastNum + 1 : 1;
    return `EMP-${String(next).padStart(4, '0')}`;
  }
}
