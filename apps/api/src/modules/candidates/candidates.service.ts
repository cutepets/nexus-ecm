import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { AuditContext, AuditService } from '../../core/audit/audit.service';
import { CreateCandidateDto, UpdateCandidateDto } from './dto/candidate.dto';

const CANDIDATE_INCLUDE = {
  desiredBranches: { include: { branch: { select: { id: true, name: true } } } },
  createdBy: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const candidates = await this.prisma.candidate.findMany({
      include: CANDIDATE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return Promise.all(candidates.map((candidate) => this.withPhotoUrl(candidate)));
  }

  async branches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async presignPhoto(fileName: string) {
    const key = this.storage.buildKey('candidate-photos', fileName);
    return this.storage.presignedUpload(key);
  }

  async create(dto: CreateCandidateDto, ctx: AuditContext) {
    if (dto.desiredBranchIds) await this.ensureActiveBranches(dto.desiredBranchIds);
    this.assertCandidatePhotoKey(dto.photoKey);
    const candidate = await this.prisma.candidate.create({
      data: {
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        createdById: ctx.actorId,
        address: this.nullableText(dto.address),
        photoKey: dto.photoKey || null,
        desiredShift: this.nullableText(dto.desiredShift),
        desiredStartDate: dto.desiredStartDate ? new Date(dto.desiredStartDate) : null,
        source: this.nullableText(dto.source),
        notes: this.nullableText(dto.notes),
        desiredBranches: dto.desiredBranchIds?.length
          ? { create: dto.desiredBranchIds.map((branchId) => ({ branchId })) }
          : undefined,
      },
      include: CANDIDATE_INCLUDE,
    });
    await this.audit.record({ action: 'CREATE', entity: 'Candidate', entityId: candidate.id, after: { fields: Object.keys(dto) }, ctx });
    return this.withPhotoUrl(candidate);
  }

  async update(id: string, dto: UpdateCandidateDto, ctx: AuditContext) {
    const before = await this.prisma.candidate.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Candidate not found');
    if (dto.desiredBranchIds !== undefined) await this.ensureActiveBranches(dto.desiredBranchIds);
    this.assertCandidatePhotoKey(dto.photoKey);

    const candidate = await this.prisma.candidate.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        phone: dto.phone?.trim(),
        address: dto.address !== undefined ? this.nullableText(dto.address) : undefined,
        photoKey: dto.photoKey !== undefined ? dto.photoKey || null : undefined,
        desiredShift: dto.desiredShift !== undefined ? this.nullableText(dto.desiredShift) : undefined,
        desiredStartDate: dto.desiredStartDate !== undefined
          ? dto.desiredStartDate ? new Date(dto.desiredStartDate) : null
          : undefined,
        status: dto.status,
        source: dto.source !== undefined ? this.nullableText(dto.source) : undefined,
        notes: dto.notes !== undefined ? this.nullableText(dto.notes) : undefined,
        desiredBranches: dto.desiredBranchIds !== undefined
          ? { deleteMany: {}, create: dto.desiredBranchIds.map((branchId) => ({ branchId })) }
          : undefined,
      },
      include: CANDIDATE_INCLUDE,
    });
    if (before.photoKey && before.photoKey !== candidate.photoKey) await this.storage.remove(before.photoKey);
    await this.audit.record({ action: 'UPDATE', entity: 'Candidate', entityId: id, after: { fields: Object.keys(dto) }, ctx });
    return this.withPhotoUrl(candidate);
  }

  async remove(id: string, ctx: AuditContext) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id }, select: { id: true, photoKey: true } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    await this.prisma.candidate.delete({ where: { id } });
    if (candidate.photoKey) await this.storage.remove(candidate.photoKey);
    await this.audit.record({ action: 'DELETE', entity: 'Candidate', entityId: id, ctx });
    return { success: true };
  }

  private async withPhotoUrl<T extends { photoKey: string | null }>(candidate: T) {
    return {
      ...candidate,
      ...('desiredBranches' in candidate && Array.isArray(candidate.desiredBranches)
        ? { desiredBranches: candidate.desiredBranches.map((preference) => preference.branch) }
        : {}),
      photoUrl: candidate.photoKey ? await this.storage.presignedDownload(candidate.photoKey) : null,
    };
  }

  private nullableText(value?: string) {
    return value?.trim() || null;
  }

  private assertCandidatePhotoKey(key?: string) {
    if (key && !key.startsWith('candidate-photos/')) {
      throw new BadRequestException('Invalid candidate photo key');
    }
  }

  private async ensureActiveBranches(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return;
    const count = await this.prisma.branch.count({ where: { id: { in: uniqueIds }, isActive: true } });
    if (count !== uniqueIds.length) throw new BadRequestException('One or more selected branches are unavailable');
  }
}
