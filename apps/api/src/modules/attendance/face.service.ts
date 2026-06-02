import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { EnrollFaceDto } from './dto/face.dto';
import { bufferToEmbedding, embeddingToBuffer, minDistance } from './embedding.util';

@Injectable()
export class FaceService {
  private readonly threshold = Number(process.env.FACE_MATCH_THRESHOLD ?? 0.55);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  /** Decrypt all stored embeddings for one employee into number arrays. */
  async loadEmbeddings(employeeId: string): Promise<number[][]> {
    const profiles = await this.prisma.faceProfile.findMany({ where: { employeeId } });
    return profiles.map((p) => bufferToEmbedding(this.crypto.decrypt(Buffer.from(p.embedding))));
  }

  async enroll(dto: EnrollFaceDto, ctx: AuditContext) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Deduplicate: reject if any embedding closely matches a DIFFERENT employee.
    const others = await this.prisma.faceProfile.findMany({
      where: { employeeId: { not: dto.employeeId } },
      select: { employeeId: true, embedding: true },
    });
    for (const probe of dto.embeddings) {
      for (const o of others) {
        const dist = minDistance(probe, [bufferToEmbedding(this.crypto.decrypt(Buffer.from(o.embedding)))]);
        if (dist < this.threshold) {
          throw new ConflictException('This face is already enrolled to another employee');
        }
      }
    }

    let sampleImageUrl: string | undefined;
    if (dto.sampleImage) {
      sampleImageUrl = await this.storage.putBase64Image(`employees/${dto.employeeId}/face`, dto.sampleImage);
    }

    const created = await this.prisma.$transaction(
      dto.embeddings.map((emb, i) =>
        this.prisma.faceProfile.create({
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

    await this.audit.record({
      action: 'CREATE',
      entity: 'FaceProfile',
      entityId: employee.id,
      after: { employeeId: employee.id, count: created.length },
      ctx,
    });
    return { employeeId: employee.id, enrolled: created.length };
  }

  async status(employeeId: string) {
    const count = await this.prisma.faceProfile.count({ where: { employeeId } });
    return { employeeId, enrolled: count > 0, profiles: count };
  }

  /** Purge all face data for an employee (privacy / data-deletion path). */
  async purge(employeeId: string, ctx: AuditContext) {
    const profiles = await this.prisma.faceProfile.findMany({ where: { employeeId } });
    if (!profiles.length) throw new BadRequestException('No face profiles to delete');

    await Promise.all(profiles.filter((p) => p.sampleImageUrl).map((p) => this.storage.remove(p.sampleImageUrl!)));
    await this.prisma.faceProfile.deleteMany({ where: { employeeId } });
    await this.audit.record({ action: 'DELETE', entity: 'FaceProfile', entityId: employeeId, ctx });
    return { success: true, deleted: profiles.length };
  }
}
