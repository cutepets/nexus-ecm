import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { NotificationService } from '../../core/notification/notification.service';
import { AddVersionDto, CreateDocumentDto, CreateFolderDto, ShareDocumentDto } from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
  ) {}

  // ---- Folders ----
  listFolders(parentId?: string) {
    return this.prisma.folder.findMany({
      where: { parentId: parentId ?? null },
      include: { _count: { select: { children: true, documents: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createFolder(dto: CreateFolderDto, ownerId: string) {
    return this.prisma.folder.create({ data: { name: dto.name, parentId: dto.parentId, ownerId } });
  }

  // ---- Documents ----
  listDocuments(folderId?: string, docType?: string) {
    return this.prisma.document.findMany({
      where: {
        ...(folderId ? { folderId } : {}),
        ...(docType ? { docType: docType as Prisma.DocumentWhereInput['docType'] } : {}),
      },
      include: {
        folder: { select: { id: true, name: true } },
        versions: { orderBy: { version: 'desc' }, take: 1 },
        _count: { select: { versions: true, shares: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getDocument(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        folder: { select: { id: true, name: true } },
        versions: {
          orderBy: { version: 'desc' },
          include: { uploadedBy: { select: { id: true, fullName: true } } },
        },
        shares: { include: { sharedWith: { select: { id: true, fullName: true, email: true } } } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    // Sign the current version for download.
    const versions = await Promise.all(
      doc.versions.map(async (v) => ({ ...v, downloadUrl: await this.storage.presignedDownload(v.fileUrl) })),
    );
    return { ...doc, versions };
  }

  async createDocument(dto: CreateDocumentDto, ownerId: string, ctx: AuditContext) {
    const doc = await this.prisma.document.create({
      data: {
        title: dto.title,
        folderId: dto.folderId,
        docType: (dto.docType as Prisma.DocumentCreateInput['docType']) ?? 'OTHER',
        ownerId,
      },
    });
    await this.audit.record({ action: 'CREATE', entity: 'Document', entityId: doc.id, after: doc, ctx });
    return doc;
  }

  presignUpload(fileName: string) {
    return this.storage.presignedUpload(this.storage.buildKey('documents', fileName));
  }

  /** Append a new version, bumping the version number and pointer. */
  async addVersion(documentId: string, dto: AddVersionDto, uploadedById: string, ctx: AuditContext) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    const nextVersion = (doc.versions[0]?.version ?? 0) + 1;

    const version = await this.prisma.documentVersion.create({
      data: {
        documentId,
        version: nextVersion,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        sizeBytes: dto.sizeBytes ?? 0,
        uploadedById,
      },
    });
    await this.prisma.document.update({ where: { id: documentId }, data: { currentVersionId: version.id } });
    await this.audit.record({ action: 'UPDATE', entity: 'Document', entityId: documentId, after: { version: nextVersion }, ctx });
    return { ...version, downloadUrl: await this.storage.presignedDownload(version.fileUrl) };
  }

  // ---- Sharing ----
  async share(documentId: string, dto: ShareDocumentDto, ctx: AuditContext) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId }, select: { id: true, title: true } });
    if (!doc) throw new NotFoundException('Document not found');

    const share = await this.prisma.documentShare.upsert({
      where: { documentId_sharedWithUserId: { documentId, sharedWithUserId: dto.userId } },
      update: { access: dto.access ?? 'VIEW' },
      create: { documentId, sharedWithUserId: dto.userId, access: dto.access ?? 'VIEW' },
    });
    await this.notify.notifyUser(dto.userId, {
      type: 'DOCUMENT_SHARED',
      title: 'Dokumen dibagikan kepada Anda',
      body: doc.title,
      data: { documentId },
    });
    await this.audit.record({ action: 'UPDATE', entity: 'Document', entityId: documentId, after: { sharedWith: dto.userId }, ctx });
    return share;
  }

  async unshare(documentId: string, userId: string) {
    await this.prisma.documentShare.delete({
      where: { documentId_sharedWithUserId: { documentId, sharedWithUserId: userId } },
    });
    return { success: true };
  }
}
