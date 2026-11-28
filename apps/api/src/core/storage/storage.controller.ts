import { BadRequestException, Controller, Get, Header, Put, Query, Req, StreamableFile } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from './storage.service';

@ApiTags('storage')
@Public()
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Put('upload')
  @ApiOperation({ summary: 'Receive a short-lived signed object upload' })
  async upload(
    @Query('key') key: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Req() request: Request,
  ) {
    this.storage.verifySignedRequest('PUT', key, expires, signature);
    const contentLength = request.headers['content-length'];
    const size = contentLength === undefined ? undefined : Number(contentLength);
    if (size !== undefined && (!Number.isSafeInteger(size) || size < 0)) {
      throw new BadRequestException('Invalid upload content length');
    }
    const contentType = request.headers['content-type'] ?? 'application/octet-stream';
    await this.storage.putObjectStream(key, request, size, contentType);
  }

  @Get('download')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Serve an object through a short-lived signed URL' })
  async download(
    @Query('key') key: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
  ) {
    this.storage.verifySignedRequest('GET', key, expires, signature);
    const object = await this.storage.getObjectForDownload(key);
    return new StreamableFile(object.stream, {
      type: object.contentType,
      disposition: 'inline',
      length: object.size,
    });
  }
}
