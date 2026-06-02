import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateItemDto, NamedDto, StockMovementDto, UpdateItemDto } from './dto/inventory.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // ---- Master data ----
  @Get('categories') @RequirePermissions('inventory:read') categories() { return this.inventory.listCategories(); }
  @Post('categories') @RequirePermissions('inventory:create') createCategory(@Body() dto: NamedDto) { return this.inventory.createCategory(dto); }

  @Get('suppliers') @RequirePermissions('inventory:read') suppliers() { return this.inventory.listSuppliers(); }
  @Post('suppliers') @RequirePermissions('inventory:create') createSupplier(@Body() dto: NamedDto) { return this.inventory.createSupplier(dto); }

  @Get('warehouses') @RequirePermissions('inventory:read') warehouses() { return this.inventory.listWarehouses(); }
  @Post('warehouses') @RequirePermissions('inventory:create') createWarehouse(@Body() dto: NamedDto) { return this.inventory.createWarehouse(dto); }

  // ---- Items ----
  @Get('items')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'List items with derived current stock + low-stock flag' })
  items(@Query('search') search?: string) {
    return this.inventory.listItems(search);
  }

  @Get('items/low-stock')
  @RequirePermissions('inventory:read')
  lowStock() {
    return this.inventory.lowStock();
  }

  @Get('items/:id') @RequirePermissions('inventory:read') item(@Param('id') id: string) { return this.inventory.getItem(id); }

  @Get('items/:id/qr')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'QR code (PNG data URL) for an item' })
  qr(@Param('id') id: string) {
    return this.inventory.qrCode(id);
  }

  @Post('items') @RequirePermissions('inventory:create')
  createItem(@Body() dto: CreateItemDto, @CurrentUser() user: RequestUser) {
    return this.inventory.createItem(dto, { actorId: user.id });
  }

  @Put('items/:id') @RequirePermissions('inventory:update')
  updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto, @CurrentUser() user: RequestUser) {
    return this.inventory.updateItem(id, dto, { actorId: user.id });
  }

  @Delete('items/:id') @RequirePermissions('inventory:delete')
  removeItem(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventory.removeItem(id, { actorId: user.id });
  }

  // ---- Stock movements ----
  @Get('movements') @RequirePermissions('inventory:read')
  movements(@Query('itemId') itemId?: string) {
    return this.inventory.listMovements(itemId);
  }

  @Post('movements') @RequirePermissions('inventory:update')
  @ApiOperation({ summary: 'Record a stock movement (IN/OUT/ADJUST); triggers low-stock alert' })
  addMovement(@Body() dto: StockMovementDto, @CurrentUser() user: RequestUser) {
    return this.inventory.addMovement(dto, { actorId: user.id });
  }
}
