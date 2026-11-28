import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { AuditContext, AuditService } from "../../core/audit/audit.service";
import { PrismaService } from "../../core/prisma/prisma.service";
import { StorageService } from "../../core/storage/storage.service";
import { CryptoService } from "../../core/crypto/crypto.service";
import { GoogleDriveStorageProvider } from "../../core/storage/google-drive-storage.provider";
import {
  CreateBranchDto,
  CreateEmployeeBranchAssignmentDto,
  ReorderBranchesDto,
  UpdateAttendancePolicyDto,
  UpdateBranchDto,
  UpdateCompanySettingDto,
  UpdateEmploymentTypesDto,
  UpdateIntegrationSettingDto,
  UpdatePayrollSettingDto,
} from "./dto/company-setting.dto";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly crypto: CryptoService,
    private readonly googleDrive: GoogleDriveStorageProvider,
  ) {}

  private async companyRecord() {
    return this.prisma.companySetting.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    });
  }

  private async companyResponse(
    record: Awaited<ReturnType<SettingsService["companyRecord"]>>,
  ) {
    const {
      logoKey,
      googleDriveOAuthClientSecretEnc: _googleDriveOAuthClientSecretEnc,
      googleDriveOAuthRefreshTokenEnc: _googleDriveOAuthRefreshTokenEnc,
      googleDriveOAuthStateHash: _googleDriveOAuthStateHash,
      googleDriveOAuthStateExpiresAt: _googleDriveOAuthStateExpiresAt,
      googleDriveConfigFingerprint: _googleDriveConfigFingerprint,
      ...safe
    } = record;
    return {
      ...safe,
      timezone: "Asia/Ho_Chi_Minh",
      logoUrl: logoKey ? await this.storage.presignedDownload(logoKey, 3600) : null,
    };
  }

  async getCompany() {
    return this.companyResponse(await this.companyRecord());
  }

  async getBranding() {
    const setting = await this.companyRecord();
    return {
      companyName: setting.companyName,
      logoUrl: setting.logoKey ? await this.storage.presignedDownload(setting.logoKey, 3600) : null,
    };
  }

  async getStorageSettings() {
    await this.companyRecord();
    const [setting] = await this.prisma.$queryRaw<Array<{
      storageProvider: string | null;
      googleDriveFolderId: string | null;
      googleDriveOAuthClientId: string | null;
      googleDriveOAuthClientSecretEnc: Uint8Array | null;
      googleDriveOAuthRefreshTokenEnc: Uint8Array | null;
      googleDriveOAuthEmail: string | null;
      googleDriveConnectionVerifiedAt: Date | null;
    }>>`SELECT "storageProvider"::text AS "storageProvider", "googleDriveFolderId", "googleDriveOAuthClientId", "googleDriveOAuthClientSecretEnc", "googleDriveOAuthRefreshTokenEnc", "googleDriveOAuthEmail", "googleDriveConnectionVerifiedAt" FROM "company_settings" WHERE id = 'default' LIMIT 1`;
    const environmentProvider = process.env.STORAGE_PROVIDER?.trim().toUpperCase();
    return {
      storageProvider: setting?.storageProvider ?? (environmentProvider === "GOOGLE_DRIVE" ? "GOOGLE_DRIVE" : "MINIO"),
      googleDriveFolderId: setting?.googleDriveFolderId ?? "",
      googleDriveOAuthClientId: setting?.googleDriveOAuthClientId ?? "",
      oauthClientSecretConfigured: Boolean(setting?.googleDriveOAuthClientSecretEnc),
      oauthConnected: Boolean(setting?.googleDriveOAuthRefreshTokenEnc),
      googleDriveOAuthEmail: setting?.googleDriveOAuthEmail ?? null,
      oauthRedirectUri: this.googleDrive.oauthRedirectUri(),
      connectionVerified: await this.googleDrive.isConfigured(),
      connectionVerifiedAt: setting?.googleDriveConnectionVerifiedAt,
    };
  }

  async updateGoogleDriveOAuthSettings(
    dto: { clientId: string; clientSecret?: string; folderId: string },
    ctx: AuditContext,
  ) {
    await this.companyRecord();
    const clientId = dto.clientId?.trim();
    const folderId = dto.folderId?.trim();
    const clientSecret = dto.clientSecret?.trim();
    if (!clientId || !folderId) throw new BadRequestException("OAuth Client ID và folder ID là bắt buộc.");
    const [before] = await this.prisma.$queryRaw<Array<{
      storageProvider: string | null;
      googleDriveOAuthClientId: string | null;
      googleDriveOAuthClientSecretEnc: Uint8Array | null;
    }>>`SELECT "storageProvider"::text AS "storageProvider", "googleDriveOAuthClientId", "googleDriveOAuthClientSecretEnc" FROM "company_settings" WHERE id = 'default' LIMIT 1`;
    if (!clientSecret && (!before?.googleDriveOAuthClientSecretEnc || before.googleDriveOAuthClientId !== clientId)) {
      throw new BadRequestException("Cần nhập OAuth Client Secret cho Client ID mới.");
    }
    const secretEnc = clientSecret
      ? this.crypto.encrypt(Buffer.from(clientSecret, "utf8"))
      : Buffer.from(before!.googleDriveOAuthClientSecretEnc!);
    const clientChanged = before?.googleDriveOAuthClientId !== clientId || Boolean(clientSecret);
    await this.prisma.$executeRaw`
      UPDATE "company_settings"
      SET "googleDriveOAuthClientId" = ${clientId},
          "googleDriveOAuthClientSecretEnc" = ${secretEnc},
          "googleDriveOAuthRefreshTokenEnc" = CASE WHEN ${clientChanged} THEN NULL ELSE "googleDriveOAuthRefreshTokenEnc" END,
          "googleDriveOAuthEmail" = CASE WHEN ${clientChanged} THEN NULL ELSE "googleDriveOAuthEmail" END,
          "googleDriveFolderId" = ${folderId},
          "googleDriveOAuthStateHash" = NULL,
          "googleDriveOAuthStateExpiresAt" = NULL,
          "googleDriveConnectionVerifiedAt" = NULL,
          "googleDriveConfigFingerprint" = NULL,
          "storageProvider" = CASE WHEN "storageProvider" = 'GOOGLE_DRIVE'::"StorageProvider"
            THEN 'MINIO'::"StorageProvider" ELSE "storageProvider" END
      WHERE id = 'default'`;
    await this.audit.record({
      action: "UPDATE",
      entity: "StorageSettings",
      entityId: "default",
      before: { storageProvider: before?.storageProvider ?? "MINIO" },
      after: { authMode: "OAUTH", googleDriveFolderId: folderId, oauthClientUpdated: clientChanged },
      ctx,
    });
    return this.getStorageSettings();
  }

  async startGoogleDriveOAuth() {
    await this.companyRecord();
    const state = randomBytes(32).toString("base64url");
    const stateHash = createHash("sha256").update(state).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.$executeRaw`
      UPDATE "company_settings"
      SET "googleDriveOAuthStateHash" = ${stateHash},
          "googleDriveOAuthStateExpiresAt" = ${expiresAt}
      WHERE id = 'default'`;
    return {
      url: await this.googleDrive.createOAuthAuthorizationUrl(state),
      redirectUri: this.googleDrive.oauthRedirectUri(),
    };
  }

  async completeGoogleDriveOAuth(state: string, code: string) {
    if (!state || !code) throw new BadRequestException("Thiếu mã xác thực hoặc trạng thái OAuth.");
    const stateHash = createHash("sha256").update(state).digest("hex");
    const consumed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "company_settings"
      SET "googleDriveOAuthStateHash" = NULL,
          "googleDriveOAuthStateExpiresAt" = NULL
      WHERE id = 'default'
        AND "googleDriveOAuthStateHash" = ${stateHash}
        AND "googleDriveOAuthStateExpiresAt" > NOW()
      RETURNING id`;
    if (!consumed.length) throw new BadRequestException("Liên kết OAuth đã hết hạn hoặc đã được sử dụng. Hãy bắt đầu kết nối lại.");

    const { refreshToken, email } = await this.googleDrive.exchangeOAuthCode(code);
    const refreshTokenEnc = this.crypto.encrypt(Buffer.from(refreshToken, "utf8"));
    await this.prisma.$executeRaw`
      UPDATE "company_settings"
      SET "googleDriveOAuthRefreshTokenEnc" = ${refreshTokenEnc},
          "googleDriveOAuthEmail" = ${email},
          "googleDriveConnectionVerifiedAt" = NULL,
          "googleDriveConfigFingerprint" = NULL
      WHERE id = 'default'`;
    const result = await this.googleDrive.testConnection();
    await this.prisma.$executeRaw`
      UPDATE "company_settings"
      SET "googleDriveConnectionVerifiedAt" = ${new Date()},
          "googleDriveConfigFingerprint" = ${result.configFingerprint}
      WHERE id = 'default'`;
    return { email, folderName: result.folderName };
  }

  async testGoogleDriveConnection(ctx: AuditContext) {
    const result = await this.googleDrive.testConnection();
    await this.prisma.$executeRaw`
      UPDATE "company_settings"
      SET "googleDriveConnectionVerifiedAt" = ${new Date()},
          "googleDriveConfigFingerprint" = ${result.configFingerprint}
      WHERE id = 'default'`;
    await this.audit.record({
      action: "UPDATE",
      entity: "StorageSettings",
      entityId: "default",
      after: { googleDriveConnectionVerified: true, folderName: result.folderName },
      ctx,
    });
    const { configFingerprint: _fingerprint, ...safeResult } = result;
    return safeResult;
  }

  async selectStorageProvider(provider: string, ctx: AuditContext) {
    const normalized = provider.trim().toUpperCase();
    if (normalized !== "MINIO" && normalized !== "GOOGLE_DRIVE") {
      throw new BadRequestException("Chế độ lưu trữ phải là MINIO hoặc GOOGLE_DRIVE.");
    }
    await this.companyRecord();
    const [before] = await this.prisma.$queryRaw<Array<{
      storageProvider: string | null;
      googleDriveConnectionVerifiedAt: Date | null;
      googleDriveConfigFingerprint: string | null;
    }>>`SELECT "storageProvider"::text AS "storageProvider", "googleDriveConnectionVerifiedAt", "googleDriveConfigFingerprint" FROM "company_settings" WHERE id = 'default' LIMIT 1`;
    let verifiedAt = before?.googleDriveConnectionVerifiedAt ?? null;
    let configFingerprint = before?.googleDriveConfigFingerprint ?? null;
    if (normalized === "GOOGLE_DRIVE") {
      const result = await this.googleDrive.testConnection();
      verifiedAt = new Date();
      configFingerprint = result.configFingerprint;
    }
    await this.prisma.$executeRaw`
      UPDATE "company_settings"
      SET "storageProvider" = CASE WHEN ${normalized} = 'GOOGLE_DRIVE'
            THEN 'GOOGLE_DRIVE'::"StorageProvider" ELSE 'MINIO'::"StorageProvider" END,
          "googleDriveConnectionVerifiedAt" = ${verifiedAt},
          "googleDriveConfigFingerprint" = ${configFingerprint}
      WHERE id = 'default'`;
    await this.audit.record({
      action: "UPDATE",
      entity: "StorageSettings",
      entityId: "default",
      before: { storageProvider: before?.storageProvider ?? "MINIO" },
      after: { storageProvider: normalized },
      ctx,
    });
    return this.getStorageSettings();
  }

  async updateCompany(dto: UpdateCompanySettingDto, ctx: AuditContext) {
    const before = await this.companyRecord();
    const { logo, removeLogo, ...settingData } = dto;
    const nextLogoKey = logo
      ? await this.storage.putBase64Image("company/brand", logo)
      : removeLogo
        ? null
        : before.logoKey;
    const updated = await this.prisma.companySetting.update({
      where: { id: "default" },
      data: { ...settingData, requireGps: true, logoKey: nextLogoKey },
    });
    if (nextLogoKey !== before.logoKey && before.logoKey)
      await this.storage.remove(before.logoKey);
    await this.audit.record({
      action: "UPDATE",
      entity: "CompanySetting",
      entityId: updated.id,
      before: this.auditSnapshot(before),
      after: this.auditSnapshot(updated),
      ctx,
    });
    return this.companyResponse(updated);
  }

  async getAttendancePolicy() {
    await this.companyRecord();
    return this.prisma.companySetting.findUniqueOrThrow({
      where: { id: "default" },
      select: {
        requireGps: true,
        livenessMode: true,
        faceDuplicateThreshold: true,
        auditRetentionDays: true,
        rosterAutoGenerateEnabled: true,
        rosterGenerationDay: true,
      },
    });
  }

  async updateAttendancePolicy(
    dto: UpdateAttendancePolicyDto,
    ctx: AuditContext,
  ) {
    const before = await this.getAttendancePolicy();
    const updated = await this.prisma.companySetting.update({
      where: { id: "default" },
      data: { ...dto, requireGps: true },
    });
    const after = this.attendancePolicySnapshot(updated);
    await this.audit.record({
      action: "UPDATE",
      entity: "AttendancePolicy",
      entityId: updated.id,
      before,
      after,
      ctx,
    });
    return after;
  }

  async getEmploymentTypes() {
    await this.companyRecord();
    return this.prisma.companySetting.findUniqueOrThrow({
      where: { id: "default" },
      select: { employmentTypes: true },
    });
  }

  async updateEmploymentTypes(
    dto: UpdateEmploymentTypesDto,
    ctx: AuditContext,
  ) {
    const before = await this.getEmploymentTypes();
    const updated = await this.prisma.companySetting.update({
      where: { id: "default" },
      data: dto,
    });
    const after = { employmentTypes: updated.employmentTypes };
    await this.audit.record({
      action: "UPDATE",
      entity: "EmploymentTypeSetting",
      entityId: updated.id,
      before,
      after,
      ctx,
    });
    return after;
  }

  async getPayroll() {
    await this.companyRecord();
    const setting = await this.prisma.companySetting.findUniqueOrThrow({
      where: { id: "default" },
      select: {
        payrollMode: true,
        workUnitMode: true,
        payrollCutoffDay: true,
        timesheetStartDay: true,
        timesheetEndDay: true,
        latePenaltyPerMinute: true,
        missingPunchPenalty: true,
        overtimeTriggerMinutes: true,
        overtimeMultiplier: true,
      },
    });
    return this.payrollSnapshot(setting);
  }

  async updatePayroll(dto: UpdatePayrollSettingDto, ctx: AuditContext) {
    const before = await this.getPayroll();
    const updated = await this.prisma.companySetting.update({
      where: { id: "default" },
      data: dto,
    });
    const after = this.payrollSnapshot(updated);
    await this.audit.record({
      action: "UPDATE",
      entity: "PayrollSetting",
      entityId: updated.id,
      before,
      after,
      ctx,
    });
    return after;
  }

  async getIntegration() {
    await this.companyRecord();
    return this.prisma.companySetting.findUniqueOrThrow({
      where: { id: "default" },
      select: { integrationApiEnabled: true, integrationAllowedOrigins: true },
    });
  }

  async updateIntegration(dto: UpdateIntegrationSettingDto, ctx: AuditContext) {
    const before = await this.getIntegration();
    const updated = await this.prisma.companySetting.update({
      where: { id: "default" },
      data: dto,
    });
    const after = this.integrationSnapshot(updated);
    await this.audit.record({
      action: "UPDATE",
      entity: "IntegrationSetting",
      entityId: updated.id,
      before,
      after,
      ctx,
    });
    return after;
  }

  listBranches() {
    return this.prisma.branch.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  }

  async createBranch(dto: CreateBranchDto, ctx: AuditContext) {
    const branch = await this.prisma.$transaction(async (tx) => {
      const last = await tx.branch.aggregate({ _max: { displayOrder: true } });
      const created = await tx.branch.create({ data: { ...dto, displayOrder: (last._max.displayOrder ?? -1) + 1 } });
      await tx.branchLocation.create({
        data: {
          branchId: created.id,
          code: `${created.code}-MAIN`,
          name: `${created.name} - Điểm chính`,
          address: created.address,
          latitude: created.latitude,
          longitude: created.longitude,
          radiusMeters: created.radiusMeters,
          isActive: created.isActive,
        },
      });
      return created;
    });
    await this.audit.record({
      action: "CREATE",
      entity: "Branch",
      entityId: branch.id,
      after: branch,
      ctx,
    });
    return branch;
  }

  async reorderBranches(dto: ReorderBranchesDto, ctx: AuditContext) {
    const existing = await this.prisma.branch.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((branch) => branch.id));
    if (dto.branchIds.length !== existing.length || dto.branchIds.some((id) => !existingIds.has(id))) {
      throw new ConflictException("Danh sách sắp xếp chi nhánh không hợp lệ");
    }
    await this.prisma.$transaction(dto.branchIds.map((id, displayOrder) =>
      this.prisma.branch.update({ where: { id }, data: { displayOrder } }),
    ));
    await this.audit.record({ action: "UPDATE", entity: "BranchOrder", entityId: "all", after: dto.branchIds, ctx });
    return this.listBranches();
  }

  async updateBranch(id: string, dto: UpdateBranchDto, ctx: AuditContext) {
    const before = await this.prisma.branch.findUniqueOrThrow({
      where: { id },
    });
    const branch = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.branch.update({ where: { id }, data: dto });
      const primaryLocation = await tx.branchLocation.findFirst({
        where: { branchId: id },
        orderBy: { createdAt: "asc" },
      });
      const locationData = {
        code: `${updated.code}-MAIN`,
        name: `${updated.name} - Điểm chấm`,
        address: updated.address,
        latitude: updated.latitude,
        longitude: updated.longitude,
        radiusMeters: updated.radiusMeters,
        isActive: updated.isActive,
        allowRemote: false,
      };
      if (primaryLocation) {
        await tx.branchLocation.update({
          where: { id: primaryLocation.id },
          data: locationData,
        });
        await tx.branchLocation.updateMany({
          where: { branchId: id, id: { not: primaryLocation.id } },
          data: { isActive: false, allowRemote: false },
        });
      } else {
        await tx.branchLocation.create({
          data: { ...locationData, branchId: id },
        });
      }
      return updated;
    });
    await this.audit.record({
      action: "UPDATE",
      entity: "Branch",
      entityId: id,
      before,
      after: branch,
      ctx,
    });
    return branch;
  }

  async removeBranch(id: string, ctx: AuditContext) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException("Không tìm thấy chi nhánh");
    const [assignments, attendance] = await Promise.all([
      this.prisma.employeeBranchAssignment.count({ where: { branchId: id } }),
      this.prisma.attendance.count({
        where: {
          OR: [
            { checkInLocation: { branchId: id } },
            { checkOutLocation: { branchId: id } },
          ],
        },
      }),
    ]);
    if (assignments || attendance)
      throw new ConflictException(
        "Chi nhánh đã có phân công hoặc lịch sử chấm công; hãy ngừng hoạt động thay vì xóa",
      );
    await this.prisma.branch.delete({ where: { id } });
    await this.audit.record({
      action: "DELETE",
      entity: "Branch",
      entityId: id,
      before: branch,
      ctx,
    });
    return { success: true };
  }

  listEmployeeBranchAssignments(employeeId?: string) {
    return this.prisma.employeeBranchAssignment.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: {
        employee: { select: { id: true, fullName: true, employeeNo: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  async createEmployeeBranchAssignment(
    dto: CreateEmployeeBranchAssignmentDto,
    ctx: AuditContext,
  ) {
    const assignment = await this.prisma.employeeBranchAssignment.create({
      data: {
        ...dto,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
    });
    await this.audit.record({
      action: "CREATE",
      entity: "EmployeeBranchAssignment",
      entityId: assignment.id,
      after: assignment,
      ctx,
    });
    return assignment;
  }

  async removeEmployeeBranchAssignment(id: string, ctx: AuditContext) {
    const assignment = await this.prisma.employeeBranchAssignment.findUnique({
      where: { id },
      include: {
        employee: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    });
    if (!assignment)
      throw new NotFoundException("Không tìm thấy phân công chi nhánh");
    await this.prisma.employeeBranchAssignment.delete({ where: { id } });
    await this.audit.record({
      action: "DELETE",
      entity: "EmployeeBranchAssignment",
      entityId: id,
      before: assignment,
      ctx,
    });
    return { success: true };
  }

  private auditSnapshot(setting: {
    companyName: string;
    locale: string;
    timezone: string;
    currency: string;
    weekStartsOn: number;
    requireGps: boolean;
    livenessMode: string;
    faceDuplicateThreshold: number;
    auditRetentionDays: number;
    trustedWebOrigins: string[];
  }) {
    return {
      companyName: setting.companyName,
      locale: setting.locale,
      timezone: "Asia/Ho_Chi_Minh",
      currency: setting.currency,
      weekStartsOn: setting.weekStartsOn,
      requireGps: setting.requireGps,
      livenessMode: setting.livenessMode,
      faceDuplicateThreshold: setting.faceDuplicateThreshold,
      auditRetentionDays: setting.auditRetentionDays,
      trustedWebOrigins: setting.trustedWebOrigins,
    };
  }

  private attendancePolicySnapshot(setting: {
    requireGps: boolean;
    livenessMode: string;
    faceDuplicateThreshold: number;
    auditRetentionDays: number;
    rosterAutoGenerateEnabled: boolean;
    rosterGenerationDay: number;
  }) {
    return {
      requireGps: setting.requireGps,
      livenessMode: setting.livenessMode,
      faceDuplicateThreshold: setting.faceDuplicateThreshold,
      auditRetentionDays: setting.auditRetentionDays,
      rosterAutoGenerateEnabled: setting.rosterAutoGenerateEnabled,
      rosterGenerationDay: setting.rosterGenerationDay,
    };
  }

  private payrollSnapshot(setting: {
    payrollMode: string;
    workUnitMode: string;
    payrollCutoffDay: number;
    timesheetStartDay: number;
    timesheetEndDay: number;
    latePenaltyPerMinute: unknown;
    missingPunchPenalty: unknown;
    overtimeTriggerMinutes: number;
    overtimeMultiplier: number;
  }) {
    return {
      payrollMode: setting.payrollMode,
      workUnitMode: setting.workUnitMode,
      payrollCutoffDay: setting.payrollCutoffDay,
      timesheetStartDay: setting.timesheetStartDay,
      timesheetEndDay: setting.timesheetEndDay,
      latePenaltyPerMinute: Number(setting.latePenaltyPerMinute),
      missingPunchPenalty: Number(setting.missingPunchPenalty),
      overtimeTriggerMinutes: setting.overtimeTriggerMinutes,
      overtimeMultiplier: setting.overtimeMultiplier,
    };
  }

  private integrationSnapshot(setting: {
    integrationApiEnabled: boolean;
    integrationAllowedOrigins: string[];
  }) {
    return {
      integrationApiEnabled: setting.integrationApiEnabled,
      integrationAllowedOrigins: setting.integrationAllowedOrigins,
    };
  }
}
