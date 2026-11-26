import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentUser,
  RequestUser,
} from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  CreateIntegrationApiKeyDto,
  CreateIntegrationKpiFieldDto,
  CreateIntegrationWebhookDto,
  CreateKpiEventDto,
} from "./dto/integration.dto";
import { IntegrationsService } from "./integrations.service";

@ApiTags("integration-admin")
@ApiBearerAuth()
@Controller("integrations/api-keys")
export class IntegrationAdminController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @RequirePermissions("integration:read")
  list() {
    return this.integrations.listKeys();
  }

  @Post()
  @RequirePermissions("integration:create")
  @ApiOperation({
    summary:
      "Create a scoped API key; its plaintext value is returned once only",
  })
  create(
    @Body() dto: CreateIntegrationApiKeyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.integrations.createKey(dto, { actorId: user.id });
  }

  @Delete(":id")
  @RequirePermissions("integration:delete")
  @ApiOperation({
    summary: "Revoke an API key without deleting its audit trail",
  })
  revoke(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.integrations.revokeKey(id, { actorId: user.id });
  }

  @Get("kpi-fields")
  @RequirePermissions("integration:read")
  listKpiFields() {
    return this.integrations.listKpiFields();
  }

  @Post("kpi-fields")
  @RequirePermissions("integration:update")
  createKpiField(
    @Body() dto: CreateIntegrationKpiFieldDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.integrations.createKpiField(dto, { actorId: user.id });
  }

  @Delete("kpi-fields/:id")
  @RequirePermissions("integration:update")
  removeKpiField(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.integrations.removeKpiField(id, { actorId: user.id });
  }

  @Get("webhooks")
  @RequirePermissions("integration:read")
  listWebhooks() {
    return this.integrations.listWebhooks();
  }

  @Post("webhooks")
  @RequirePermissions("integration:update")
  createWebhook(
    @Body() dto: CreateIntegrationWebhookDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.integrations.createWebhook(dto.url, dto.eventTypes, {
      actorId: user.id,
    });
  }

  @Delete("webhooks/:id")
  @RequirePermissions("integration:update")
  deactivateWebhook(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.integrations.deactivateWebhook(id, { actorId: user.id });
  }
}

@ApiTags("integrations")
@Public()
@Controller("integrations")
@Throttle({ default: { limit: 100, ttl: 60_000 } })
export class IntegrationDataController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get("employees")
  @ApiHeader({ name: "x-api-key", required: true })
  @ApiOperation({
    summary: "List active employee directory records for a scoped integration",
  })
  employees(
    @Headers("x-api-key") key: string | undefined,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: number,
  ) {
    return this.integrations.employees(key, cursor, limit);
  }

  @Get("branches")
  @ApiHeader({ name: "x-api-key", required: true })
  branches(
    @Headers("x-api-key") key: string | undefined,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: number,
  ) {
    return this.integrations.branches(key, cursor, limit);
  }

  @Get("attendance")
  @ApiHeader({ name: "x-api-key", required: true })
  attendance(
    @Headers("x-api-key") key: string | undefined,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: number,
  ) {
    return this.integrations.attendance(key, from, to, cursor, limit);
  }

  @Post("kpi-events")
  @ApiHeader({ name: "x-api-key", required: true })
  @ApiHeader({ name: "idempotency-key", required: true })
  @ApiOperation({
    summary:
      "Accept a POS/KPI event exactly once per API key and Idempotency-Key",
  })
  createKpiEvent(
    @Headers("x-api-key") key: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreateKpiEventDto,
  ) {
    return this.integrations.createKpiEvent(key, idempotencyKey, dto);
  }
}
