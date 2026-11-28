import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@nexus/database";
import { PrismaService } from "../../core/prisma/prisma.service";
import { StorageService } from "../../core/storage/storage.service";
import { AuditService, AuditContext } from "../../core/audit/audit.service";
import { FaceService } from "./face.service";
import { ScheduleResolverService } from "./schedule-resolver.service";
import { WorkRosterService } from "./work-roster.service";
import {
  CheckDto,
  CreateAttendanceSessionDto,
  AttendanceQueryDto,
  CreateAttendanceApprovalRequestDto,
  CreateAttendanceCorrectionDto,
  CreateManualAttendanceRequestDto,
  CreateOvertimeRequestDto,
  IdentifyCheckDto,
  ReviewAttendanceCorrectionDto,
  ReviewAttendanceDto,
  UpdateAttendanceCorrectionDto,
  UpdateAttendanceAdjustmentDto,
  UpdateAttendanceSessionDto,
} from "./dto/attendance.dto";
import { distanceToConfidence, minDistance } from "./embedding.util";
import {
  isoDateInTimeZone,
  minutesInTimeZone,
  monthStartInTimeZone,
  workDateFromIsoDate,
  workDateInTimeZone,
} from "../../common/utils/company-time";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type LivenessPolicy = "NONE" | "BLINK" | "TURN_HEAD" | "RANDOM" | "SMILE" | "NOD";
type IssuedLivenessChallenge = Exclude<
  CheckDto["livenessChallenge"],
  "NONE" | undefined
>;

type AttendanceApprovalUpdate = {
  exceptionTypes?: string[];
  reviewState?: "NEEDS_MORE_INFO";
  items?: Array<{
    type: string;
    decision: "PENDING" | "APPROVED" | "REJECTED";
    note?: string;
    proposedCheckIn?: string;
    proposedCheckOut?: string;
    proposedCheckIn2?: string;
    proposedCheckOut2?: string;
    workScheduleId?: string;
    workScheduleName?: string;
    branchLocationId?: string;
    targetEmployeeId?: string;
    overtimeMinutes?: number;
  }>;
  targetEmployeeId?: string;
  branchLocationId?: string;
  workScheduleId?: string;
  workScheduleBranchIds?: string[];
  appliesTo?: "CHECK_IN" | "CHECK_OUT";
  proposedCheckIn?: string;
  proposedCheckOut?: string;
  proposedCheckIn2?: string;
  proposedCheckOut2?: string;
  overtimeMinutes?: number;
  manualLatePenalty?: number;
  manualReward?: number;
  manualScheduleTimes?: {
    startTime: string;
    endTime: string;
    secondStartTime: string;
    secondEndTime: string;
  };
};

