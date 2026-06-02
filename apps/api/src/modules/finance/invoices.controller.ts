import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { AddPaymentDto, CreateInvoiceDto, InvoiceQueryDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('finance/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermissions('finance:read')
  @ApiOperation({ summary: 'List invoices (OVERDUE derived on read)' })
  list(@Query() query: InvoiceQueryDto) {
    return this.invoices.list(query);
  }

  @Get(':id')
  @RequirePermissions('finance:read')
  getOne(@Param('id') id: string) {
    return this.invoices.getById(id);
  }

  @Post()
  @RequirePermissions('finance:create')
  @ApiOperation({ summary: 'Create an invoice with line items' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: RequestUser) {
    return this.invoices.create(dto, { actorId: user.id });
  }

  @Put(':id/status')
  @RequirePermissions('finance:update')
  setStatus(@Param('id') id: string, @Body() dto: UpdateInvoiceStatusDto, @CurrentUser() user: RequestUser) {
    return this.invoices.setStatus(id, dto, { actorId: user.id });
  }

  @Post(':id/payments')
  @RequirePermissions('finance:update')
  @ApiOperation({ summary: 'Record a payment (auto PARTIAL/PAID)' })
  addPayment(@Param('id') id: string, @Body() dto: AddPaymentDto, @CurrentUser() user: RequestUser) {
    return this.invoices.addPayment(id, dto, { actorId: user.id });
  }
}
