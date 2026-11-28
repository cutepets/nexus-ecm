import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto, TerminateEmployeeDto } from './dto/employee.dto';
import { CreateJobHistoryDto, CreateSalaryHistoryDto } from './dto/history.dto';
import { CreateDocumentDto, PresignCreateEmployeeUploadDto, PresignUploadDto } from './dto/document.dto';
import { normalizeVietnamesePhone } from '../../common/utils/login-identifier';
import { workDateInTimeZone } from '../../common/utils/company-time';
import { RoleAssignmentService } from '../rbac/role-assignment.service';

const LIST_SELECT = {
  id: true,
  employeeNo: true,
  fullName: true,
  jobTitle: true,
  email: true,
  phone: true,
  gender: true,
  dateOfBirth: true,
  identityCode: true,
  address: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  photoUrl: true,
  employmentType: true,
  exitDate: true,
  workStatus: true,
  probationDays: true,
  joinDate: true,
  department: { select: { id: true, name: true, code: true } },
  position: { select: { id: true, title: true } },
  primaryBranch: { select: { id: true, code: true, name: true, address: true } },
  manager: { select: { id: true, fullName: true, employeeNo: true } },
  branchAssignments: {
    where: { effectiveTo: null },
    select: { id: true, branch: { select: { id: true, code: true, name: true, address: true } } },
    orderBy: { effectiveFrom: 'desc' },
  },
  workScheduleAssignments: {
    where: { effectiveTo: null },
    select: { id: true, workSchedule: { select: { id: true, name: true, startTime: true, endTime: true } } },
    orderBy: [{ priority: 'desc' }, { effectiveFrom: 'desc' }],
  },
  user: { select: { username: true, email: true, isActive: true, lastLoginAt: true, roles: { select: { role: { select: { id: true, code: true, name: true } } } } } },
} satisfies Prisma.EmployeeSelect;

const SORTABLE = new Set(['fullName', 'employeeNo', 'joinDate', 'createdAt', 'workStatus']);

interface EmployeeReadScope {
  scope: 'ALL' | 'BRANCH' | 'SELF' | 'NONE';
  employeeId?: string | null;
  branchIds: string[];
  from: Date;
  to: Date;
}