@Injectable()
export class AttendanceService {
  private readonly threshold = Number(process.env.FACE_MATCH_THRESHOLD ?? 0.55);
  private readonly usedLivenessNonces = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly face: FaceService,
    private readonly scheduleResolver: ScheduleResolverService,
    private readonly workRoster: WorkRosterService,
  ) {}

  async checkIn(dto: CheckDto, ctx: AuditContext) {
    const { employee, matchScore } = await this.verify(dto);
    const livenessPolicy = await this.livenessPolicy();
    await this.assertLiveness(dto, livenessPolicy, ctx.actorId ?? "");

    const now = new Date();
    const timezone = await this.companyTimezone();
    const workDate = workDateInTimeZone(now, timezone);
    const geofence = await this.resolveGeofence(employee.id, dto, workDate);
    const status = await this.deriveStatus(
      employee.id,
      workDate,
      now,
      timezone,
    );
    const photoUrl = dto.photo
      ? await this.storage.putBase64Image(
          `attendance/${employee.id}/in`,
          dto.photo,
        )
      : undefined;

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      include: {
        sessions: { orderBy: { sequence: "desc" }, take: 1 },
        _count: { select: { sessions: true } },
      },
    });
    if (existing?.sessions[0] && !existing.sessions[0].checkOutAt)
      throw new BadRequestException(
        "Bạn đang có một phiên chấm công chưa chấm ra",
      );
    if (existing && existing._count.sessions >= 2)
      throw new BadRequestException(
        "Mỗi ngày chỉ hỗ trợ tối đa 2 ca chấm công",
      );

    const checkInData = {
      checkInAt: now,
      checkInLat: dto.lat,
      checkInLng: dto.lng,
      checkInLocationId: geofence.locationId,
      checkInAccuracyMeters: dto.accuracyMeters,
      checkInDistanceMeters: geofence.distanceMeters,
      checkInPhotoUrl: photoUrl,
    };
    const record = await this.prisma.$transaction(async (tx) => {
      if (!existing) {
        const created = await tx.attendance.create({
          data: {
            employeeId: employee.id,
            workDate,
            ...checkInData,
            geofenceReason: geofence.reason,
            deviceInfo: dto.deviceInfo as Prisma.InputJsonValue,
            matchScore,
            livenessPassed: dto.livenessPassed,
            livenessChallenge: dto.livenessChallenge,
            livenessPolicy,
            status,
          },
        });
        await tx.attendanceSession.create({
          data: { attendanceId: created.id, sequence: 1, ...checkInData },
        });
        return created;
      }
      const sequence = (existing.sessions[0]?.sequence ?? 0) + 1;
      await tx.attendanceSession.create({
        data: { attendanceId: existing.id, sequence, ...checkInData },
      });
      return tx.attendance.update({
        where: { id: existing.id },
        data: existing.checkInAt
          ? { deviceInfo: dto.deviceInfo as Prisma.InputJsonValue }
          : {
              ...checkInData,
              geofenceReason: geofence.reason,
              deviceInfo: dto.deviceInfo as Prisma.InputJsonValue,
              matchScore,
              livenessPassed: dto.livenessPassed,
              livenessChallenge: dto.livenessChallenge,
              livenessPolicy,
              status,
            },
      });
    });

    await this.audit.record({
      action: "CREATE",
      entity: "AttendanceSession",
      entityId: record.id,
      after: {
        status,
        geofence: geofence.reason,
        locationId: geofence.locationId,
        livenessPolicy,
        session: existing ? (existing.sessions[0]?.sequence ?? 0) + 1 : 1,
      },
      ctx,
    });
    void this.purgeExpiredAuditPhotos();
    return {
      ...this.withoutAuditPhotoKeys(record),
      employee: { id: employee.id, fullName: employee.fullName },
      matchScore,
      overtime: await this.overtimeEligibility(employee.id, workDate, now),
    };
  }

  async checkOut(dto: CheckDto, ctx: AuditContext) {
    const { employee, matchScore } = await this.verify(dto);
    await this.assertLiveness(
      dto,
      await this.livenessPolicy(),
      ctx.actorId ?? "",
    );

    const now = new Date();
    const workDate = workDateInTimeZone(now, await this.companyTimezone());
    const geofence = await this.resolveGeofence(employee.id, dto, workDate);
    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      include: { sessions: { orderBy: { sequence: "desc" }, take: 1 } },
    });
    if (!existing) throw new BadRequestException("No check-in found for today");
    const latestSession = existing.sessions[0];
    if (!latestSession)
      throw new BadRequestException(
        "Không tìm thấy phiên chấm công trong ngày",
      );

    const photoUrl = dto.photo
      ? await this.storage.putBase64Image(
          `attendance/${employee.id}/out`,
          dto.photo,
        )
      : undefined;

    const checkOutData = {
      checkOutAt: now,
      checkOutLat: dto.lat,
      checkOutLng: dto.lng,
      checkOutLocationId: geofence.locationId,
      checkOutAccuracyMeters: dto.accuracyMeters,
      checkOutDistanceMeters: geofence.distanceMeters,
      checkOutPhotoUrl: photoUrl,
    };
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.attendanceSession.update({
        where: { id: latestSession.id },
        data: {
          ...checkOutData,
          checkOutUpdateCount: { increment: latestSession.checkOutAt ? 1 : 0 },
        },
      });
      return tx.attendance.update({
        where: { id: existing.id },
        data: {
          ...checkOutData,
          // Older placeholder records may contain a session while their day
          // summary has no check-in. Repair that summary as part of checkout.
          ...(existing.checkInAt
            ? {}
            : {
                checkInAt: latestSession.checkInAt,
                checkInLat: latestSession.checkInLat,
                checkInLng: latestSession.checkInLng,
                checkInLocationId: latestSession.checkInLocationId,
                checkInAccuracyMeters: latestSession.checkInAccuracyMeters,
                checkInDistanceMeters: latestSession.checkInDistanceMeters,
                checkInPhotoUrl: latestSession.checkInPhotoUrl,
                status: "PRESENT",
              }),
        },
      });
    });

    await this.audit.record({
      action: "UPDATE",
      entity: "AttendanceSession",
      entityId: latestSession.id,
      after: {
        checkOut: true,
        updatedCheckOut: Boolean(latestSession.checkOutAt),
        geofence: geofence.reason,
        locationId: geofence.locationId,
      },
      ctx,
    });
    void this.purgeExpiredAuditPhotos();
    return {
      ...this.withoutAuditPhotoKeys(record),
      employee: { id: employee.id, fullName: employee.fullName },
      matchScore,
      overtime: await this.overtimeEligibility(employee.id, workDate, now),
    };
  }

  async checkInIdentified(dto: IdentifyCheckDto, ctx: AuditContext) {
    const workDate = workDateInTimeZone(
      new Date(),
      await this.companyTimezone(),
    );
    const candidateIds = await this.identificationCandidates(dto, workDate);
    const { employee } = await this.face.identify(dto.embedding, candidateIds);
    return this.checkIn(
      {
        ...dto,
        employeeId: employee.id,
        deviceInfo: { ...dto.deviceInfo, attendanceMode: "BORROWED_DEVICE_1N" },
      },
      ctx,
    );
  }

  async checkOutIdentified(dto: IdentifyCheckDto, ctx: AuditContext) {
    const workDate = workDateInTimeZone(
      new Date(),
      await this.companyTimezone(),
    );
    const candidateIds = await this.identificationCandidates(dto, workDate);
    const { employee } = await this.face.identify(dto.embedding, candidateIds);
    return this.checkOut(
      {
        ...dto,
        employeeId: employee.id,
        deviceInfo: { ...dto.deviceInfo, attendanceMode: "BORROWED_DEVICE_1N" },
      },
      ctx,
    );
  }

  async createApprovalRequest(
    dto: CreateAttendanceApprovalRequestDto,
    ctx: AuditContext,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!employee)
      throw new NotFoundException("Không tìm thấy hồ sơ nhân viên");
    const now = new Date();
    const currentWorkDate = workDateInTimeZone(
      now,
      await this.companyTimezone(),
    );
    const existing = await (dto.attendanceId
      ? this.prisma.attendance.findFirst({
          where: { id: dto.attendanceId, employeeId: employee.id },
          include: {
            sessions: { orderBy: { sequence: "desc" }, take: 1 },
            _count: { select: { sessions: true } },
          },
        })
      : this.prisma.attendance.findUnique({
          where: {
            employeeId_workDate: {
              employeeId: employee.id,
              workDate: currentWorkDate,
            },
          },
          include: {
            sessions: { orderBy: { sequence: "desc" }, take: 1 },
            _count: { select: { sessions: true } },
          },
        }));
    const workDate = existing?.workDate ?? currentWorkDate;
    if (existing?.approvalStatus === "PENDING" && dto.action !== "REVIEW")
      throw new BadRequestException("Đã có yêu cầu chờ duyệt cho ngày này");
    if (dto.action === "REVIEW" && !existing)
      throw new BadRequestException("Chưa có lượt chấm công để gửi xin duyệt");
    if (dto.action === "CHECK_IN" && existing?.checkInAt)
      throw new BadRequestException(
        "Đã có giờ chấm vào; không thể tạo yêu cầu mới",
      );
    if (
      dto.action === "CHECK_OUT" &&
      (!existing?.checkInAt || existing.checkOutAt)
    )
      throw new BadRequestException("Chưa đủ điều kiện tạo yêu cầu chấm ra");

    const exceptionTypes = Array.from(
      new Set(
        dto.exceptionTypes?.length ? dto.exceptionTypes : [dto.exceptionType],
      ),
    );
    if (exceptionTypes.includes("OVERTIME") && !existing?.checkOutAt)
      throw new BadRequestException(
        "Chỉ có thể xin làm thêm sau khi đã chấm ra",
      );
    if (
      exceptionTypes.includes("OVERTIME") &&
      (!dto.overtimeMinutes || dto.overtimeMinutes < 1)
    )
      throw new BadRequestException("Hãy nhập số phút xin làm thêm");
    if (exceptionTypes.includes("FACE_UNRECOGNIZED")) {
      if (!dto.targetEmployeeId)
        throw new BadRequestException(
          "Hãy chọn tài khoản nhân viên cần gắn lại lượt chấm",
        );
      const target = await this.prisma.employee.findFirst({
        where: { id: dto.targetEmployeeId, deletedAt: null },
        select: { id: true },
      });
      if (!target)
        throw new NotFoundException(
          "Không tìm thấy tài khoản nhân viên được chọn",
        );
    }
    if (exceptionTypes.includes("GPS_UNAVAILABLE")) {
      if (!dto.branchLocationId)
        throw new BadRequestException("Hãy chọn chi nhánh/điểm chấm công");
      const location = await this.prisma.branchLocation.findFirst({
        where: {
          id: dto.branchLocationId,
          isActive: true,
          branch: { isActive: true },
        },
        select: { id: true },
      });
      if (!location)
        throw new NotFoundException("Điểm chấm công đã chọn không hợp lệ");
    }
    let requestedSchedule: { id: string; name: string } | null = null;
    if (exceptionTypes.includes("WRONG_SCHEDULE")) {
      if (!dto.workScheduleId)
        throw new BadRequestException("Hãy chọn ca làm thay thế");
      requestedSchedule = await this.prisma.workSchedule.findUnique({
        where: { id: dto.workScheduleId },
        select: { id: true, name: true },
      });
      if (!requestedSchedule)
        throw new NotFoundException("Ca làm đã chọn không tồn tại");
    }
    if (exceptionTypes.includes("WRONG_SCHEDULE") && dto.workScheduleBranchIds?.length) {
      const expectedSegments = await this.prisma.workSchedule.findUnique({ where: { id: dto.workScheduleId! }, select: { secondStartTime: true, secondEndTime: true } });
      const expectedCount = expectedSegments?.secondStartTime && expectedSegments.secondEndTime ? 2 : 1;
      if (dto.workScheduleBranchIds.length !== expectedCount) throw new BadRequestException("Hãy chọn cửa hàng cho từng khung giờ của ca");
      const branches = await this.prisma.branch.count({ where: { id: { in: dto.workScheduleBranchIds }, isActive: true } });
      if (branches !== new Set(dto.workScheduleBranchIds).size) throw new BadRequestException("Cửa hàng được chọn không hợp lệ");
    }
    if (
      exceptionTypes.includes("MISSED_PUNCH") &&
      !dto.proposedCheckIn &&
      !dto.proposedCheckOut &&
      !dto.proposedCheckIn2 &&
      !dto.proposedCheckOut2
    )
      throw new BadRequestException("Hãy bổ sung ít nhất giờ vào hoặc giờ ra");

    const photoUrl = dto.photo
      ? await this.storage.putBase64Image(
          `attendance/${employee.id}/approval`,
          dto.photo,
        )
      : undefined;
    const existingEvidencePhotoUrls =
      existing?.approvalStatus === "PENDING"
        ? existing.approvalEvidencePhotoUrls
        : [];
    if (
      existingEvidencePhotoUrls.length + (dto.evidencePhotos?.length ?? 0) >
      5
    )
      throw new BadRequestException(
        "Mỗi yêu cầu chỉ hỗ trợ tối đa 5 ảnh chứng minh",
      );
    const addedEvidencePhotoUrls = await Promise.all(
      (dto.evidencePhotos ?? []).map((photo) =>
        this.storage.putBase64Image(
          `attendance/${employee.id}/approval-evidence`,
          photo,
        ),
      ),
    );
    const approvalEvidencePhotoUrls = [
      ...existingEvidencePhotoUrls,
      ...addedEvidencePhotoUrls,
    ];
    const approvalUpdate: AttendanceApprovalUpdate = {
      exceptionTypes,
      items: exceptionTypes.map((type) => ({
        type,
        decision: "PENDING" as const,
        ...(type === "FACE_UNRECOGNIZED" && dto.targetEmployeeId
          ? { targetEmployeeId: dto.targetEmployeeId }
          : {}),
        ...(type === "GPS_UNAVAILABLE" && dto.branchLocationId
          ? { branchLocationId: dto.branchLocationId }
          : {}),
        ...(type === "WRONG_SCHEDULE" && requestedSchedule
          ? {
              workScheduleId: requestedSchedule.id,
              workScheduleName: requestedSchedule.name,
            }
          : {}),
        ...(type === "MISSED_PUNCH"
          ? {
              ...(dto.proposedCheckIn
                ? { proposedCheckIn: dto.proposedCheckIn }
                : {}),
              ...(dto.proposedCheckOut
                ? { proposedCheckOut: dto.proposedCheckOut }
                : {}),
              ...(dto.proposedCheckIn2
                ? { proposedCheckIn2: dto.proposedCheckIn2 }
                : {}),
              ...(dto.proposedCheckOut2
                ? { proposedCheckOut2: dto.proposedCheckOut2 }
                : {}),
            }
          : {}),
        ...(type === "OVERTIME" && dto.overtimeMinutes
          ? { overtimeMinutes: dto.overtimeMinutes }
          : {}),
      })),
      ...(dto.targetEmployeeId
        ? { targetEmployeeId: dto.targetEmployeeId }
        : {}),
      ...(dto.branchLocationId
        ? { branchLocationId: dto.branchLocationId }
        : {}),
      ...(dto.workScheduleId ? { workScheduleId: dto.workScheduleId } : {}),
      ...(dto.workScheduleBranchIds?.length ? { workScheduleBranchIds: dto.workScheduleBranchIds } : {}),
      ...(dto.appliesTo ? { appliesTo: dto.appliesTo } : {}),
      ...(dto.proposedCheckIn ? { proposedCheckIn: dto.proposedCheckIn } : {}),
      ...(dto.proposedCheckOut
        ? { proposedCheckOut: dto.proposedCheckOut }
        : {}),
      ...(dto.proposedCheckIn2
        ? { proposedCheckIn2: dto.proposedCheckIn2 }
        : {}),
      ...(dto.proposedCheckOut2
        ? { proposedCheckOut2: dto.proposedCheckOut2 }
        : {}),
      ...(dto.overtimeMinutes ? { overtimeMinutes: dto.overtimeMinutes } : {}),
    };
    const common = {
      approvalStatus: "PENDING" as const,
      exceptionType: (exceptionTypes.find((type) => type !== "OVERTIME") ??
        "OTHER") as CreateAttendanceApprovalRequestDto["exceptionType"],
      approvalRequestNote: dto.note,
      approvalReviewedAt: null,
      approvalReviewedById: null,
      approvalReviewNote: null,
      approvalEvidencePhotoUrls,
      approvalUpdate: Object.keys(approvalUpdate).length
        ? (approvalUpdate as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      deviceInfo: dto.deviceInfo as Prisma.InputJsonValue,
    };
    const record =
      dto.action === "REVIEW"
        ? await this.prisma.attendance.update({
            where: { id: existing!.id },
            data: common,
          })
        : dto.action === "CHECK_IN"
          ? await this.prisma.attendance.upsert({
              where: {
                employeeId_workDate: { employeeId: employee.id, workDate },
              },
              create: {
                employeeId: employee.id,
                workDate,
                checkInAt: now,
                checkInLat: dto.lat,
                checkInLng: dto.lng,
                checkInAccuracyMeters: dto.accuracyMeters,
                checkInPhotoUrl: photoUrl,
                status: "PRESENT",
                ...common,
              },
              update: {
                checkInAt: now,
                checkInLat: dto.lat,
                checkInLng: dto.lng,
                checkInAccuracyMeters: dto.accuracyMeters,
                checkInPhotoUrl: photoUrl,
                ...common,
              },
            })
          : await this.prisma.attendance.update({
              where: { id: existing!.id },
              data: {
                checkOutAt: now,
                checkOutLat: dto.lat,
                checkOutLng: dto.lng,
                checkOutAccuracyMeters: dto.accuracyMeters,
                checkOutPhotoUrl: photoUrl,
                ...common,
              },
            });
    await this.audit.record({
      action: existing?.approvalStatus === "PENDING" ? "UPDATE" : "CREATE",
      entity: "AttendanceApprovalRequest",
      entityId: record.id,
      after: { action: dto.action, exceptionTypes },
      ctx,
    });
    return { ...this.withoutAuditPhotoKeys(record), employee };
  }

  async createManualAttendanceRequest(
    dto: CreateManualAttendanceRequestDto,
    ctx: AuditContext,
  ) {
    const [employee, schedule] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id: dto.employeeId, deletedAt: null },
        select: { id: true, fullName: true },
      }),
      this.prisma.workSchedule.findUnique({
        where: { id: dto.workScheduleId },
        select: { id: true, name: true },
      }),
    ]);
    if (!employee)
      throw new NotFoundException("Không tìm thấy hồ sơ nhân viên");
    if (!schedule) throw new NotFoundException("Không tìm thấy ca làm việc");

    const now = new Date();
    const workDate = workDateInTimeZone(now, await this.companyTimezone());
    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      include: {
        sessions: { orderBy: { sequence: "desc" }, take: 1 },
        _count: { select: { sessions: true } },
      },
    });
    if (existing?.approvalStatus === "PENDING")
      throw new BadRequestException("Đã có phiên chấm công chờ duyệt hôm nay");
    const latestSession = existing?.sessions[0];
    if (dto.action === "CHECK_IN" && latestSession && !latestSession.checkOutAt)
      throw new BadRequestException("Bạn đang có một ca chưa chấm ra");
    if (dto.action === "CHECK_IN" && (existing?._count.sessions ?? 0) >= 2)
      throw new BadRequestException(
        "Mỗi ngày chỉ hỗ trợ tối đa 2 ca chấm công",
      );
    if (
      dto.action === "CHECK_OUT" &&
      (!latestSession || latestSession.checkOutAt)
    )
      throw new BadRequestException("Chưa đủ điều kiện để chấm ra thủ công");

    const photoUrl = await this.storage.putBase64Image(
      `attendance/${employee.id}/manual`,
      dto.photo,
    );
    const common = {
      approvalStatus: "PENDING" as const,
      exceptionType: "OTHER" as const,
      approvalRequestNote: dto.reason,
      manualWorkScheduleId: schedule.id,
      manualWorkScheduleName: schedule.name,
      approvalReviewedAt: null,
      approvalReviewedById: null,
      approvalReviewNote: null,
      deviceInfo: dto.deviceInfo as Prisma.InputJsonValue,
    };
    const record =
      dto.action === "CHECK_IN"
        ? await this.prisma.attendance.upsert({
            where: {
              employeeId_workDate: { employeeId: employee.id, workDate },
            },
            create: {
              employeeId: employee.id,
              workDate,
              checkInAt: now,
              checkInLat: dto.lat,
              checkInLng: dto.lng,
              checkInAccuracyMeters: dto.accuracyMeters,
              checkInPhotoUrl: photoUrl,
              status: "PRESENT",
              ...common,
            },
            update: {
              checkInAt: now,
              checkInLat: dto.lat,
              checkInLng: dto.lng,
              checkInAccuracyMeters: dto.accuracyMeters,
              checkInPhotoUrl: photoUrl,
              ...common,
            },
          })
        : await this.prisma.attendance.update({
            where: { id: existing!.id },
            data: {
              checkOutAt: now,
              checkOutLat: dto.lat,
              checkOutLng: dto.lng,
              checkOutAccuracyMeters: dto.accuracyMeters,
              checkOutPhotoUrl: photoUrl,
              ...common,
            },
          });

    if (dto.action === "CHECK_IN") {
      const latest = await this.prisma.attendanceSession.findFirst({
        where: { attendanceId: record.id },
        orderBy: { sequence: "desc" },
      });
      await this.prisma.attendanceSession.create({
        data: {
          attendanceId: record.id,
          sequence: (latest?.sequence ?? 0) + 1,
          checkInAt: now,
          checkInPhotoUrl: photoUrl,
          checkInLat: dto.lat,
          checkInLng: dto.lng,
          checkInAccuracyMeters: dto.accuracyMeters,
        },
      });
    } else {
      const session = await this.prisma.attendanceSession.findFirst({
        where: { attendanceId: record.id, checkOutAt: null },
        orderBy: { sequence: "desc" },
      });
      if (session) {
        await this.prisma.attendanceSession.update({
          where: { id: session.id },
          data: {
            checkOutAt: now,
            checkOutPhotoUrl: photoUrl,
            checkOutLat: dto.lat,
            checkOutLng: dto.lng,
            checkOutAccuracyMeters: dto.accuracyMeters,
          },
        });
      }
    }
    await this.audit.record({
      action: "CREATE",
      entity: "ManualAttendanceRequest",
      entityId: record.id,
      after: {
        employeeId: employee.id,
        action: dto.action,
        workScheduleId: schedule.id,
        approvalStatus: "PENDING",
      },
      ctx,
    });
    return {
      ...this.withoutAuditPhotoKeys(record),
      employee,
      workSchedule: schedule,
    };
  }

  async pendingApprovals() {
    const records = await this.prisma.attendance.findMany({
      where: { approvalStatus: "PENDING" },
      include: {
        employee: { select: { id: true, fullName: true, employeeNo: true } },
        sessions: {
          select: {
            id: true,
            sequence: true,
            checkInAt: true,
            checkOutAt: true,
            checkInLocationId: true,
            checkOutLocationId: true,
            checkOutUpdateCount: true,
          },
          orderBy: { sequence: "asc" },
        },
        overtimeRequests: { select: { status: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    const locationIds = records
      .flatMap((record) =>
        record.sessions.flatMap((session) => [
          session.checkInLocationId,
          session.checkOutLocationId,
        ]),
      )
      .filter((id): id is string => Boolean(id));
    const locations = await this.prisma.branchLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, branch: { select: { name: true } } },
    });
    const branchByLocation = new Map(
      locations.map((location) => [location.id, location.branch.name]),
    );
    return Promise.all(
      records.map(async (record) => {
        const branchName = record.sessions
          .map(
            (session) =>
              branchByLocation.get(session.checkInLocationId ?? "") ??
              branchByLocation.get(session.checkOutLocationId ?? ""),
          )
          .find(Boolean);
        const { approvalEvidencePhotoUrls, ...safeRecord } =
          this.withoutAuditPhotoKeys(record);
        const approvalUpdate = (record.approvalUpdate ??
          {}) as unknown as AttendanceApprovalUpdate;
        return {
          ...safeRecord,
          approvalReasons:
            approvalUpdate.exceptionTypes ??
            (record.exceptionType ? [record.exceptionType] : []),
          approvalItems:
            approvalUpdate.items ??
            (record.exceptionType
              ? [{ type: record.exceptionType, decision: "PENDING" as const }]
              : []),
          attendanceBranchName: branchName ?? null,
          approvalEvidencePhotos: await Promise.all(
            approvalEvidencePhotoUrls.map((key) =>
              this.storage.presignedDownload(key),
            ),
          ),
        };
      }),
    );
  }

  async reviewApproval(
    id: string,
    dto: ReviewAttendanceDto,
    ctx: AuditContext,
  ) {
    const before = await this.prisma.attendance.findUniqueOrThrow({
      where: { id },
    });
    if (before.approvalStatus !== "PENDING")
      throw new BadRequestException("Yêu cầu này đã được xử lý");
    const approvalUpdate = (before.approvalUpdate ??
      {}) as unknown as AttendanceApprovalUpdate;
    const approvalReasons =
      approvalUpdate.exceptionTypes ??
      (before.exceptionType ? [before.exceptionType] : []);
    const priorItems =
      approvalUpdate.items ??
      approvalReasons.map((type) => ({
        type,
        decision: "PENDING" as const,
      }));
    const reviewByType = new Map(
      (dto.itemReviews ?? []).map((item) => [item.type, item]),
    );
    const items = priorItems.map((item) => {
      const review = reviewByType.get(item.type);
      return review
        ? { ...item, ...review }
        : dto.decision
          ? {
              ...item,
              decision:
                dto.decision === "NEEDS_MORE_INFO" ? "PENDING" : dto.decision,
              note: dto.note,
            }
          : item;
    });
    if (!dto.decision && !dto.itemReviews?.length)
      throw new BadRequestException("Hãy duyệt hoặc từ chối ít nhất một mục");
    const approvedReasons = new Set(
      items
        .filter((item) => item.decision === "APPROVED")
        .map((item) => item.type),
    );
    const hasPendingItems = items.some((item) => item.decision === "PENDING");
    const overallDecision = hasPendingItems
      ? "PENDING"
      : approvedReasons.size
        ? "APPROVED"
        : "REJECTED";
    const approvedItem = (type: string) =>
      items.find((item) => item.type === type && item.decision === "APPROVED");
    const targetEmployeeId =
      approvedItem("FACE_UNRECOGNIZED")?.targetEmployeeId ??
      approvalUpdate.targetEmployeeId;
    const branchLocationId =
      approvedItem("GPS_UNAVAILABLE")?.branchLocationId ??
      approvalUpdate.branchLocationId;
    const workScheduleId =
      approvedItem("WRONG_SCHEDULE")?.workScheduleId ??
      approvalUpdate.workScheduleId;
    const workScheduleBranchIds =
      approvedItem("WRONG_SCHEDULE")?.workScheduleBranchIds ??
      approvalUpdate.workScheduleBranchIds;
    const proposedCheckIn =
      approvedItem("MISSED_PUNCH")?.proposedCheckIn ??
      approvalUpdate.proposedCheckIn;
    const proposedCheckOut =
      approvedItem("MISSED_PUNCH")?.proposedCheckOut ??
      approvalUpdate.proposedCheckOut;
    const proposedCheckIn2 =
      approvedItem("MISSED_PUNCH")?.proposedCheckIn2 ??
      approvalUpdate.proposedCheckIn2;
    const proposedCheckOut2 =
      approvedItem("MISSED_PUNCH")?.proposedCheckOut2 ??
      approvalUpdate.proposedCheckOut2;
    const reviewedApprovalUpdate: AttendanceApprovalUpdate = {
      ...approvalUpdate,
      items,
    };
    if (dto.decision === "NEEDS_MORE_INFO")
      reviewedApprovalUpdate.reviewState = "NEEDS_MORE_INFO";
    else delete reviewedApprovalUpdate.reviewState;
    const record = await this.prisma.$transaction(async (tx) => {
      if (approvedReasons.size) {
        if (
          approvedReasons.has("FACE_UNRECOGNIZED") &&
          targetEmployeeId &&
          targetEmployeeId !== before.employeeId
        ) {
          const duplicate = await tx.attendance.findUnique({
            where: {
              employeeId_workDate: {
                employeeId: targetEmployeeId,
                workDate: before.workDate,
              },
            },
            select: { id: true },
          });
          if (duplicate && duplicate.id !== before.id)
            throw new BadRequestException(
              "Nhân viên được chọn đã có chấm công trong ngày này",
            );
          await tx.attendance.update({
            where: { id },
            data: { employeeId: targetEmployeeId },
          });
        }

        if (approvedReasons.has("GPS_UNAVAILABLE") && branchLocationId) {
          const location = await tx.branchLocation.findFirst({
            where: {
              id: branchLocationId,
              isActive: true,
              branch: { isActive: true },
            },
            select: { id: true },
          });
          if (!location)
            throw new BadRequestException(
              "Điểm chấm công đã chọn không còn hoạt động",
            );
          const isCheckOut = approvalUpdate.appliesTo === "CHECK_OUT";
          const session = await tx.attendanceSession.findFirst({
            where: { attendanceId: id },
            orderBy: { sequence: isCheckOut ? "desc" : "asc" },
          });
          if (session) {
            await tx.attendanceSession.update({
              where: { id: session.id },
              data: isCheckOut
                ? { checkOutLocationId: location.id }
                : { checkInLocationId: location.id },
            });
            await this.synchronizeAttendanceFromSessions(tx, id);
          }
        }

        if (approvedReasons.has("WRONG_SCHEDULE") && workScheduleId) {
          const workSchedule = await tx.workSchedule.findUnique({
            where: { id: workScheduleId },
            select: { id: true, name: true },
          });
          if (!workSchedule)
            throw new BadRequestException("Ca làm đã chọn không còn tồn tại");
          const employee = await tx.employee.findUnique({ where: { id: before.employeeId }, select: { primaryBranchId: true } });
          const branchIds = workScheduleBranchIds?.length ? workScheduleBranchIds : employee?.primaryBranchId ? [employee.primaryBranchId] : [];
          await this.workRoster.upsertDay(tx, before.employeeId, before.workDate, workSchedule.id, branchIds, "Đổi ca đã được duyệt", "SHIFT_CHANGE_APPROVED", ctx.actorId);
          await tx.attendance.update({
            where: { id },
            data: {
              manualWorkScheduleId: workSchedule.id,
              manualWorkScheduleName: workSchedule.name,
            },
          });
        }

        if (
          approvedReasons.has("MISSED_PUNCH") &&
          (proposedCheckIn ||
            proposedCheckOut ||
            proposedCheckIn2 ||
            proposedCheckOut2)
        ) {
          const applyPunch = async (
            sequence: number,
            requestedIn?: string,
            requestedOut?: string,
          ) => {
            if (!requestedIn && !requestedOut) return;
            const session = await tx.attendanceSession.findUnique({
              where: { attendanceId_sequence: { attendanceId: id, sequence } },
            });
            if (!session && !requestedIn)
              throw new BadRequestException(
                `Cần bổ sung giờ vào ${sequence} trước khi thêm giờ ra ${sequence}`,
              );
            const checkInAt = requestedIn
              ? new Date(requestedIn)
              : session!.checkInAt;
            const checkOutAt = requestedOut
              ? new Date(requestedOut)
              : (session?.checkOutAt ?? null);
            if (checkOutAt && checkOutAt < checkInAt)
              throw new BadRequestException(
                `Giờ ra ${sequence} phải sau giờ vào ${sequence}`,
              );
            if (session) {
              await tx.attendanceSession.update({
                where: { id: session.id },
                data: { checkInAt, checkOutAt },
              });
            } else {
              await tx.attendanceSession.create({
                data: { attendanceId: id, sequence, checkInAt, checkOutAt },
              });
            }
          };
          await applyPunch(1, proposedCheckIn, proposedCheckOut);
          await applyPunch(2, proposedCheckIn2, proposedCheckOut2);
          await this.synchronizeAttendanceFromSessions(tx, id);
        }
      }
      return tx.attendance.update({
        where: { id },
        data: {
          approvalStatus: overallDecision,
          approvalReviewedAt: hasPendingItems ? null : new Date(),
          approvalReviewedById: hasPendingItems ? null : ctx.actorId,
          approvalReviewNote: dto.note ?? null,
          approvalUpdate: reviewedApprovalUpdate as Prisma.InputJsonValue,
          ...(approvedReasons.has("LATE_ARRIVAL")
            ? { latePenaltyWaived: true }
            : {}),
        },
        include: {
          employee: { select: { id: true, fullName: true, employeeNo: true } },
        },
      });
    });
    await this.audit.record({
      action:
        overallDecision === "PENDING"
          ? "UPDATE"
          : overallDecision === "APPROVED"
            ? "APPROVE"
            : "REJECT",
      entity: "AttendanceApprovalRequest",
      entityId: id,
      before: { approvalStatus: before.approvalStatus },
      after: { approvalStatus: overallDecision, items, note: dto.note },
      ctx,
    });
    return this.withoutAuditPhotoKeys(record);
  }

  async removeApprovalRequest(id: string, ctx: AuditContext) {
    const before = await this.prisma.attendance.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        approvalRequestNote: true,
        approvalStatus: true,
        approvalEvidencePhotoUrls: true,
      },
    });
    if (!before.approvalRequestNote)
      throw new BadRequestException(
        "Bản ghi này không có phiếu xin duyệt để xóa",
      );

    const record = await this.prisma.$transaction(async (tx) => {
      // The request may later be recreated for the same attendance row. Its UI
      // must never inherit the former request's reasons or visible timeline.
      await tx.auditLog.deleteMany({
        where: { entity: "AttendanceApprovalRequest", entityId: id },
      });
      return tx.attendance.update({
        where: { id },
        data: {
          approvalStatus: "APPROVED",
          exceptionType: null,
          approvalRequestNote: null,
          approvalUpdate: Prisma.JsonNull,
          approvalEvidencePhotoUrls: [],
          approvalReviewedAt: null,
          approvalReviewedById: null,
          approvalReviewNote: null,
          manualWorkScheduleId: null,
          manualWorkScheduleName: null,
          latePenaltyWaived: false,
        },
      });
    });
    await Promise.all(
      before.approvalEvidencePhotoUrls.map((key) => this.storage.remove(key)),
    );
    await this.audit.record({
      action: "DELETE",
      entity: "Attendance",
      entityId: id,
      before: { approvalStatus: before.approvalStatus },
      after: { removed: true },
      ctx,
    });
    return this.withoutAuditPhotoKeys(record);
  }

  /** Immutable audit trail for the request, including employee revisions and manager decisions. */
  async approvalHistory(id: string) {
    await this.prisma.attendance.findUniqueOrThrow({
      where: { id },
      select: { id: true },
    });
    return this.prisma.auditLog.findMany({
      where: { entity: "AttendanceApprovalRequest", entityId: id },
      select: {
        id: true,
        action: true,
        createdAt: true,
        actor: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateSession(
    attendanceId: string,
    sessionId: string,
    dto: UpdateAttendanceSessionDto,
    ctx: AuditContext,
  ) {
    const before = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, attendanceId },
    });
    if (!before) throw new NotFoundException("Không tìm thấy phiên chấm công");
    const checkInAt = dto.checkInAt
      ? new Date(dto.checkInAt)
      : before.checkInAt;
    const checkOutAt =
      dto.checkOutAt === undefined
        ? before.checkOutAt
        : dto.checkOutAt
          ? new Date(dto.checkOutAt)
          : null;
    if (checkOutAt && checkOutAt < checkInAt)
      throw new BadRequestException("Giờ chấm ra phải sau giờ chấm vào");
    const session = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.attendanceSession.update({
        where: { id: sessionId },
        data: { checkInAt, checkOutAt },
      });
      await this.synchronizeAttendanceFromSessions(tx, attendanceId);
      return updated;
    });
    await this.audit.record({
      action: "UPDATE",
      entity: "AttendanceSession",
      entityId: sessionId,
      before: { checkInAt: before.checkInAt, checkOutAt: before.checkOutAt },
      after: { checkInAt: session.checkInAt, checkOutAt: session.checkOutAt },
      ctx,
    });
    return session;
  }

  async createSession(
    attendanceId: string,
    dto: CreateAttendanceSessionDto,
    ctx: AuditContext,
  ) {
    const attendance = await this.prisma.attendance.findUniqueOrThrow({
      where: { id: attendanceId },
      include: { sessions: { orderBy: { sequence: "asc" } } },
    });
    if (attendance.sessions.length >= 2)
      throw new BadRequestException(
        "Mỗi ngày chỉ hỗ trợ tối đa 2 ca chấm công",
      );
    const checkInAt = new Date(dto.checkInAt);
    const checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : null;
    if (checkOutAt && checkOutAt < checkInAt)
      throw new BadRequestException("Giờ ra phải sau giờ vào");
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attendanceSession.create({
        data: {
          attendanceId,
          sequence: attendance.sessions.length + 1,
          checkInAt,
          checkOutAt,
        },
      });
      await this.synchronizeAttendanceFromSessions(tx, attendanceId);
      return created;
    });
    await this.audit.record({
      action: "CREATE",
      entity: "AttendanceSession",
      entityId: session.id,
      after: { attendanceId, sequence: session.sequence },
      ctx,
    });
    return session;
  }

  /** Manager-only overrides stored with the attendance record, never changing company policy defaults. */
  async updateAdjustment(
    id: string,
    dto: UpdateAttendanceAdjustmentDto,
    ctx: AuditContext,
  ) {
    const before = await this.prisma.attendance.findUniqueOrThrow({
      where: { id },
    });
    let schedule: { id: string; name: string } | null = null;
    if (dto.workScheduleId) {
      schedule = await this.prisma.workSchedule.findUnique({
        where: { id: dto.workScheduleId },
        select: { id: true, name: true },
      });
      if (!schedule)
        throw new BadRequestException("Ca làm đã chọn không còn tồn tại");
    }
    const previous = (before.approvalUpdate ??
      {}) as unknown as AttendanceApprovalUpdate;
    if (dto.workScheduleId && dto.manualScheduleTimes)
      throw new BadRequestException("Chọn ca làm hoặc ca thủ công");
    if (dto.manualScheduleTimes) {
      const toMinutes = (value: string) => {
        const [hours, minutes] = value.split(":").map(Number);
        return hours * 60 + minutes;
      };
      if (
        toMinutes(dto.manualScheduleTimes.endTime) <=
          toMinutes(dto.manualScheduleTimes.startTime) ||
        toMinutes(dto.manualScheduleTimes.secondEndTime) <=
          toMinutes(dto.manualScheduleTimes.secondStartTime) ||
        toMinutes(dto.manualScheduleTimes.secondStartTime) <
          toMinutes(dto.manualScheduleTimes.endTime)
      )
        throw new BadRequestException("Giờ ca thủ công không hợp lệ");
    }
    const adjustment: AttendanceApprovalUpdate = {
      ...previous,
      ...(dto.latePenalty !== undefined
        ? { manualLatePenalty: dto.latePenalty }
        : {}),
      ...(dto.reward !== undefined ? { manualReward: dto.reward } : {}),
      ...(dto.manualScheduleTimes
        ? { manualScheduleTimes: dto.manualScheduleTimes }
        : {}),
    };
    if (dto.workScheduleId) delete adjustment.manualScheduleTimes;
    const record = await this.prisma.attendance.update({
      where: { id },
      data: {
        ...(schedule
          ? {
              manualWorkScheduleId: schedule.id,
              manualWorkScheduleName: schedule.name,
            }
          : {}),
        ...(dto.manualScheduleTimes
          ? { manualWorkScheduleId: null, manualWorkScheduleName: "Thủ công" }
          : {}),
        approvalUpdate: adjustment as Prisma.InputJsonValue,
      },
    });
    await this.audit.record({
      action: "UPDATE",
      entity: "Attendance",
      entityId: id,
      before: {
        manualWorkScheduleId: before.manualWorkScheduleId,
        approvalUpdate: previous,
      },
      after: {
        manualWorkScheduleId: record.manualWorkScheduleId,
        approvalUpdate: adjustment,
      },
      ctx,
    });
    return this.withoutAuditPhotoKeys(record);
  }

  async removeSession(
    attendanceId: string,
    sessionId: string,
    ctx: AuditContext,
  ) {
    const before = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, attendanceId },
    });
    if (!before) throw new NotFoundException("Không tìm thấy phiên chấm công");
    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceSession.delete({ where: { id: sessionId } });
      await this.synchronizeAttendanceFromSessions(tx, attendanceId);
    });
    await Promise.all(
      [before.checkInPhotoUrl, before.checkOutPhotoUrl]
        .filter((key): key is string => Boolean(key))
        .map((key) => this.storage.remove(key)),
    );
    await this.audit.record({
      action: "DELETE",
      entity: "AttendanceSession",
      entityId: sessionId,
      before: { attendanceId, sequence: before.sequence },
      ctx,
    });
    return { success: true };
  }

  async createCorrectionRequest(
    employeeId: string,
    dto: CreateAttendanceCorrectionDto,
    ctx: AuditContext,
  ) {
    if (!dto.proposedCheckIn && !dto.proposedCheckOut)
      throw new BadRequestException("Cần bổ sung ít nhất giờ vào hoặc giờ ra");
    const workDate = workDateFromIsoDate(dto.workDate);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException("Không tìm thấy nhân viên");
    const attendance = await this.prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId, workDate } },
      select: { id: true },
    });
    const duplicate = await this.prisma.attendanceCorrectionRequest.findFirst({
      where: {
        employeeId,
        workDate,
        status: { in: ["PENDING", "NEEDS_MORE_INFO"] },
      },
    });
    if (duplicate)
      throw new BadRequestException(
        "Đã có yêu cầu bổ sung chấm công đang chờ duyệt cho ngày này",
      );
    const evidencePhotoUrl = dto.evidencePhoto
      ? await this.storage.putBase64Image(
          `attendance/${employeeId}/correction`,
          dto.evidencePhoto,
        )
      : undefined;
    const request = await this.prisma.attendanceCorrectionRequest.create({
      data: {
        employeeId,
        attendanceId: attendance?.id,
        workDate,
        proposedCheckIn: dto.proposedCheckIn
          ? new Date(dto.proposedCheckIn)
          : null,
        proposedCheckOut: dto.proposedCheckOut
          ? new Date(dto.proposedCheckOut)
          : null,
        reason: dto.reason,
        evidencePhotoUrl,
      },
    });
    await this.prisma.attendanceCorrectionHistory.create({
      data: {
        requestId: request.id,
        action: "CREATED",
        actorId: ctx.actorId,
        note: dto.reason,
        snapshot: {
          proposedCheckIn: request.proposedCheckIn?.toISOString() ?? null,
          proposedCheckOut: request.proposedCheckOut?.toISOString() ?? null,
          evidenceAttached: Boolean(evidencePhotoUrl),
        },
      },
    });
    await this.audit.record({
      action: "CREATE",
      entity: "AttendanceCorrectionRequest",
      entityId: request.id,
      after: {
        employeeId,
        workDate: dto.workDate,
        hasCheckIn: Boolean(dto.proposedCheckIn),
        hasCheckOut: Boolean(dto.proposedCheckOut),
      },
      ctx,
    });
    return request;
  }

  async updateCorrectionRequest(
    id: string,
    employeeId: string,
    dto: UpdateAttendanceCorrectionDto,
    ctx: AuditContext,
  ) {
    const before = await this.prisma.attendanceCorrectionRequest.findFirst({
      where: { id, employeeId },
    });
    if (!before)
      throw new NotFoundException("Không tìm thấy yêu cầu bổ sung chấm công");
    if (!["PENDING", "NEEDS_MORE_INFO"].includes(before.status))
      throw new BadRequestException(
        "Chỉ có thể cập nhật yêu cầu đang chờ duyệt hoặc cần bổ sung",
      );
    const evidencePhotoUrl = dto.evidencePhoto
      ? await this.storage.putBase64Image(
          `attendance/${employeeId}/correction`,
          dto.evidencePhoto,
        )
      : undefined;
    const request = await this.prisma.attendanceCorrectionRequest.update({
      where: { id },
      data: {
        proposedCheckIn: dto.proposedCheckIn
          ? new Date(dto.proposedCheckIn)
          : before.proposedCheckIn,
        proposedCheckOut: dto.proposedCheckOut
          ? new Date(dto.proposedCheckOut)
          : before.proposedCheckOut,
        reason: dto.reason,
        ...(evidencePhotoUrl ? { evidencePhotoUrl } : {}),
        status: "PENDING",
        reviewedAt: null,
        reviewedById: null,
        reviewNote: null,
      },
    });
    if (evidencePhotoUrl && before.evidencePhotoUrl)
      await this.storage.remove(before.evidencePhotoUrl);
    await this.prisma.attendanceCorrectionHistory.create({
      data: {
        requestId: id,
        action: "UPDATED",
        actorId: ctx.actorId,
        note: dto.reason,
        snapshot: {
          previousStatus: before.status,
          proposedCheckIn: request.proposedCheckIn?.toISOString() ?? null,
          proposedCheckOut: request.proposedCheckOut?.toISOString() ?? null,
          evidenceAttached: Boolean(evidencePhotoUrl),
        },
      },
    });
    await this.audit.record({
      action: "UPDATE",
      entity: "AttendanceCorrectionRequest",
      entityId: id,
      before: { status: before.status },
      after: { status: request.status },
      ctx,
    });
    return request;
  }

  async pendingCorrectionRequests() {
    return this.prisma.attendanceCorrectionRequest.findMany({
      where: { status: "PENDING" },
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  }

  async reviewCorrectionRequest(
    id: string,
    dto: ReviewAttendanceCorrectionDto,
    ctx: AuditContext,
  ) {
    const request = await this.prisma.attendanceCorrectionRequest.findUnique({
      where: { id },
    });
    if (!request)
      throw new NotFoundException("Không tìm thấy yêu cầu bổ sung chấm công");
    if (request.status !== "PENDING")
      throw new BadRequestException("Yêu cầu này đã được xử lý");
    await this.prisma.$transaction(async (tx) => {
      if (dto.decision === "APPROVED") {
        const attendance = await tx.attendance.upsert({
          where: {
            employeeId_workDate: {
              employeeId: request.employeeId,
              workDate: request.workDate,
            },
          },
          create: {
            employeeId: request.employeeId,
            workDate: request.workDate,
            checkInAt: request.proposedCheckIn,
            checkOutAt: request.proposedCheckOut,
            status: "PRESENT",
          },
          update: {
            checkInAt: request.proposedCheckIn ?? undefined,
            checkOutAt: request.proposedCheckOut ?? undefined,
          },
        });
        const existingSession = await tx.attendanceSession.findFirst({
          where: { attendanceId: attendance.id },
          orderBy: { sequence: "asc" },
        });
        if (existingSession) {
          await tx.attendanceSession.update({
            where: { id: existingSession.id },
            data: {
              checkInAt: request.proposedCheckIn ?? existingSession.checkInAt,
              checkOutAt:
                request.proposedCheckOut ?? existingSession.checkOutAt,
            },
          });
        } else if (request.proposedCheckIn) {
          await tx.attendanceSession.create({
            data: {
              attendanceId: attendance.id,
              sequence: 1,
              checkInAt: request.proposedCheckIn,
              checkOutAt: request.proposedCheckOut,
            },
          });
        }
      }
      await tx.attendanceCorrectionRequest.update({
        where: { id },
        data: {
          status: dto.decision,
          reviewedAt: new Date(),
          reviewedById: ctx.actorId,
          reviewNote: dto.note ?? null,
        },
      });
      await tx.attendanceCorrectionHistory.create({
        data: {
          requestId: id,
          action:
            dto.decision === "APPROVED"
              ? "APPROVED"
              : dto.decision === "REJECTED"
                ? "REJECTED"
                : "REQUESTED_MORE_INFO",
          actorId: ctx.actorId,
          note: dto.note ?? null,
          snapshot: { statusBefore: request.status, statusAfter: dto.decision },
        },
      });
    });
    await this.audit.record({
      action:
        dto.decision === "APPROVED"
          ? "APPROVE"
          : dto.decision === "REJECTED"
            ? "REJECT"
            : "UPDATE",
      entity: "AttendanceCorrectionRequest",
      entityId: id,
      after: { decision: dto.decision, note: dto.note },
      ctx,
    });
    return this.prisma.attendanceCorrectionRequest.findUniqueOrThrow({
      where: { id },
    });
  }

  async correctionRequests(
    attendanceId: string,
    scopeEmployeeId?: string | null,
    includeEvidence = false,
  ) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: { id: true, employeeId: true },
    });
    if (
      !attendance ||
      (scopeEmployeeId && attendance.employeeId !== scopeEmployeeId)
    )
      throw new NotFoundException("Không tìm thấy bản ghi chấm công");
    const requests = await this.prisma.attendanceCorrectionRequest.findMany({
      where: { attendanceId },
      include: { history: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      requests.map(async ({ evidencePhotoUrl, ...request }) => ({
        ...request,
        evidencePhoto:
          (includeEvidence || scopeEmployeeId === attendance.employeeId) &&
          evidencePhotoUrl
            ? await this.storage.presignedDownload(evidencePhotoUrl)
            : null,
        hasEvidencePhoto: Boolean(evidencePhotoUrl),
      })),
    );
  }

  async createOvertimeRequest(
    employeeId: string,
    dto: CreateOvertimeRequestDto,
    ctx: AuditContext,
  ) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id: dto.attendanceId, employeeId },
      include: { overtimeRequests: true },
    });
    if (!attendance?.checkOutAt)
      throw new BadRequestException(
        "Chỉ có thể xin làm thêm sau khi đã chấm ra",
      );
    if (attendance.overtimeRequests.length)
      throw new BadRequestException(
        "Đã có yêu cầu làm thêm cho lượt chấm công này",
      );
    const eligible = await this.overtimeEligibility(
      employeeId,
      attendance.workDate,
      attendance.checkOutAt,
    );
    if (!eligible.canRequest)
      throw new BadRequestException(
        "Chỉ được xin làm thêm khi chấm ra vượt ca làm theo cấu hình",
      );
    const request = await this.prisma.attendanceOvertimeRequest.create({
      data: {
        attendanceId: attendance.id,
        employeeId,
        requestedMinutes: eligible.eligibleMinutes,
        reason: dto.reason,
      },
    });
    await this.audit.record({
      action: "CREATE",
      entity: "AttendanceOvertimeRequest",
      entityId: request.id,
      after: {
        attendanceId: attendance.id,
        requestedMinutes: request.requestedMinutes,
      },
      ctx,
    });
    return request;
  }

  async pendingOvertimeRequests() {
    return this.prisma.attendanceOvertimeRequest.findMany({
      where: { status: "PENDING" },
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true } },
        attendance: {
          select: { workDate: true, checkInAt: true, checkOutAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  }

  async reviewOvertimeRequest(
    id: string,
    dto: ReviewAttendanceDto,
    ctx: AuditContext,
  ) {
    const before = await this.prisma.attendanceOvertimeRequest.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException("Không tìm thấy yêu cầu làm thêm");
    if (before.status !== "PENDING")
      throw new BadRequestException("Yêu cầu này đã được xử lý");
    if (!dto.decision || dto.decision === "NEEDS_MORE_INFO")
      throw new BadRequestException(
        "Yêu cầu làm thêm chỉ có thể duyệt hoặc từ chối",
      );
    const request = await this.prisma.attendanceOvertimeRequest.update({
      where: { id },
      data: {
        status: dto.decision,
        reviewedAt: new Date(),
        reviewedById: ctx.actorId,
        reviewNote: dto.note ?? null,
      },
    });
    await this.audit.record({
      action: dto.decision === "APPROVED" ? "APPROVE" : "REJECT",
      entity: "AttendanceOvertimeRequest",
      entityId: id,
      before: { status: before.status },
      after: { status: dto.decision, note: dto.note },
      ctx,
    });
    return request;
  }

  async checkPolicy() {
    const setting = await this.prisma.companySetting.findUnique({
      where: { id: "default" },
      select: { requireGps: true, livenessMode: true },
    });
    return {
      requireGps: true,
      livenessMode: this.normalizedLivenessPolicy(setting?.livenessMode),
    };
  }

  async issueLivenessChallenge(actorId: string) {
    const policy = await this.livenessPolicy();
    if (policy === "NONE")
      return { challenge: "NONE" as const, token: "", expiresAt: new Date() };
    const choices: Record<
      Exclude<LivenessPolicy, "NONE">,
      IssuedLivenessChallenge[]
    > = {
      BLINK: ["BLINK"],
      TURN_HEAD: ["TURN_LEFT", "TURN_RIGHT"],
      SMILE: ["SMILE"],
      NOD: ["NOD"],
      RANDOM: ["BLINK", "TURN_LEFT", "TURN_RIGHT", "SMILE", "NOD"],
    };
    const allowed = choices[policy];
    const challenge = allowed[Math.floor(Math.random() * allowed.length)];
    const expiresAt = new Date(Date.now() + 20_000);
    const nonce = randomUUID();
    const payload = `${actorId}:${challenge}:${expiresAt.getTime()}:${nonce}`;
    return {
      challenge,
      expiresAt,
      token: `${Buffer.from(payload).toString("base64url")}.${this.signLivenessPayload(payload)}`,
    };
  }

  async list(
    query: AttendanceQueryDto,
    scopeEmployeeId?: string | null,
    includeAuditPhotos = false,
    branchIds?: string[],
    branchPeriod?: { from: Date; to: Date },
  ) {
    const where: Prisma.AttendanceWhereInput = {};
    // Non-privileged users are locked to their own records.
    if (scopeEmployeeId) where.employeeId = scopeEmployeeId;
    else if (query.employeeId) {
      const employeeIds = query.employeeId.split(",").filter(Boolean);
      where.employeeId = employeeIds.length > 1 ? { in: employeeIds } : employeeIds[0];
    }
    if (branchIds) {
      if (!branchIds.length) return [];
      const from = branchPeriod?.from ?? new Date();
      const to = branchPeriod?.to ?? new Date();
      where.employee = {
        branchAssignments: {
          some: {
            branchId: { in: branchIds },
            effectiveFrom: { lte: to },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
          },
        },
      };
    }
    if (query.branchId) {
      const locations = await this.prisma.branchLocation.findMany({
        where: { branchId: query.branchId },
        select: { id: true },
      });
      const locationIds = locations.map((location) => location.id);
      if (locationIds.length) {
        where.OR = [
          { checkInLocationId: { in: locationIds } },
          { checkOutLocationId: { in: locationIds } },
          { sessions: { some: { checkInLocationId: { in: locationIds } } } },
          { sessions: { some: { checkOutLocationId: { in: locationIds } } } },
        ];
      } else {
        where.id = "__no_attendance_location__";
      }
    }
    if (query.status && query.status !== "NOT_ARRIVED" && query.status !== "ABSENT")
      where.status = query.status as Prisma.AttendanceWhereInput["status"];
    if (query.approvalStatus) where.approvalStatus = query.approvalStatus;
    if (query.date) {
      where.workDate = workDateFromIsoDate(query.date);
    } else if (query.from || query.to) {
      where.workDate = {
        ...(query.from ? { gte: workDateFromIsoDate(query.from) } : {}),
        ...(query.to ? { lte: workDateFromIsoDate(query.to) } : {}),
      };
    }

    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true, employeeNo: true } },
        sessions: {
          select: {
            id: true,
            sequence: true,
            checkInAt: true,
            checkOutAt: true,
            checkInLocationId: true,
            checkOutLocationId: true,
            checkInPhotoUrl: true,
            checkOutPhotoUrl: true,
            checkOutUpdateCount: true,
          },
          orderBy: { sequence: "asc" },
        },
        overtimeRequests: { select: { status: true } },
      },
      orderBy: [{ workDate: "desc" }, { checkInAt: "desc" }],
      take: 200,
    });
    const locationIds = records
      .flatMap((record) =>
        record.sessions.flatMap((session) => [
          session.checkInLocationId,
          session.checkOutLocationId,
        ]),
      )
      .filter((id): id is string => Boolean(id));
    const locations = await this.prisma.branchLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, branch: { select: { name: true } } },
    });
    const branchByLocation = new Map(
      locations.map((location) => [location.id, location.branch.name]),
    );
    const corrections = await this.prisma.attendanceCorrectionRequest.findMany({
      where: { attendanceId: { in: records.map((record) => record.id) } },
      select: { attendanceId: true, status: true },
      orderBy: { updatedAt: "desc" },
    });
    const correctionStatusByAttendance = new Map<string, string>();
    for (const correction of corrections) {
      if (
        correction.attendanceId &&
        !correctionStatusByAttendance.has(correction.attendanceId)
      )
        correctionStatusByAttendance.set(
          correction.attendanceId,
          correction.status,
        );
    }
    const assignments =
      await this.prisma.employeeWorkScheduleAssignment.findMany({
        where: {
          employeeId: { in: records.map((record) => record.employeeId) },
        },
        include: { workSchedule: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });
    const dailySchedules = await this.prisma.employeeDailySchedule.findMany({
      where: {
        employeeId: { in: records.map((record) => record.employeeId) },
        workDate: { in: records.map((record) => record.workDate) },
      },
      include: {
        workSchedule: true,
        segments: { orderBy: { sequence: "asc" }, select: { startTime: true, endTime: true } },
      },
    });
    const overrides = await this.prisma.employeeScheduleOverride.findMany({
      where: {
        employeeId: { in: records.map((record) => record.employeeId) },
        workDate: { in: records.map((record) => record.workDate) },
      },
      include: { workSchedule: true },
    });
    const setting = await this.prisma.companySetting.findUnique({
      where: { id: "default" },
      select: { timezone: true, latePenaltyPerMinute: true },
    });
    const timezone = setting?.timezone ?? "Asia/Ho_Chi_Minh";
    const attendanceRows = await Promise.all(
      records.map(async (record) => {
        const assignment = assignments.find(
          (item) =>
            item.employeeId === record.employeeId &&
            item.effectiveFrom <= record.workDate &&
            (!item.effectiveTo || item.effectiveTo >= record.workDate) &&
            (!item.weekdays.length ||
              item.weekdays.includes(record.workDate.getUTCDay())),
        );
        const daily = dailySchedules.find(
          (item) =>
            item.employeeId === record.employeeId &&
            item.workDate.getTime() === record.workDate.getTime(),
        );
        const override = overrides.find(
          (item) =>
            item.employeeId === record.employeeId &&
            item.workDate.getTime() === record.workDate.getTime(),
        );
        const schedule = daily
          ? {
              ...daily.workSchedule,
              name: daily.scheduleName,
              startTime: daily.segments[0]?.startTime ?? daily.workSchedule.startTime,
              endTime: daily.segments[0]?.endTime ?? daily.workSchedule.endTime,
              secondStartTime: daily.segments[1]?.startTime ?? null,
              secondEndTime: daily.segments[1]?.endTime ?? null,
            }
          : override?.workSchedule ?? assignment?.workSchedule;
        const segments = schedule
          ? [
              { start: schedule.startTime, end: schedule.endTime },
              ...(schedule.secondStartTime && schedule.secondEndTime
                ? [
                    {
                      start: schedule.secondStartTime,
                      end: schedule.secondEndTime,
                    },
                  ]
                : []),
            ]
          : [];
        const approvalUpdate = (record.approvalUpdate ??
          {}) as unknown as AttendanceApprovalUpdate;
        const overtimeApproved =
          record.overtimeRequests.some(
            (request) => request.status === "APPROVED",
          ) ||
          approvalUpdate.items?.some(
            (item) => item.type === "OVERTIME" && item.decision === "APPROVED",
          );
        let totalMinutes = 0;
        let calculatedLateMinutes = 0;
        for (const [index, segment] of segments.entries()) {
          const session = record.sessions[index];
          if (!session || !schedule) continue;
          const [startHour, startMinute] = segment.start.split(":").map(Number);
          const [endHour, endMinute] = segment.end.split(":").map(Number);
          const start = startHour * 60 + startMinute;
          const end = endHour * 60 + endMinute;
          const checkIn = minutesInTimeZone(session.checkInAt, timezone);
          calculatedLateMinutes += Math.max(
            0,
            checkIn - start,
          );
          if (!session.checkOutAt) continue;
          const checkOut = minutesInTimeZone(session.checkOutAt, timezone);
          totalMinutes += Math.max(
            0,
            (overtimeApproved ? checkOut : Math.min(checkOut, end)) -
              Math.max(checkIn, start),
          );
        }
        const attendanceBranchName = record.sessions
          .map(
            (session) =>
              branchByLocation.get(session.checkInLocationId ?? "") ??
              branchByLocation.get(session.checkOutLocationId ?? ""),
          )
          .find(Boolean);
        return {
          ...this.withoutAuditPhotoKeys(record),
          approvalReasons:
            approvalUpdate.exceptionTypes ??
            (record.exceptionType ? [record.exceptionType] : []),
          approvalItems:
            approvalUpdate.items ??
            (record.exceptionType
              ? [{ type: record.exceptionType, decision: "PENDING" as const }]
              : []),
          sessions: await Promise.all(
            record.sessions.map(
              async ({
                checkInLocationId: _checkInLocationId,
                checkOutLocationId: _checkOutLocationId,
                checkInPhotoUrl,
                checkOutPhotoUrl,
                ...session
              }) => ({
                ...session,
                checkInPhoto:
                  includeAuditPhotos && checkInPhotoUrl
                    ? await this.storage.presignedDownload(checkInPhotoUrl)
                    : null,
                checkOutPhoto:
                  includeAuditPhotos && checkOutPhotoUrl
                    ? await this.storage.presignedDownload(checkOutPhotoUrl)
                    : null,
              }),
            ),
          ),
          attendanceBranchName: attendanceBranchName ?? null,
          totalMinutes,
          lateMinutes: schedule ? calculatedLateMinutes : null,
          latePenalty: schedule
            ? (approvalUpdate.manualLatePenalty ??
              (record.latePenaltyWaived
                ? 0
                : Number(setting?.latePenaltyPerMinute ?? 0) *
                  calculatedLateMinutes))
            : null,
          manualReward: approvalUpdate.manualReward ?? null,
          workScheduleName:
            record.manualWorkScheduleName ??
            schedule?.name ??
            null,
          manualScheduleTimes: approvalUpdate.manualScheduleTimes ?? null,
          approvalDisplayStatus:
            correctionStatusByAttendance.get(record.id) ??
            (record.approvalRequestNote
              ? (approvalUpdate.reviewState ?? record.approvalStatus)
              : null),
        };
      }),
    );

    const today = workDateInTimeZone(new Date(), timezone);
    const rangeStart = query.date
      ? workDateFromIsoDate(query.date)
      : query.from
        ? workDateFromIsoDate(query.from)
        : monthStartInTimeZone(today, timezone);
    const requestedEnd = query.date
      ? workDateFromIsoDate(query.date)
      : query.to
        ? workDateFromIsoDate(query.to)
        : today;
    const rangeEnd = requestedEnd > today ? today : requestedEnd;
    const scheduledRows: Array<{
      id: string;
      workDate: Date;
      checkInAt: null;
      checkOutAt: null;
      status: string;
      livenessPassed: false;
      approvalStatus: "APPROVED";
      employee: { id: string; fullName: string; employeeNo: string };
      sessions: [];
      workScheduleName: string;
      workScheduleTimes: string[];
      attendanceBranchName: string;
      isScheduledPlaceholder: true;
    }> = [];
    if (rangeStart <= rangeEnd && !query.approvalStatus) {
      const rosterMonths = new Set<string>();
      for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1)) {
        rosterMonths.add(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
      }
      const rosters = await Promise.all(
        [...rosterMonths].map((month) => this.workRoster.list(month, null, true)),
      );
      const occupancyRecords = query.status === "ABSENT"
        ? await this.prisma.attendance.findMany({
            where: { ...where, status: undefined },
            select: { employeeId: true, workDate: true },
          })
        : records;
      const recordedShifts = new Set(occupancyRecords.map((record) => `${record.employeeId}:${isoDateInTimeZone(record.workDate, timezone)}`));
      const fromKey = isoDateInTimeZone(rangeStart, timezone);
      const toKey = isoDateInTimeZone(rangeEnd, timezone);
      for (const roster of rosters) {
        for (const entry of roster.entries) {
          const workDate = isoDateInTimeZone(new Date(entry.workDate), timezone);
          if (workDate < fromKey || workDate > toKey) continue;
          if (scopeEmployeeId === "__none__") continue;
          if (scopeEmployeeId && entry.employee.id !== scopeEmployeeId) continue;
          if (query.employeeId && entry.employee.id !== query.employeeId) continue;
          if (recordedShifts.has(`${entry.employee.id}:${workDate}`)) continue;
          if (branchIds && !entry.segments.some((segment) => branchIds.includes(segment.branch.id))) continue;
          if (query.branchId && !entry.segments.some((segment) => segment.branch.id === query.branchId)) continue;
          const status = workDate < isoDateInTimeZone(today, timezone) ? "ABSENT" : "NOT_ARRIVED";
          if (query.status && query.status !== status) continue;
          scheduledRows.push({
            id: `scheduled:${entry.employee.id}:${workDate}`,
            workDate: new Date(entry.workDate),
            checkInAt: null,
            checkOutAt: null,
            status,
            livenessPassed: false,
            approvalStatus: "APPROVED",
            employee: {
              id: entry.employee.id,
              fullName: entry.employee.fullName,
              employeeNo: entry.employee.employeeNo,
            },
            sessions: [],
            workScheduleName: entry.scheduleName,
            workScheduleTimes: entry.segments.map((segment) => `${segment.startTime}–${segment.endTime}`),
            attendanceBranchName: entry.segments.map((segment) => segment.branch.name).join(", "),
            isScheduledPlaceholder: true,
          });
        }
      }
    }

    const filteredAttendanceRows = query.status
      ? attendanceRows.filter((record) => record.status === query.status)
      : attendanceRows;
    return [...filteredAttendanceRows, ...scheduledRows].sort((a, b) => {
      const dateOrder = new Date(b.workDate).getTime() - new Date(a.workDate).getTime();
      if (dateOrder) return dateOrder;
      return (b.checkInAt ? new Date(b.checkInAt).getTime() : 0) -
        (a.checkInAt ? new Date(a.checkInAt).getTime() : 0);
    });
  }

  /** Detailed attendance audit view. Photo URLs are short-lived and never expose object keys. */
  async getDetail(
    id: string,
    scopeEmployeeId?: string | null,
    includeAuditPhotos = false,
  ) {
    const record = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNo: true,
            department: { select: { name: true } },
          },
        },
        sessions: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            sequence: true,
            checkInAt: true,
            checkOutAt: true,
            checkInLocationId: true,
            checkOutLocationId: true,
            checkInLat: true,
            checkInLng: true,
            checkOutLat: true,
            checkOutLng: true,
            checkInAccuracyMeters: true,
            checkOutAccuracyMeters: true,
            checkInDistanceMeters: true,
            checkOutDistanceMeters: true,
            checkInPhotoUrl: true,
            checkOutPhotoUrl: true,
            checkOutUpdateCount: true,
          },
        },
      },
    });
    if (!record || (scopeEmployeeId && record.employeeId !== scopeEmployeeId))
      throw new NotFoundException("Không tìm thấy bản ghi chấm công");

    const locationIds = record.sessions
      .flatMap((session) => [
        session.checkInLocationId,
        session.checkOutLocationId,
      ])
      .filter((id): id is string => Boolean(id));
    const locations = await this.prisma.branchLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true, branch: { select: { name: true } } },
    });
    const locationById = new Map(
      locations.map((location) => [
        location.id,
        `${location.branch.name} — ${location.name}`,
      ]),
    );
    const sessions = await Promise.all(
      record.sessions.map(
        async ({
          checkInPhotoUrl,
          checkOutPhotoUrl,
          checkInLocationId,
          checkOutLocationId,
          ...session
        }) => ({
          ...session,
          checkInLocation: checkInLocationId
            ? (locationById.get(checkInLocationId) ?? null)
            : null,
          checkOutLocation: checkOutLocationId
            ? (locationById.get(checkOutLocationId) ?? null)
            : null,
          checkInPhoto:
            includeAuditPhotos && checkInPhotoUrl
              ? await this.storage.presignedDownload(checkInPhotoUrl)
              : null,
          checkOutPhoto:
            includeAuditPhotos && checkOutPhotoUrl
              ? await this.storage.presignedDownload(checkOutPhotoUrl)
              : null,
        }),
      ),
    );
    const latestCorrection =
      await this.prisma.attendanceCorrectionRequest.findFirst({
        where: { attendanceId: id },
        select: { status: true },
        orderBy: { updatedAt: "desc" },
      });
    const {
      checkInPhotoUrl: _checkInPhotoUrl,
      checkOutPhotoUrl: _checkOutPhotoUrl,
      ...safe
    } = record;
    const approvalUpdate = (record.approvalUpdate ??
      {}) as unknown as AttendanceApprovalUpdate;
    return {
      ...safe,
      approvalReasons:
        approvalUpdate.exceptionTypes ??
        (record.exceptionType ? [record.exceptionType] : []),
      approvalItems:
        approvalUpdate.items ??
        (record.exceptionType
          ? [{ type: record.exceptionType, decision: "PENDING" as const }]
          : []),
      manualReward: approvalUpdate.manualReward ?? null,
      manualScheduleTimes: approvalUpdate.manualScheduleTimes ?? null,
      ...(approvalUpdate.manualLatePenalty !== undefined
        ? { latePenalty: approvalUpdate.manualLatePenalty }
        : {}),
      sessions,
      approvalDisplayStatus:
        latestCorrection?.status ??
        (record.approvalRequestNote
          ? (approvalUpdate.reviewState ?? record.approvalStatus)
          : null),
    };
  }

  /** Status breakdown for a single day (defaults to today). */
  async summary(dateStr?: string) {
    const timezone = await this.companyTimezone();
    const workDate = dateStr
      ? workDateFromIsoDate(dateStr)
      : workDateInTimeZone(new Date(), timezone);
    const grouped = await this.prisma.attendance.groupBy({
      by: ["status"],
      where: { workDate },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {
      PRESENT: 0,
      LATE: 0,
      LEAVE: 0,
      PERMIT: 0,
      ABSENT: 0,
    };
    for (const g of grouped) counts[g.status] = g._count._all;

    const totalActive = await this.prisma.employee.count({
      where: { deletedAt: null },
    });
    const recorded = Object.values(counts).reduce((a, b) => a + b, 0);
    counts.ABSENT = Math.max(counts.ABSENT, totalActive - recorded);

    return { date: isoDateInTimeZone(workDate, "UTC"), totalActive, counts };
  }

  /** Personal month-to-date attendance stats for the self-service dashboard. */
  async myMonthSummary(employeeId: string) {
    const now = new Date();
    const timezone = await this.companyTimezone();
    const monthStart = monthStartInTimeZone(now, timezone);
    const grouped = await this.prisma.attendance.groupBy({
      by: ["status"],
      where: { employeeId, workDate: { gte: monthStart } },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {
      PRESENT: 0,
      LATE: 0,
      LEAVE: 0,
      PERMIT: 0,
      ABSENT: 0,
    };
    for (const g of grouped) counts[g.status] = g._count._all;

    const workDate = workDateInTimeZone(now, timezone);
    const today = await this.prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId, workDate } },
      select: {
        id: true,
        checkInAt: true,
        checkOutAt: true,
        status: true,
        approvalStatus: true,
        approvalRequestNote: true,
        sessions: {
          select: {
            sequence: true,
            checkInAt: true,
            checkOutAt: true,
            checkOutUpdateCount: true,
          },
          orderBy: { sequence: "asc" },
        },
      },
    });
    const enrolled =
      (await this.prisma.faceProfile.count({ where: { employeeId } })) > 0;

    const latestCorrection = today
      ? await this.prisma.attendanceCorrectionRequest.findFirst({
          where: { attendanceId: today.id },
          select: { status: true },
          orderBy: { updatedAt: "desc" },
        })
      : null;
    return {
      counts,
      today: today
        ? {
            ...today,
            approvalDisplayStatus:
              latestCorrection?.status ??
              (today.approvalRequestNote ? today.approvalStatus : null),
          }
        : null,
      enrolled,
    };
  }

  /** Active attendance locations the employee may use today; safe for mobile preflight. */
  async eligibleLocations(employeeId: string) {
    void employeeId;
    const allLocations = await this.prisma.branchLocation.findMany({
      where: { isActive: true, branch: { isActive: true } },
      include: { branch: { select: { name: true } } },
    });
    return allLocations.map((location) => ({
      id: location.id,
      name: location.name,
      branchName: location.branch.name,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters: location.radiusMeters,
      allowRemote: false,
    }));
  }

  // ---- internals ----

  /** Keep the day summary aligned with the first in and latest out of its two sessions. */
  private async synchronizeAttendanceFromSessions(
    tx: Prisma.TransactionClient,
    attendanceId: string,
  ) {
    const attendance = await tx.attendance.findUniqueOrThrow({
      where: { id: attendanceId },
      select: {
        employeeId: true,
        workDate: true,
        manualWorkScheduleId: true,
      },
    });
    const sessions = await tx.attendanceSession.findMany({
      where: { attendanceId },
      orderBy: { sequence: "asc" },
    });
    const first = sessions[0];
    const latestOut = [...sessions]
      .reverse()
      .find((session) => session.checkOutAt);
    const schedule = attendance.manualWorkScheduleId
      ? await tx.workSchedule.findUnique({
          where: { id: attendance.manualWorkScheduleId },
          select: { startTime: true },
        })
      : (await this.scheduleResolver.resolve(
          attendance.employeeId,
          attendance.workDate,
        ))?.workSchedule;
    const timezone = await this.companyTimezone();
    const startTime = schedule?.startTime;
    const [startHour, startMinute] = startTime?.split(":").map(Number) ?? [];
    const isLate = Boolean(
      first &&
        startTime &&
        minutesInTimeZone(first.checkInAt, timezone) >
          startHour * 60 + startMinute,
    );
    await tx.attendance.update({
      where: { id: attendanceId },
      data: {
        checkInAt: first?.checkInAt ?? null,
        checkInLat: first?.checkInLat ?? null,
        checkInLng: first?.checkInLng ?? null,
        checkInLocationId: first?.checkInLocationId ?? null,
        checkInAccuracyMeters: first?.checkInAccuracyMeters ?? null,
        checkInDistanceMeters: first?.checkInDistanceMeters ?? null,
        checkInPhotoUrl: first?.checkInPhotoUrl ?? null,
        checkOutAt: latestOut?.checkOutAt ?? null,
        checkOutLat: latestOut?.checkOutLat ?? null,
        checkOutLng: latestOut?.checkOutLng ?? null,
        checkOutLocationId: latestOut?.checkOutLocationId ?? null,
        checkOutAccuracyMeters: latestOut?.checkOutAccuracyMeters ?? null,
        checkOutDistanceMeters: latestOut?.checkOutDistanceMeters ?? null,
        checkOutPhotoUrl: latestOut?.checkOutPhotoUrl ?? null,
        status: first ? (isLate ? "LATE" : "PRESENT") : "ABSENT",
      },
    });
  }

  /** Match the probe embedding against the employee's enrolled profiles. */
  private async verify(dto: CheckDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!employee) throw new NotFoundException("Không tìm thấy nhân viên");

    const enrolled = await this.face.loadEmbeddings(employee.id);
    if (!enrolled.length)
      throw new BadRequestException("Nhân viên chưa đăng ký khuôn mặt");

    const dist = minDistance(dto.embedding, enrolled);
    if (dist > this.threshold)
      throw new UnauthorizedException("Không nhận diện được khuôn mặt");

    return {
      employee,
      matchScore: Number(distanceToConfidence(dist).toFixed(4)),
    };
  }

  private async deriveStatus(
    employeeId: string,
    workDate: Date,
    at: Date,
    timezone: string,
  ): Promise<"PRESENT" | "LATE"> {
    const resolved = await this.scheduleResolver.resolve(employeeId, workDate);
    if (!resolved) return "PRESENT";

    const [h, m] = resolved.workSchedule.startTime.split(":").map(Number);
    const deadline = h * 60 + m;
    const arrived = minutesInTimeZone(at, timezone);
    return arrived <= deadline ? "PRESENT" : "LATE";
  }

  private async companyTimezone() {
    const setting = await this.prisma.companySetting.findUnique({
      where: { id: "default" },
      select: { timezone: true },
    });
    return setting?.timezone ?? "Asia/Ho_Chi_Minh";
  }

  private async livenessPolicy(): Promise<LivenessPolicy> {
    const setting = await this.prisma.companySetting.findUnique({
      where: { id: "default" },
      select: { livenessMode: true },
    });
    return this.normalizedLivenessPolicy(setting?.livenessMode);
  }

  private normalizedLivenessPolicy(policy?: string | null): LivenessPolicy {
    return policy === "NONE" ||
      policy === "BLINK" ||
      policy === "TURN_HEAD" ||
      policy === "SMILE" ||
      policy === "NOD" ||
      policy === "RANDOM"
      ? policy
      : "RANDOM";
  }

  private signLivenessPayload(payload: string) {
    const secret =
      process.env.LIVENESS_CHALLENGE_SECRET ?? process.env.JWT_ACCESS_SECRET;
    if (!secret)
      throw new BadRequestException("Thiếu khóa bảo mật xác minh sống");
    return createHmac("sha256", secret).update(payload).digest("base64url");
  }

  private async assertLiveness(
    dto: Pick<
      CheckDto,
      "livenessPassed" | "livenessChallenge" | "livenessToken"
    >,
    policy: LivenessPolicy,
    actorId: string,
  ) {
    if (policy === "NONE") return;
    if (!dto.livenessPassed)
      throw new BadRequestException("Xác minh sống chưa đạt yêu cầu");
    if (!dto.livenessToken || !dto.livenessChallenge)
      throw new BadRequestException("Thiếu thử thách xác minh sống");
    const [encodedPayload, signature] = dto.livenessToken.split(".");
    if (!encodedPayload || !signature)
      throw new BadRequestException("Thử thách xác minh sống không hợp lệ");
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expectedSignature = this.signLivenessPayload(payload);
    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new BadRequestException("Thử thách xác minh sống không hợp lệ");
    const [tokenActorId, tokenChallenge, expiresAtRaw, nonce] =
      payload.split(":");
    const expiresAt = Number(expiresAtRaw);
    if (
      !tokenActorId ||
      !nonce ||
      tokenActorId !== actorId ||
      !Number.isFinite(expiresAt) ||
      expiresAt < Date.now()
    )
      throw new BadRequestException("Thử thách xác minh sống đã hết hạn");
    for (const [usedNonce, usedUntil] of this.usedLivenessNonces) {
      if (usedUntil < Date.now()) this.usedLivenessNonces.delete(usedNonce);
    }
    if (this.usedLivenessNonces.has(nonce))
      throw new BadRequestException("Thử thách xác minh sống đã được sử dụng");
    if (tokenChallenge !== dto.livenessChallenge)
      throw new BadRequestException(
        "Kết quả xác minh sống không khớp thử thách",
      );
    const isAllowed =
      policy === "RANDOM" ||
      (policy === "SMILE" && tokenChallenge === "SMILE") ||
      (policy === "BLINK" && tokenChallenge === "BLINK") ||
      (policy === "NOD" && tokenChallenge === "NOD") ||
      (policy === "TURN_HEAD" &&
        ["TURN_LEFT", "TURN_RIGHT"].includes(tokenChallenge));
    if (!isAllowed)
      throw new BadRequestException(
        "Thử thách xác minh sống không đúng chính sách",
      );
    this.usedLivenessNonces.set(nonce, expiresAt);
  }

  private async identificationCandidates(
    dto: Pick<IdentifyCheckDto, "lat" | "lng" | "accuracyMeters">,
    workDate: Date,
  ) {
    {
      const locations = await this.prisma.branchLocation.findMany({
        where: { isActive: true, branch: { isActive: true } },
        select: { latitude: true, longitude: true, radiusMeters: true },
      });
      if (dto.lat === undefined || dto.lng === undefined)
        throw new BadRequestException(
          "Cần bật định vị GPS để nhận diện chấm công",
        );
      if (dto.accuracyMeters !== undefined && dto.accuracyMeters! > 200)
        throw new BadRequestException(
          "Độ chính xác GPS quá thấp, vui lòng di chuyển ra nơi thoáng hơn",
        );
      const insideStore = locations.some(
        (location) =>
          haversineMeters(
            dto.lat!,
            dto.lng!,
            location.latitude,
            location.longitude,
          ) <= location.radiusMeters,
      );
      if (!insideStore)
        throw new ForbiddenException("Bạn chưa ở trong phạm vi của cửa hàng");
      const employees = await this.prisma.employee.findMany({
        where: { deletedAt: null, faceProfiles: { some: {} } },
        select: { id: true },
      });
      return employees.map((employee) => employee.id);
    }

    const policy = await this.checkPolicy();
    if (policy.requireGps && (dto.lat === undefined || dto.lng === undefined))
      throw new BadRequestException(
        "Cần bật định vị GPS để nhận diện chấm công",
      );
    if (dto.accuracyMeters !== undefined && dto.accuracyMeters! > 200)
      throw new BadRequestException(
        "Độ chính xác GPS quá thấp, vui lòng di chuyển ra nơi thoáng hơn",
      );
    const assignments = await this.prisma.employeeBranchAssignment.findMany({
      where: {
        effectiveFrom: { lte: workDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
      },
      include: {
        branch: { include: { locations: { where: { isActive: true } } } },
      },
    });
    const isLocationEligible = (assignment: {
      allowRemote: boolean;
      branch: {
        locations: Array<{
          allowRemote: boolean;
          latitude: number;
          longitude: number;
          radiusMeters: number;
        }>;
      };
    }) => {
      if (assignment.allowRemote) return true;
      if (dto.lat === undefined || dto.lng === undefined)
        return !policy.requireGps;
      return assignment.branch.locations.some(
        (location) =>
          location.allowRemote ||
          haversineMeters(
            dto.lat!,
            dto.lng!,
            location.latitude,
            location.longitude,
          ) <= location.radiusMeters,
      );
    };
    const assignedCandidateIds = assignments
      .filter(isLocationEligible)
      .map((assignment) => assignment.employeeId);

    // Store administrators may have no explicit branch assignment. Apply the
    // existing active-branch fallback for ADMIN only, so ordinary unassigned
    // employees cannot check in at every branch.
    const administrators = await this.prisma.employee.findMany({
      where: {
        deletedAt: null,
        user: {
          is: {
            deletedAt: null,
            isActive: true,
            roles: { some: { role: { code: "admin" } } },
          },
        },
      },
      select: { id: true },
    });
    const adminAssignments = await Promise.all(
      administrators.map(async (administrator) => ({
        employeeId: administrator.id,
        assignments: await this.activeAssignments(administrator.id, workDate),
      })),
    );
    const adminCandidateIds = adminAssignments.flatMap((administrator) =>
      administrator.assignments.some(isLocationEligible)
        ? [administrator.employeeId]
        : [],
    );

    return [...new Set([...assignedCandidateIds, ...adminCandidateIds])];
  }

  private async activeAssignments(employeeId: string, workDate: Date) {
    const assignments = await this.prisma.employeeBranchAssignment.findMany({
      where: {
        employeeId,
        effectiveFrom: { lte: workDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
      },
      include: {
        branch: { include: { locations: { where: { isActive: true } } } },
      },
    });
    if (assignments.length) return assignments;
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      include: { locations: { where: { isActive: true } } },
    });
    return branches.map((branch) => ({
      employeeId,
      branchId: branch.id,
      allowRemote: false,
      branch,
    }));
  }

  private async overtimeEligibility(
    employeeId: string,
    workDate: Date,
    checkOutAt: Date,
  ) {
    const [assignment, setting, timezone] = await Promise.all([
      this.prisma.employeeWorkScheduleAssignment.findFirst({
        where: {
          employeeId,
          effectiveFrom: { lte: workDate },
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }] },
            {
              OR: [
                { weekdays: { isEmpty: true } },
                { weekdays: { has: workDate.getUTCDay() } },
              ],
            },
          ],
        },
        include: { workSchedule: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.companySetting.findUnique({
        where: { id: "default" },
        select: { overtimeTriggerMinutes: true },
      }),
      this.companyTimezone(),
    ]);
    if (!assignment) return { canRequest: false, eligibleMinutes: 0 };
    const endTime =
      assignment.workSchedule.secondEndTime ?? assignment.workSchedule.endTime;
    const [hours, minutes] = endTime.split(":").map(Number);
    const excess = Math.max(
      0,
      minutesInTimeZone(checkOutAt, timezone) - (hours * 60 + minutes),
    );
    const trigger = setting?.overtimeTriggerMinutes ?? 15;
    return {
      canRequest: excess >= trigger,
      eligibleMinutes: excess,
      triggerMinutes: trigger,
    };
  }

  private async resolveGeofence(
    employeeId: string,
    dto: CheckDto,
    workDate: Date,
  ) {
    {
      if (dto.lat === undefined || dto.lng === undefined)
        throw new BadRequestException("Cần bật định vị GPS để chấm công");
      if (dto.accuracyMeters !== undefined && dto.accuracyMeters! > 200)
        throw new BadRequestException(
          "Độ chính xác GPS quá thấp, vui lòng di chuyển ra nơi thoáng hơn",
        );
      const locations = await this.prisma.branchLocation.findMany({
        where: { isActive: true, branch: { isActive: true } },
      });
      if (!locations.length)
        throw new ForbiddenException("Chưa có điểm chấm công đang hoạt động");
      const closest = locations
        .map((location) => ({
          location,
          distanceMeters: haversineMeters(
            dto.lat!,
            dto.lng!,
            location.latitude,
            location.longitude,
          ),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
      if (closest.distanceMeters > closest.location.radiusMeters)
        throw new ForbiddenException(
          `Ngoài phạm vi điểm chấm công gần nhất (${Math.round(closest.distanceMeters)} m)`,
        );
      return {
        locationId: closest.location.id,
        distanceMeters: Number(closest.distanceMeters.toFixed(1)),
        reason: "IN_GEOFENCE",
      };
    }

    const setting = await this.prisma.companySetting.findUnique({
      where: { id: "default" },
      select: { requireGps: true },
    });
    if (!setting?.requireGps)
      return {
        locationId: undefined,
        distanceMeters: undefined,
        reason: "GPS_OPTIONAL",
      };
    if (dto.lat === undefined || dto.lng === undefined)
      throw new BadRequestException("Cần bật định vị GPS để chấm công");
    if (dto.accuracyMeters !== undefined && dto.accuracyMeters! > 200)
      throw new BadRequestException(
        "Độ chính xác GPS quá thấp, vui lòng di chuyển ra nơi thoáng hơn",
      );

    const assignments = await this.activeAssignments(employeeId, workDate);
    const candidates = assignments.flatMap((assignment) =>
      assignment.branch.locations.map((location) => ({
        ...location,
        allowRemote: assignment.allowRemote || location.allowRemote,
      })),
    );
    const remoteAllowed =
      assignments.some((assignment) => assignment.allowRemote) ||
      candidates.some((location) => location.allowRemote);
    if (!candidates.length) {
      if (remoteAllowed)
        return {
          locationId: undefined,
          distanceMeters: undefined,
          reason: "REMOTE_APPROVED",
        };
      throw new ForbiddenException(
        "Nhân viên chưa được gán điểm chấm công đang hiệu lực",
      );
    }

    const closest = candidates
      .map((location) => ({
        location,
        distanceMeters: haversineMeters(
          dto.lat!,
          dto.lng!,
          location.latitude,
          location.longitude,
        ),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

    if (closest.distanceMeters <= closest.location.radiusMeters) {
      return {
        locationId: closest.location.id,
        distanceMeters: Number(closest.distanceMeters.toFixed(1)),
        reason: "IN_GEOFENCE",
      };
    }
    if (remoteAllowed)
      return {
        locationId: undefined,
        distanceMeters: Number(closest.distanceMeters.toFixed(1)),
        reason: "REMOTE_APPROVED",
      };
    throw new ForbiddenException(
      `Ngoài phạm vi điểm chấm công gần nhất (${Math.round(closest.distanceMeters)} m)`,
    );
  }

  /** Deletes images after the company retention period; object keys never leave this service. */
  private async purgeExpiredAuditPhotos() {
    const setting = await this.prisma.companySetting.findUnique({
      where: { id: "default" },
      select: { auditRetentionDays: true },
    });
    const cutoff = new Date();
    cutoff.setUTCDate(
      cutoff.getUTCDate() - (setting?.auditRetentionDays ?? 90),
    );
    const expired = await this.prisma.attendance.findMany({
      where: {
        createdAt: { lt: cutoff },
        OR: [
          { checkInPhotoUrl: { not: null } },
          { checkOutPhotoUrl: { not: null } },
          { approvalEvidencePhotoUrls: { isEmpty: false } },
        ],
      },
      select: {
        id: true,
        checkInPhotoUrl: true,
        checkOutPhotoUrl: true,
        approvalEvidencePhotoUrls: true,
      },
      take: 200,
    });
    const expiredSessions = await this.prisma.attendanceSession.findMany({
      where: {
        createdAt: { lt: cutoff },
        OR: [
          { checkInPhotoUrl: { not: null } },
          { checkOutPhotoUrl: { not: null } },
        ],
      },
      select: { id: true, checkInPhotoUrl: true, checkOutPhotoUrl: true },
      take: 400,
    });
    const expiredCorrectionEvidence =
      await this.prisma.attendanceCorrectionRequest.findMany({
        where: { createdAt: { lt: cutoff }, evidencePhotoUrl: { not: null } },
        select: { id: true, evidencePhotoUrl: true },
        take: 200,
      });
    const keys = [
      ...expired.flatMap((record) =>
        [
          record.checkInPhotoUrl,
          record.checkOutPhotoUrl,
          ...record.approvalEvidencePhotoUrls,
        ].filter((key): key is string => Boolean(key)),
      ),
      ...expiredSessions.flatMap((record) =>
        [record.checkInPhotoUrl, record.checkOutPhotoUrl].filter(
          (key): key is string => Boolean(key),
        ),
      ),
      ...expiredCorrectionEvidence
        .map((record) => record.evidencePhotoUrl)
        .filter((key): key is string => Boolean(key)),
    ];
    await Promise.all(keys.map((key) => this.storage.remove(key)));
    if (expired.length) {
      await this.prisma.attendance.updateMany({
        where: { id: { in: expired.map((record) => record.id) } },
        data: {
          checkInPhotoUrl: null,
          checkOutPhotoUrl: null,
          approvalEvidencePhotoUrls: [],
        },
      });
    }
    if (expiredSessions.length)
      await this.prisma.attendanceSession.updateMany({
        where: { id: { in: expiredSessions.map((record) => record.id) } },
        data: { checkInPhotoUrl: null, checkOutPhotoUrl: null },
      });
    if (expiredCorrectionEvidence.length)
      await this.prisma.attendanceCorrectionRequest.updateMany({
        where: {
          id: { in: expiredCorrectionEvidence.map((record) => record.id) },
        },
        data: { evidencePhotoUrl: null },
      });
    if (
      expired.length ||
      expiredSessions.length ||
      expiredCorrectionEvidence.length
    )
      await this.audit.record({
        action: "DELETE",
        entity: "AttendanceAuditPhoto",
        after: {
          count: keys.length,
          attendanceRecords: expired.length,
          sessions: expiredSessions.length,
          correctionEvidence: expiredCorrectionEvidence.length,
          cutoff: cutoff.toISOString(),
        },
      });
  }

  private withoutAuditPhotoKeys<
    T extends {
      checkInPhotoUrl?: string | null;
      checkOutPhotoUrl?: string | null;
    },
  >(record: T) {
    const {
      checkInPhotoUrl: _checkInPhotoUrl,
      checkOutPhotoUrl: _checkOutPhotoUrl,
      ...safe
    } = record;
    return safe;
  }
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
