import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CandidatesService } from './candidates.service';
import { CreateCandidateDto, PresignCandidatePhotoDto, UpdateCandidateDto } from './dto/candidate.dto';

@ApiTags('candidates')
@ApiBearerAuth()
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get()
  @RequirePermissions('candidate:read')
  @ApiOperation({ summary: 'List recruitment candidates' })
  list() {
    return this.candidates.list();
  }

  @Get('options/branches')
  @RequirePermissions('candidate:read')
  @ApiOperation({ summary: 'List active branches for candidate preferences' })
  branches() {
    return this.candidates.branches();
  }

  @Post('uploads')
  @RequirePermissions('candidate:create')
  @ApiOperation({ summary: 'Get a presigned upload URL for a candidate photo' })
  upload(@Body() dto: PresignCandidatePhotoDto) {
    return this.candidates.presignPhoto(dto.fileName);
  }

  @Post()
  @RequirePermissions('candidate:create')
  @ApiOperation({ summary: 'Create a candidate record' })
  create(@Body() dto: CreateCandidateDto, @CurrentUser() user: RequestUser) {
    return this.candidates.create(dto, { actorId: user.id });
  }

  @Patch(':id')
  @RequirePermissions('candidate:update')
  @ApiOperation({ summary: 'Update a candidate record' })
  update(@Param('id') id: string, @Body() dto: UpdateCandidateDto, @CurrentUser() user: RequestUser) {
    return this.candidates.update(id, dto, { actorId: user.id });
  }

  @Delete(':id')
  @RequirePermissions('candidate:delete')
  @ApiOperation({ summary: 'Delete a candidate record' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.candidates.remove(id, { actorId: user.id });
  }
}
