/**
 * Nexus ECM — Database seed
 * Seeds: permissions, the default roles, an ADMIN store owner, and core master data.
 * Run: pnpm db:seed
 */
import { Prisma, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

// ---- Permission catalog (module:action) ----
const MODULE_PERMISSIONS: Record<string, string[]> = {
  dashboard: ["read"],
  employee: ["create", "read", "update", "delete"],
  candidate: ["create", "read", "update", "delete"],
  attendance: ["create", "read", "update", "delete", "face:enroll", "review", "correction:approve"],
  "attendance-policy": ["create", "read", "update", "delete"],
  "attendance-correction": ["create", "read", "update", "delete"],
  leave: ["create", "read", "approve"],
  project: ["create", "read", "update", "delete"],
  task: ["create", "read", "update", "delete"],
  document: ["create", "read", "update", "delete"],
  chat: ["create", "read"],
  notification: ["read"],
  audit: ["read"],
  report: ["export"],
  rbac: ["create", "read", "update", "delete"],
  user: ["read", "update", "delete", "reset-password", "manage-roles"],
  settings: ["read", "update"],
  branch: ["create", "read", "update", "delete"],
  payroll: ["read", "update"],
  integration: ["create", "read", "update", "delete"],
};

function buildPermissionKeys(): { key: string; module: string }[] {
  const keys = Object.entries(MODULE_PERMISSIONS).flatMap(([module, actions]) =>
    actions.map((action) => `${module}:${action}`),
  );
  return [...keys].map((key) => ({ key, module: key.split(":")[0] }));
}

// ---- Role → permission mapping ----
const ROLE_PERMISSIONS: Record<string, (key: string) => boolean> = {
  ADMIN: () => true, // all permissions
  HR: (k) =>
    k.startsWith("employee:") ||
    k.startsWith("candidate:") ||
    k.startsWith("attendance:") ||
    k.startsWith("attendance-policy:") ||
    k.startsWith("branch:") ||
    k.startsWith("attendance-correction:") ||
    k.startsWith("payroll:") ||
    k.startsWith("leave:") ||
    k.startsWith("document:") ||
    k.startsWith("dashboard:") ||
    k === "report:export" ||
    k === "user:reset-password" ||
    k === "notification:read",
  MANAGER: (k) =>
    k.startsWith("project:") ||
    k.startsWith("task:") ||
    k === "leave:approve" ||
    k === "attendance:review" ||
    k === "attendance:face:enroll" ||
    k === "user:reset-password" ||
    k.startsWith("dashboard:") ||
    k.endsWith(":read") ||
    k.startsWith("chat:") ||
    k === "notification:read",
  EMPLOYEE: (k) =>
    k === "dashboard:read" ||
    k === "attendance:create" ||
    k === "attendance:read" ||
    k === "leave:create" ||
    k === "leave:read" ||
    k === "task:read" ||
    k === "task:update" ||
    k.startsWith("chat:") ||
    k === "document:read" ||
    k === "notification:read",
};

async function main() {
  console.log("🌱 Seeding Nexus ECM...");

  // 1. Permissions
  const permissionDefs = buildPermissionKeys();
  await prisma.permission.createMany({
    data: permissionDefs.map((p) => ({ key: p.key, module: p.module })),
    skipDuplicates: true,
  });
  // Keep the persisted catalog aligned with the current module/action map.
  // Deleting obsolete permissions also removes their role links by cascade.
  await prisma.permission.deleteMany({
    where: { key: { notIn: permissionDefs.map((permission) => permission.key) } },
  });
  const permissions = await prisma.permission.findMany();
  console.log(`  ✓ ${permissions.length} permissions`);

  await prisma.companySetting.upsert({
    where: { id: "default" },
      update: {},
    create: { id: "default" },
  });
  console.log("  ✓ company settings");

  // 2. Roles + role-permission links
  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        isSystem: true,
        description: `${roleName} role`,
      },
    });

    const allowed = permissions.filter((p) =>
      ROLE_PERMISSIONS[roleName](p.key),
    );
    await prisma.rolePermission.createMany({
      data: allowed.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    console.log(`  ✓ role ${roleName} (${allowed.length} permissions)`);
  }

  // 3. Store owner account (also visible in the employee directory)
  let adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@nexus.local";
  const adminUsername = (process.env.SEED_ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const accountWithAdminUsername = await prisma.user.findUnique({
    where: { username: adminUsername },
    select: { email: true },
  });
  // An existing installation may have created the store owner with a custom
  // email. Preserve that identity rather than failing on the unique username.
  if (accountWithAdminUsername) adminEmail = accountWithAdminUsername.email;
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "ADMIN" },
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { fullName: "Chủ cửa hàng" },
    create: {
      username: adminUsername,
      email: adminEmail,
      passwordHash: await argon2.hash(adminPassword),
      fullName: "Chủ cửa hàng",
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
  await prisma.employee.upsert({
    where: { userId: admin.id },
    update: { fullName: "Chủ cửa hàng", email: adminEmail, workStatus: "PERMANENT" },
    create: {
      userId: admin.id,
      employeeNo: process.env.SEED_ADMIN_EMPLOYEE_NO ?? "ADMIN-001",
      fullName: "Chủ cửa hàng",
      email: adminEmail,
      joinDate: new Date(),
      workStatus: "PERMANENT",
    },
  });
  console.log(`  ✓ store admin employee: ${adminEmail} / ${adminPassword}`);

  // 4. Core master data
  await prisma.leaveType.createMany({
    data: [
      { name: "Cuti Tahunan", defaultQuota: 12, requiresDoc: false },
      { name: "Izin", defaultQuota: 0, requiresDoc: false },
      { name: "Sakit", defaultQuota: 0, requiresDoc: true },
    ],
    skipDuplicates: true,
  });
  await prisma.workSchedule.createMany({
    data: [
      {
        name: "Hành chính 08:00–17:00",
        startTime: "08:00",
        endTime: "17:00",
      },
    ],
    skipDuplicates: true,
  });

  // Safe, synthetic records are opt-in. They never include face profiles,
  // photos, real contact details, or a user account that can sign in.
  if (process.env.SEED_DEMO_DATA === "true") {
    const demoHanoiBranch = await prisma.branch.upsert({
      where: { code: "HN-DEMO" },
      update: {},
      create: {
        code: "HN-DEMO",
        name: "Chi nhánh Hà Nội (mẫu)",
        address: "Dữ liệu thử nghiệm",
        latitude: 21.0285,
        longitude: 105.8542,
        radiusMeters: 100,
      },
    });
    const demoHcmBranch = await prisma.branch.upsert({
      where: { code: "HCM-DEMO" },
      update: {},
      create: {
        code: "HCM-DEMO",
        name: "Chi nhánh TP.HCM (mẫu)",
        address: "Dữ liệu thử nghiệm",
        latitude: 10.7769,
        longitude: 106.7009,
        radiusMeters: 150,
      },
    });
    const demoEmployeeUser = await prisma.user.upsert({
      where: { email: "demo.employee@nexus.local" },
      update: { isActive: false },
      create: {
        username: "demo.employee",
        email: "demo.employee@nexus.local",
        passwordHash: await argon2.hash(`demo-disabled-${Date.now()}`),
        fullName: "Nhân viên demo 01",
        isActive: false,
      },
    });
    const demoEmployee = await prisma.employee.upsert({
      where: { employeeNo: "DEMO-001" },
      update: { userId: demoEmployeeUser.id, primaryBranchId: demoHanoiBranch.id },
      create: {
        userId: demoEmployeeUser.id,
        employeeNo: "DEMO-001",
        primaryBranchId: demoHanoiBranch.id,
        fullName: "Nhân viên thử nghiệm 01",
        joinDate: new Date("2026-01-01T00:00:00.000Z"),
        workStatus: "PERMANENT",
      },
    });
    const effectiveFrom = new Date("2026-01-01T00:00:00.000Z");
    await prisma.employeeBranchAssignment.upsert({
      where: {
        employeeId_branchId_effectiveFrom: {
          employeeId: demoEmployee.id,
          branchId: demoHanoiBranch.id,
          effectiveFrom,
        },
      },
      update: {},
      create: {
        employeeId: demoEmployee.id,
        branchId: demoHanoiBranch.id,
        effectiveFrom,
      },
    });
    const demoLocation = await prisma.branchLocation.upsert({
      where: { code: "HN-DEMO-MAIN" },
      update: { branchId: demoHanoiBranch.id, isActive: true },
      create: {
        branchId: demoHanoiBranch.id,
        code: "HN-DEMO-MAIN",
        name: "Điểm chấm công mẫu",
        address: "Dữ liệu thử nghiệm",
        latitude: 21.0285,
        longitude: 105.8542,
        radiusMeters: 100,
      },
    });
    const demoSchedule = await prisma.workSchedule.upsert({
      where: { name: "DEMO — Ca hành chính 08:00–17:00" },
      update: { startTime: "08:00", endTime: "17:00" },
      create: {
        name: "DEMO — Ca hành chính 08:00–17:00",
        startTime: "08:00",
        endTime: "17:00",
      },
    });
    await prisma.employeeWorkScheduleAssignment.upsert({
      where: {
        employeeId_workScheduleId_effectiveFrom: {
          employeeId: demoEmployee.id,
          workScheduleId: demoSchedule.id,
          effectiveFrom,
        },
      },
      update: {
        weekdays: [1, 2, 3, 4, 5],
        note: "Dữ liệu demo: ca ngày, không hỗ trợ qua đêm",
      },
      create: {
        employeeId: demoEmployee.id,
        workScheduleId: demoSchedule.id,
        effectiveFrom,
        weekdays: [1, 2, 3, 4, 5],
        note: "Dữ liệu demo: ca ngày, không hỗ trợ qua đêm",
      },
    });

    const demoSplitSchedule = await prisma.workSchedule.upsert({
      where: { name: "DEMO - Ca gay Sang Toi" },
      update: { startTime: "08:00", endTime: "13:00", secondStartTime: "17:00", secondEndTime: "22:00" },
      create: { name: "DEMO - Ca gay Sang Toi", startTime: "08:00", endTime: "13:00", secondStartTime: "17:00", secondEndTime: "22:00", displayOrder: 1 },
    });
    const demoSupportUser = await prisma.user.upsert({
      where: { email: "demo.support@nexus.local" },
      update: { isActive: false },
      create: { username: "demo.support", email: "demo.support@nexus.local", passwordHash: await argon2.hash(`demo-disabled-${Date.now()}`), fullName: "Nhân viên hỗ trợ demo", isActive: false },
    });
    const demoSupportEmployee = await prisma.employee.upsert({
      where: { employeeNo: "DEMO-002" },
      update: { userId: demoSupportUser.id, primaryBranchId: demoHcmBranch.id },
      create: { userId: demoSupportUser.id, employeeNo: "DEMO-002", fullName: "Nhân viên hỗ trợ demo", primaryBranchId: demoHcmBranch.id, joinDate: new Date("2026-01-01T00:00:00.000Z"), workStatus: "PERMANENT" },
    });
    await prisma.employeeBranchAssignment.upsert({
      where: { employeeId_branchId_effectiveFrom: { employeeId: demoSupportEmployee.id, branchId: demoHcmBranch.id, effectiveFrom } },
      update: {},
      create: { employeeId: demoSupportEmployee.id, branchId: demoHcmBranch.id, effectiveFrom },
    });
    const rosterMonth = await prisma.workRosterMonth.upsert({
      where: { monthStart: new Date("2026-12-01T00:00:00.000Z") },
      update: {},
      create: { monthStart: new Date("2026-12-01T00:00:00.000Z") },
    });
    const seedRosterDay = async (employeeId: string, date: string, schedule: { id: string; name: string; startTime: string; endTime: string; secondStartTime: string | null; secondEndTime: string | null }, branchIds: string[]) => {
      const segments = [
        { sequence: 1, startTime: schedule.startTime, endTime: schedule.endTime, branchId: branchIds[0] },
        ...(schedule.secondStartTime && schedule.secondEndTime ? [{ sequence: 2, startTime: schedule.secondStartTime, endTime: schedule.secondEndTime, branchId: branchIds[1] ?? branchIds[0] }] : []),
      ];
      return prisma.employeeDailySchedule.upsert({
        where: { employeeId_workDate: { employeeId, workDate: new Date(`${date}T00:00:00.000Z`) } },
        update: { rosterMonthId: rosterMonth.id, workScheduleId: schedule.id, scheduleName: schedule.name, source: "MANAGER_EDITED", segments: { deleteMany: {}, create: segments } },
        create: { rosterMonthId: rosterMonth.id, employeeId, workDate: new Date(`${date}T00:00:00.000Z`), workScheduleId: schedule.id, scheduleName: schedule.name, source: "MANAGER_EDITED", segments: { create: segments } },
      });
    };
    await seedRosterDay(demoEmployee.id, "2026-12-02", demoSplitSchedule, [demoHanoiBranch.id, demoHcmBranch.id]);
    await seedRosterDay(demoSupportEmployee.id, "2026-12-02", demoSchedule, [demoHcmBranch.id]);
    await seedRosterDay(demoEmployee.id, "2026-12-03", demoSchedule, [demoHanoiBranch.id]);
    console.log("  ✓ demo roster (December 2026: split shift across Hanoi + HCMC, support employee, published month)");

    const workday = (value: string) => new Date(`${value}T00:00:00.000Z`);
    const at = (value: string) => new Date(`${value}:00.000Z`);
    const demoDays = [
      {
        date: "2026-11-17",
        inAt: "2026-11-17T01:05",
        outAt: "2026-11-17T10:20",
        status: "PRESENT" as const,
      },
      {
        date: "2026-11-18",
        inAt: "2026-11-18T01:30",
        outAt: "2026-11-18T10:05",
        status: "LATE" as const,
      },
      {
        date: "2026-11-19",
        inAt: "2026-11-19T01:00",
        outAt: null,
        status: "PRESENT" as const,
      },
      {
        date: "2026-11-20",
        inAt: "2026-11-20T01:05",
        outAt: "2026-11-20T10:45",
        status: "PRESENT" as const,
      },
    ];
    const attendanceIds = new Map<string, string>();
    for (const day of demoDays) {
      const attendance = await prisma.attendance.upsert({
        where: {
          employeeId_workDate: {
            employeeId: demoEmployee.id,
            workDate: workday(day.date),
          },
        },
        update: {
          checkInAt: at(day.inAt),
          checkOutAt: day.outAt ? at(day.outAt) : null,
          checkInLocationId: demoLocation.id,
          checkOutLocationId: day.outAt ? demoLocation.id : null,
          status: day.status,
          approvalStatus: "APPROVED",
          geofenceReason: "DEMO_DATA",
        },
        create: {
          employeeId: demoEmployee.id,
          workDate: workday(day.date),
          checkInAt: at(day.inAt),
          checkOutAt: day.outAt ? at(day.outAt) : null,
          checkInLocationId: demoLocation.id,
          checkOutLocationId: day.outAt ? demoLocation.id : null,
          status: day.status,
          approvalStatus: "APPROVED",
          geofenceReason: "DEMO_DATA",
        },
      });
      attendanceIds.set(day.date, attendance.id);
      await prisma.attendanceSession.upsert({
        where: {
          attendanceId_sequence: { attendanceId: attendance.id, sequence: 1 },
        },
        update: {
          checkInAt: at(day.inAt),
          checkOutAt: day.outAt ? at(day.outAt) : null,
          checkInLocationId: demoLocation.id,
          checkOutLocationId: day.outAt ? demoLocation.id : null,
        },
        create: {
          attendanceId: attendance.id,
          sequence: 1,
          checkInAt: at(day.inAt),
          checkOutAt: day.outAt ? at(day.outAt) : null,
          checkInLocationId: demoLocation.id,
          checkOutLocationId: day.outAt ? demoLocation.id : null,
        },
      });
    }
    const overtimeAttendanceId = attendanceIds.get("2026-11-20")!;
    await prisma.attendanceOvertimeRequest.upsert({
      where: { attendanceId: overtimeAttendanceId },
      update: {
        requestedMinutes: 45,
        reason: "DEMO: bàn giao cuối ca",
        status: "APPROVED",
      },
      create: {
        attendanceId: overtimeAttendanceId,
        employeeId: demoEmployee.id,
        requestedMinutes: 45,
        reason: "DEMO: bàn giao cuối ca",
        status: "APPROVED",
      },
    });
    const missingDate = workday("2026-11-19");
    const correction = await prisma.attendanceCorrectionRequest.findFirst({
      where: {
        employeeId: demoEmployee.id,
        workDate: missingDate,
        status: "PENDING",
      },
    });
    if (!correction)
      await prisma.attendanceCorrectionRequest.create({
        data: {
          employeeId: demoEmployee.id,
          attendanceId: attendanceIds.get("2026-11-19"),
          workDate: missingDate,
          proposedCheckOut: at("2026-11-19T10:00"),
          reason: "DEMO: quên chấm ra cuối ca",
        },
      });

    const periodStart = workday("2026-10-26");
    const periodEnd = workday("2026-11-25");
    const demoPeriod = await prisma.timesheetPeriod.upsert({
      where: {
        startDate_endDate: { startDate: periodStart, endDate: periodEnd },
      },
      update: { status: "DRAFT" },
      create: { startDate: periodStart, endDate: periodEnd, status: "DRAFT" },
    });
    const entries = [
      {
        date: "2026-11-17",
        worked: 555,
        rounded: 555,
        late: 0,
        early: 0,
        missing: false,
        overtime: 20,
        approvedOvertime: 0,
      },
      {
        date: "2026-11-18",
        worked: 515,
        rounded: 510,
        late: 15,
        early: 40,
        missing: false,
        overtime: 0,
        approvedOvertime: 0,
      },
      {
        date: "2026-11-19",
        worked: 0,
        rounded: 0,
        late: 0,
        early: 0,
        missing: true,
        overtime: 0,
        approvedOvertime: 0,
      },
      {
        date: "2026-11-20",
        worked: 580,
        rounded: 585,
        late: 0,
        early: 0,
        missing: false,
        overtime: 45,
        approvedOvertime: 45,
      },
    ];
    for (const entry of entries)
      await prisma.timesheetEntry.upsert({
        where: {
          periodId_employeeId_workDate: {
            periodId: demoPeriod.id,
            employeeId: demoEmployee.id,
            workDate: workday(entry.date),
          },
        },
        update: {
          attendanceId: attendanceIds.get(entry.date),
          scheduledMinutes: 540,
          workedMinutes: entry.worked,
          roundedWorkMinutes: entry.rounded,
          workUnits: new Prisma.Decimal(entry.rounded)
            .div(540)
            .toDecimalPlaces(4),
          lateMinutes: entry.late,
          earlyLeaveMinutes: entry.early,
          latePenalty: new Prisma.Decimal(entry.late).mul(1000),
          missingPunch: entry.missing,
          missingPunchPenalty: entry.missing
            ? new Prisma.Decimal(50000)
            : new Prisma.Decimal(0),
          overtimeMinutes: entry.overtime,
          overtimeApprovedMinutes: entry.approvedOvertime,
          sourceSnapshot: { demo: true, schedule: demoSchedule.name },
        },
        create: {
          periodId: demoPeriod.id,
          employeeId: demoEmployee.id,
          workDate: workday(entry.date),
          attendanceId: attendanceIds.get(entry.date),
          scheduledMinutes: 540,
          workedMinutes: entry.worked,
          roundedWorkMinutes: entry.rounded,
          workUnits: new Prisma.Decimal(entry.rounded)
            .div(540)
            .toDecimalPlaces(4),
          lateMinutes: entry.late,
          earlyLeaveMinutes: entry.early,
          latePenalty: new Prisma.Decimal(entry.late).mul(1000),
          missingPunch: entry.missing,
          missingPunchPenalty: entry.missing
            ? new Prisma.Decimal(50000)
            : new Prisma.Decimal(0),
          overtimeMinutes: entry.overtime,
          overtimeApprovedMinutes: entry.approvedOvertime,
          sourceSnapshot: { demo: true, schedule: demoSchedule.name },
        },
      });
    await prisma.integrationKpiField.upsert({
      where: { key: "sales_target" },
      update: {
        label: "Doanh số mục tiêu",
        fieldType: "NUMBER",
        required: false,
        isActive: true,
        sortOrder: 1,
      },
      create: {
        key: "sales_target",
        label: "Doanh số mục tiêu",
        fieldType: "NUMBER",
        required: false,
        isActive: true,
        sortOrder: 1,
      },
    });
    await prisma.integrationKpiField.upsert({
      where: { key: "customer_count" },
      update: {
        label: "Số khách phục vụ",
        fieldType: "NUMBER",
        required: true,
        isActive: true,
        sortOrder: 2,
      },
      create: {
        key: "customer_count",
        label: "Số khách phục vụ",
        fieldType: "NUMBER",
        required: true,
        isActive: true,
        sortOrder: 2,
      },
    });
    console.log(
      "  safe demo data (2 branches, 1 employee, shift assignment, 4 attendances, missing punch, approved OT, timesheet draft, KPI fields; no biometric data or login account)",
    );
  }
  console.log("  ✓ master data (leave types, work schedule)");

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
