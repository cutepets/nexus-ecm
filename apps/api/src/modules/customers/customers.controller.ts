import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CustomersService } from './customers.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

class UpsertCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, enum: ['PROSPECT', 'ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsEnum(['PROSPECT', 'ACTIVE', 'INACTIVE'])
  type?: string;
}

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('crm:read')
  @ApiOperation({ summary: 'List customers' })
  list(@Query('search') search?: string) {
    return this.customers.list(search);
  }

  @Get(':id')
  @RequirePermissions('crm:read')
  getOne(@Param('id') id: string) {
    return this.customers.getById(id);
  }

  @Post()
  @RequirePermissions('crm:create')
  create(@Body() dto: UpsertCustomerDto, @CurrentUser() user: RequestUser) {
    return this.customers.create(dto, { actorId: user.id });
  }

  @Put(':id')
  @RequirePermissions('crm:update')
  update(@Param('id') id: string, @Body() dto: UpsertCustomerDto, @CurrentUser() user: RequestUser) {
    return this.customers.update(id, dto, { actorId: user.id });
  }

  @Delete(':id')
  @RequirePermissions('crm:delete')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.customers.remove(id, { actorId: user.id });
  }
}
