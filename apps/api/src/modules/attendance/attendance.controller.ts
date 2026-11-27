import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Param,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AttendanceService } from "./attendance.service";
import { SchedulesService } from "./schedules.service";
import { WorkRosterService } from "./work-roster.service";
import {
  CheckDto,
  AttendanceQueryDto,
  CreateAttendanceApprovalRequestDto,
  CreateManualAttendanceRequestDto,
  CreateAttendanceCorrectionDto,
  CreateOvertimeRequestDto,
  IdentifyCheckDto,
  ReviewAttendanceDto,
  ReviewAttendanceCorrectionDto,
  UpdateAttendanceCorrectionDto,
  UpdateAttendanceSessionDto,
  CreateAttendanceSessionDto,
  UpdateAttendanceAdjustmentDto,
} from "./dto/attendance.dto";
import {
  AssignEmployeeScheduleDto,
  ReorderSchedulesDto,
  UpsertEmployeeScheduleOverrideDto,
  UpsertScheduleDto,
} from "./dto/schedule.dto";
import { ApplyWorkScheduleRangeDto, BulkDeleteWorkRosterDto, CopyWorkRosterDayDto, GenerateWorkRosterDto, UpdateDailyScheduleDto } from "./dto/work-roster.dto";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import {
  branchIdsForPeriod,
  CurrentUser,
  RequestUser,
  isPrivileged,
  permissionScope,
} from "../../common/decorators/current-user.decorator";
import { ForbiddenException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("attendance")
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly schedules: SchedulesService,
    private readonly rosters: WorkRosterService,
  ) {}

  /** Automatic face attendance always belongs to the authenticated employee. */
  private resolveSelf(dto: CheckDto, user: RequestUser): CheckDto {
    if (!user.employeeId)
      throw new ForbiddenException("Akun Anda tidak tertaut ke data karyawan");
    return { ...dto, employeeId: user.employeeId };
  }

  @Post("check-in")
  @RequirePermissions("attendance:create")
  @ApiOperation({
    summary: "Face check-in (verifies match, liveness, derives status)",
  })
  checkIn(@Body() dto: CheckDto, @CurrentUser() user: RequestUser) {
    return this.attendance.checkIn(this.resolveSelf(dto, user), {
      actorId: user.id,
    });
  }

  @Post("check-in/identify")
  @RequirePermissions("attendance:create")
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "Borrowed-device 1:N face check-in; explicit confirmation required",
  })
  checkInIdentified(
    @Body() dto: IdentifyCheckDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendance.checkInIdentified(dto, { actorId: user.id });
  }

  @Post("check-out")
  @RequirePermissions("attendance:create")
  @ApiOperation({ summary: "Face check-out for the current day" })
  checkOut(@Body() dto: CheckDto, @CurrentUser() user: RequestUser) {
    return this.attendance.checkOut(this.resolveSelf(dto, user), {
      actorId: user.id,
    });
  }

  @Post("check-out/identify")
  @RequirePermissions("attendance:create")
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "Borrowed-device 1:N face check-out; explicit confirmation required",
  })
  checkOutIdentified(
    @Body() dto: IdentifyCheckDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendance.checkOutIdentified(dto, { actorId: user.id });
  }

  @Get("check-policy")
  @RequirePermissions("attendance:create")
  @ApiOperation({
    summary: "Public-safe attendance camera policy for the current user",
  })
  checkPolicy() {
    return this.attendance.checkPolicy();
  }

  @Post("liveness-challenge")
  @RequirePermissions("attendance:create")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Issue a short-lived face liveness challenge" })
  livenessChallenge(@CurrentUser() user: RequestUser) {
    return this.attendance.issueLivenessChallenge(user.id);
  }

  @Get("manual-work-schedules")
  @RequirePermissions("attendance:create")
  @ApiOperation({
    summary: "List work schedules available for manual attendance",
  })
  manualWorkSchedules() {
    return this.schedules.list();
  }

  @Get("roster")
  @RequirePermissions("attendance:read")
  @ApiOperation({ summary: "Monthly work roster, grouped by store in the client" })
  roster(@Query("month") month: string, @CurrentUser() user: RequestUser) {
    return this.rosters.list(month, user.employeeId, isPrivileged(user, "attendance:update"));
  }

  @Post("roster/generate")
  @RequirePermissions("attendance-policy:update")
  generateRoster(@Body() dto: GenerateWorkRosterDto, @CurrentUser() user: RequestUser) {
    return this.rosters.generate(dto.month, { actorId: user.id });
  }

  @Put("roster/day")
  @RequirePermissions("attendance-policy:update")
  updateRosterDay(@Body() dto: UpdateDailyScheduleDto, @CurrentUser() user: RequestUser) {
    return this.rosters.updateDay(dto, { actorId: user.id });
  }

  @Post("roster/range")
  @RequirePermissions("attendance-policy:update")
  applyRosterRange(@Body() dto: ApplyWorkScheduleRangeDto, @CurrentUser() user: RequestUser) {
    return this.rosters.applyRange(dto, { actorId: user.id });
  }

  @Post("roster/bulk-delete")
  @RequirePermissions("attendance-policy:update")
  bulkDeleteRoster(@Body() dto: BulkDeleteWorkRosterDto, @CurrentUser() user: RequestUser) {
    return this.rosters.bulkDelete(dto, { actorId: user.id });
  }

  @Post("roster/copy-day")
  @RequirePermissions("attendance-policy:update")
  copyRosterDay(@Body() dto: CopyWorkRosterDayDto, @CurrentUser() user: RequestUser) {
    return this.rosters.copyDay(dto, { actorId: user.id });
  }

  @Post("manual-requests")
  @RequirePermissions("attendance:create")
  @ApiOperation({
    summary:
      "Create a self-service manual attendance request after failed face verification",
  })
  createManualRequest(
    @Body() dto: CreateManualAttendanceRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (
      !isPrivileged(user, "attendance:update") &&
      (!user.employeeId || user.employeeId !== dto.employeeId)
    )
      throw new ForbiddenException(
        "Chỉ được chấm công thủ công cho chính mình",
      );
    return this.attendance.createManualAttendanceRequest(dto, {
      actorId: user.id,
    });
  }

  @Post("approval-requests")
  @RequirePermissions("attendance:create")
  @ApiOperation({
    summary: "Create a pending attendance request for an exception",
  })
  createApprovalRequest(
    @Body() dto: CreateAttendanceApprovalRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (
      !isPrivileged(user, "attendance:update") &&
      user.employeeId !== dto.employeeId
    )
      throw new ForbiddenException("Chỉ được gửi yêu cầu cho chính mình");
    return this.attendance.createApprovalRequest(dto, { actorId: user.id });
  }

  @Get("pending-approvals")
  @RequirePermissions("attendance:review")
  @ApiOperation({ summary: "List attendance requests awaiting review" })
  pendingApprovals() {
    return this.attendance.pendingApprovals();
  }

  @Get(":id/approval-history")
  @RequirePermissions("attendance:read")
  @ApiOperation({
    summary: "Read the audit history of an attendance approval request",
  })
  approvalHistory(@Param("id") id: string) {
    return this.attendance.approvalHistory(id);
  }

  @Put(":id/review")
  @RequirePermissions("attendance:review")
  @ApiOperation({ summary: "Approve or reject a pending attendance request" })
  reviewApproval(
    @Param("id") id: string,
    @Body() dto: ReviewAttendanceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendance.reviewApproval(id, dto, { actorId: user.id });
  }

  @Delete(":id/approval-request")
  @RequirePermissions("attendance:delete")
  @ApiOperation({ summary: "Admin removes an attendance approval request" })
  removeApprovalRequest(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user.roles.includes("ADMIN"))
      throw new ForbiddenException(
        "Chỉ quản trị viên được xóa phiếu xin duyệt",
      );
    return this.attendance.removeApprovalRequest(id, { actorId: user.id });
  }

  @Put(":attendanceId/sessions/:sessionId")
  @RequirePermissions("attendance:update")
  @ApiOperation({ summary: "Admin updates a recorded attendance session" })
  updateSession(
    @Param("attendanceId") attendanceId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: UpdateAttendanceSessionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendance.updateSession(attendanceId, sessionId, dto, {
      actorId: user.id,
    });
  }

  @Post(":attendanceId/sessions")
  @RequirePermissions("attendance:update")
  @ApiOperation({ summary: "Manager adds the second attendance session" })
  createSession(
    @Param("attendanceId") attendanceId: string,
    @Body() dto: CreateAttendanceSessionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendance.createSession(attendanceId, dto, {
      actorId: user.id,
    });
  }

  @Put(":id/adjustment")
  @RequirePermissions("attendance:update")
  @ApiOperation({
    summary:
      "Manager updates the schedule or financial override of one attendance record",
  })
  updateAdjustment(
    @Param("id") id: string,
    @Body() dto: UpdateAttendanceAdjustmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendance.updateAdjustment(id, dto, { actorId: user.id });
  }

  @Delete(":attendanceId/sessions/:sessionId")
  @RequirePermissions("attendance:update")
  @ApiOperation({ summary: "Admin removes a recorded attendance session" })
  removeSession(
    @Param("attendanceId") attendanceId: string,
    @Param("sessionId") sessionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendance.removeSession(attendanceId, sessionId, {
      actorId: user.id,
    });
  }

  @Post("correction-requests")
  @RequirePermissions("attendance:create")
  @ApiOperation({
    summary:
      "Submit a missing-punch correction request for the authenticated employee",
  })
  createCorrectionRequest(
    @Body() dto: CreateAttendanceCorrectionDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user.employeeId)
      throw new ForbiddenException(
        "Tài khoản chưa được liên kết với hồ sơ nhân viên",
      );
    return this.attendance.createCorrectionRequest(user.employeeId, dto, {
      actorId: user.id,
    });
  }

  @Get("correction-requests/pending")
  @RequirePermissions("attendance:review")
  pendingCorrectionRequests() {
    return this.attendance.pendingCorrectionRequests();
  }

  @Put("correction-requests/:id")
  @RequirePermissions("attendance:create")
  updateCorrectionRequest(
    @Param("id") id: string,
    @Body() dto: UpdateAttendanceCorrectionDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user.employeeId)
      throw new ForbiddenException(
        "Tài khoản chưa được liên kết với hồ sơ nhân viên",
      );
    return this.attendance.updateCorrectionRequest(id, user.employeeId, dto, {
      actorId: user.id,
    });
  }

  @Put("correction-requests/:id/review")
  @RequirePermissions("attendance:review")
  reviewCorrectionRequest(
    @Param("id") id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendance.reviewCorrectionRequest(id, dto, {
      actorId: user.id,
    });
  }

  @Get(":id/correction-requests")
  @RequirePermissions("attendance:read")
  correctionRequests(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const scope = isPrivileged(user, "attendance:update")
      ? null
      : (user.employeeId ?? "__none__");
    return this.attendance.correctionRequests(
      id,
      scope,
      user.roles.includes("ADMIN"),
    );
  }

  @Post("overtime-requests")
  @RequirePermissions("attendance:create")
  @ApiOperation({
    summary: "Request overtime after checkout exceeds the configured trigger",
  })
  createOvertimeRequest(
    @Body() dto: CreateOvertimeRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!user.employeeId)
      throw new ForbiddenException(
        "Tài khoản chưa được liên kết với hồ sơ nhân viên",
      );
    return this.attendance.createOvertimeRequest(user.employeeId, dto, {
      actorId: user.id,
    });
  }

  @Get("overtime-requests/pending")
  @RequirePermissions("attendance:review")
  pendingOvertimeRequests() {
    return this.attendance.pendingOvertimeRequests();
  }

  @Put("overtime-requests/:id/review")
  @RequirePermissions("attendance:review")
  reviewOvertimeRequest(
    @Param("id") id: string,
    @Body() dto: ReviewAttendanceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendance.reviewOvertimeRequest(id, dto, { actorId: user.id });
  }

  @Get("me/summary")
  @RequirePermissions("attendance:read")
  @ApiOperation({ summary: "Personal month-to-date attendance summary" })
  mySummary(@CurrentUser() user: RequestUser) {
    if (!user.employeeId)
      throw new ForbiddenException("Akun Anda tidak tertaut ke data karyawan");
    return this.attendance.myMonthSummary(user.employeeId);
  }

  @Get("employees/:employeeId/eligible-locations")
  @RequirePermissions("attendance:read")
  @ApiOperation({
    summary: "Active attendance locations assigned to an employee",
  })
  eligibleLocations(
    @Param("employeeId") employeeId: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (
      !isPrivileged(user, "attendance:update") &&
      user.employeeId !== employeeId
    )
      throw new ForbiddenException(
        "Không được xem điểm chấm công của nhân viên khác",
      );
    return this.attendance.eligibleLocations(employeeId);
  }

  @Get()
  @RequirePermissions("attendance:read")
  @ApiOperation({
    summary: "List attendance records (employees see only their own)",
  })
  list(@Query() query: AttendanceQueryDto, @CurrentUser() user: RequestUser) {
    const canManage = isPrivileged(user, "attendance:update");
    const readScope = permissionScope(user, "attendance:read");
    const reference = query.date ?? query.from ?? query.to;
    const referenceDate = reference ? new Date(reference) : new Date();
    const from = query.from ? new Date(query.from) : new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const to = query.to ? new Date(query.to) : query.date ? new Date(query.date) : new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const scopeEmployeeId = readScope === "ALL" ? null : readScope === "SELF" ? (user.employeeId ?? "__none__") : undefined;
    const branchIds = readScope === "BRANCH" ? branchIdsForPeriod(user, from, to) : undefined;
    return this.attendance.list(query, scopeEmployeeId, canManage, branchIds, { from, to });
  }

  @Get("summary")
  @RequirePermissions("attendance:read")
  @ApiOperation({ summary: "Company status breakdown (privileged only)" })
  summary(
    @Query("date") date: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!isPrivileged(user, "attendance:update"))
      throw new ForbiddenException("Tidak diizinkan");
    return this.attendance.summary(date);
  }

  // ---- Work schedules ----

  @Get("schedules")
  @RequirePermissions("attendance-policy:read")
  @ApiOperation({ summary: "List work schedules" })
  listSchedules() {
    return this.schedules.list();
  }

  @Post("schedules")
  @RequirePermissions("attendance-policy:create")
  @ApiOperation({ summary: "Create a work schedule" })
  createSchedule(
    @Body() dto: UpsertScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedules.create(dto, { actorId: user.id });
  }

  @Put("schedules/order")
  @RequirePermissions("attendance-policy:update")
  @ApiOperation({ summary: "Reorder work schedules" })
  reorderSchedules(
    @Body() dto: ReorderSchedulesDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedules.reorder(dto, { actorId: user.id });
  }

  @Put("schedules/:id")
  @RequirePermissions("attendance-policy:update")
  @ApiOperation({ summary: "Update a work schedule" })
  updateSchedule(
    @Param("id") id: string,
    @Body() dto: UpsertScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedules.update(id, dto, { actorId: user.id });
  }

  @Delete("schedules/:id")
  @RequirePermissions("attendance-policy:delete")
  @ApiOperation({ summary: "Delete a work schedule" })
  removeSchedule(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.schedules.remove(id, { actorId: user.id });
  }

  @Get("schedules/assignments")
  @RequirePermissions("attendance-policy:read")
  @ApiOperation({
    summary: "List effective-dated employee schedule assignments",
  })
  listScheduleAssignments(@Query("employeeId") employeeId?: string) {
    return this.schedules.listAssignments(employeeId);
  }

  @Post("schedules/assignments")
  @RequirePermissions("attendance-policy:update")
  @ApiOperation({ summary: "Assign a work schedule to an employee" })
  assignSchedule(
    @Body() dto: AssignEmployeeScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedules.assignEmployee(dto, { actorId: user.id });
  }

  @Delete("schedules/assignments/:assignmentId")
  @RequirePermissions("attendance-policy:update")
  @ApiOperation({ summary: "Remove an employee work-schedule assignment" })
  removeScheduleAssignment(
    @Param("assignmentId") assignmentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedules.removeAssignment(assignmentId, { actorId: user.id });
  }

  @Get("schedules/overrides")
  @RequirePermissions("attendance-policy:read")
  @ApiOperation({ summary: "List one-day employee schedule overrides" })
  listScheduleOverrides(
    @Query("employeeId") employeeId?: string,
    @Query("workDate") workDate?: string,
  ) {
    return this.schedules.listOverrides(employeeId, workDate);
  }

  @Get("schedules/resolve")
  @RequirePermissions("attendance-policy:read")
  @ApiOperation({
    summary: "Resolve the effective schedule for one employee/date",
  })
  resolveSchedule(
    @Query("employeeId") employeeId: string,
    @Query("workDate") workDate: string,
  ) {
    return this.schedules.resolve(employeeId, workDate);
  }

  @Post("schedules/overrides")
  @RequirePermissions("attendance-policy:update")
  @ApiOperation({
    summary: "Create or update a one-day employee schedule override",
  })
  setScheduleOverride(
    @Body() dto: UpsertEmployeeScheduleOverrideDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedules.setOverride(dto, { actorId: user.id });
  }

  @Delete("schedules/overrides/:id")
  @RequirePermissions("attendance-policy:update")
  @ApiOperation({ summary: "Remove a one-day employee schedule override" })
  removeScheduleOverride(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedules.removeOverride(id, { actorId: user.id });
  }

  @Get(":id")
  @RequirePermissions("attendance:read")
  @ApiOperation({
    summary: "Read one attendance record with signed audit photos",
  })
  getDetail(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    const scope = isPrivileged(user, "attendance:update")
      ? null
      : (user.employeeId ?? "__none__");
    return this.attendance.getDetail(id, scope, user.roles.includes("ADMIN"));
  }
}
