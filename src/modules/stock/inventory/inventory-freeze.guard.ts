import { BadRequestException, Injectable } from '@nestjs/common';
import { InventorySessionStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CrmMessages } from '../../../shared/constants/crm-messages';

const FREEZE_STATUSES: InventorySessionStatus[] = [
  InventorySessionStatus.counting,
  InventorySessionStatus.recount,
  InventorySessionStatus.analyzing,
];

/** RM-INV01 — bloque les mouvements si inventaire gelé sur l’entrepôt. */
@Injectable()
export class InventoryFreezeGuard {
  constructor(private readonly prisma: PrismaService) {}

  async assertNotFrozen(tenantId: string, warehouseId: string) {
    const open = await this.prisma.inventorySession.findFirst({
      where: {
        tenantId,
        warehouseId,
        freezeMovements: true,
        status: { in: FREEZE_STATUSES },
      },
      select: { id: true, number: true },
    });
    if (open) {
      throw new BadRequestException(
        `${CrmMessages.stock.INVENTORY_MOVEMENTS_FROZEN} (Inventaire en cours : ${open.number})`,
      );
    }
  }
}
