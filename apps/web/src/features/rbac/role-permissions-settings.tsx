"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import {
  useCreateRole,
  useDeleteRole,
  usePermissions,
  useRoles,
  useSetRolePermissions,
  useReplaceRoleAssignmentRules,
  useRoleAssignmentRules,
  useUpdateRole,
  type Role,
  type RoleAssignmentRule,
  type PermissionScope,
} from "@/features/rbac/api";
import { useAuthStore } from "@/stores/auth-store";
import { RoleAssignmentRulesSettings } from "./role-assignment-rules-settings";

const crudRows = (prefix: string, subject: string, compact = false) => [
  { label: compact ? "Tạo" : `Tạo ${subject}`, matches: (key: string) => key === `${prefix}:create` },
  { label: compact ? "Xem" : `Xem ${subject}`, matches: (key: string) => key === `${prefix}:read` },
  { label: compact ? "Cập nhật" : `Cập nhật ${subject}`, matches: (key: string) => key === `${prefix}:update` },
  { label: compact ? "Xóa" : `Xóa ${subject}`, matches: (key: string) => key === `${prefix}:delete` },
];

const permissionGroups = [
  { label: "Chấm công", rows: [
    ...crudRows("attendance", "bản ghi chấm công", true),
    { label: "Đăng ký khuôn mặt chấm công", matches: (key: string) => key === "attendance:face:enroll" },
  ] },
  { label: "Lịch", rows: crudRows("attendance-policy", "lịch làm việc", true) },
  { label: "Nhân viên", rows: [
    ...crudRows("employee", "hồ sơ nhân viên", true),
    { label: "Xem bảng lương", matches: (key: string) => key === "payroll:read" },
    { label: "Cập nhật bảng lương", matches: (key: string) => key === "payroll:update" },
    { label: "Đặt lại mật khẩu nhân viên", matches: (key: string) => key === "user:reset-password" },
  ] },
  { label: "Ứng viên", rows: crudRows("candidate", "ứng viên", true) },
  { label: "Lịch sử chấm công", rows: crudRows("attendance-correction", "yêu cầu điều chỉnh chấm công", true) },
  { label: "Phê duyệt", rows: [
    { label: "Tạo đơn nghỉ phép", matches: (key: string) => key === "leave:create" },
    { label: "Xem đơn nghỉ phép", matches: (key: string) => key === "leave:read" },
    { label: "Phê duyệt đơn nghỉ phép", matches: (key: string) => key === "leave:approve" },
    { label: "Duyệt chấm công", matches: (key: string) => key === "attendance:review" },
    { label: "Duyệt điều chỉnh chấm công", matches: (key: string) => key === "attendance:correction:approve" },
  ] },
  { label: "Thông báo", rows: [
    { label: "Xem trang tổng quan", matches: (key: string) => key === "dashboard:read" },
    { label: "Xem thông báo cá nhân", matches: (key: string) => key === "notification:read" },
  ] },
  { label: "Dự án", rows: crudRows("project", "dự án", true) },
  { label: "Công việc", rows: crudRows("task", "công việc", true) },
  { label: "Tài liệu", rows: crudRows("document", "tài liệu", true) },
  { label: "Trò chuyện", rows: [
    { label: "Tạo cuộc trò chuyện", matches: (key: string) => key === "chat:create" },
    { label: "Xem cuộc trò chuyện", matches: (key: string) => key === "chat:read" },
  ] },
  { label: "Cài đặt", rows: [
    { label: "Xem cấu hình, tài khoản, nhật ký; xuất báo cáo", matches: (key: string) => ["settings:read", "branch:read", "integration:read", "rbac:read", "user:read", "audit:read", "report:export"].includes(key) },
    { label: "Sửa cấu hình và quản lý vai trò, tài khoản", matches: (key: string) => ["settings:update", "branch:create", "branch:update", "integration:create", "integration:update", "rbac:create", "rbac:update", "user:update", "user:manage-roles"].includes(key) },
    { label: "Xóa cấu hình, vai trò và tài khoản", matches: (key: string) => ["branch:delete", "integration:delete", "rbac:delete", "user:delete"].includes(key) },
  ] },
];

