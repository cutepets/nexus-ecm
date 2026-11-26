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
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import {
  useCreateRole,
  useDeleteRole,
  usePermissions,
  useRoles,
  useSetRolePermissions,
  useUpdateRole,
  type Role,
} from "@/features/rbac/api";
import { useAuthStore } from "@/stores/auth-store";
import { RoleAssignmentRulesSettings } from "./role-assignment-rules-settings";

export function RolePermissionsSettings() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { data: roles } = useRoles();
  const { data: permissions } = usePermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const savePermissions = useSetRolePermissions();
  const deleteRole = useDeleteRole();
  const [selected, setSelected] = useState<Role | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  useEffect(() => {
    if (!selected && roles?.[0]) setSelected(roles[0]);
  }, [roles, selected]);
  useEffect(
    () =>
      setSelectedKeys(
        selected?.permissions.map(({ permission }) => permission.key) ?? [],
      ),
    [selected],
  );
  const grouped = useMemo(
    () =>
      (permissions ?? []).reduce<Record<string, string[]>>(
        (all, permission) => {
          (all[permission.module] ??= []).push(permission.key);
          return all;
        },
        {},
      ),
    [permissions],
  );
  const toggle = (permission: string) =>
    setSelectedKeys((keys) =>
      keys.includes(permission)
        ? keys.filter((key) => key !== permission)
        : [...keys, permission],
    );
  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createRole.mutate(
      {
        name: String(form.get("name")).trim().toUpperCase(),
        description: String(form.get("description")).trim() || undefined,
      },
      { onSuccess: () => setCreateOpen(false) },
    );
  };
  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const name = selected.isSystem
      ? selected.name
      : String(form.get("name")).trim().toUpperCase();
    const description = String(form.get("description")).trim() || undefined;
    updateRole.mutate(
      { id: selected.id, name, description },
      {
        onSuccess: () => {
          setSelected((role) => (role ? { ...role, name, description } : role));
          setEditOpen(false);
        },
      },
    );
  };
  const canUpdate = hasPermission("rbac:update");
  const canCreate = hasPermission("rbac:create");
  const canDelete = hasPermission("rbac:delete");
  const canEditSelectedPermissions = canUpdate && selected?.name !== "ADMIN";
  const canManageAssignmentRules = canUpdate && hasPermission("rbac:read");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Vai trò & quyền</h2>
          <p className="mt-1 text-sm text-ink-muted">Quản lý vai trò và quyền truy cập.</p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus /> Thêm vai trò
          </Button>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="max-h-[32rem] space-y-2 overflow-y-auto">
          {roles?.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelected(role)}
              className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${selected?.id === role.id ? "border-accent-purple bg-accent-purple/10" : "border-border bg-card hover:bg-canvas"}`}
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{role.name}</span>
                {role.isSystem && <Badge tone="neutral">System</Badge>}
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
                  <h2 className="font-medium">{selected.name}</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {selected.description || "Chưa có mô tả"}
                  </p>
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
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(grouped).map(([module, keys]) => (
                  <fieldset
                    key={module}
                    className="rounded-xl border border-border p-3"
                  >
                    <legend className="px-1 text-sm font-medium">
                      {module}
                    </legend>
                    {keys.map((permission) => (
                      <label
                        key={permission}
                        className="mt-2 flex gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                      disabled={!canEditSelectedPermissions}
                          checked={selectedKeys.includes(permission)}
                          onChange={() => toggle(permission)}
                        />
                        <span>{permission.split(":")[1]}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
              {canEditSelectedPermissions && (
                <div className="mt-6 flex justify-end">
                  <Button
                    disabled={savePermissions.isPending}
                    onClick={() =>
                      savePermissions.mutate({
                        id: selected.id,
                        permissionKeys: selectedKeys,
                      })
                    }
                  >
                    Lưu
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      {canManageAssignmentRules && <RoleAssignmentRulesSettings />}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Xóa role"
        description={`Xóa role ${selected?.name ?? ""}?`}
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="p-6">
          <DialogTitle>Thêm role tùy chỉnh</DialogTitle>
          <form className="mt-5 space-y-4" onSubmit={submitCreate}>
            <Input
              name="name"
              required
              pattern="[A-Za-z0-9_-]{2,40}"
              placeholder="AUDITOR"
              autoCapitalize="characters"
            />
            <Input name="description" placeholder="Mô tả vai trò" />
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Hủy
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createRole.isPending}>
                Tạo role
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="p-6">
          <DialogTitle>Sửa role</DialogTitle>
          <form
            key={selected?.id}
            className="mt-5 space-y-4"
            onSubmit={submitEdit}
          >
            <Input
              name="name"
              required
              pattern="[A-Za-z0-9_-]{2,40}"
              defaultValue={selected?.name}
              autoCapitalize="characters"
              disabled={selected?.isSystem}
            />
            <Input
              name="description"
              defaultValue={selected?.description ?? ""}
              placeholder="Mô tả vai trò"
            />
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Hủy
                </Button>
              </DialogClose>
              <Button type="submit" disabled={updateRole.isPending}>
                Lưu
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
