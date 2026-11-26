'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api-client';

type ExcelPreview = {
  summary: { createCount: number; updateCount: number; errorCount: number };
  errors: { row: number; column?: string; message: string }[];
  rows?: { row: number; employeeNo: string; fullName: string; action: 'create' | 'update' }[];
};

export function EmployeeExcelActions({ canImport }: { canImport: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<ExcelPreview>();
  const [busy, setBusy] = useState(false);

  const saveFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadTemplate = async () => {
    setBusy(true);
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('NhanVien');
      const headers = ['employeeNo', 'username', 'fullName', 'email', 'phone', 'gender', 'dateOfBirth', 'identityCode', 'address', 'emergencyContactName', 'emergencyContactPhone', 'joinDate', 'workStatus', 'employmentType', 'branch', 'department', 'position'];
      sheet.addRow(headers);
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5422A5' } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(18, header.length + 3) }));
      for (const column of ['employeeNo', 'username', 'phone', 'identityCode', 'emergencyContactPhone']) sheet.getColumn(headers.indexOf(column) + 1).numFmt = '@';
      const guide = workbook.addWorksheet('HuongDan');
      guide.addRows([
        ['Cột', 'Hướng dẫn'],
        ['employeeNo', 'Để trống để thêm mới; điền mã nhân viên hiện có để cập nhật hồ sơ đó.'],
        ['username, fullName, email', 'Bắt buộc khi thêm mới. username dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.'],
        ['Tài khoản mới', 'Mật khẩu khởi tạo là 123456; nhân viên cần đổi sau lần đăng nhập đầu tiên.'],
        ['joinDate', 'Ngày vào làm theo định dạng YYYY-MM-DD; bắt buộc khi thêm mới.'],
        ['branch', 'Mã hoặc tên chi nhánh đang hoạt động; bắt buộc khi thêm mới.'],
        ['department, position', 'Tên phòng ban và chức vụ đã cấu hình; có thể để trống.'],
        ['workStatus', 'PROBATION, PERMANENT, CONTRACT, ON_LEAVE hoặc INACTIVE.'],
        ['employmentType', 'FULL_TIME hoặc PART_TIME.'],
        ['gender', 'MALE, FEMALE, OTHER hoặc UNDISCLOSED.'],
        ['Các cột khác', 'Để trống khi cập nhật nếu muốn giữ nguyên. Không xóa dòng tiêu đề.'],
      ]);
      guide.getRow(1).font = { bold: true };
      guide.columns = [{ width: 25 }, { width: 100 }];
      const data = await workbook.xlsx.writeBuffer();
      // ExcelJS types the result as Node's Buffer even though its browser build
      // returns an ArrayBuffer. Treat the browser result as the transferable
      // binary payload so Blob does not receive a Node-only Buffer type.
      saveFile(new Blob([data as unknown as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'nhan-vien-mau.xlsx');
    } catch {
      toast.error('Không tạo được file mẫu Excel.');
    } finally { setBusy(false); }
  };

  const download = async (path: string, filename: string) => {
    setBusy(true);
    try {
      const { data } = await api.get<Blob>(path, { responseType: 'blob' });
      saveFile(data, filename);
    } catch {
      toast.error('Không tải được file Excel.');
    } finally { setBusy(false); }
  };

  const upload = async (file: File, apply: boolean) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<ExcelPreview>(`/employees/excel/import/${apply ? 'apply' : 'preview'}`, form);
    return data;
  };

  const selectFile = async (file: File) => {
    setBusy(true);
    try {
      const result = await upload(file, false);
      setPreview(result);
      if (result.summary.errorCount) toast.error(`File có ${result.summary.errorCount} lỗi cần sửa.`);
    } catch {
      toast.error('Không đọc được file Excel. Hãy dùng file .xlsx theo mẫu.');
    } finally { setBusy(false); }
  };

  const apply = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !preview || preview.summary.errorCount) return;
    setBusy(true);
    try {
      const result = await upload(file, true);
      setPreview(result);
      if (result.summary.errorCount) {
        toast.error(`Đã thêm ${result.summary.createCount}, cập nhật ${result.summary.updateCount}; còn ${result.summary.errorCount} dòng lỗi.`);
      } else {
        toast.success(`Đã thêm ${result.summary.createCount}, cập nhật ${result.summary.updateCount} nhân viên.`);
        setPreview(undefined);
        if (fileRef.current) fileRef.current.value = '';
      }
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch {
      toast.error('Không áp dụng được file Excel.');
    } finally { setBusy(false); }
  };

  return <>
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button type="button" variant="secondary" disabled={busy}><FileSpreadsheet />Nhập/Xuất<ChevronDown className="ml-1 size-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void downloadTemplate()}><FileSpreadsheet />Tải mẫu Excel</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void download('/employees/excel/export', 'nhan-vien.xlsx')}><Download />Xuất Excel</DropdownMenuItem>
          <DropdownMenuItem disabled={!canImport} onSelect={() => fileRef.current?.click()}><Upload />Nhập Excel</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void selectFile(file); }} />
    </div>
    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open && !busy) { setPreview(undefined); if (fileRef.current) fileRef.current.value = ''; } }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto p-6">
        <DialogTitle>Kiểm tra file Excel</DialogTitle>
        <DialogDescription>Xem số dòng thêm mới, cập nhật và lỗi trước khi áp dụng.</DialogDescription>
        {preview && <>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-xl bg-canvas p-3">Thêm mới <b className="block text-lg">{preview.summary.createCount}</b></div>
            <div className="rounded-xl bg-canvas p-3">Cập nhật <b className="block text-lg">{preview.summary.updateCount}</b></div>
            <div className="rounded-xl bg-canvas p-3">Lỗi <b className="block text-lg">{preview.summary.errorCount}</b></div>
          </div>
          {preview.errors.length > 0 && <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-border">{preview.errors.map((error, index) => <p key={`${error.row}-${error.column}-${index}`} className="border-b border-border px-3 py-2 text-sm last:border-0">Dòng {error.row}{error.column ? ` · ${error.column}` : ''}: {error.message}</p>)}</div>}
          {preview.summary.errorCount === 0 && preview.rows && <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-border">{preview.rows.slice(0, 30).map((row) => <p key={row.row} className="flex justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-0"><span>Dòng {row.row} · {row.fullName} {row.employeeNo && `(${row.employeeNo})`}</span><span className="shrink-0 text-ink-muted">{row.action === 'create' ? 'Thêm mới' : 'Cập nhật'}</span></p>)}</div>}
          {preview.summary.errorCount === 0 && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">File hợp lệ và sẵn sàng áp dụng.</p>}
        </>}
        <div className="mt-5 flex justify-end gap-2"><DialogClose asChild><Button type="button" variant="secondary" disabled={busy}>Hủy</Button></DialogClose><Button type="button" disabled={busy || !preview || preview.summary.errorCount > 0} onClick={() => void apply()}>Xác nhận</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