const scopeOptions: { value: PermissionScope; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "BRANCH", label: "Chi nhánh" },
  { value: "SELF", label: "Mình tôi" },
  { value: "NONE", label: "Không" },
];

const allOrNone = scopeOptions.filter((option) => option.value === "ALL" || option.value === "NONE");

function optionsForPermission(key: string) {
  if (
    key.startsWith("dashboard:") ||
    key.startsWith("candidate:") ||
    key.startsWith("attendance-policy:") ||
    key.startsWith("attendance-correction:") ||
    ["audit:", "report:", "rbac:", "user:", "settings:", "branch:", "integration:"].some((prefix) => key.startsWith(prefix))
  ) return allOrNone;
  if (key.startsWith("notification:") || key.startsWith("chat:")) {
    return scopeOptions.filter((option) => option.value === "SELF" || option.value === "NONE");
  }
  if (key === "leave:approve") {
    return scopeOptions.filter((option) => option.value !== "SELF");
  }
  if (["employee:read", "payroll:read", "attendance:read", "leave:read", "project:read", "task:read", "document:read"].includes(key)) {
    return scopeOptions;
  }
  return allOrNone;
}

function supportedScope(key: string, scope: PermissionScope | undefined): PermissionScope {
  return optionsForPermission(key).some((option) => option.value === scope) ? scope! : "NONE";
}

function roleDisplayName(name: string) {
  return ({ ADMIN: "Quản trị viên", HR: "Nhân sự", MANAGER: "Quản lý", EMPLOYEE: "Nhân viên" } as Record<string, string>)[name] ?? name;
}

