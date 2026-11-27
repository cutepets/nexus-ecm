import { Injectable } from '@nestjs/common';
import { Prisma } from '@nexus/database';

export interface EmployeeRoleFacts {
  userId: string;
  departmentId: string | null;
  positionId: string | null;
}

@Injectable()
export class RoleAssignmentService {
  async syncEmployee(tx: Prisma.TransactionClient, employee: EmployeeRoleFacts) {
    const rules = await tx.roleAssignmentRule.findMany({ where: { isActive: true } });
    const matchedRoleIds = [...new Set(rules.filter((rule) =>
      (!rule.departmentId || rule.departmentId === employee.departmentId) &&
      (!rule.positionId || rule.positionId === employee.positionId),
    ).map((rule) => rule.roleId))];

    await tx.userRole.deleteMany({
      where: {
        userId: employee.userId,
        isAutomatic: true,
        ...(matchedRoleIds.length ? { roleId: { notIn: matchedRoleIds } } : {}),
      },
    });
    if (matchedRoleIds.length) {
      await tx.userRole.createMany({
        data: matchedRoleIds.map((roleId) => ({ userId: employee.userId, roleId, isAutomatic: true })),
        skipDuplicates: true,
      });
    }
  }

  async syncAll(tx: Prisma.TransactionClient) {
    const employees = await tx.employee.findMany({
      where: { deletedAt: null },
      select: {
        userId: true,
        departmentId: true,
        positionId: true,
      },
    });
    for (const employee of employees) {
      await this.syncEmployee(tx, {
        userId: employee.userId,
        departmentId: employee.departmentId,
        positionId: employee.positionId,
      });
    }
  }
}
