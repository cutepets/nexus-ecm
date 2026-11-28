import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  RequestUser,
} from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  CreateBranchDto,
  ReorderBranchesDto,
  UpdateAttendancePolicyDto,
  UpdateBranchDto,
  UpdateCompanySettingDto,
  UpdateEmploymentTypesDto,
  UpdateIntegrationSettingDto,
  UpdatePayrollSettingDto,
} from "./dto/company-setting.dto";
import { SettingsService } from "./settings.service";

@ApiTags("settings")
@ApiBearerAuth()
@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get("company")
  @RequirePermissions("settings:read")
  @ApiOperation({ summary: "Read company-wide settings" })
  getCompany() {
    return this.settings.getCompany();
  }

  @Get("branding")
  @Public()
  @ApiOperation({
    summary: "Read safe company brand identity for the application shell",
  })
  getBranding() {
    return this.settings.getBranding();
  }

  @Put("company")
  @RequirePermissions("settings:update")
  @ApiOperation({ summary: "Update company-wide settings" })
  updateCompany(
    @Body() dto: UpdateCompanySettingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settings.updateCompany(dto, { actorId: user.id });
  }

  @Get("storage")
  @RequirePermissions("settings:read")
  @ApiOperation({ summary: "Read storage provider and Google Drive connection state" })
  getStorageSettings() {
    return this.settings.getStorageSettings();
  }

  @Put("storage/google-drive/oauth")
  @RequirePermissions("settings:update")
  @ApiOperation({ summary: "Save Google OAuth settings for a personal Google account" })
  updateGoogleDriveOAuthSettings(
    @Body() dto: { clientId: string; clientSecret?: string; folderId: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.settings.updateGoogleDriveOAuthSettings(dto, { actorId: user.id });
  }

  @Post("storage/google-drive/oauth/start")
  @RequirePermissions("settings:update")
  @ApiOperation({ summary: "Start Google Drive OAuth authorization" })
  startGoogleDriveOAuth() {
    return this.settings.startGoogleDriveOAuth();
  }

  @Get("storage/google-drive/oauth/callback")
  @Public()
  @ApiOperation({ summary: "Complete Google Drive OAuth authorization" })
  async completeGoogleDriveOAuth(
    @Query("state") state: string,
    @Query("code") code: string,
    @Query("error") oauthError: string,
    @Res() response: Response,
  ) {
    let webUrl = process.env.WEB_URL?.trim() || "http://localhost:3100";
    while (webUrl.endsWith("/")) webUrl = webUrl.slice(0, -1);
    let result = "error";
    if (!oauthError) {
      try {
        await this.settings.completeGoogleDriveOAuth(state, code);
        result = "success";
      } catch {
        result = "error";
      }
    }
    return response.redirect(`${webUrl}/dashboard/pengaturan?section=storage&drive_oauth=${result}`);
  }

  @Post("storage/google-drive/test")
  @RequirePermissions("settings:update")
  @ApiOperation({ summary: "Test Google Drive folder read and write access" })
  testGoogleDriveConnection(@CurrentUser() user: RequestUser) {
    return this.settings.testGoogleDriveConnection({ actorId: user.id });
  }

  @Put("storage/provider")
  @RequirePermissions("settings:update")
  @ApiOperation({ summary: "Select MinIO or Google Drive as active storage" })
  selectStorageProvider(@Body() dto: { provider: string }, @CurrentUser() user: RequestUser) {
    return this.settings.selectStorageProvider(dto.provider, { actorId: user.id });
  }

  @Get("branches")
  @RequirePermissions("branch:read")
  listBranches() {
    return this.settings.listBranches();
  }

  @Post("branches")
  @RequirePermissions("branch:create")
  createBranch(@Body() dto: CreateBranchDto, @CurrentUser() user: RequestUser) {
    return this.settings.createBranch(dto, { actorId: user.id });
  }

  @Put("branches/order")
  @RequirePermissions("branch:update")
  reorderBranches(
    @Body() dto: ReorderBranchesDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settings.reorderBranches(dto, { actorId: user.id });
  }

  @Put("branches/:id")
  @RequirePermissions("branch:update")
  updateBranch(
    @Param("id") id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settings.updateBranch(id, dto, { actorId: user.id });
  }

  @Delete("branches/:id")
  @RequirePermissions("branch:delete")
  removeBranch(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.settings.removeBranch(id, { actorId: user.id });
  }

  @Get("attendance-policy")
  @RequirePermissions("attendance-policy:read")
  getAttendancePolicy() {
    return this.settings.getAttendancePolicy();
  }

  @Put("attendance-policy")
  @RequirePermissions("attendance-policy:update")
  updateAttendancePolicy(
    @Body() dto: UpdateAttendancePolicyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settings.updateAttendancePolicy(dto, { actorId: user.id });
  }

  @Get("employment-types")
  @RequirePermissions("settings:read")
  getEmploymentTypes() {
    return this.settings.getEmploymentTypes();
  }

  @Put("employment-types")
  @RequirePermissions("settings:update")
  updateEmploymentTypes(
    @Body() dto: UpdateEmploymentTypesDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settings.updateEmploymentTypes(dto, { actorId: user.id });
  }

  @Get("payroll")
  @RequirePermissions("payroll:read")
  getPayroll() {
    return this.settings.getPayroll();
  }

  @Put("payroll")
  @RequirePermissions("payroll:update")
  updatePayroll(
    @Body() dto: UpdatePayrollSettingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settings.updatePayroll(dto, { actorId: user.id });
  }

  @Get("integration")
  @RequirePermissions("integration:read")
  getIntegration() {
    return this.settings.getIntegration();
  }

  @Put("integration")
  @RequirePermissions("integration:update")
  updateIntegration(
    @Body() dto: UpdateIntegrationSettingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settings.updateIntegration(dto, { actorId: user.id });
  }
}
