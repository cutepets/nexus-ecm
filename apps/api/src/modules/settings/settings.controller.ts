import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  RequestUser,
} from "../../common/decorators/current-user.decorator";
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