export function RolePermissionsSettings() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { data: roles } = useRoles();
  const { data: permissions } = usePermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const { data: assignmentRules, isLoading: assignmentRulesLoading } = useRoleAssignmentRules();
  const replaceAssignmentRules = useReplaceRoleAssignmentRules();
  const savePermissions = useSetRolePermissions();
  const deleteRole = useDeleteRole();
  const [selected, setSelected] = useState<Role | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Record<string, PermissionScope>>({});
  const [savedScopes, setSavedScopes] = useState<Record<string, PermissionScope>>({});
  const [selectedRoleRules, setSelectedRoleRules] = useState<Omit<RoleAssignmentRule, "id" | "role">[]>([]);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canManageAssignmentRules = hasPermission("rbac:update") && hasPermission("rbac:read");
  useEffect(() => {
    if (!selected && roles?.[0]) setSelected(roles[0]);
  }, [roles, selected]);
  useEffect(
    () => {
      const scopes = Object.fromEntries(
        selected?.permissions.map(({ permission, scope }) => [permission.key, selected.name === "ADMIN" ? "ALL" : supportedScope(permission.key, scope)]) ?? [],
      );
      setSelectedScopes(scopes);
      setSavedScopes(scopes);
    },
    [selected],
  );
  useEffect(() => {
    if (isCreatingRole) return;
    setSelectedRoleRules(
      (assignmentRules ?? [])
        .filter((rule) => rule.roleId === selected?.id)
        .map(({ id, role, ...rule }) => rule),
    );
  }, [assignmentRules, isCreatingRole, selected?.id]);
  const grouped = useMemo(
    () => permissionGroups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => ({
        ...row,
        keys: (permissions ?? []).filter(({ key }) => row.matches(key)).map(({ key }) => key),
      })).filter((row) => row.keys.length),
    })).filter((group) => group.rows.length),
    [permissions],
  );
  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canManageAssignmentRules && (isCreatingRole || selected?.name !== "ADMIN") && !assignmentRules) return;
    const form = new FormData(event.currentTarget);
    const name = isCreatingRole
      ? String(form.get("name")).trim().toUpperCase()
      : selected?.isSystem ? selected.name : String(form.get("name")).trim().toUpperCase();
    if (!name || (!isCreatingRole && !selected)) return;
    if (isCreatingRole) {
      try {
        const created = await createRole.mutateAsync({ name });
        const newRules = selectedRoleRules.map((rule) => ({ ...rule, name, roleId: created.id }));
        const placeholderRole: Role = {
          id: created.id,
          name,
          isSystem: false,
          permissions: [],
          _count: { users: 0 },
        };
        setSelected(placeholderRole);
        setIsCreatingRole(false);
        setSelectedRoleRules(newRules);
        if (canManageAssignmentRules && newRules.length && assignmentRules) {
          const existingRules = assignmentRules.map(({ id, role, ...rule }) => rule);
          await replaceAssignmentRules.mutateAsync([...existingRules, ...newRules]);
        }
        setEditOpen(false);
      } catch {
        return;
      }
      return;
    }
    if (!selected) return;
    const saves: Promise<unknown>[] = [
      updateRole.mutateAsync({ id: selected.id, name }),
    ];
    if (canManageAssignmentRules && selected.name !== "ADMIN") {
      if (!assignmentRules) return;
      const otherRoleRules = assignmentRules
        .filter((rule) => rule.roleId !== selected.id)
        .map(({ id, role, ...rule }) => rule);
      const currentRoleRules = selectedRoleRules.map((rule) => ({
        ...rule,
        name,
        roleId: selected.id,
      }));
      saves.push(replaceAssignmentRules.mutateAsync([...otherRoleRules, ...currentRoleRules]));
    }
    Promise.all(saves).then(() => {
      setSelected((role) => (role ? { ...role, name } : role));
      setEditOpen(false);
    }).catch(() => undefined);
  };
  const canUpdate = hasPermission("rbac:update");
  const canCreate = hasPermission("rbac:create");
  const canDelete = hasPermission("rbac:delete");
  const canEditSelectedPermissions = canUpdate && selected?.name !== "ADMIN";
  const hasPermissionChanges = (permissions ?? []).some(({ key }) =>
    supportedScope(key, selectedScopes[key]) !== supportedScope(key, savedScopes[key]),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Vai trò & quyền</h2>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => {
            setIsCreatingRole(true);
            setSelectedRoleRules([]);
            setEditOpen(true);
          }}>
            <Plus /> Thêm vai trò
          </Button>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="max-h-[32rem] space-y-2 overflow-y-auto">
          {roles?.map((role) => (
            <button
              key={role.id}
              onClick={() => {
                if (selected?.id === role.id) return;
                if (hasPermissionChanges) {
                  setPendingRole(role);
                  return;
                }
                setSelected(role);
              }}
              className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${selected?.id === role.id ? "border-accent-purple bg-accent-purple/10" : "border-border bg-card hover:bg-canvas"}`}
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{roleDisplayName(role.name)}</span>
                {role.isSystem && <Badge tone="neutral">Hệ thống</Badge>}
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {role._count.users} nhân viên · {role.permissions.length} quyền
              </p>
            </button>
          ))}
        </aside>
        <section className="min-w-0 rounded-xl border border-border bg-card p-4">
          {selected && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{roleDisplayName(selected.name)}</h2>
                </div>
                <div className="flex gap-2">
                  {canUpdate && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil /> Sửa
                    </Button>
                  )}
                  {selected.name !== "ADMIN" && canDelete && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 /> Xóa
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {grouped.map((group) => (
                  <section key={group.label} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <h3 className="text-sm font-semibold">{group.label}</h3>
                      <span className="text-xs text-ink-muted">{group.rows.length} quyền</span>
                    </div>
                    <div className="divide-y divide-border px-4">
                      {group.rows.map(({ label, keys }) => {
                        const scopes = [...new Set(keys.map((key) => selected.name === "ADMIN" ? "ALL" : supportedScope(key, selectedScopes[key])))];
                        const scope = scopes.length === 1 ? scopes[0] : "MIXED";
                        const options = optionsForPermission(keys[0]);
                        return (
                          <div key={label} className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{label}</p>
                            </div>
                            <Select
                              className="w-full"
                              aria-label={`Phạm vi ${label}`}
                              value={scope}
                              disabled={!canEditSelectedPermissions}
                              onChange={(event) => setSelectedScopes((current) => ({
                                ...current,
                                ...Object.fromEntries(keys.map((key) => [key, supportedScope(key, event.target.value as PermissionScope)])),
                              }))}
                            >
                              {scope === "MIXED" && <option value="MIXED" disabled>Khác nhau</option>}
                              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              {canEditSelectedPermissions && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted" aria-live="polite">
                    {hasPermissionChanges ? "Có thay đổi chưa lưu." : "Quyền đã được lưu."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={!hasPermissionChanges || savePermissions.isPending}
                      onClick={() => setSelectedScopes({ ...savedScopes })}
                    >
                      Hoàn tác
                    </Button>
                    <Button
                      disabled={savePermissions.isPending || !hasPermissionChanges}
                      onClick={() => {
                        const nextScopes = Object.fromEntries(
                          (permissions ?? []).map(({ key }) => [key, supportedScope(key, selectedScopes[key])]),
                        );
                        savePermissions.mutate(
                          {
                            id: selected.id,
                            permissions: Object.entries(nextScopes).map(([key, scope]) => ({ key, scope })),
                          },
                          { onSuccess: () => setSavedScopes(nextScopes) },
                        );
                      }}
                    >
                      Lưu quyền
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Xóa vai trò"
        description={`Xóa vai trò ${selected ? roleDisplayName(selected.name) : ""}?`}
        pending={deleteRole.isPending}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          if (!selected) return;
          deleteRole.mutate(selected.id, {
            onSuccess: () => {
              setDeleteOpen(false);
              setSelected(null);
            },
          });
        }}
      />
      <Dialog open={!!pendingRole} onOpenChange={(open) => { if (!open) setPendingRole(null); }}>
        <DialogContent className="p-6">
          <DialogTitle>Quyền chưa được lưu</DialogTitle>
          <p className="mt-2 text-sm text-ink-muted">Bạn đã thay đổi phạm vi quyền. Nếu chuyển vai trò, các thay đổi này sẽ bị bỏ.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPendingRole(null)}>
              Tiếp tục chỉnh sửa
            </Button>
            <Button type="button" onClick={() => {
              if (pendingRole) setSelected(pendingRole);
              setPendingRole(null);
            }}>
              Bỏ thay đổi và chuyển
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) setIsCreatingRole(false);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-6">
          <DialogTitle>{isCreatingRole ? "Thêm vai trò" : "Sửa vai trò"}</DialogTitle>
          <form
            key={isCreatingRole ? "new-role" : selected?.id}
            className="mt-5 space-y-4"
            onSubmit={submitEdit}
          >
            <Input
              name="name"
              required
              pattern="[A-Za-z0-9_-]{2,40}"
              defaultValue={isCreatingRole ? "" : selected?.name}
              autoCapitalize="characters"
              disabled={!isCreatingRole && selected?.isSystem}
            />
            {canManageAssignmentRules && (isCreatingRole || selected?.name !== "ADMIN") && (
              <RoleAssignmentRulesSettings
                key={selected?.id ?? "new-role"}
                roleId={selected?.id ?? "new-role"}
                roleRules={selectedRoleRules}
                onChange={setSelectedRoleRules}
              />
            )}
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Hủy
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createRole.isPending || updateRole.isPending || replaceAssignmentRules.isPending || (canManageAssignmentRules && (isCreatingRole || selected?.name !== "ADMIN") && assignmentRulesLoading)}>
                {isCreatingRole ? "Tạo vai trò" : "Lưu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
