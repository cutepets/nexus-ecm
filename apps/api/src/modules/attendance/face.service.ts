import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../../core/prisma/prisma.service";
import { StorageService } from "../../core/storage/storage.service";
import { CryptoService } from "../../core/crypto/crypto.service";
import { AuditService, AuditContext } from "../../core/audit/audit.service";
import { EnrollFaceDto } from "./dto/face.dto";
import {
  bufferToEmbedding,
  distanceToConfidence,
  embeddingToBuffer,
  minDistance,
} from "./embedding.util";

@Injectable()
export class FaceService {
  private readonly fallbackMatchThreshold = Number(process.env.FACE_MATCH_THRESHOLD ?? 0.55);
  private readonly fallbackDuplicateThreshold = 0.43;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  /** Decrypt all stored embeddings for one employee into number arrays. */
  async loadEmbeddings(employeeId: string): Promise<number[][]> {
    const profiles = await this.prisma.faceProfile.findMany({
      where: { employeeId },
    });
    return profiles.map((p) =>
      bufferToEmbedding(this.crypto.decrypt(Buffer.from(p.embedding))),
    );
  }

  /** Identifies only within server-provided, location-eligible staff. */
  async identify(probe: number[], candidateEmployeeIds: string[]) {
    const thresholds = await this.faceThresholds();
    if (!candidateEmployeeIds.length)
      throw new UnauthorizedException("Không tìm thấy khuôn mặt phù hợp");
    const profiles = await this.prisma.faceProfile.findMany({
      where: {
        employeeId: { in: candidateEmployeeIds },
        employee: { deletedAt: null },
      },
      select: { employeeId: true, embedding: true },
    });
    const nearestByEmployee = new Map<string, number>();
    for (const profile of profiles) {
      const distance = minDistance(probe, [
        bufferToEmbedding(this.crypto.decrypt(Buffer.from(profile.embedding))),
      ]);
      const current = nearestByEmployee.get(profile.employeeId);
      if (current === undefined || distance < current)
        nearestByEmployee.set(profile.employeeId, distance);
    }
    const matches = [...nearestByEmployee.entries()].sort(
      (a, b) => a[1] - b[1],
    );
    const best = matches[0];
    const ambiguous = matches[1] && best && matches[1][1] - best[1] < 0.04;
    if (!best || best[1] > thresholds.match || ambiguous)
      throw new UnauthorizedException("Không tìm thấy khuôn mặt phù hợp");

    const employee = await this.prisma.employee.findFirst({
      where: { id: best[0], deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!employee)
      throw new UnauthorizedException("Không tìm thấy khuôn mặt phù hợp");
    return {
      employee,
      matchScore: Number(distanceToConfidence(best[1]).toFixed(4)),
    };
  }

  async enroll(dto: EnrollFaceDto, ctx: AuditContext) {
    const thresholds = await this.faceThresholds();
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!employee) throw new NotFoundException("Không tìm thấy nhân viên");

    // Re-enrolment is a replacement, not an append. Keeping old templates
    // leaves stale face vectors in the matching pool.
    const existingProfiles = await this.prisma.faceProfile.findMany({
      where: { employeeId: dto.employeeId },
      select: { sampleImageUrl: true },
    });

    // Deduplicate: reject if any embedding closely matches a DIFFERENT employee.
    const others = await this.prisma.faceProfile.findMany({
      where: { employeeId: { not: dto.employeeId } },
      select: { employeeId: true, embedding: true },
    });
    for (const probe of dto.embeddings) {
      for (const o of others) {
        const dist = minDistance(probe, [
          bufferToEmbedding(this.crypto.decrypt(Buffer.from(o.embedding))),
        ]);
        if (dist < thresholds.duplicate) {
          throw new ConflictException(
            "Khuôn mặt này đã được đăng ký cho một nhân viên khác",
          );
        }
      }
    }

    let sampleImageUrl: string | undefined;
    if (dto.sampleImage) {
      sampleImageUrl = await this.storage.putBase64Image(
        `employees/${dto.employeeId}/face`,
        dto.sampleImage,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.faceProfile.deleteMany({ where: { employeeId: dto.employeeId } });
      return Promise.all(
        dto.embeddings.map((emb, i) =>
          tx.faceProfile.create({
            data: {
              employeeId: dto.employeeId,
              embedding: this.crypto.encrypt(embeddingToBuffer(emb)),
              quality: 1,
              isPrimary: i === 0,
              sampleImageUrl: i === 0 ? sampleImageUrl : undefined,
            },
          }),
        ),
      );
    });

    await Promise.all(
      existingProfiles
        .flatMap((profile) => (profile.sampleImageUrl ? [profile.sampleImageUrl] : []))
        .map((key) => this.storage.remove(key)),
    );

    await this.audit.record({
      action: "CREATE",
      entity: "FaceProfile",
      entityId: employee.id,
      before: { employeeId: employee.id, count: existingProfiles.length },
      after: { employeeId: employee.id, count: created.length },
      ctx,
    });
    return {
      employeeId: employee.id,
      enrolled: created.length,
      replaced: existingProfiles.length,
    };
  }

  async status(employeeId: string) {
    const count = await this.prisma.faceProfile.count({
      where: { employeeId },
    });
    return { employeeId, enrolled: count > 0, profiles: count };
  }

  private async faceThresholds() {
    const setting = await this.prisma.companySetting.findUnique({
      where: { id: "default" },
      select: { faceMatchThreshold: true, faceDuplicateThreshold: true },
    });
    return {
      match: setting?.faceMatchThreshold ?? this.fallbackMatchThreshold,
      duplicate: setting?.faceDuplicateThreshold ?? this.fallbackDuplicateThreshold,
    };
  }

  /**
   * Privacy export is intentionally restricted to the store ADMIN. It returns
   * encrypted-at-rest embeddings (never decrypted templates) plus temporary
   * links to the employee's stored sample/audit images.
   */
  async exportPersonalData(employeeId: string, ctx: AuditContext) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, employeeNo: true, fullName: true },
    });
    if (!employee) throw new NotFoundException("Không tìm thấy nhân viên");
    const [profiles, attendance, sessions, correctionRequests] =
      await Promise.all([
        this.prisma.faceProfile.findMany({
          where: { employeeId },
          select: {
            id: true,
            embedding: true,
            quality: true,
            isPrimary: true,
            sampleImageUrl: true,
            createdAt: true,
          },
        }),
        this.prisma.attendance.findMany({
          where: { employeeId },
          select: {
            id: true,
            workDate: true,
            checkInPhotoUrl: true,
            checkOutPhotoUrl: true,
            createdAt: true,
          },
        }),
        this.prisma.attendanceSession.findMany({
          where: { attendance: { employeeId } },
          select: {
            id: true,
            sequence: true,
            checkInPhotoUrl: true,
            checkOutPhotoUrl: true,
            createdAt: true,
          },
        }),
        this.prisma.attendanceCorrectionRequest.findMany({
          where: { employeeId },
          select: {
            id: true,
            workDate: true,
            evidencePhotoUrl: true,
            createdAt: true,
          },
        }),
      ]);
    const link = async (key: string | null) =>
      key ? this.storage.presignedDownload(key, 300) : null;
    const result = {
      generatedAt: new Date().toISOString(),
      employee,
      faceProfiles: await Promise.all(
        profiles.map(async (profile) => ({
          id: profile.id,
          encryptedEmbeddingBase64: Buffer.from(profile.embedding).toString(
            "base64",
          ),
          quality: profile.quality,
          isPrimary: profile.isPrimary,
          createdAt: profile.createdAt,
          sampleImageDownloadUrl: await link(profile.sampleImageUrl),
        })),
      ),
      attendanceAuditImages: await Promise.all(
        attendance
          .flatMap((record) => [
            {
              recordId: record.id,
              workDate: record.workDate,
              type: "CHECK_IN",
              key: record.checkInPhotoUrl,
              createdAt: record.createdAt,
            },
            {
              recordId: record.id,
              workDate: record.workDate,
              type: "CHECK_OUT",
              key: record.checkOutPhotoUrl,
              createdAt: record.createdAt,
            },
          ])
          .filter((item) => item.key)
          .map(async (item) => ({
            recordId: item.recordId,
            workDate: item.workDate,
            type: item.type,
            createdAt: item.createdAt,
            downloadUrl: await link(item.key),
          })),
      ),
      sessionAuditImages: await Promise.all(
        sessions
          .flatMap((session) => [
            {
              sessionId: session.id,
              sequence: session.sequence,
              type: "CHECK_IN",
              key: session.checkInPhotoUrl,
              createdAt: session.createdAt,
            },
            {
              sessionId: session.id,
              sequence: session.sequence,
              type: "CHECK_OUT",
              key: session.checkOutPhotoUrl,
              createdAt: session.createdAt,
            },
          ])
          .filter((item) => item.key)
          .map(async (item) => ({
            sessionId: item.sessionId,
            sequence: item.sequence,
            type: item.type,
            createdAt: item.createdAt,
            downloadUrl: await link(item.key),
          })),
      ),
      correctionEvidenceImages: await Promise.all(
        correctionRequests
          .filter((request) => request.evidencePhotoUrl)
          .map(async (request) => ({
            requestId: request.id,
            workDate: request.workDate,
            type: "CORRECTION_EVIDENCE",
            createdAt: request.createdAt,
            downloadUrl: await link(request.evidencePhotoUrl),
          })),
      ),
    };
    await this.audit.record({
      action: "EXPORT",
      entity: "BiometricPrivacyExport",
      entityId: employeeId,
      after: {
        profileCount: profiles.length,
        attendanceImageCount: result.attendanceAuditImages.length,
        sessionImageCount: result.sessionAuditImages.length,
        correctionEvidenceImageCount: result.correctionEvidenceImages.length,
      },
      ctx,
    });
    return result;
  }

  /** Purge all face data for an employee (privacy / data-deletion path). */
  async purge(employeeId: string, ctx: AuditContext) {
    const profiles = await this.prisma.faceProfile.findMany({
      where: { employeeId },
    });
    if (!profiles.length)
      throw new BadRequestException(
        "Nhân viên chưa có dữ liệu khuôn mặt để xóa",
      );

    await Promise.all(
      profiles
        .filter((p) => p.sampleImageUrl)
        .map((p) => this.storage.remove(p.sampleImageUrl!)),
    );
    await this.prisma.faceProfile.deleteMany({ where: { employeeId } });
    await this.audit.record({
      action: "DELETE",
      entity: "FaceProfile",
      entityId: employeeId,
      ctx,
    });
    return { success: true, deleted: profiles.length };
  }

  /** Processes an approved employee privacy request without deleting attendance facts. */
  async purgePersonalData(employeeId: string, ctx: AuditContext) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException("Không tìm thấy nhân viên");
    const [profiles, attendance, sessions, correctionRequests] =
      await Promise.all([
        this.prisma.faceProfile.findMany({
          where: { employeeId },
          select: { sampleImageUrl: true },
        }),
        this.prisma.attendance.findMany({
          where: { employeeId },
          select: { id: true, checkInPhotoUrl: true, checkOutPhotoUrl: true },
        }),
        this.prisma.attendanceSession.findMany({
          where: { attendance: { employeeId } },
          select: { id: true, checkInPhotoUrl: true, checkOutPhotoUrl: true },
        }),
        this.prisma.attendanceCorrectionRequest.findMany({
          where: { employeeId },
          select: { id: true, evidencePhotoUrl: true },
        }),
      ]);
    const keys = [
      ...profiles.map((item) => item.sampleImageUrl),
      ...attendance.flatMap((item) => [
        item.checkInPhotoUrl,
        item.checkOutPhotoUrl,
      ]),
      ...sessions.flatMap((item) => [
        item.checkInPhotoUrl,
        item.checkOutPhotoUrl,
      ]),
      ...correctionRequests.map((item) => item.evidencePhotoUrl),
    ].filter((key): key is string => Boolean(key));
    await Promise.all(keys.map((key) => this.storage.remove(key)));
    await this.prisma.$transaction([
      this.prisma.faceProfile.deleteMany({ where: { employeeId } }),
      this.prisma.attendance.updateMany({
        where: { employeeId },
        data: { checkInPhotoUrl: null, checkOutPhotoUrl: null },
      }),
      this.prisma.attendanceSession.updateMany({
        where: { attendance: { employeeId } },
        data: { checkInPhotoUrl: null, checkOutPhotoUrl: null },
      }),
      this.prisma.attendanceCorrectionRequest.updateMany({
        where: { employeeId },
        data: { evidencePhotoUrl: null },
      }),
    ]);
    await this.audit.record({
      action: "DELETE",
      entity: "BiometricPrivacyData",
      entityId: employeeId,
      after: {
        embeddingsDeleted: profiles.length,
        auditImagesDeleted: keys.length,
        attendanceFactsRetained: true,
      },
      ctx,
    });
    return {
      success: true,
      embeddingsDeleted: profiles.length,
      auditImagesDeleted: keys.length,
      attendanceFactsRetained: true,
    };
  }
}
