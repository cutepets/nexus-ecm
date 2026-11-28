import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FaceService } from "./face.service";
import { EnrollFaceDto } from "./dto/face.dto";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  CurrentUser,
  RequestUser,
} from "../../common/decorators/current-user.decorator";

@ApiTags("attendance-face")
@ApiBearerAuth()
@Controller("attendance/face")
export class FaceController {
  constructor(private readonly face: FaceService) {}

  @Post("enroll")
  @ApiOperation({
    summary: "Enroll face embeddings for an employee (with dedup)",
  })
  enroll(@Body() dto: EnrollFaceDto, @CurrentUser() user: RequestUser) {
    const isSelf = user.employeeId === dto.employeeId;
    const mayManage = user.roles.includes("admin") || user.permissions.includes("attendance:face:enroll");
    if (!isSelf && !mayManage) {
      throw new ForbiddenException("Only the employee or a face manager may enroll this face");
    }
    return this.face.enroll(dto, { actorId: user.id });
  }

  @Get(":employeeId/status")
  @RequirePermissions("attendance:read")
  @ApiOperation({ summary: "Whether an employee has enrolled face profiles" })
  status(@Param("employeeId") employeeId: string) {
    return this.face.status(employeeId);
  }

  @Get(":employeeId/privacy-export")
  @RequirePermissions("attendance:face:enroll")
  @ApiOperation({
    summary:
      "Admin-only privacy export: encrypted embeddings manifest and temporary audit-image links",
  })
  privacyExport(
    @Param("employeeId") employeeId: string,
    @CurrentUser() user: RequestUser,
  ) {
    this.requireAdmin(user);
    return this.face.exportPersonalData(employeeId, { actorId: user.id });
  }

  @Delete(":employeeId")
  @RequirePermissions("attendance:face:enroll")
  @ApiOperation({ summary: "Purge all face data for an employee (privacy)" })
  purge(
    @Param("employeeId") employeeId: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.employeeId === employeeId) {
      throw new ForbiddenException("Employees cannot delete their own enrolled face");
    }
    return this.face.purge(employeeId, { actorId: user.id });
  }

  @Delete(":employeeId/privacy-data")
  @RequirePermissions("attendance:face:enroll")
  @ApiOperation({
    summary:
      "Admin-only deletion of face embeddings, enrollment sample and attendance audit images",
  })
  purgePrivacyData(
    @Param("employeeId") employeeId: string,
    @CurrentUser() user: RequestUser,
  ) {
    this.requireAdmin(user);
    return this.face.purgePersonalData(employeeId, { actorId: user.id });
  }

  private requireAdmin(user: RequestUser) {
    if (!user.roles.includes("admin"))
      throw new ForbiddenException(
        "Chỉ chủ cửa hàng được xuất hoặc xóa dữ liệu sinh trắc",
      );
  }
}
