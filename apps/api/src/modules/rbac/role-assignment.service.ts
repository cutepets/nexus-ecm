import { Injectable } from '@nestjs/common';
import { Prisma } from '@nexus/database';

export interface EmployeeRoleFacts {
  userId: string;
  departmentId: string | null;
  positionId: string | null;
  branchIds: string[];
}

@Injectable()
export class RoleAssignmentService {
  async syncEmployee(tx: Prisma.TransactionClient, employee: EmployeeRoleFacts) {
    const rules = await tx.roleAssignmentRule.findMany({ where: { isActive: true } });
    const matchedRoleIds = [...new Set(rules.filter((rule) =>
      (!rule.departmentId || rule.departmentId === employee.departmentId) &&
      (!rule.positionId || rule.positionId === employee.positionId) &&
      (!rule.branchId || employee.branchIds.includes(rule.branchId)),
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
        primaryBranchId: true,
        branchAssignments: { where: { effectiveTo: null }, select: { branchId: true } },
      },
    });
    for (const employee of employees) {
      await this.syncEmployee(tx, {
        userId: employee.userId,
        departmentId: employee.departmentId,
        positionId: employee.positionId,
        branchIds: [...new Set([employee.primaryBranchId, ...employee.branchAssignments.map((item) => item.branchId)].filter((id): id is string => Boolean(id)))],
      });
    }
  }
}
