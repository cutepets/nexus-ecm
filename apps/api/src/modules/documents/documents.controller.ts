import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { AddVersionDto, CreateDocumentDto, CreateFolderDto, ShareDocumentDto } from './dto/document.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { branchIdsForPeriod, CurrentUser, permissionScope, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // ---- Folders ----
  @Get('folders') @RequirePermissions('document:read')
  folders(@Query('parentId') parentId?: string) { return this.documents.listFolders(parentId); }
  @Post('folders') @RequirePermissions('document:create')
  createFolder(@Body() dto: CreateFolderDto, @CurrentUser() user: RequestUser) {
    return this.documents.createFolder(dto, user.id);
  }

  // ---- Documents ----
  @Get() @RequirePermissions('document:read')
  list(@Query('folderId') folderId: string | undefined, @Query('docType') docType: string | undefined, @CurrentUser() user: RequestUser) {
    return this.documents.listDocuments(folderId, docType, this.readScope(user));
  }

  @Post('uploads') @RequirePermissions('document:create')
  @ApiOperation({ summary: 'Presign a document file upload' })
  presign(@Body('fileName') fileName: string) { return this.documents.presignUpload(fileName); }

  @Get(':id') @RequirePermissions('document:read')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.documents.getDocument(id, this.readScope(user)); }

  @Post() @RequirePermissions('document:create')
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: RequestUser) {
    return this.documents.createDocument(dto, user.id, { actorId: user.id });
  }

  @Post(':id/versions') @RequirePermissions('document:update')
  @ApiOperation({ summary: 'Add a new version (version control)' })
  addVersion(@Param('id') id: string, @Body() dto: AddVersionDto, @CurrentUser() user: RequestUser) {
    return this.documents.addVersion(id, dto, user.id, { actorId: user.id });
  }

  // ---- Sharing ----
  @Post(':id/shares') @RequirePermissions('document:update')
  share(@Param('id') id: string, @Body() dto: ShareDocumentDto, @CurrentUser() user: RequestUser) {
    return this.documents.share(id, dto, { actorId: user.id });
  }
  @Delete(':id/shares/:userId') @RequirePermissions('document:update')
  unshare(@Param('id') id: string, @Param('userId') userId: string) {
    return this.documents.unshare(id, userId);
  }

  private readScope(user: RequestUser) {
    const scope = permissionScope(user, 'document:read');
    const from = new Date();
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
    return { scope, userId: user.id, branchIds: branchIdsForPeriod(user, from, to), from, to };
  }
}