@Injectable()
export class EmployeesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmployeesService.name);
  private probationTimer?: NodeJS.Timeout;
  private probationPromotionRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly roleAssignments: RoleAssignmentService,
  ) {}

  onModuleInit() {
    void this.promoteCompletedProbation();
    this.probationTimer = setInterval(() => void this.promoteCompletedProbation(), 24 * 60 * 60_000);
  }

  onModuleDestroy() {
    if (this.probationTimer) clearInterval(this.probationTimer);
  }

  private async promoteCompletedProbation() {
    if (this.probationPromotionRunning) return;
    this.probationPromotionRunning = true;
    try {
      const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date());
      const part = (type: Intl.DateTimeFormatPartTypes) => Number(dateParts.find((value) => value.type === type)?.value);
      const today = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
      const probationEmployees = await this.prisma.employee.findMany({
        where: { workStatus: 'PROBATION', deletedAt: null },
        select: { id: true, joinDate: true, probationDays: true },
      });
      let promoted = 0;
      for (const employee of probationEmployees) {
        const joinDate = new Date(Date.UTC(employee.joinDate.getUTCFullYear(), employee.joinDate.getUTCMonth(), employee.joinDate.getUTCDate()));
        const daysWorked = Math.floor((today.getTime() - joinDate.getTime()) / 86_400_000);
        if (daysWorked < Math.max(0, employee.probationDays)) continue;
        const effectiveDate = new Date(joinDate);
        effectiveDate.setUTCDate(effectiveDate.getUTCDate() + Math.max(0, employee.probationDays));
        await this.prisma.$transaction(async (tx) => {
          const result = await tx.employee.updateMany({
            where: { id: employee.id, workStatus: 'PROBATION', deletedAt: null },
            data: { workStatus: 'PERMANENT' },
          });
          if (!result.count) return;
          await tx.employmentHistory.create({
            data: {
              employeeId: employee.id,
              effectiveDate,
              changeType: 'WORK_STATUS',
              reason: 'Hoàn thành thời gian thử việc.',
              changes: [{ field: 'workStatus', before: 'Thử việc', after: 'Chính thức' }],
            },
          });
          promoted += 1;
        });
      }
      if (promoted) this.logger.log(`Automatically promoted ${promoted} employees after probation.`);
    } catch (error) {
      this.logger.error(`Probation status automation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.probationPromotionRunning = false;
    }
  }

  async listBranchesForEmployeeAccess(access: EmployeeReadScope) {
    if (access.scope === 'NONE') return [];
    let allowedBranchIds: string[] | undefined;
    if (access.scope === 'BRANCH') allowedBranchIds = access.branchIds;
    if (access.scope === 'SELF') {
      if (!access.employeeId) return [];
      const employee = await this.prisma.employee.findUnique({
        where: { id: access.employeeId },
        select: {
          primaryBranchId: true,
          branchAssignments: { where: { effectiveTo: null }, select: { branchId: true } },
        },
      });
      allowedBranchIds = [...new Set([employee?.primaryBranchId, ...(employee?.branchAssignments.map(({ branchId }) => branchId) ?? [])].filter((id): id is string => Boolean(id)))];
    }
    if (allowedBranchIds && !allowedBranchIds.length) return [];
    return this.prisma.branch.findMany({
      where: { isActive: true, ...(allowedBranchIds ? { id: { in: allowedBranchIds } } : {}) },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async list(query: EmployeeQueryDto, includeCompensation = false, access?: EmployeeReadScope) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));
    const sortBy = SORTABLE.has(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const today = query.upcomingExit
      ? new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}T00:00:00.000Z`)
      : undefined;
    const select: Prisma.EmployeeSelect = includeCompensation
      ? {
          ...LIST_SELECT,
          taxCode: true,
          salaryBankName: true,
          salaryBankAccount: true,
          basicSalary: true,
          spaBonusPercent: true,
        }
      : LIST_SELECT;

    const where: Prisma.EmployeeWhereInput = {
      deletedAt: null,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(!query.upcomingExit && query.workStatus?.length ? { workStatus: { in: query.workStatus } } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { employeeNo: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { user: { is: { username: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const filters: Prisma.EmployeeWhereInput[] = [];
    if (today) filters.push({
      OR: [
        ...(query.workStatus?.length ? [{ workStatus: { in: query.workStatus } }] : []),
        { exitDate: { gte: today } },
      ],
    });
    if (query.branchId) filters.push({
      OR: [
        { primaryBranchId: query.branchId },
        { branchAssignments: { some: { branchId: query.branchId, effectiveTo: null } } },
      ],
    });
    const scopeWhere = this.employeeReadScopeWhere(access);
    if (scopeWhere) filters.push(scopeWhere);
    if (filters.length) where.AND = filters;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(id: string, includeCompensation = false, access?: EmployeeReadScope) {
    const scopeWhere = this.employeeReadScopeWhere(access);
    const employee = await this.prisma.employee.findFirst({
      where: { AND: [{ id, deletedAt: null }, ...(scopeWhere ? [scopeWhere] : [])] },
      include: {
        department: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, title: true } },
        primaryBranch: { select: { id: true, code: true, name: true, address: true } },
        manager: { select: { id: true, fullName: true, employeeNo: true } },
        jobHistory: {
          include: {
            position: { select: { id: true, title: true } },
            department: { select: { id: true, name: true } },
          },
          orderBy: { startDate: 'desc' },
        },
        salaryHistory: { orderBy: { effectiveDate: 'desc' } },
        employmentHistory: {
          orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
          include: { documents: { orderBy: { uploadedAt: 'desc' } } },
        },
        documents: { orderBy: { uploadedAt: 'desc' } },
        branchAssignments: {
          where: { effectiveTo: null },
          include: { branch: { select: { id: true, code: true, name: true, address: true } } },
          orderBy: { effectiveFrom: 'desc' },
        },
        workScheduleAssignments: {
          where: { effectiveTo: null },
          include: { workSchedule: { select: { id: true, name: true, startTime: true, endTime: true } } },
          orderBy: [{ priority: 'desc' }, { effectiveFrom: 'desc' }],
        },
        user: { select: { id: true, username: true, email: true, phone: true, isActive: true, lastLoginAt: true, roles: { select: { role: { select: { id: true, code: true, name: true } } } } } },
      },
    });
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');

    // Turn stored object keys into temporary viewable URLs.
    const photoUrl = employee.photoUrl
      ? /^https?:\/\//i.test(employee.photoUrl)
        ? employee.photoUrl
        : await this.storage.presignedDownload(employee.photoUrl)
      : null;
    const documents = await Promise.all(
      employee.documents.map(async (d) => ({ ...d, fileUrl: await this.storage.presignedDownload(d.fileUrl) })),
    );

    const employmentHistory = await Promise.all(employee.employmentHistory.map(async (entry) => ({
      ...entry,
      documents: await Promise.all(entry.documents.map(async (document) => ({
        ...document,
        fileUrl: await this.storage.presignedDownload(document.fileUrl),
      }))),
    })));
    const result = { ...employee, photoUrl, documents, employmentHistory };
    if (includeCompensation) return result;

    const {
      taxCode: _taxCode,
      salaryBankName: _salaryBankName,
      salaryBankAccount: _salaryBankAccount,
      basicSalary: _basicSalary,
      spaBonusPercent: _spaBonusPercent,
      salaryHistory: _salaryHistory,
      ...safeProfile
    } = result;
    return {
      ...safeProfile,
      salaryHistory: [],
      employmentHistory: employmentHistory.map((entry) => ({
        ...entry,
        changes: Array.isArray(entry.changes)
          ? entry.changes.filter((change: unknown) => {
              if (!change || typeof change !== 'object' || Array.isArray(change)) return true;
              const field = 'field' in change ? change.field : undefined;
              return field !== 'basicSalary' && field !== 'spaBonusPercent';
            })
          : entry.changes,
      })).filter((entry) => !Array.isArray(entry.changes) || entry.changes.length > 0),
    };
  }

  async suggestUsername(fullName: string) {
    const parts = fullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const givenName = parts.pop() ?? '';
    const initials = parts.map((part) => part[0]).join('');
    let stem = `${initials}${givenName}`.slice(0, 30);
    if (stem.length < 3) stem = `${stem || 'nv'}01`;

    const existing = await this.prisma.user.findMany({
      where: { username: { startsWith: stem } },
      select: { username: true },
    });
    const usernames = new Set(existing.map(({ username }) => username.toLowerCase()));
    if (!usernames.has(stem)) return { username: stem };

    for (let suffix = 1; ; suffix += 1) {
      const ending = String(suffix).padStart(2, '0');
      const candidate = `${stem.slice(0, 32 - ending.length)}${ending}`;
      if (!usernames.has(candidate)) return { username: candidate };
    }
  }

  async create(dto: CreateEmployeeDto, ctx: AuditContext, canManageCompensation = false, canManageAssignments = false) {
    this.ensureMayManageCompensation(dto, canManageCompensation);
    this.ensureMayManageAssignments(dto, canManageAssignments);
    this.assertIdentityCardKeys(dto);
    const employeeNo = dto.employeeNo ?? (await this.nextEmployeeNo());
    const employee = await this.prisma.$transaction(async (tx) => {
      const clash = await tx.employee.findUnique({ where: { employeeNo } });
      if (clash) throw new BadRequestException('Employee number already exists');
      const userId = await this.createLoginAccount(tx, dto.username, dto.email, dto.phone, dto.password ?? '123456', dto.fullName);
      await this.assertPrimaryBranch(tx, dto.primaryBranchId);
      const employee = await tx.employee.create({
        data: {
          employeeNo, userId, fullName: dto.fullName, email: dto.email, phone: dto.phone,
          jobTitle: dto.jobTitle ?? 'Nhân viên',
          address: dto.address, gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          identityCode: dto.identityCode, emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone, taxCode: dto.taxCode,
          salaryBankName: dto.salaryBankName, salaryBankAccount: dto.salaryBankAccount,
          basicSalary: dto.basicSalary, spaBonusPercent: dto.spaBonusPercent,
          employmentType: dto.employmentType ?? 'FULL_TIME', primaryBranchId: dto.primaryBranchId,
          departmentId: dto.departmentId, positionId: dto.positionId,
          managerId: dto.managerId, workStatus: dto.workStatus ?? 'PROBATION',
          probationDays: dto.probationDays ?? 20,
          joinDate: new Date(dto.joinDate), exitDate: dto.exitDate ? new Date(dto.exitDate) : null,
          photoUrl: dto.photoUrl,
          documents:
            dto.identityCardFrontUrl || dto.identityCardBackUrl
              ? {
                  create: [
                    ...(dto.identityCardFrontUrl ? [{ docType: 'OTHER' as const, fileUrl: dto.identityCardFrontUrl, fileName: 'can-cuoc-mat-truoc' }] : []),
                    ...(dto.identityCardBackUrl ? [{ docType: 'OTHER' as const, fileUrl: dto.identityCardBackUrl, fileName: 'can-cuoc-mat-sau' }] : []),
                  ],
                }
              : undefined,
          jobHistory: dto.positionId || dto.departmentId ? { create: { positionId: dto.positionId, departmentId: dto.departmentId, startDate: new Date(dto.joinDate), note: 'Initial placement' } } : undefined,
        },
        select: LIST_SELECT,
      });
      await this.reconcileAssignments(tx, employee.id, dto.branchIds, dto.workScheduleId, new Date(dto.joinDate));
      await this.roleAssignments.syncEmployee(tx, {
        userId,
        departmentId: dto.departmentId ?? null,
        positionId: dto.positionId ?? null,
      });
      const initialValues: Record<string, unknown> = {
        basicSalary: dto.basicSalary?.toString() ?? null,
        spaBonusPercent: dto.spaBonusPercent?.toString() ?? null,
        employmentType: dto.employmentType ?? 'FULL_TIME',
        jobTitle: dto.jobTitle ?? 'Nhân viên',
        positionId: dto.positionId ?? null,
        departmentId: dto.departmentId ?? null,
        primaryBranchId: dto.primaryBranchId,
        workStatus: dto.workStatus ?? 'PROBATION',
        branchIds: dto.branchIds ?? [],
        workScheduleIds: dto.workScheduleId ? [dto.workScheduleId] : [],
      };
      const initialChanges = await Promise.all(Object.entries(initialValues).map(async ([field, value]) => ({
        field,
        before: null,
        after: await this.employmentValue(tx, field, value),
      })));
      await tx.employmentHistory.create({
        data: {
          employeeId: employee.id,
          effectiveDate: this.dateOnly(new Date(dto.joinDate)),
          changeType: 'INITIAL_HIRE',
          reason: 'Ghi nhận thông tin ban đầu khi tiếp nhận nhân viên',
          changes: initialChanges as Prisma.InputJsonValue,
          createdById: ctx.actorId,
        },
      });
      return employee;
    });

    await this.audit.record({ action: 'CREATE', entity: 'Employee', entityId: employee.id, after: employee, ctx });
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, ctx: AuditContext, canManageCompensation = false, canManageAssignments = false) {
    this.ensureMayManageCompensation(dto, canManageCompensation);
    this.ensureMayManageAssignments(dto, canManageAssignments);
    const before = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Không tìm thấy nhân viên');

    if (dto.employeeNo && dto.employeeNo !== before.employeeNo) {
      const clash = await this.prisma.employee.findUnique({ where: { employeeNo: dto.employeeNo } });
      if (clash) throw new BadRequestException('Employee number already exists');
    }

    const {
      password, username, branchIds, workScheduleId,
      effectiveDate, changeReason, decisionNumber, historyDocuments,
      identityCardFrontUrl: _identityCardFrontUrl, identityCardBackUrl: _identityCardBackUrl,
      ...employeeData
    } = dto;
    const employee = await this.prisma.$transaction(async (tx) => {
      const [previousBranches, previousSchedules] = await Promise.all([
        tx.employeeBranchAssignment.findMany({ where: { employeeId: id, effectiveTo: null }, select: { branchId: true } }),
        tx.employeeWorkScheduleAssignment.findMany({ where: { employeeId: id, effectiveTo: null }, select: { workScheduleId: true } }),
      ]);
      if (username !== undefined || dto.fullName !== undefined || dto.email !== undefined || dto.phone !== undefined || password !== undefined) {
        if (!before.userId) throw new BadRequestException('Employee account is missing; reconcile the account before editing login details');
        const userData: Prisma.UserUpdateInput = {};
        if (username !== undefined) userData.username = this.normalizeUsername(username);
        if (dto.fullName !== undefined) userData.fullName = dto.fullName.trim();
        if (dto.email !== undefined) userData.email = dto.email.trim().toLowerCase();
        if (dto.phone !== undefined) {
          const normalizedPhone = dto.phone ? normalizeVietnamesePhone(dto.phone) : null;
          if (dto.phone && !normalizedPhone) throw new BadRequestException('Số điện thoại đăng nhập phải là số Việt Nam hợp lệ');
          userData.phone = normalizedPhone;
        }
        if (password !== undefined) {
          userData.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
          userData.mustChangePassword = true;
        }
        await tx.user.update({ where: { id: before.userId }, data: userData });
        await tx.refreshToken.updateMany({
          where: { userId: before.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      const employee = await tx.employee.update({
        where: { id },
        data: {
          ...employeeData,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
          exitDate: dto.exitDate ? new Date(dto.exitDate) : undefined,
        },
        select: LIST_SELECT,
      });
      await this.assertPrimaryBranch(tx, dto.primaryBranchId);
      const changeDate = this.dateOnly(effectiveDate ? new Date(effectiveDate) : new Date());
      await this.reconcileAssignments(tx, id, branchIds, workScheduleId, changeDate);
      if (before.userId) {
        await this.roleAssignments.syncEmployee(tx, {
          userId: before.userId,
          departmentId: employeeData.departmentId !== undefined ? employeeData.departmentId : before.departmentId,
          positionId: employeeData.positionId !== undefined ? employeeData.positionId : before.positionId,
        });
      }

      const trackedValues: Record<string, { before: unknown; after: unknown }> = {
        basicSalary: { before: before.basicSalary === null ? null : Number(before.basicSalary).toFixed(2), after: employeeData.basicSalary !== undefined ? (employeeData.basicSalary === null ? null : Number(employeeData.basicSalary).toFixed(2)) : before.basicSalary === null ? null : Number(before.basicSalary).toFixed(2) },
        spaBonusPercent: { before: before.spaBonusPercent === null ? null : Number(before.spaBonusPercent).toFixed(2), after: employeeData.spaBonusPercent !== undefined ? (employeeData.spaBonusPercent === null ? null : Number(employeeData.spaBonusPercent).toFixed(2)) : before.spaBonusPercent === null ? null : Number(before.spaBonusPercent).toFixed(2) },
        employmentType: { before: before.employmentType, after: employeeData.employmentType ?? before.employmentType },
        probationDays: { before: before.probationDays, after: employeeData.probationDays ?? before.probationDays },
        jobTitle: { before: before.jobTitle, after: employeeData.jobTitle ?? before.jobTitle },
        positionId: { before: before.positionId, after: employeeData.positionId ?? before.positionId },
        departmentId: { before: before.departmentId, after: employeeData.departmentId ?? before.departmentId },
        primaryBranchId: { before: before.primaryBranchId, after: employeeData.primaryBranchId ?? before.primaryBranchId },
        workStatus: { before: before.workStatus, after: employeeData.workStatus ?? before.workStatus },
        branchIds: { before: previousBranches.map((item) => item.branchId).sort(), after: branchIds?.slice().sort() ?? previousBranches.map((item) => item.branchId).sort() },
        workScheduleIds: { before: previousSchedules.map((item) => item.workScheduleId).sort(), after: workScheduleId !== undefined ? (workScheduleId ? [workScheduleId] : []) : previousSchedules.map((item) => item.workScheduleId).sort() },
      };
      const changes = await Promise.all(Object.entries(trackedValues)
        .filter(([, value]) => JSON.stringify(value.before) !== JSON.stringify(value.after))
        .map(async ([field, value]) => ({
          field,
          before: await this.employmentValue(tx, field, value.before),
          after: await this.employmentValue(tx, field, value.after),
        })));
      if (changes.length) {
        if (!changeReason?.trim()) throw new BadRequestException('Nhập lý do thay đổi để lưu vào quá trình làm việc');
        const history = await tx.employmentHistory.create({
          data: {
            employeeId: id,
            effectiveDate: changeDate,
            changeType: this.employmentChangeType(changes.map((change) => change.field)),
            reason: changeReason.trim(),
            decisionNumber: decisionNumber?.trim() || null,
            changes: changes as Prisma.InputJsonValue,
            createdById: ctx.actorId,
          },
        });
        if (historyDocuments?.length) {
          await tx.employeeDocument.createMany({
            data: historyDocuments.map((document) => ({
              employeeId: id,
              historyId: history.id,
              docType: 'OTHER' as const,
              fileUrl: document.fileUrl,
              fileName: document.fileName,
            })),
          });
        }
        if (changes.some((change) => ['positionId', 'departmentId', 'jobTitle'].includes(change.field))) {
          const previousEnd = new Date(changeDate);
          previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
          await tx.jobHistory.updateMany({
            where: { employeeId: id, endDate: null },
            data: { endDate: previousEnd },
          });
          await tx.jobHistory.create({
            data: {
              employeeId: id,
              positionId: employeeData.positionId !== undefined ? employeeData.positionId : before.positionId,
              departmentId: employeeData.departmentId !== undefined ? employeeData.departmentId : before.departmentId,
              startDate: changeDate,
              note: changeReason.trim(),
            },
          });
        }
        if (trackedValues.basicSalary.before !== trackedValues.basicSalary.after && trackedValues.basicSalary.after !== null) {
          await tx.salaryHistory.create({
            data: {
              employeeId: id,
              amount: new Prisma.Decimal(String(trackedValues.basicSalary.after)),
              currency: 'VND',
              effectiveDate: changeDate,
              reason: changeReason.trim(),
            },
          });
        }
      }
      return employee;
    });

    await this.audit.record({ action: 'UPDATE', entity: 'Employee', entityId: id, before: this.auditSnapshot(before), after: employee, ctx });
    return employee;
  }

  private employmentChangeType(fields: string[]) {
    if (fields.some((field) => ['basicSalary', 'spaBonusPercent'].includes(field))) return 'COMPENSATION';
    if (fields.some((field) => ['positionId', 'departmentId', 'jobTitle'].includes(field))) return 'POSITION';
    if (fields.some((field) => ['primaryBranchId', 'branchIds'].includes(field))) return 'BRANCH';
    if (fields.includes('workScheduleIds')) return 'SCHEDULE';
    if (fields.includes('workStatus')) return 'WORK_STATUS';
    return 'EMPLOYMENT_TERMS';
  }

  private async employmentValue(tx: Prisma.TransactionClient, field: string, value: unknown): Promise<string | null> {
    if (value === null || value === undefined || value === '') return null;
    if (field === 'basicSalary') return `${Number(value).toLocaleString('vi-VN')}đ`;
    if (field === 'spaBonusPercent') return `${value}%`;
    if (field === 'probationDays') return `${value} ngày`;
    const lookup = async (ids: string[], kind: 'branch' | 'schedule' | 'position' | 'department') => {
      if (!ids.length) return [];
      if (kind === 'branch') return (await tx.branch.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((item) => item.name);
      if (kind === 'schedule') return (await tx.workSchedule.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((item) => item.name);
      if (kind === 'position') return (await tx.position.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })).map((item) => item.title);
      return (await tx.department.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((item) => item.name);
    };
    if (field === 'primaryBranchId' || field === 'positionId' || field === 'departmentId') {
      const kind = field === 'primaryBranchId' ? 'branch' : field === 'positionId' ? 'position' : 'department';
      return (await lookup([String(value)], kind))[0] ?? String(value);
    }
    if (field === 'branchIds' || field === 'workScheduleIds') {
      const names = await lookup(value as string[], field === 'branchIds' ? 'branch' : 'schedule');
      return names.length ? names.join(', ') : null;
    }
    if (field === 'employmentType') return value === 'FULL_TIME' ? 'Toàn thời gian' : 'Bán thời gian';
    if (field === 'workStatus') return ({ PROBATION: 'Thử việc', PERMANENT: 'Chính thức', CONTRACT: 'Hợp đồng', ON_LEAVE: 'Tạm nghỉ', INACTIVE: 'Thôi việc', ABANDONED: 'Bỏ việc' } as Record<string, string>)[String(value)] ?? String(value);
    return String(value);
  }

  private employeeReadScopeWhere(access?: EmployeeReadScope): Prisma.EmployeeWhereInput | null {
    if (!access || access.scope === 'ALL') return null;
    if (access.scope === 'SELF') return { id: access.employeeId ?? '__no_employee__' };
    if (access.scope === 'NONE' || !access.branchIds.length) return { id: '__no_employee__' };
    return {
      branchAssignments: {
        some: {
          branchId: { in: access.branchIds },
          effectiveFrom: { lte: access.to },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: access.from } }],
        },
      },
    };
  }

  async getDeletionEligibility(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, fullName: true, userId: true },
    });
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');
    return this.deletionEligibility(this.prisma, employee);
  }

  /** Permanently delete only a demo/empty employee with no business history. */
  async remove(id: string, ctx: AuditContext) {
    const result = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, fullName: true, userId: true, employeeNo: true },
      });
      if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');
      const eligibility = await this.deletionEligibility(tx, employee);
      if (!eligibility.canDelete) {
        throw new ConflictException({
          code: 'EMPLOYEE_HAS_HISTORY',
          message: 'Nhân viên có lịch sử nghiệp vụ; hãy dùng chức năng cho thôi việc.',
          eligibility,
        });
      }

      // Manager references do not cascade. Reassign reports to no manager before
      // deleting the otherwise history-free employee.
      await tx.employee.updateMany({ where: { managerId: id }, data: { managerId: null } });
      await tx.employee.delete({ where: { id } });
      if (employee.userId) {
        await this.ensureNotLastActiveSuperAdmin(tx, employee.userId);
        await tx.user.update({
          where: { id: employee.userId },
          data: { isActive: false, deletedAt: new Date() },
        });
        await tx.refreshToken.updateMany({
          where: { userId: employee.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return employee;
    });
    await this.audit.record({ action: 'DELETE', entity: 'Employee', entityId: id, before: result, ctx });
    return { success: true };
  }

  /**
   * Irreversibly removes an employee and the linked account. This deliberately
   * differs from terminate(): no employee-owned HR, attendance or payroll data
   * survives. Shared business records are detached rather than deleted.
   */
  async permanentlyDelete(
    id: string,
    currentPassword: string,
    ctx: AuditContext & { actorRoles: string[] },
  ) {
    if (!ctx.actorRoles.includes('admin')) {
      throw new ForbiddenException('Chỉ admin mới được xóa vĩnh viễn nhân viên');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [actor, employee] = await Promise.all([
        tx.user.findFirst({
          where: { id: ctx.actorId, deletedAt: null, isActive: true },
          select: { id: true, passwordHash: true },
        }),
        tx.employee.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, employeeNo: true, fullName: true, userId: true, photoUrl: true },
        }),
      ]);
      if (!actor || !(await argon2.verify(actor.passwordHash, currentPassword))) {
        throw new ForbiddenException('Mật khẩu xác nhận không đúng');
      }
      if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');
      if (employee.userId === ctx.actorId) {
        throw new BadRequestException('Không thể tự xóa tài khoản admin đang đăng nhập');
      }

      await this.ensureNotLastActiveSuperAdmin(tx, employee.userId);

      const [documents, faceProfiles, attendances, corrections, leaveRequests] = await Promise.all([
        tx.employeeDocument.findMany({ where: { employeeId: id }, select: { fileUrl: true } }),
        tx.faceProfile.findMany({ where: { employeeId: id }, select: { sampleImageUrl: true } }),
        tx.attendance.findMany({
          where: { employeeId: id },
          select: {
            checkInPhotoUrl: true,
            checkOutPhotoUrl: true,
            sessions: { select: { checkInPhotoUrl: true, checkOutPhotoUrl: true } },
          },
        }),
        tx.attendanceCorrectionRequest.findMany({ where: { employeeId: id }, select: { evidencePhotoUrl: true } }),
        tx.leaveRequest.findMany({ where: { employeeId: id }, select: { documentUrl: true } }),
      ]);

      const fileKeys = [
        employee.photoUrl,
        ...documents.map((document) => document.fileUrl),
        ...faceProfiles.map((profile) => profile.sampleImageUrl),
        ...attendances.flatMap((attendance) => [
          attendance.checkInPhotoUrl,
          attendance.checkOutPhotoUrl,
          ...attendance.sessions.flatMap((session) => [session.checkInPhotoUrl, session.checkOutPhotoUrl]),
        ]),
        ...corrections.map((request) => request.evidencePhotoUrl),
        ...leaveRequests.map((request) => request.documentUrl),
      ].filter(
        (key): key is string =>
          typeof key === 'string' && key.length > 0 && !key.startsWith('data:') && !key.startsWith('http'),
      );

      // These fields are scalar owner references, not foreign keys. Preserve
      // shared records while preventing them from retaining a deleted identity.
      await Promise.all([
        tx.employee.updateMany({ where: { managerId: id }, data: { managerId: null } }),
        tx.project.updateMany({ where: { managerId: id }, data: { managerId: null } }),
        tx.integrationKpiEvent.deleteMany({ where: { employeeId: id } }),
        tx.folder.updateMany({ where: { ownerId: employee.userId }, data: { ownerId: null } }),
        tx.document.updateMany({ where: { ownerId: employee.userId }, data: { ownerId: null } }),
        tx.documentVersion.updateMany({ where: { uploadedById: employee.userId }, data: { uploadedById: null } }),
        tx.conversation.updateMany({ where: { createdById: employee.userId }, data: { createdById: null } }),
        tx.integrationApiKey.updateMany({ where: { createdById: employee.userId }, data: { createdById: null } }),
        tx.integrationWebhookSubscription.updateMany({ where: { createdById: employee.userId }, data: { createdById: null } }),
      ]);

      // Employee-owned history and relation rows use cascade rules in Prisma.
      // Delete employee first because Employee.user is intentionally RESTRICT.
      await tx.employee.delete({ where: { id } });
      await tx.user.delete({ where: { id: employee.userId } });

      return { employee, fileKeys };
    });

    await Promise.all(result.fileKeys.map((key) => this.storage.remove(key)));
    await this.audit.record({
      action: 'DELETE',
      entity: 'Employee',
      entityId: id,
      before: { employeeNo: result.employee.employeeNo, fullName: result.employee.fullName, permanent: true },
      after: { permanentlyDeleted: true },
      ctx,
    });
    return { success: true };
  }

  async terminate(id: string, dto: TerminateEmployeeDto, ctx: AuditContext) {
    const before = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Không tìm thấy nhân viên');
    if (before.workStatus === 'INACTIVE') throw new BadRequestException('Nhân viên đã thôi việc');

    const terminationDate = this.dateOnly(new Date(dto.terminationDate));
    const today = workDateInTimeZone(new Date(), 'Asia/Ho_Chi_Minh');
    const inactiveFrom = terminationDate < today ? terminationDate : today;
    const lastActiveDate = new Date(inactiveFrom);
    lastActiveDate.setUTCDate(lastActiveDate.getUTCDate() - 1);
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          workStatus: 'INACTIVE',
          exitDate: terminationDate,
          terminatedAt: new Date(),
          terminationReason: dto.terminationReason.trim(),
        },
      });
      const history = await tx.employmentHistory.create({
        data: {
          employeeId: id,
          effectiveDate: this.dateOnly(terminationDate),
          changeType: 'WORK_STATUS',
          reason: dto.terminationReason.trim(),
          decisionNumber: dto.decisionNumber?.trim() || null,
          changes: [
            { field: 'workStatus', before: await this.employmentValue(tx, 'workStatus', before.workStatus), after: 'Thôi việc' },
          ],
          createdById: ctx.actorId,
        },
      });
      if (dto.historyDocuments?.length) {
        await tx.employeeDocument.createMany({
          data: dto.historyDocuments.map((document) => ({
            employeeId: id,
            historyId: history.id,
            docType: 'OTHER' as const,
            fileUrl: document.fileUrl,
            fileName: document.fileName,
          })),
        });
      }
      await tx.employeeBranchAssignment.updateMany({
        where: { employeeId: id, OR: [{ effectiveTo: null }, { effectiveTo: { gt: terminationDate } }] },
        data: { effectiveTo: terminationDate },
      });
      await tx.employeeWorkScheduleAssignment.deleteMany({
        where: { employeeId: id, effectiveFrom: { gte: inactiveFrom } },
      });
      await tx.employeeWorkScheduleAssignment.updateMany({
        where: {
          employeeId: id,
          effectiveFrom: { lt: inactiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: inactiveFrom } }],
        },
        data: { effectiveTo: lastActiveDate },
      });
      await tx.employeeDailySchedule.deleteMany({ where: { employeeId: id, workDate: { gte: inactiveFrom } } });
      await tx.employeeScheduleOverride.deleteMany({ where: { employeeId: id, workDate: { gte: inactiveFrom } } });
      if (before.userId) {
        await this.ensureNotLastActiveSuperAdmin(tx, before.userId);
        await tx.user.update({ where: { id: before.userId }, data: { isActive: false } });
        await tx.refreshToken.updateMany({ where: { userId: before.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    });
    await this.audit.record({
      action: 'UPDATE', entity: 'Employee', entityId: id, before,
      after: { terminated: true, terminationDate: dto.terminationDate, terminationReason: dto.terminationReason.trim() }, ctx,
    });
    return { success: true };
  }

  async restore(id: string, ctx: AuditContext) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');
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
    const entry = await this.prisma.$transaction(async (tx) => {
      const before = await tx.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { basicSalary: true } });
      const amount = new Prisma.Decimal(dto.amount);
      const effectiveDate = this.dateOnly(new Date(dto.effectiveDate));
      const salaryEntry = await tx.salaryHistory.create({
        data: {
          employeeId,
          amount,
          currency: dto.currency ?? 'VND',
          effectiveDate,
          reason: dto.reason,
        },
      });
      await tx.employee.update({ where: { id: employeeId }, data: { basicSalary: amount } });
      await tx.employmentHistory.create({
        data: {
          employeeId,
          effectiveDate,
          changeType: 'COMPENSATION',
          reason: dto.reason,
          changes: [{
            field: 'basicSalary',
            before: await this.employmentValue(tx, 'basicSalary', before.basicSalary?.toString() ?? null),
            after: await this.employmentValue(tx, 'basicSalary', amount.toString()),
          }],
          createdById: ctx.actorId,
        },
      });
      return salaryEntry;
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

  async presignCreateUpload(dto: PresignCreateEmployeeUploadDto) {
    const folder = `employees/pending/${dto.kind === 'identity-front' ? 'identity-front' : 'identity-back'}`;
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
  private async createLoginAccount(
    db: PrismaService | Prisma.TransactionClient,
    username: string | undefined,
    email: string,
    phone: string | undefined,
    password: string,
    fullName: string,
  ): Promise<string> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = this.normalizeUsername(username ?? this.usernameFromEmail(normalizedEmail));
    const normalizedPhone = phone ? normalizeVietnamesePhone(phone) : null;
    if (phone && !normalizedPhone) {
      throw new BadRequestException('Số điện thoại đăng nhập phải là số Việt Nam hợp lệ');
    }

    const [emailTaken, usernameTaken, phoneTaken] = await Promise.all([
      db.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
      db.user.findUnique({ where: { username: normalizedUsername }, select: { id: true } }),
      normalizedPhone
        ? db.user.findUnique({ where: { phone: normalizedPhone }, select: { id: true } })
        : null,
    ]);
    if (emailTaken) throw new BadRequestException('Email đã được sử dụng bởi tài khoản khác');
    if (usernameTaken) throw new BadRequestException('Tên đăng nhập đã được sử dụng bởi tài khoản khác');
    if (phoneTaken) throw new BadRequestException('Số điện thoại đã được sử dụng bởi tài khoản khác');

    const user = await db.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        mustChangePassword: password === '123456',
        fullName,
        isActive: true,
      },
    });
    return user.id;
  }

  private usernameFromEmail(email: string) {
    const localPart = email.split('@')[0] ?? '';
    const cleaned = localPart
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/^[._-]+|[._-]+$/g, '');
    return cleaned.length >= 3 ? cleaned.slice(0, 32) : `user-${cleaned || 'account'}`;
  }

  private normalizeUsername(value: string) {
    const username = value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(username)) {
      throw new BadRequestException('Tên đăng nhập phải gồm 3-32 ký tự chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang');
    }
    return username;
  }

  /** Keep identity, tax and bank details out of the immutable audit trail. */
  private auditSnapshot(employee: Prisma.EmployeeGetPayload<Record<string, never>>) {
    const {
      identityCode: _identityCode,
      emergencyContactPhone: _emergencyContactPhone,
      taxCode: _taxCode,
      salaryBankName: _salaryBankName,
      salaryBankAccount: _salaryBankAccount,
      ...safe
    } = employee;
    return safe;
  }

  private ensureMayManageCompensation(dto: Pick<CreateEmployeeDto, 'taxCode' | 'salaryBankName' | 'salaryBankAccount' | 'basicSalary' | 'spaBonusPercent'>, canManageCompensation: boolean) {
    if (canManageCompensation) return;
    if (dto.taxCode !== undefined || dto.salaryBankName !== undefined || dto.salaryBankAccount !== undefined || dto.basicSalary !== undefined || dto.spaBonusPercent !== undefined) {
      throw new ForbiddenException('Cần quyền payroll:update để thay đổi thông tin thuế hoặc tài khoản nhận lương');
    }
  }

  private ensureMayManageAssignments(dto: Pick<CreateEmployeeDto, 'branchIds' | 'workScheduleId'>, canManageAssignments: boolean) {
    if (canManageAssignments || (dto.branchIds === undefined && dto.workScheduleId === undefined)) return;
    throw new ForbiddenException('Cần quyền quản trị chi nhánh và ca làm để thay đổi phân công');
  }

  private async assertPrimaryBranch(db: PrismaService | Prisma.TransactionClient, branchId: string | undefined) {
    if (branchId === undefined || !branchId) return;
    const branch = await db.branch.findFirst({ where: { id: branchId, isActive: true }, select: { id: true } });
    if (!branch) throw new BadRequestException('Chi nhánh làm việc chính không hợp lệ');
  }

  private assertIdentityCardKeys(dto: Pick<CreateEmployeeDto, 'identityCardFrontUrl' | 'identityCardBackUrl'>) {
    const keys = [dto.identityCardFrontUrl, dto.identityCardBackUrl].filter((key): key is string => Boolean(key));
    if (keys.some((key) => !key.startsWith('employees/pending/identity-'))) {
      throw new BadRequestException('Ảnh căn cước không hợp lệ');
    }
  }

  /** Retire active allocations instead of deleting them, preserving attendance history. */
  private async reconcileAssignments(
    tx: Prisma.TransactionClient,
    employeeId: string,
    branchIds: string[] | undefined,
    workScheduleId: string | undefined,
    effectiveFrom: Date,
  ) {
    const start = this.dateOnly(effectiveFrom);
    const previousEnd = new Date(start);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

    if (branchIds !== undefined) {
      const uniqueIds = [...new Set(branchIds)];
      if (uniqueIds.length) {
        const active = await tx.branch.count({ where: { id: { in: uniqueIds }, isActive: true } });
        if (active !== uniqueIds.length) throw new BadRequestException('Một hoặc nhiều chi nhánh không tồn tại hoặc đã ngừng hoạt động');
      }
      const activeAssignments = await tx.employeeBranchAssignment.findMany({
        where: { employeeId, effectiveTo: null }, select: { id: true, branchId: true },
      });
      await tx.employeeBranchAssignment.updateMany({
        where: { id: { in: activeAssignments.filter((item) => !uniqueIds.includes(item.branchId)).map((item) => item.id) } },
        data: { effectiveTo: previousEnd },
      });
      const existing = new Set(activeAssignments.map((item) => item.branchId));
      const additions = uniqueIds.filter((id) => !existing.has(id));
      if (additions.length) await tx.employeeBranchAssignment.createMany({ data: additions.map((branchId) => ({ employeeId, branchId, effectiveFrom: start })) });
    }

    if (workScheduleId !== undefined) {
      if (workScheduleId) {
        const schedule = await tx.workSchedule.findUnique({ where: { id: workScheduleId }, select: { id: true } });
        if (!schedule) throw new BadRequestException('Không tìm thấy ca làm');
      }
      const activeSchedules = await tx.employeeWorkScheduleAssignment.findMany({
        where: { employeeId, effectiveTo: null }, select: { id: true, workScheduleId: true },
      });
      await tx.employeeWorkScheduleAssignment.updateMany({
        where: { id: { in: activeSchedules.filter((item) => item.workScheduleId !== workScheduleId).map((item) => item.id) } },
        data: { effectiveTo: previousEnd },
      });
      if (workScheduleId && !activeSchedules.some((item) => item.workScheduleId === workScheduleId)) {
        await tx.employeeWorkScheduleAssignment.create({ data: { employeeId, workScheduleId, effectiveFrom: start } });
      }
    }
  }

  private dateOnly(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.employee.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException('Không tìm thấy nhân viên');
  }

  private async deletionEligibility(
    db: PrismaService | Prisma.TransactionClient,
    employee: { id: string; fullName: string; userId: string | null },
  ) {
    const id = employee.id;
    const [
      attendance, leaveRequests, jobHistory, salaryHistory, employmentHistory, documents, faceProfiles,
      corrections, overtime, timesheets, integrationKpi, projectMemberships,
      taskAssignments, taskComments, leaveApprovals, auditLogs,
    ] = await Promise.all([
      db.attendance.count({ where: { employeeId: id } }),
      db.leaveRequest.count({ where: { employeeId: id } }),
      db.jobHistory.count({ where: { employeeId: id } }),
      db.salaryHistory.count({ where: { employeeId: id } }),
      db.employmentHistory.count({ where: { employeeId: id } }),
      db.employeeDocument.count({ where: { employeeId: id } }),
      db.faceProfile.count({ where: { employeeId: id } }),
      db.attendanceCorrectionRequest.count({ where: { employeeId: id } }),
      db.attendanceOvertimeRequest.count({ where: { employeeId: id } }),
      db.timesheetEntry.count({ where: { employeeId: id } }),
      db.integrationKpiEvent.count({ where: { employeeId: id } }),
      db.projectMember.count({ where: { employeeId: id } }),
      db.taskAssignee.count({ where: { employeeId: id } }),
      db.taskComment.count({ where: { authorId: id } }),
      db.leaveApproval.count({ where: { approverId: id } }),
      db.auditLog.count({
        where: {
          OR: [
            { entity: 'Employee', entityId: id },
            ...(employee.userId ? [{ actorId: employee.userId }, { entity: 'User', entityId: employee.userId }] : []),
          ],
        },
      }),
    ]);
    const history = {
      attendance, leaveRequests, jobHistory, salaryHistory, employmentHistory, documents, faceProfiles,
      corrections, overtime, timesheets, integrationKpi, projectMemberships,
      taskAssignments, taskComments, leaveApprovals, auditLogs,
    };
    const total = Object.values(history).reduce((sum, count) => sum + count, 0);
    return { employeeId: id, fullName: employee.fullName, canDelete: total === 0, total, history };
  }

  private async ensureNotLastActiveSuperAdmin(db: Prisma.TransactionClient, userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isActive: true, roles: { include: { role: { select: { code: true } } } } },
    });
    if (!user?.isActive || !user.roles.some(({ role }) => role.code === 'admin')) return;
    const activeAdmins = await db.user.count({
      where: { isActive: true, deletedAt: null, roles: { some: { role: { code: 'admin' } } } },
    });
    if (activeAdmins <= 1) throw new BadRequestException('Không thể vô hiệu hóa chủ cửa hàng đang hoạt động cuối cùng');
  }

  /** Generate the next sequential employee number, e.g. NV0001. */
  private async nextEmployeeNo() {
    const employees = await this.prisma.employee.findMany({
      where: { employeeNo: { startsWith: 'NV' } },
      select: { employeeNo: true },
    });
    const lastNum = employees.reduce((max, { employeeNo }) => {
      const match = /^NV(\d+)$/i.exec(employeeNo);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `NV${String(lastNum + 1).padStart(4, '0')}`;
  }
}
