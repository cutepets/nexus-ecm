import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmployeesService } from './employees.service';
import { isPrivileged, permissionScope, RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateEmployeeDto, normalizeEmployeePhone, UpdateEmployeeDto } from './dto/employee.dto';

const FIELDS = [
  { key: 'employeeNo', label: 'Mã nhân viên' },
  { key: 'username', label: 'Tên đăng nhập' },
  { key: 'fullName', label: 'Họ và tên' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'gender', label: 'Giới tính' },
  { key: 'dateOfBirth', label: 'Ngày sinh' },
  { key: 'identityCode', label: 'CCCD/CMND' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'emergencyContactName', label: 'Tên liên hệ khẩn cấp' },
  { key: 'emergencyContactPhone', label: 'SĐT liên hệ khẩn cấp' },
  { key: 'joinDate', label: 'Ngày vào làm' },
  { key: 'workStatus', label: 'Trạng thái làm việc' },
  { key: 'employmentType', label: 'Loại hình làm việc' },
  { key: 'branch', label: 'Chi nhánh' },
  { key: 'workSchedule', label: 'Ca làm' },
  { key: 'department', label: 'Phòng ban' },
  { key: 'position', label: 'Chức vụ' },
  { key: 'taxCode', label: 'Mã số thuế' },
  { key: 'salaryBankName', label: 'Ngân hàng' },
  { key: 'salaryBankAccount', label: 'STK' },
  { key: 'photoUrl', label: 'Link ảnh đại diện' },
  { key: 'basicSalary', label: 'Lương cơ bản' },
  { key: 'spaBonusPercent', label: 'Thưởng Spa (%)' },
  { key: 'probationDays', label: 'Số ngày thử việc' },
] as const;
const HEADERS: string[] = FIELDS.map((field) => field.key);
const LABELS = new Map<string, string>(FIELDS.map(({ key, label }) => [key, label]));
const ALIASES: Record<string, string[]> = {
  employeeNo: ['Mã NV', 'Mã nhân viên'], username: ['Tên đăng nhập'], fullName: ['Họ tên', 'Họ và tên'],
  email: ['Email'], phone: ['Điện thoại', 'Số điện thoại'], gender: ['Giới tính'], dateOfBirth: ['Ngày sinh'],
  identityCode: ['CCCD', 'CMND', 'CCCD/CMND', 'Số CCCD'], address: ['Địa chỉ'],
  emergencyContactName: ['Tên liên hệ khẩn cấp'], emergencyContactPhone: ['SĐT liên hệ khẩn cấp', 'Điện thoại liên hệ khẩn cấp'],
  joinDate: ['Ngày vào làm'], workStatus: ['Trạng thái làm việc'], employmentType: ['Loại hình làm việc'],
  branch: ['Chi nhánh'], workSchedule: ['Ca làm', 'Ca làm mặc định'], department: ['Phòng ban'], position: ['Chức vụ'],
  taxCode: ['Mã số thuế'], salaryBankName: ['Ngân hàng'], salaryBankAccount: ['STK', 'Số tài khoản'],
  photoUrl: ['Link ảnh đại diện', 'Ảnh đại diện', 'Avatar URL', 'photoUrl'],
  basicSalary: ['Lương cơ bản', 'basicSalary'], spaBonusPercent: ['Thưởng Spa (%)', 'Phần trăm thưởng Spa', 'spaBonusPercent'],
};
const STATUS_OPTIONS = [
  ['PROBATION', 'Thử việc'], ['PERMANENT', 'Chính thức'], ['ON_LEAVE', 'Tạm nghỉ'], ['INACTIVE', 'Thôi việc'], ['ABANDONED', 'Bỏ việc'],
] as const;
const TYPE_OPTIONS = [['FULL_TIME', 'Full Time'], ['PART_TIME', 'Part Time']] as const;
const GENDER_OPTIONS = [['MALE', 'Nam'], ['FEMALE', 'Nữ'], ['OTHER', 'Khác'], ['UNDISCLOSED', 'Không công khai']] as const;
const OPTION_FIELDS = { workStatus: STATUS_OPTIONS, employmentType: TYPE_OPTIONS, gender: GENDER_OPTIONS } as const;
const text = (value: ExcelJS.CellValue | undefined) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return dateText(value);
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '').trim();
  return String(value).trim();
};
const dateText = (date: Date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, (c) => c === 'đ' ? 'd' : 'D').trim().toLocaleLowerCase('vi-VN');
const normalizeDate = (value: string) => {
  const local = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const normalized = local ? `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}` : iso ? value : '';
  if (!normalized) return '';
  const date = new Date(`${normalized}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized ? normalized : '';
};
const displayOption = (field: keyof typeof OPTION_FIELDS, value: string) => {
  const option = OPTION_FIELDS[field].find(([code]) => code === value);
  return option?.[1] ?? value;
};
const parseOption = (field: keyof typeof OPTION_FIELDS, value: string) => {
  const normalized = key(value);
  const option = OPTION_FIELDS[field].find(([code, label]) => key(code) === normalized || key(label) === normalized);
  if (!option && field === 'employmentType') {
    if (['toan thoi gian', 'fulltime'].includes(normalized)) return 'FULL_TIME';
    if (['ban thoi gian', 'partime'].includes(normalized)) return 'PART_TIME';
  }
  return option?.[0] ?? value.toUpperCase();
};

type ImportRow = { row: number; employeeNo: string; values: Record<string, string>; employeeId?: string; action: 'create' | 'update' };
type Issue = { row: number; column?: string; message: string };

@Injectable()
export class EmployeesExcelService {
  constructor(private readonly prisma: PrismaService, private readonly employees: EmployeesService) {}

  async template() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('NhanVien');
    sheet.addRow(FIELDS.map(({ label }) => label));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5422A5' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns = FIELDS.map(({ key, label }) => ({ header: label, key, width: Math.max(18, label.length + 3) }));
    for (const column of ['employeeNo', 'username', 'phone', 'identityCode', 'emergencyContactPhone']) sheet.getColumn(HEADERS.indexOf(column) + 1).numFmt = '@';
    this.formatDateColumns(sheet);
    this.addOptionValidations(sheet);
    const guide = workbook.addWorksheet('HuongDan');
    guide.addRows([
      ['Cột', 'Hướng dẫn'],
      ['Mã nhân viên', 'Mã chưa tồn tại sẽ tạo nhân viên mới; mã đã tồn tại sẽ cập nhật nhân viên đó. Để trống để hệ thống tự tạo mã.'],
      ['Tên đăng nhập, Họ và tên, Email', 'Bắt buộc khi thêm mới. Tài khoản mới có mật khẩu khởi tạo 123456.'],
      ['Ngày sinh, Ngày vào làm', 'Nhập theo định dạng dd/mm/yyyy. Ngày vào làm bắt buộc khi thêm mới.'],
      ['Số điện thoại', 'Nếu nhập 9 chữ số bị mất số 0 đầu, hệ thống sẽ tự thêm 0. Các cột số điện thoại được định dạng văn bản.'],
      ['Chi nhánh', 'Nhập mã hoặc tên chi nhánh đang hoạt động; bắt buộc khi thêm mới.'],
      ['Trạng thái làm việc', STATUS_OPTIONS.map(([, label]) => label).join(', ') + '.'],
      ['Loại hình làm việc', TYPE_OPTIONS.map(([, label]) => label).join(', ') + '.'],
      ['Ca làm', 'Nhập tên ca làm đã được khai báo trong hệ thống. Ô trống khi cập nhật sẽ giữ ca hiện tại.'],
      ['Giới tính', GENDER_OPTIONS.map(([, label]) => label).join(', ') + '.'],
      ['Link ảnh đại diện', 'Nhập URL ảnh http:// hoặc https://. Ô trống khi cập nhật sẽ giữ ảnh hiện tại.'],
      ['Mã số thuế, Ngân hàng, STK, Lương cơ bản, Thưởng Spa (%)', 'Các trường lương và tài khoản nhận lương chỉ được cập nhật bởi tài khoản có quyền quản lý lương.'],
      ['Số ngày thử việc', 'Nhập số nguyên không âm; mặc định 20 ngày khi tạo mới.'],
      ['Ô trống khi cập nhật', 'Ô trống không cập nhật và không xóa dữ liệu đang có. Muốn đổi giá trị, hãy nhập giá trị mới vào ô.'],
      ['Các ô còn lại', 'Không xóa dòng tiêu đề.'],
    ]);
    guide.getRow(1).font = { bold: true };
    guide.columns = [{ width: 30 }, { width: 100 }];
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async export(user: RequestUser) {
    const canReadCompensation = permissionScope(user, 'payroll:read') === 'ALL';
    const employees = await this.prisma.employee.findMany({
      where: { deletedAt: null }, orderBy: { employeeNo: 'asc' },
      include: { user: true, primaryBranch: true, department: true, position: true, workScheduleAssignments: { where: { effectiveTo: null }, include: { workSchedule: true }, orderBy: [{ priority: 'desc' }, { effectiveFrom: 'desc' }] } },
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('NhanVien');
    sheet.addRow(FIELDS.map(({ label }) => label));
    sheet.columns = FIELDS.map(({ key, label }) => ({ header: label, key, width: Math.max(18, label.length + 3) }));
    employees.forEach((employee) => sheet.addRow({
      employeeNo: employee.employeeNo, username: employee.user?.username ?? '', fullName: employee.fullName,
      email: employee.email ?? '', phone: normalizeEmployeePhone(employee.phone ?? ''), gender: employee.gender ? displayOption('gender', employee.gender) : '',
      dateOfBirth: employee.dateOfBirth ?? undefined, identityCode: employee.identityCode ?? '',
      address: employee.address ?? '', emergencyContactName: employee.emergencyContactName ?? '',
      emergencyContactPhone: normalizeEmployeePhone(employee.emergencyContactPhone ?? ''), joinDate: employee.joinDate,
      workStatus: displayOption('workStatus', employee.workStatus), employmentType: displayOption('employmentType', employee.employmentType),
      branch: employee.primaryBranch?.code ?? employee.primaryBranch?.name ?? '',
      workSchedule: employee.workScheduleAssignments[0]?.workSchedule.name ?? '',
      department: employee.department?.name ?? '', position: employee.position?.title ?? '',
      taxCode: canReadCompensation ? employee.taxCode ?? '' : '',
      salaryBankName: canReadCompensation ? employee.salaryBankName ?? '' : '',
      salaryBankAccount: canReadCompensation ? employee.salaryBankAccount ?? '' : '',
      photoUrl: employee.photoUrl?.startsWith('http') ? employee.photoUrl : '',
      basicSalary: !canReadCompensation || employee.basicSalary === null ? '' : Number(employee.basicSalary),
      spaBonusPercent: !canReadCompensation || employee.spaBonusPercent === null ? '' : Number(employee.spaBonusPercent),
      probationDays: employee.probationDays,
    }));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    this.formatDateColumns(sheet);
    for (const field of ['phone', 'emergencyContactPhone', 'salaryBankAccount']) sheet.getColumn(HEADERS.indexOf(field) + 1).numFmt = '@';
    for (const field of ['basicSalary', 'spaBonusPercent']) sheet.getColumn(HEADERS.indexOf(field) + 1).numFmt = '#,##0.##';
    sheet.getColumn(HEADERS.indexOf('probationDays') + 1).numFmt = '0';
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
      const payload = this.dto(row.values, row.action === 'update');
      try {
        if (row.action === 'create') {
          await this.employees.create(payload as unknown as CreateEmployeeDto, { actorId: user.id }, isPrivileged(user, 'payroll:update'), permissionScope(user, 'branch:create') !== 'NONE' && permissionScope(user, 'attendance-policy:update') !== 'NONE');
          created += 1;
        } else {
          await this.employees.update(row.employeeId!, {
            ...payload,
            effectiveDate: new Date().toISOString().slice(0, 10),
            changeReason: 'Cập nhật hàng loạt từ Excel',
          } as UpdateEmployeeDto, { actorId: user.id }, isPrivileged(user, 'payroll:update'), permissionScope(user, 'branch:create') !== 'NONE' && permissionScope(user, 'attendance-policy:update') !== 'NONE');
          updated += 1;
        }
      } catch (error) {
        errors.push({ row: row.row, message: error instanceof Error ? error.message : 'Không thể lưu dòng này.' });
      }
    }
    return { summary: { createCount: created, updateCount: updated, errorCount: errors.length }, errors };
  }

  private dto(values: Record<string, string>, isUpdate: boolean) {
    const payload: Record<string, unknown> = {};
    const stringFields = ['employeeNo', 'username', 'fullName', 'email', 'phone', 'gender', 'dateOfBirth', 'identityCode', 'address', 'emergencyContactName', 'emergencyContactPhone', 'joinDate', 'workStatus', 'employmentType', 'photoUrl', 'primaryBranchId', 'departmentId', 'positionId', 'workScheduleId', 'taxCode', 'salaryBankName', 'salaryBankAccount'];
    for (const field of stringFields) {
      const value = values[field] ?? '';
      if (isUpdate && value.trim() === '') continue;
      if (value.trim() !== '') payload[field] = value;
    }
    for (const field of ['basicSalary', 'spaBonusPercent', 'probationDays']) {
      const value = values[field] ?? '';
      if (isUpdate && value.trim() === '') continue;
      if (value.trim() !== '') payload[field] = Number(value.replace(/,/g, ''));
    }
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
    const aliases = new Map<string, string>();
    for (const field of FIELDS) {
      for (const alias of [field.key, field.label, ...(ALIASES[field.key] ?? [])]) aliases.set(key(alias), field.key);
    }
    const fieldColumns = new Map<string, number>();
    for (const [header, col] of headerMap) {
      const field = aliases.get(header);
      if (field) fieldColumns.set(field, col);
    }
    const read = (row: ExcelJS.Row, field: string) => {
      const col = fieldColumns.get(field);
      if (!col) return '';
      const cell = row.getCell(col);
      if (cell.value instanceof Date) return ['dateOfBirth', 'joinDate'].includes(field) ? normalizeDate(dateText(cell.value)) : text(cell.value);
      return text(cell.value);
    };
    if (!fieldColumns.has('fullName')) throw new BadRequestException('Thiếu cột Họ và tên.');
    const [branches, departments, positions, workSchedules, existing] = await Promise.all([
      this.prisma.branch.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
      this.prisma.department.findMany({ select: { id: true, name: true } }),
      this.prisma.position.findMany({ select: { id: true, title: true, departmentId: true } }),
      this.prisma.workSchedule.findMany({ select: { id: true, name: true } }),
      this.prisma.employee.findMany({ where: { deletedAt: null }, select: { id: true, employeeNo: true, user: { select: { username: true, email: true } } } }),
    ]);
    const byBranch = new Map(branches.flatMap((item) => [[key(item.code), item.id], [key(item.name), item.id]]));
    const byDepartment = new Map(departments.map((item) => [key(item.name), item.id]));
    const byWorkSchedule = new Map(workSchedules.map((item) => [key(item.name), item.id]));
    const existingByNo = new Map(existing.map((item) => [item.employeeNo, item]));
    const errors: Issue[] = [];
    const rows: ImportRow[] = [];
    const seen = new Set<string>();
    const seenEmployeeNos = new Set<string>();
    const canCreate = isPrivileged(user, 'employee:create');
    const canUpdate = isPrivileged(user, 'employee:update');
    const canManageCompensation = isPrivileged(user, 'payroll:update');
    sheet.eachRow((row, index) => {
      if (index === 1 || HEADERS.every((field) => !read(row, field))) return;
      const values: Record<string, string> = {};
      for (const field of HEADERS) values[field] = read(row, field);
      for (const field of ['phone', 'emergencyContactPhone']) values[field] = String(normalizeEmployeePhone(values[field]));
      values.joinDate = values.joinDate ? normalizeDate(values.joinDate) || values.joinDate : '';
      values.dateOfBirth = values.dateOfBirth ? normalizeDate(values.dateOfBirth) || values.dateOfBirth : '';
      for (const field of ['gender', 'workStatus', 'employmentType'] as const) values[field] = parseOption(field, values[field]);
      const employee = values.employeeNo ? existingByNo.get(values.employeeNo) : undefined;
      const action = employee ? 'update' : 'create';
      const addError = (column: string, message: string) => errors.push({ row: index, column: LABELS.get(column) ?? column, message });
      if (values.employeeNo && seenEmployeeNos.has(values.employeeNo)) addError('employeeNo', 'Mã nhân viên bị lặp trong file.');
      if (values.employeeNo) seenEmployeeNos.add(values.employeeNo);
      if (employee && !canUpdate) addError('employeeNo', 'Bạn không có quyền cập nhật nhân viên.');
      if (!employee && !canCreate) addError('employeeNo', 'Bạn không có quyền thêm nhân viên.');
      if (!values.fullName || values.fullName.length < 2) addError('fullName', 'Nhập họ tên từ 2 ký tự.');
      if (action === 'create') {
        if (!values.username || !/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/i.test(values.username)) addError('username', 'Tên đăng nhập không hợp lệ.');
        if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) addError('email', 'Email không hợp lệ.');
        if (!values.joinDate) addError('joinDate', 'Ngày vào làm bắt buộc khi thêm mới và phải theo dd/mm/yyyy.');
        if (!values.branch) addError('branch', 'Bắt buộc chọn chi nhánh khi thêm mới.');
      }
      if (values.joinDate && !normalizeDate(values.joinDate)) addError('joinDate', 'Ngày phải theo dd/mm/yyyy.');
      if (values.dateOfBirth && !normalizeDate(values.dateOfBirth)) addError('dateOfBirth', 'Ngày phải theo dd/mm/yyyy.');
      if (values.identityCode && !/^\d{9}$|^\d{12}$/.test(values.identityCode)) addError('identityCode', 'CCCD/CMND gồm 9 hoặc 12 chữ số.');
      if (values.taxCode && !/^\d{10}(-\d{3})?$/.test(values.taxCode)) addError('taxCode', 'Mã số thuế phải gồm 10 số hoặc 10 số-3 số.');
      if (values.gender && !GENDER_OPTIONS.some(([code]) => code === values.gender)) addError('gender', 'Giá trị giới tính không hợp lệ.');
      if (values.workStatus && !STATUS_OPTIONS.some(([code]) => code === values.workStatus)) addError('workStatus', 'Trạng thái làm việc không hợp lệ.');
      if (values.employmentType && !TYPE_OPTIONS.some(([code]) => code === values.employmentType)) addError('employmentType', 'Loại hình làm việc không hợp lệ.');
      if (values.photoUrl && !/^https?:\/\//i.test(values.photoUrl)) addError('photoUrl', 'Link ảnh phải bắt đầu bằng http:// hoặc https://.');
      for (const field of ['basicSalary', 'spaBonusPercent', 'probationDays']) {
        if (values[field] === '') continue;
        const amount = Number(values[field].replace(/,/g, ''));
        const max = field === 'spaBonusPercent' ? 100 : Number.MAX_SAFE_INTEGER;
        if (!Number.isFinite(amount) || amount < 0 || amount > max || (field === 'probationDays' && !Number.isInteger(amount))) addError(field, field === 'spaBonusPercent' ? 'Thưởng Spa phải từ 0 đến 100%.' : field === 'probationDays' ? 'Số ngày thử việc phải là số nguyên không âm.' : 'Lương cơ bản phải là số không âm.');
      }
      const compensationField = ['taxCode', 'salaryBankName', 'salaryBankAccount', 'basicSalary', 'spaBonusPercent'].find((field) => values[field] !== '');
      if (compensationField && !canManageCompensation) addError(compensationField, 'Bạn không có quyền cập nhật thông tin lương và tài khoản nhận lương.');
      const branchId = values.branch ? byBranch.get(key(values.branch)) : undefined;
      const departmentId = values.department ? byDepartment.get(key(values.department)) : undefined;
      const workScheduleId = values.workSchedule ? byWorkSchedule.get(key(values.workSchedule)) : undefined;
      const position = values.position ? positions.find((item) => key(item.title) === key(values.position) && (!departmentId || item.departmentId === departmentId)) : undefined;
      if (values.branch && !branchId) addError('branch', 'Không tìm thấy chi nhánh đang hoạt động.');
      if (values.department && !departmentId) addError('department', 'Không tìm thấy phòng ban.');
      if (values.position && !position) addError('position', 'Không tìm thấy chức vụ phù hợp.');
      if (values.workSchedule && !workScheduleId) addError('workSchedule', 'Không tìm thấy ca làm.');
      const canManageAssignments = permissionScope(user, 'branch:create') !== 'NONE' && permissionScope(user, 'attendance-policy:update') !== 'NONE';
      if (values.workSchedule && workScheduleId && !canManageAssignments) addError('workSchedule', 'Bạn không có quyền cập nhật ca làm.');
      values.primaryBranchId = branchId ?? '';
      values.departmentId = departmentId ?? '';
      values.positionId = position?.id ?? '';
      values.workScheduleId = workScheduleId ?? '';
      for (const field of ['username', 'email']) {
        const value = values[field].toLowerCase();
        if (!value) continue;
        const fingerprint = `${field}:${value}`;
        if (seen.has(fingerprint)) addError(field, `Giá trị bị lặp trong file: ${value}.`);
        seen.add(fingerprint);
        const collision = existing.find((item) => item.id !== employee?.id && item.user?.[field as 'username' | 'email']?.toLowerCase() === value);
        if (collision) addError(field, `${field} đã được tài khoản khác sử dụng.`);
      }
      rows.push({ row: index, employeeNo: values.employeeNo, values, employeeId: employee?.id, action });
    });
    return { rows, errors };
  }

  private formatDateColumns(sheet: ExcelJS.Worksheet) {
    for (const field of ['dateOfBirth', 'joinDate']) sheet.getColumn(HEADERS.indexOf(field) + 1).numFmt = 'dd/mm/yyyy';
  }

  private addOptionValidations(sheet: ExcelJS.Worksheet) {
    for (const field of ['gender', 'workStatus', 'employmentType'] as const) {
      const options = OPTION_FIELDS[field];
      const labels = (options as readonly (readonly [string, string])[]).map((option) => option[1]);
      const col = HEADERS.indexOf(field) + 1;
      for (let row = 2; row <= 1000; row += 1) {
        sheet.getCell(row, col).dataValidation = {
          type: 'list', allowBlank: true, formulae: [`"${labels.join(',')}"`],
        };
      }
    }
  }
}
