/**
 * One-off: create a demo EMPLOYEE-role user linked to an Employee record.
 * Run: cd packages/database && DATABASE_URL=... pnpm exec tsx scripts/create-employee-user.ts
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'budi@nexus.local';
  const password = 'Karyawan123!';
  const fullName = 'Budi Hartono';
  const employeeNo = 'EMP-9001';

  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } });

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await argon2.hash(password), fullName, isActive: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  const employee = await prisma.employee.upsert({
    where: { employeeNo },
    update: { userId: user.id },
    create: {
      employeeNo,
      fullName,
      email,
      userId: user.id,
      joinDate: new Date('2026-01-02'),
      workStatus: 'PERMANENT',
    },
  });

  console.log(JSON.stringify({ userId: user.id, employeeId: employee.id, email, password }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
