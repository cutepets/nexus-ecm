/**
 * Nexus ECM — Database seed
 * Seeds: permissions, the 5 default roles, a super admin, and core master data.
 * Run: pnpm db:seed
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ---- Permission catalog (module:action) ----
const MODULES = [
  'dashboard',
  'employee',
  'attendance',
  'leave',
  'project',
  'task',
  'finance',
  'inventory',
  'crm',
  'document',
  'chat',
  'notification',
  'audit',
  'report',
  'rbac',
  'user',
];
const ACTIONS = ['create', 'read', 'update', 'delete'];

// Extra fine-grained permissions beyond CRUD
const EXTRA_PERMISSIONS = [
  'leave:approve',
  'attendance:face:enroll',
  'finance:report:read',
  'report:export',
];

function buildPermissionKeys(): { key: string; module: string }[] {
  const keys = new Set<string>();
  for (const m of MODULES) for (const a of ACTIONS) keys.add(`${m}:${a}`);
  for (const k of EXTRA_PERMISSIONS) keys.add(k);
  return [...keys].map((key) => ({ key, module: key.split(':')[0] }));
}

// ---- Role → permission mapping ----
const ROLE_PERMISSIONS: Record<string, (key: string) => boolean> = {
  SUPER_ADMIN: () => true, // all permissions
  HR: (k) =>
    k.startsWith('employee:') ||
    k.startsWith('attendance:') ||
    k.startsWith('leave:') ||
    k.startsWith('document:') ||
    k.startsWith('dashboard:') ||
    k === 'report:export' ||
    k === 'notification:read',
  FINANCE: (k) =>
    k.startsWith('finance:') ||
    k.startsWith('inventory:') ||
    k.startsWith('dashboard:') ||
    k === 'report:export' ||
    k === 'report:read' ||
    k === 'notification:read',
  MANAGER: (k) =>
    k.startsWith('project:') ||
    k.startsWith('task:') ||
    k.startsWith('crm:') ||
    k === 'leave:approve' ||
    k.startsWith('dashboard:') ||
    k.endsWith(':read') ||
    k.startsWith('chat:') ||
    k === 'notification:read',
  EMPLOYEE: (k) =>
    k === 'dashboard:read' ||
    k === 'attendance:create' ||
    k === 'attendance:read' ||
    k === 'leave:create' ||
    k === 'leave:read' ||
    k === 'task:read' ||
    k === 'task:update' ||
    k.startsWith('chat:') ||
    k === 'document:read' ||
    k === 'notification:read',
};

async function main() {
  console.log('🌱 Seeding Nexus ECM...');

  // 1. Permissions
  const permissionDefs = buildPermissionKeys();
  await prisma.permission.createMany({
    data: permissionDefs.map((p) => ({ key: p.key, module: p.module })),
    skipDuplicates: true,
  });
  const permissions = await prisma.permission.findMany();
  console.log(`  ✓ ${permissions.length} permissions`);

  // 2. Roles + role-permission links
  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, isSystem: true, description: `${roleName} role` },
    });

    const allowed = permissions.filter((p) => ROLE_PERMISSIONS[roleName](p.key));
    await prisma.rolePermission.createMany({
      data: allowed.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    console.log(`  ✓ role ${roleName} (${allowed.length} permissions)`);
  }

  // 3. Super admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@nexus.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await argon2.hash(adminPassword),
      fullName: 'Super Admin',
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id },
  });
  console.log(`  ✓ super admin: ${adminEmail} / ${adminPassword}`);

  // 4. Core master data
  await prisma.leaveType.createMany({
    data: [
      { name: 'Cuti Tahunan', defaultQuota: 12, requiresDoc: false },
      { name: 'Izin', defaultQuota: 0, requiresDoc: false },
      { name: 'Sakit', defaultQuota: 0, requiresDoc: true },
    ],
    skipDuplicates: true,
  });
  await prisma.expenseCategory.createMany({
    data: [
      { name: 'OPERATIONAL' },
      { name: 'PURCHASE' },
      { name: 'SALARY' },
      { name: 'REIMBURSEMENT' },
    ],
    skipDuplicates: true,
  });
  await prisma.pipelineStage.createMany({
    data: [
      { name: 'Qualification', orderIndex: 1, probability: 10 },
      { name: 'Proposal', orderIndex: 2, probability: 40 },
      { name: 'Negotiation', orderIndex: 3, probability: 70 },
      { name: 'Won', orderIndex: 4, probability: 100 },
      { name: 'Lost', orderIndex: 5, probability: 0 },
    ],
    skipDuplicates: true,
  });
  await prisma.workSchedule.createMany({
    data: [{ name: 'Default 08:00-17:00', startTime: '08:00', endTime: '17:00', graceMinutes: 15 }],
    skipDuplicates: true,
  });
  console.log('  ✓ master data (leave types, expense categories, pipeline, schedule)');

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
