import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmployeesService } from './employees.service';
import { isPrivileged, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

const HEADERS = [
  'employeeNo', 'username', 'fullName', 'email', 'phone', 'gender', 'dateOfBirth', 'identityCode',
  'address', 'emergencyContactName', 'emergencyContactPhone', 'joinDate', 'workStatus', 'employmentType',
  'branch', 'department', 'position',
];
const STATUSES = new Set(['PROBATION', 'PERMANENT', 'CONTRACT', 'ON_LEAVE', 'INACTIVE']);
const TYPES = new Set(['FULL_TIME', 'PART_TIME']);
const GENDERS = new Set(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']);
const text = (value: ExcelJS.CellValue | undefined) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '').trim();
  return String(value).trim();
};
const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, (c) => c === 'đ' ? 'd' : 'D').trim().toLocaleLowerCase('vi-VN');
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

type ImportRow = { row: number; employeeNo: string; values: Record<string, string>; employeeId?: string; action: 'create' | 'update' };
type Issue = { row: number; column?: string; message: string };

@Injectable()
export class EmployeesExcelService {
  constructor(private readonly prisma: PrismaService, private readonly employees: EmployeesService) {}

  async template() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('NhanVien');
    sheet.addRow(HEADERS);
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5422A5' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns = HEADERS.map((header) => ({ header, key: header, width: Math.max(18, header.length + 3) }));
    for (const column of ['employeeNo', 'username', 'phone', 'identityCode', 'emergencyContactPhone']) {
      const index = HEADERS.indexOf(column) + 1;
      sheet.getColumn(index).numFmt = '@';
    }
    const guide = workbook.addWorksheet('HuongDan');
    guide.addRows([
      ['Cột', 'Hướng dẫn'],
      ['employeeNo', 'Để trống để thêm mới; điền mã nhân viên hiện có để cập nhật hồ sơ đó.'],
      ['username, fullName, email', 'Bắt buộc khi thêm mới. username dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.'],
      ['Tài khoản thêm mới', 'Mật khẩu khởi tạo là 123456; nhân viên cần đổi mật khẩu sau lần đăng nhập đầu tiên.'],
      ['joinDate', 'Ngày vào làm theo định dạng YYYY-MM-DD; bắt buộc khi thêm mới.'],
      ['branch', 'Mã hoặc tên chi nhánh đang hoạt động; bắt buộc khi thêm mới.'],
      ['department, position', 'Tên phòng ban và chức vụ đã được cấu hình; có thể để trống.'],
      ['workStatus', 'PROBATION, PERMANENT, CONTRACT, ON_LEAVE hoặc INACTIVE.'],
      ['employmentType', 'FULL_TIME hoặc PART_TIME.'],
      ['gender', 'MALE, FEMALE, OTHER hoặc UNDISCLOSED.'],
      ['Các cột khác', 'Để trống khi cập nhật nếu muốn giữ nguyên dữ liệu hiện tại. Không xóa dòng tiêu đề.'],
    ]);
    guide.getRow(1).font = { bold: true };
    guide.columns = [{ width: 25 }, { width: 100 }];
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async export() {
    const employees = await this.prisma.employee.findMany({
      where: { deletedAt: null }, orderBy: { employeeNo: 'asc' },
      include: { user: true, primaryBranch: true, department: true, position: true },
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('NhanVien');
    sheet.addRow(HEADERS);
    sheet.columns = HEADERS.map((header) => ({ header, key: header, width: Math.max(18, header.length + 3) }));
    employees.forEach((employee) => sheet.addRow({
      employeeNo: employee.employeeNo, username: employee.user?.username ?? '', fullName: employee.fullName,
      email: employee.email ?? '', phone: employee.phone ?? '', gender: employee.gender ?? '',
      dateOfBirth: employee.dateOfBirth?.toISOString().slice(0, 10) ?? '', identityCode: employee.identityCode ?? '',
      address: employee.address ?? '', emergencyContactName: employee.emergencyContactName ?? '',
      emergencyContactPhone: employee.emergencyContactPhone ?? '', joinDate: employee.joinDate.toISOString().slice(0, 10),
      workStatus: employee.workStatus, employmentType: employee.employmentType,
      branch: employee.primaryBranch?.code ?? employee.primaryBranch?.name ?? '',
      department: employee.department?.name ?? '', position: employee.position?.title ?? '',
    }));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(buffer: Buffer, user: RequestUser) {
    const { rows, errors } = await this.parse(buffer, user);
    return {
      summary: {
        createCount: rows.filter((row) => row.action === 'create').length,
        updateCount: rows.filter((row) => row.action === 'update').length,
        errorCount: errors.length,
      },
      errors: errors.slice(0, 200),
      rows: rows.slice(0, 500).map(({ row, employeeNo, values, action }) => ({ row, employeeNo, fullName: values.fullName, action })),
    };
  }

  async apply(buffer: Buffer, user: RequestUser) {
    const parsed = await this.parse(buffer, user);
    if (parsed.errors.length) return this.preview(buffer, user);
    const errors: Issue[] = [];
    let created = 0;
    let updated = 0;
    for (const row of parsed.rows) {
      const payload = this.dto(row.values);
      try {
        if (row.action === 'create') {
          await this.employees.create(payload as unknown as CreateEmployeeDto, { actorId: user.id }, isPrivileged(user, 'payroll:update'));
          created += 1;
        } else {
          await this.employees.update(row.employeeId!, {
            ...payload,
            effectiveDate: new Date().toISOString().slice(0, 10),
            changeReason: 'Cập nhật hàng loạt từ Excel',
          } as UpdateEmployeeDto, { actorId: user.id }, isPrivileged(user, 'payroll:update'));
          updated += 1;
        }
      } catch (error) {
        errors.push({ row: row.row, message: error instanceof Error ? error.message : 'Không thể lưu dòng này.' });
      }
    }
    return { summary: { createCount: created, updateCount: updated, errorCount: errors.length }, errors };
  }

  private dto(values: Record<string, string>) {
    const payload: Record<string, unknown> = {};
    const stringFields = ['employeeNo', 'username', 'fullName', 'email', 'phone', 'gender', 'dateOfBirth', 'identityCode', 'address', 'emergencyContactName', 'emergencyContactPhone', 'joinDate', 'workStatus', 'employmentType', 'primaryBranchId', 'departmentId', 'positionId'];
    for (const field of stringFields) if (values[field]) payload[field] = values[field];
    if (values.username) payload.username = values.username.toLowerCase();
    if (values.email) payload.email = values.email.toLowerCase();
    return payload;
  }

  private async parse(buffer: Buffer, user: RequestUser) {
    if (!buffer?.length || buffer.length > 10 * 1024 * 1024) throw new BadRequestException('File Excel trống hoặc vượt quá 10 MB.');
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); } catch { throw new BadRequestException('Không đọc được file Excel (.xlsx).'); }
    const sheet = workbook.getWorksheet('NhanVien') ?? workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) throw new BadRequestException('File không có dữ liệu nhân viên.');
    const headerMap = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, col) => headerMap.set(key(text(cell.value)), col));
    const read = (row: ExcelJS.Row, column: string) => {
      const col = headerMap.get(key(column));
      if (!col) return '';
      const cell = row.getCell(col);
      return cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text.trim();
    };
    for (const required of ['fullName']) if (!headerMap.has(key(required))) throw new BadRequestException(`Thiếu cột ${required}.`);
    const [branches, departments, positions, existing] = await Promise.all([
      this.prisma.branch.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
      this.prisma.department.findMany({ select: { id: true, name: true } }),
      this.prisma.position.findMany({ select: { id: true, title: true, departmentId: true } }),
      this.prisma.employee.findMany({ where: { deletedAt: null }, select: { id: true, employeeNo: true, user: { select: { username: true, email: true } } } }),
    ]);
    const byBranch = new Map(branches.flatMap((item) => [[key(item.code), item.id], [key(item.name), item.id]]));
    const byDepartment = new Map(departments.map((item) => [key(item.name), item.id]));
    const existingByNo = new Map(existing.map((item) => [item.employeeNo, item]));
    const errors: Issue[] = [];
    const rows: ImportRow[] = [];
    const seen = new Set<string>();
    const seenEmployeeNos = new Set<string>();
    const canCreate = isPrivileged(user, 'employee:create');
    const canUpdate = isPrivileged(user, 'employee:update');
    sheet.eachRow((row, index) => {
      if (index === 1 || HEADERS.every((column) => !read(row, column))) return;
      const values: Record<string, string> = {};
      for (const column of HEADERS) values[column] = read(row, column);
      for (const field of ['gender', 'workStatus', 'employmentType']) values[field] = values[field].toUpperCase();
      const employee = values.employeeNo ? existingByNo.get(values.employeeNo) : undefined;
      const action = employee ? 'update' : 'create';
      const addError = (column: string, message: string) => errors.push({ row: index, column, message });
      if (values.employeeNo && seenEmployeeNos.has(values.employeeNo)) addError('employeeNo', 'Mã nhân viên bị lặp trong file.');
      if (values.employeeNo) seenEmployeeNos.add(values.employeeNo);
      if (employee && !canUpdate) addError('employeeNo', 'Bạn không có quyền cập nhật nhân viên.');
      if (!employee && !canCreate) addError('employeeNo', 'Bạn không có quyền thêm nhân viên.');
      if (!values.fullName || values.fullName.length < 2) addError('fullName', 'Nhập họ tên từ 2 ký tự.');
      if (action === 'create') {
        if (!values.username || !/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/i.test(values.username)) addError('username', 'Tên đăng nhập không hợp lệ.');
        if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) addError('email', 'Email không hợp lệ.');
        if (!values.joinDate || !validDate(values.joinDate)) addError('joinDate', 'Ngày vào làm phải theo YYYY-MM-DD.');
        if (!values.branch) addError('branch', 'Bắt buộc chọn chi nhánh khi thêm mới.');
      }
      if (values.joinDate && !validDate(values.joinDate)) addError('joinDate', 'Ngày phải theo YYYY-MM-DD.');
      if (values.dateOfBirth && !validDate(values.dateOfBirth)) addError('dateOfBirth', 'Ngày phải theo YYYY-MM-DD.');
      if (values.identityCode && !/^\d{9}$|^\d{12}$/.test(values.identityCode)) addError('identityCode', 'CCCD/CMND gồm 9 hoặc 12 chữ số.');
      if (values.gender && !GENDERS.has(values.gender.toUpperCase())) addError('gender', 'Giá trị gender không hợp lệ.');
      if (values.workStatus && !STATUSES.has(values.workStatus.toUpperCase())) addError('workStatus', 'Giá trị workStatus không hợp lệ.');
      if (values.employmentType && !TYPES.has(values.employmentType.toUpperCase())) addError('employmentType', 'Giá trị employmentType không hợp lệ.');
      const branchId = values.branch ? byBranch.get(key(values.branch)) : undefined;
      const departmentId = values.department ? byDepartment.get(key(values.department)) : undefined;
      const position = values.position ? positions.find((item) => key(item.title) === key(values.position) && (!departmentId || item.departmentId === departmentId)) : undefined;
      if (values.branch && !branchId) addError('branch', 'Không tìm thấy chi nhánh đang hoạt động.');
      if (values.department && !departmentId) addError('department', 'Không tìm thấy phòng ban.');
      if (values.position && !position) addError('position', 'Không tìm thấy chức vụ phù hợp.');
      values.primaryBranchId = branchId ?? '';
      values.departmentId = departmentId ?? '';
      values.positionId = position?.id ?? '';
      for (const field of ['username', 'email']) {
        const value = values[field].toLowerCase();
        if (!value) continue;
        const fingerprint = `${field}:${value}`;
        if (seen.has(fingerprint)) addError(field, `Giá trị bị lặp trong file: ${value}.`);
        seen.add(fingerprint);
        const collision = existing.find((item) => item.id !== employee?.id && item.user?.[field as 'username' | 'email']?.toLowerCase() === value);
        if (collision) addError(field, `${field} đã được tài khoản khác sử dụng.`);
      }
      if (values.employeeNo && !employee) addError('employeeNo', 'Không tìm thấy mã nhân viên để cập nhật; để trống nếu thêm mới.');
      rows.push({ row: index, employeeNo: values.employeeNo, values, employeeId: employee?.id, action });
    });
    return { rows, errors };
  }
}
