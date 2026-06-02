import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { NotificationService } from '../../core/notification/notification.service';
import { CreateItemDto, NamedDto, StockMovementDto, UpdateItemDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
  ) {}

  // ---- Master data ----

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }
  createCategory(dto: NamedDto) {
    return this.prisma.category.create({ data: { name: dto.name, parentId: dto.parentId } });
  }

  listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }
  createSupplier(dto: NamedDto) {
    return this.prisma.supplier.create({
      data: { name: dto.name, contactName: dto.contactName, phone: dto.phone, email: dto.email },
    });
  }

  listWarehouses() {
    return this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
  }
  createWarehouse(dto: NamedDto) {
    return this.prisma.warehouse.create({ data: { name: dto.name, location: dto.location } });
  }

  // ---- Items ----

  async listItems(search?: string) {
    const items = await this.prisma.item.findMany({
      where: search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] }
        : undefined,
      include: { category: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    const stocks = await this.stockMap(items.map((i) => i.id));
    return items.map((i) => ({ ...i, currentStock: stocks.get(i.id) ?? 0, lowStock: (stocks.get(i.id) ?? 0) <= i.reorderLevel }));
  }

  async getItem(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        movements: {
          include: { warehouse: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!item) throw new NotFoundException('Item not found');
    return { ...item, currentStock: await this.currentStock(id) };
  }

  async createItem(dto: CreateItemDto, ctx: AuditContext) {
    const sku = dto.sku ?? (await this.nextSku());
    const clash = await this.prisma.item.findUnique({ where: { sku } });
    if (clash) throw new BadRequestException('SKU already exists');

    const item = await this.prisma.item.create({
      data: {
        sku,
        name: dto.name,
        categoryId: dto.categoryId,
        supplierId: dto.supplierId,
        unit: dto.unit ?? 'pcs',
        reorderLevel: dto.reorderLevel ?? 0,
        unitCost: dto.unitCost ? new Prisma.Decimal(dto.unitCost) : undefined,
        barcode: dto.barcode ?? sku,
      },
    });
    await this.audit.record({ action: 'CREATE', entity: 'Item', entityId: item.id, after: item, ctx });
    return item;
  }

  async updateItem(id: string, dto: UpdateItemDto, ctx: AuditContext) {
    const before = await this.prisma.item.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Item not found');
    const item = await this.prisma.item.update({
      where: { id },
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
        supplierId: dto.supplierId,
        unit: dto.unit,
        reorderLevel: dto.reorderLevel,
        unitCost: dto.unitCost ? new Prisma.Decimal(dto.unitCost) : undefined,
        barcode: dto.barcode,
      },
    });
    await this.audit.record({ action: 'UPDATE', entity: 'Item', entityId: id, before, after: item, ctx });
    return item;
  }

  async removeItem(id: string, ctx: AuditContext) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    await this.prisma.item.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'Item', entityId: id, before: item, ctx });
    return { success: true };
  }

  /** PNG data URL QR code encoding the item's barcode/SKU. */
  async qrCode(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    const dataUrl = await QRCode.toDataURL(item.barcode ?? item.sku, { width: 240, margin: 1 });
    return { sku: item.sku, barcode: item.barcode ?? item.sku, dataUrl };
  }

  // ---- Stock movements ----

  async listMovements(itemId?: string) {
    return this.prisma.stockMovement.findMany({
      where: itemId ? { itemId } : undefined,
      include: {
        item: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async addMovement(dto: StockMovementDto, ctx: AuditContext) {
    const item = await this.prisma.item.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new BadRequestException('Item not found');

    const movement = await this.prisma.stockMovement.create({
      data: {
        itemId: dto.itemId,
        warehouseId: dto.warehouseId,
        type: dto.type,
        quantity: dto.quantity,
        reference: dto.reference,
        note: dto.note,
      },
    });
    await this.audit.record({ action: 'CREATE', entity: 'StockMovement', entityId: movement.id, after: movement, ctx });

    // Low-stock alert.
    const stock = await this.currentStock(dto.itemId);
    if (stock <= item.reorderLevel) {
      await this.notify.notifyRole('FINANCE', {
        type: 'LOW_STOCK',
        title: 'Stok rendah',
        body: `${item.name} (${item.sku}) tersisa ${stock} ${item.unit}`,
        data: { itemId: item.id, stock },
      });
    }
    return { ...movement, currentStock: stock };
  }

  async lowStock() {
    const items = await this.prisma.item.findMany();
    const stocks = await this.stockMap(items.map((i) => i.id));
    return items
      .map((i) => ({ ...i, currentStock: stocks.get(i.id) ?? 0 }))
      .filter((i) => i.currentStock <= i.reorderLevel);
  }

  // ---- helpers ----

  /** Net stock for one item: IN − OUT + ADJUST (ADJUST is a signed delta). */
  async currentStock(itemId: string): Promise<number> {
    const grouped = await this.prisma.stockMovement.groupBy({
      by: ['type'],
      where: { itemId },
      _sum: { quantity: true },
    });
    let stock = 0;
    for (const g of grouped) {
      const qty = g._sum.quantity ?? 0;
      if (g.type === 'IN') stock += qty;
      else if (g.type === 'OUT') stock -= qty;
      else stock += qty; // ADJUST
    }
    return stock;
  }

  private async stockMap(itemIds: string[]): Promise<Map<string, number>> {
    if (!itemIds.length) return new Map();
    const grouped = await this.prisma.stockMovement.groupBy({
      by: ['itemId', 'type'],
      where: { itemId: { in: itemIds } },
      _sum: { quantity: true },
    });
    const map = new Map<string, number>();
    for (const g of grouped) {
      const qty = g._sum.quantity ?? 0;
      const cur = map.get(g.itemId) ?? 0;
      map.set(g.itemId, g.type === 'OUT' ? cur - qty : cur + qty);
    }
    return map;
  }

  private async nextSku() {
    const last = await this.prisma.item.findFirst({
      where: { sku: { startsWith: 'SKU-' } },
      orderBy: { sku: 'desc' },
      select: { sku: true },
    });
    const n = last ? Number(last.sku.replace('SKU-', '')) : 0;
    return `SKU-${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, '0')}`;
  }
}
