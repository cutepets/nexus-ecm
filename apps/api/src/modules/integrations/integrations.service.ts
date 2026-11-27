import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Prisma } from "@nexus/database";
import { PrismaService } from "../../core/prisma/prisma.service";
import { AuditContext, AuditService } from "../../core/audit/audit.service";
import { CryptoService } from "../../core/crypto/crypto.service";
import {
  CreateIntegrationApiKeyDto,
  CreateIntegrationKpiFieldDto,
  CreateKpiEventDto,
  INTEGRATION_SCOPES,
  IntegrationScope,
} from "./dto/integration.dto";

const MAX_PAGE_SIZE = 100;

@Injectable()
export class IntegrationsService implements OnModuleInit, OnModuleDestroy {
  private retryTimer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
  ) {}

  onModuleInit() {
    this.retryTimer = setInterval(() => void this.processDueWebhooks(), 30_000);
    void this.processDueWebhooks();
  }

  onModuleDestroy() {
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  async listKeys() {
    return this.prisma.integrationApiKey.findMany({
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        branchIds: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createKey(dto: CreateIntegrationApiKeyDto, ctx: AuditContext) {
    if (dto.scopes.some((scope) => !INTEGRATION_SCOPES.includes(scope)))
      throw new BadRequestException("Scope tích hợp không hợp lệ");
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date())
      throw new BadRequestException("Ngày hết hạn phải ở tương lai");

    const keyPrefix = `nxs_${randomBytes(6).toString("hex")}`;
    const rawKey = `${keyPrefix}.${randomBytes(32).toString("base64url")}`;
    const key = await this.prisma.integrationApiKey.create({
      data: {
        name: dto.name,
        keyPrefix,
        secretHash: this.hash(rawKey),
        scopes: dto.scopes,
        branchIds: dto.branchIds ?? [],
        expiresAt,
        createdById: ctx.actorId,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        branchIds: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    await this.audit.record({
      action: "CREATE",
      entity: "IntegrationApiKey",
      entityId: key.id,
      after: key,
      ctx,
    });
    return { ...key, apiKey: rawKey };
  }

  async revokeKey(id: string, ctx: AuditContext) {
    const before = await this.prisma.integrationApiKey.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException("Không tìm thấy API key tích hợp");
    if (before.revokedAt) return { success: true };
    const key = await this.prisma.integrationApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      action: "DELETE",
      entity: "IntegrationApiKey",
      entityId: id,
      before: this.safeKey(before),
      after: this.safeKey(key),
      ctx,
    });
    return { success: true };
  }

  listKpiFields() {
    return this.prisma.integrationKpiField.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
  }

  async createKpiField(dto: CreateIntegrationKpiFieldDto, ctx: AuditContext) {
    const field = await this.prisma.integrationKpiField.create({
      data: {
        ...dto,
        required: dto.required ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.record({
      action: "CREATE",
      entity: "IntegrationKpiField",
      entityId: field.id,
      after: field,
      ctx,
    });
    return field;
  }

  async removeKpiField(id: string, ctx: AuditContext) {
    const field = await this.prisma.integrationKpiField.findUnique({
      where: { id },
    });
    if (!field) throw new NotFoundException("Không tìm thấy trường KPI");
    await this.prisma.integrationKpiField.delete({ where: { id } });
    await this.audit.record({
      action: "DELETE",
      entity: "IntegrationKpiField",
      entityId: id,
      before: field,
      ctx,
    });
    return { success: true };
  }

  async listWebhooks() {
    return this.prisma.integrationWebhookSubscription.findMany({
      select: {
        id: true,
        url: true,
        eventTypes: true,
        isActive: true,
        createdAt: true,
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createWebhook(
    url: string,
    eventTypes: string[] | undefined,
    ctx: AuditContext,
  ) {
    this.assertWebhookUrl(url);
    const secret = randomBytes(32).toString("hex");
    const webhook = await this.prisma.integrationWebhookSubscription.create({
      data: {
        url,
        eventTypes: eventTypes ?? [],
        secretCiphertext: this.crypto.encrypt(Buffer.from(secret, "utf8")),
        createdById: ctx.actorId,
      },
      select: {
        id: true,
        url: true,
        eventTypes: true,
        isActive: true,
        createdAt: true,
      },
    });
    await this.audit.record({
      action: "CREATE",
      entity: "IntegrationWebhookSubscription",
      entityId: webhook.id,
      after: { ...webhook, secretReturnedOnce: true },
      ctx,
    });
    return { ...webhook, secret };
  }

  async deactivateWebhook(id: string, ctx: AuditContext) {
    const before = await this.prisma.integrationWebhookSubscription.findUnique({
      where: { id },
      select: { id: true, url: true, isActive: true },
    });
    if (!before) throw new NotFoundException("Không tìm thấy webhook tích hợp");
    if (before.isActive)
      await this.prisma.integrationWebhookSubscription.update({
        where: { id },
        data: { isActive: false },
      });
    await this.audit.record({
      action: "DELETE",
      entity: "IntegrationWebhookSubscription",
      entityId: id,
      before,
      after: { isActive: false },
      ctx,
    });
    return { success: true };
  }

  async authenticate(rawKey: string | undefined, scope: IntegrationScope) {
    if (!rawKey) throw new UnauthorizedException("Thiếu API key tích hợp");
    const [keyPrefix, secret] = rawKey.split(".", 2);
    if (!keyPrefix || !secret || !keyPrefix.startsWith("nxs_"))
      throw new UnauthorizedException("API key không hợp lệ");
    const key = await this.prisma.integrationApiKey.findUnique({
      where: { keyPrefix },
    });
    const suppliedHash = this.hash(rawKey);
    if (
      !key ||
      !timingSafeEqual(Buffer.from(suppliedHash), Buffer.from(key.secretHash))
    )
      throw new UnauthorizedException("API key không hợp lệ");
    if (key.revokedAt || (key.expiresAt && key.expiresAt <= new Date()))
      throw new ForbiddenException("API key đã bị thu hồi hoặc hết hạn");
    if (!key.scopes.includes(scope))
      throw new ForbiddenException("API key không có scope cần thiết");
    await this.prisma.integrationApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    return key;
  }

  async employees(rawKey: string | undefined, cursor?: string, limit?: number) {
    const key = await this.authenticate(rawKey, "employees:read");
    const take = this.pageSize(limit);
    const items = await this.prisma.employee.findMany({
      where: { deletedAt: null, workStatus: { notIn: ["INACTIVE", "ABANDONED"] } },
      select: {
        id: true,
        employeeNo: true,
        fullName: true,
        email: true,
        phone: true,
        department: { select: { code: true, name: true } },
        position: { select: { title: true } },
      },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    return this.cursorPage(items, take, key.keyPrefix);
  }

  async branches(rawKey: string | undefined, cursor?: string, limit?: number) {
    const key = await this.authenticate(rawKey, "branches:read");
    const take = this.pageSize(limit);
    const items = await this.prisma.branch.findMany({
      where: {
        isActive: true,
        ...(key.branchIds.length ? { id: { in: key.branchIds } } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        isActive: true,
      },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    return this.cursorPage(items, take, key.keyPrefix);
  }

  async attendance(
    rawKey: string | undefined,
    from?: string,
    to?: string,
    cursor?: string,
    limit?: number,
  ) {
    const key = await this.authenticate(rawKey, "attendance:read");
    const take = this.pageSize(limit);
    const workDate = {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
    };
    const items = await this.prisma.attendance.findMany({
      where: {
        ...(Object.keys(workDate).length ? { workDate } : {}),
        ...(key.branchIds.length
          ? {
              OR: [
                { checkInLocation: { branchId: { in: key.branchIds } } },
                { checkOutLocation: { branchId: { in: key.branchIds } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        workDate: true,
        checkInAt: true,
        checkOutAt: true,
        status: true,
        approvalStatus: true,
        employee: { select: { id: true, employeeNo: true, fullName: true } },
        checkInLocation: {
          select: { branch: { select: { id: true, code: true, name: true } } },
        },
        checkOutLocation: {
          select: { branch: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    return this.cursorPage(items, take, key.keyPrefix);
  }

  async createKpiEvent(
    rawKey: string | undefined,
    idempotencyKey: string | undefined,
    dto: CreateKpiEventDto,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 200)
      throw new BadRequestException(
        "Idempotency-Key là bắt buộc và không quá 200 ký tự",
      );
    const key = await this.authenticate(rawKey, "kpi-events:write");
    if (key.branchIds.length && !key.branchIds.includes(dto.branchId))
      throw new ForbiddenException(
        "API key không có quyền ghi cho chi nhánh này",
      );
    await this.assertKpiPayload(dto.payload);
    const requestHash = this.hash(JSON.stringify(dto));
    const previous = await this.prisma.integrationIdempotencyRecord.findUnique({
      where: {
        apiKeyId_endpoint_idempotencyKey: {
          apiKeyId: key.id,
          endpoint: "kpi-events",
          idempotencyKey,
        },
      },
    });
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new BadRequestException(
          "Idempotency-Key đã được dùng với dữ liệu khác",
        );
      return previous.response;
    }

    const [employee, branch] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id: dto.employeeId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.branch.findFirst({
        where: { id: dto.branchId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!employee)
      throw new NotFoundException("Không tìm thấy nhân viên đang hoạt động");
    if (!branch)
      throw new NotFoundException("Không tìm thấy chi nhánh đang hoạt động");

    const result = { accepted: true, externalId: dto.externalId };
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.integrationKpiEvent.create({
          data: {
            apiKeyId: key.id,
            externalId: dto.externalId,
            employeeId: dto.employeeId,
            branchId: dto.branchId,
            occurredAt: new Date(dto.occurredAt),
            salesAmount: new Prisma.Decimal(dto.salesAmount ?? 0),
            orderCount: dto.orderCount ?? 0,
            currency: (dto.currency ?? "VND").toUpperCase(),
            payload: dto.payload as Prisma.InputJsonValue | undefined,
          },
        });
        await tx.integrationIdempotencyRecord.create({
          data: {
            apiKeyId: key.id,
            endpoint: "kpi-events",
            idempotencyKey,
            requestHash,
            response: result,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.prisma.integrationKpiEvent.findUnique({
          where: {
            apiKeyId_externalId: {
              apiKeyId: key.id,
              externalId: dto.externalId,
            },
          },
          select: { externalId: true },
        });
        if (existing)
          return {
            accepted: true,
            externalId: existing.externalId,
            duplicate: true,
          };
      }
      throw error;
    }
    await this.audit.record({
      action: "CREATE",
      entity: "IntegrationKpiEvent",
      entityId: dto.externalId,
      after: {
        externalId: dto.externalId,
        employeeId: dto.employeeId,
        branchId: dto.branchId,
        occurredAt: dto.occurredAt,
      },
      ctx: { actorId: key.createdById ?? undefined },
    });
    await this.queueWebhook("kpi.event.accepted", {
      externalId: dto.externalId,
      employeeId: dto.employeeId,
      branchId: dto.branchId,
      occurredAt: dto.occurredAt,
      salesAmount: dto.salesAmount ?? 0,
      orderCount: dto.orderCount ?? 0,
      currency: (dto.currency ?? "VND").toUpperCase(),
      payload: dto.payload ?? {},
    });
    return result;
  }

  private async queueWebhook(
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const subscriptions =
      await this.prisma.integrationWebhookSubscription.findMany({
        where: {
          isActive: true,
          OR: [
            { eventTypes: { isEmpty: true } },
            { eventTypes: { has: eventType } },
          ],
        },
        select: { id: true },
      });
    if (!subscriptions.length) return;
    await this.prisma.integrationWebhookDelivery.createMany({
      data: subscriptions.map((subscription) => ({
        subscriptionId: subscription.id,
        eventType,
        payload: payload as Prisma.InputJsonValue,
      })),
    });
  }

  private async processDueWebhooks() {
    if (this.processing) return;
    this.processing = true;
    try {
      const deliveries = await this.prisma.integrationWebhookDelivery.findMany({
        where: {
          status: "PENDING",
          nextAttemptAt: { lte: new Date() },
          subscription: { isActive: true },
        },
        include: {
          subscription: { select: { url: true, secretCiphertext: true } },
        },
        orderBy: { nextAttemptAt: "asc" },
        take: 20,
      });
      for (const delivery of deliveries) await this.deliverWebhook(delivery);
    } finally {
      this.processing = false;
    }
  }

  private async deliverWebhook(delivery: {
    id: string;
    eventType: string;
    payload: Prisma.JsonValue;
    attempts: number;
    subscription: { url: string; secretCiphertext: Buffer };
  }) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify(delivery.payload);
    const secret = this.crypto
      .decrypt(delivery.subscription.secretCiphertext)
      .toString("utf8");
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let statusCode: number | undefined;
    let errorMessage: string | undefined;
    try {
      const response = await fetch(delivery.subscription.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-nexus-event": delivery.eventType,
          "x-nexus-delivery": delivery.id,
          "x-nexus-timestamp": timestamp,
          "x-nexus-signature": `sha256=${signature}`,
        },
        body,
      });
      statusCode = response.status;
      if (response.ok) {
        await this.prisma.integrationWebhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "DELIVERED",
            attempts: { increment: 1 },
            lastStatusCode: statusCode,
            lastError: null,
            deliveredAt: new Date(),
          },
        });
        return;
      }
      errorMessage = `HTTP ${statusCode}`;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Webhook delivery failed";
    } finally {
      clearTimeout(timeout);
    }
    const attempts = delivery.attempts + 1;
    const deadLetter = attempts >= 5;
    await this.prisma.integrationWebhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attempts,
        lastStatusCode: statusCode,
        lastError: errorMessage?.slice(0, 1000),
        status: deadLetter ? "DEAD_LETTER" : "PENDING",
        nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** (attempts - 1)),
      },
    });
    if (deadLetter)
      await this.audit.record({
        action: "UPDATE",
        entity: "IntegrationWebhookDelivery",
        entityId: delivery.id,
        after: { status: "DEAD_LETTER", attempts, error: errorMessage },
      });
  }

  private assertWebhookUrl(rawUrl: string) {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      host === "localhost" ||
      host.endsWith(".local") ||
      /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    )
      throw new BadRequestException(
        "Webhook phải dùng HTTPS công khai; không được trỏ vào mạng nội bộ",
      );
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private async assertKpiPayload(payload: Record<string, unknown> | undefined) {
    const fields = await this.prisma.integrationKpiField.findMany({
      where: { isActive: true },
      select: { key: true, fieldType: true, required: true },
    });
    const values = payload ?? {};
    for (const field of fields) {
      const value = values[field.key];
      if (
        field.required &&
        (value === undefined || value === null || value === "")
      )
        throw new BadRequestException(
          `Thiếu chỉ số KPI bắt buộc: ${field.key}`,
        );
      if (value === undefined || value === null) continue;
      if (
        field.fieldType === "NUMBER" &&
        (typeof value !== "number" || !Number.isFinite(value))
      )
        throw new BadRequestException(`Chỉ số ${field.key} phải là số`);
      if (field.fieldType === "TEXT" && typeof value !== "string")
        throw new BadRequestException(`Chỉ số ${field.key} phải là văn bản`);
      if (field.fieldType === "BOOLEAN" && typeof value !== "boolean")
        throw new BadRequestException(`Chỉ số ${field.key} phải là đúng/sai`);
    }
  }
  private pageSize(limit?: number) {
    return Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || 50));
  }
  private cursorPage<T extends { id: string }>(
    items: T[],
    take: number,
    keyPrefix: string,
  ) {
    const hasMore = items.length > take;
    const visible = hasMore ? items.slice(0, take) : items;
    return {
      items: visible,
      nextCursor: hasMore ? visible.at(-1)?.id : null,
      integration: keyPrefix,
    };
  }
  private safeKey(key: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    branchIds: string[];
    expiresAt: Date | null;
    revokedAt: Date | null;
  }) {
    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      branchIds: key.branchIds,
      expiresAt: key.expiresAt,
      revokedAt: key.revokedAt,
    };
  }
}
