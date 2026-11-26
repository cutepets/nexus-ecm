"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, LocateFixed, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth-store";
import {
  type Branch,
  type CreateBranch,
  useBranches,
  useCreateBranch,
  useDeleteBranch,
  useReorderBranches,
  useUpdateBranch,
} from "./api";

const emptyBranch: CreateBranch = {
  code: "",
  name: "",
  address: "",
  latitude: 0,
  longitude: 0,
  radiusMeters: 100,
  isActive: true,
};
const toForm = (branch: Branch): CreateBranch => ({
  code: branch.code,
  name: branch.name,
  address: branch.address ?? "",
  latitude: branch.latitude,
  longitude: branch.longitude,
  radiusMeters: branch.radiusMeters,
  isActive: branch.isActive,
});

function getCurrentLocation(
  setForm: (update: (form: CreateBranch) => CreateBranch) => void,
  setError: (message: string) => void,
) {
  if (!navigator.geolocation) {
    setError("Trình duyệt không hỗ trợ định vị.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) =>
      setForm((form) => ({
        ...form,
        latitude: Number(coords.latitude.toFixed(6)),
        longitude: Number(coords.longitude.toFixed(6)),
      })),
    () => setError("Không lấy được vị trí. Hãy cấp quyền Vị trí rồi thử lại."),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
  );
}

export function BranchSettings() {
  const [form, setForm] = useState<CreateBranch>(emptyBranch);
  const [locationError, setLocationError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: branches, isLoading } = useBranches();
  const create = useCreateBranch();
  const reorder = useReorderBranches();
  const canCreate = useAuthStore((state) => state.hasPermission("branch:create"));
  const canUpdate = useAuthStore((state) => state.hasPermission("branch:update"));
  const canDelete = useAuthStore((state) => state.hasPermission("branch:delete"));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(form, {
      onSuccess: () => {
        setForm(emptyBranch);
        setLocationError("");
        setCreateOpen(false);
      },
    });
  };
  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl bg-blue-100 p-2 text-blue-700">
            <MapPin className="size-5" />
          </span>
          <h2 className="font-semibold text-ink">Chi nhánh và điểm chấm</h2>
        </div>
        {canCreate && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus /> Thêm chi nhánh</Button>}
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto p-5 sm:p-6">
          <DialogTitle>Thêm chi nhánh</DialogTitle>
          <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
        <Input
          required
          placeholder="Mã chi nhánh, ví dụ HN-01"
          value={form.code}
          onChange={(event) =>
            setForm({ ...form, code: event.target.value.toUpperCase() })
          }
        />
        <Input
          required
          placeholder="Tên chi nhánh"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          className="sm:col-span-2"
          placeholder="Địa chỉ"
          value={form.address ?? ""}
          onChange={(event) =>
            setForm({ ...form, address: event.target.value })
          }
        />
        <Input
          required
          type="number"
          step="any"
          placeholder="Vĩ độ"
          value={form.latitude || ""}
          onChange={(event) =>
            setForm({ ...form, latitude: Number(event.target.value) })
          }
        />
        <Input
          required
          type="number"
          step="any"
          placeholder="Kinh độ"
          value={form.longitude || ""}
          onChange={(event) =>
            setForm({ ...form, longitude: Number(event.target.value) })
          }
        />
        <Button
          type="button"
          variant="secondary"
          className="sm:col-span-2"
          onClick={() => getCurrentLocation(setForm, setLocationError)}
        >
          <LocateFixed /> Lấy vị trí hiện tại
        </Button>
        <label className="space-y-1">
          <span className="text-sm font-medium text-ink">
            Bán kính chấm công (m)
          </span>
          <Input
            required
            type="number"
            min={10}
            max={10000}
            value={form.radiusMeters}
            onChange={(event) =>
              setForm({ ...form, radiusMeters: Number(event.target.value) })
            }
          />
        </label>
        {locationError && <p className="text-sm text-red-600 sm:col-span-2">{locationError}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={create.isPending}>Hủy</Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Đang lưu…" : "Lưu chi nhánh"}
          </Button>
        </div>
          </form>
        </DialogContent>
      </Dialog>
      <div className="mt-5 space-y-2">
        {isLoading ? (
          <p className="text-sm text-ink-muted">Đang tải…</p>
        ) : branches?.length ? (
          branches.map((branch, index) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canMoveUp={index > 0}
              canMoveDown={index < branches.length - 1}
              reordering={reorder.isPending}
              onMove={(offset) => {
                const target = index + offset;
                if (target < 0 || target >= branches.length) return;
                const ordered = [...branches];
                [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
                reorder.mutate(ordered.map((item) => item.id));
              }}
            />
          ))
        ) : (
          <p className="text-sm text-ink-muted">Chưa có chi nhánh.</p>
        )}
      </div>
    </section>
  );
}

function BranchCard({ branch, canUpdate, canDelete, canMoveUp, canMoveDown, reordering, onMove }: {
  branch: Branch;
  canUpdate: boolean;
  canDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reordering: boolean;
  onMove: (offset: -1 | 1) => void;
}) {
  const update = useUpdateBranch(branch.id);
  const remove = useDeleteBranch();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CreateBranch>(() => toForm(branch));
  useEffect(() => {
    if (!editing) setForm(toForm(branch));
  }, [branch, editing]);
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    update.mutate(form, {
      onSuccess: () => setEditing(false),
      onError: () => setError("Không thể lưu chi nhánh."),
    });
  };
  return (
    <>
      <div className="rounded-xl border border-border p-3 text-sm">
        {editing && canUpdate ? (
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto p-5 sm:p-6">
              <DialogTitle>Sửa chi nhánh</DialogTitle>
              <form onSubmit={save} className="mt-5 grid gap-3 sm:grid-cols-2">
            <Input
              required
              value={form.code}
              onChange={(event) =>
                setForm({ ...form, code: event.target.value.toUpperCase() })
              }
            />
            <Input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
            <Input
              className="sm:col-span-2"
              value={form.address ?? ""}
              onChange={(event) =>
                setForm({ ...form, address: event.target.value })
              }
            />
            <Input
              required
              type="number"
              step="any"
              value={form.latitude}
              onChange={(event) =>
                setForm({ ...form, latitude: Number(event.target.value) })
              }
            />
            <Input
              required
              type="number"
              step="any"
              value={form.longitude}
              onChange={(event) =>
                setForm({ ...form, longitude: Number(event.target.value) })
              }
            />
            <Button
              type="button"
              variant="secondary"
              className="sm:col-span-2"
              onClick={() => getCurrentLocation(setForm, setError)}
            >
              <LocateFixed /> Lấy vị trí hiện tại
            </Button>
            <label className="space-y-1">
              <span className="text-xs text-ink-muted">
                Bán kính chấm công (m)
              </span>
              <Input
                required
                type="number"
                min={10}
                max={10000}
                value={form.radiusMeters}
                onChange={(event) =>
                  setForm({ ...form, radiusMeters: Number(event.target.value) })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
              />{" "}
              Đang hoạt động
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={update.isPending}>
                Lưu
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setForm(toForm(branch));
                  setEditing(false);
                }}
              >
                Hủy
              </Button>
            </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium text-ink">
                {branch.name}{" "}
                <span className="text-ink-subtle">· {branch.code}</span>
                {!branch.isActive && (
                  <span className="ml-2 text-amber-700">Ngừng hoạt động</span>
                )}
              </div>
              <div className="mt-1 text-ink-muted">
                {branch.address || "Chưa có địa chỉ"} ·{" "}
                {branch.latitude.toFixed(5)}, {branch.longitude.toFixed(5)} ·
                bán kính {branch.radiusMeters} m
              </div>
            </div>
            <div className="flex gap-1">
              {canUpdate && <>
              <Button type="button" size="icon" variant="ghost" aria-label={`Đưa ${branch.name} lên trên`} disabled={!canMoveUp || reordering} onClick={() => onMove(-1)}><ArrowUp /></Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`Đưa ${branch.name} xuống dưới`} disabled={!canMoveDown || reordering} onClick={() => onMove(1)}><ArrowDown /></Button>
              </>}
              {canUpdate && <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Sửa chi nhánh"
                onClick={() => setEditing(true)}
              >
                <Pencil />
              </Button>}
              {canDelete && <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Xóa chi nhánh"
                disabled={remove.isPending}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
              </Button>}
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Xóa chi nhánh"
        description={`Xóa chi nhánh “${branch.name}”?`}
        pending={remove.isPending}
        onOpenChange={setDeleteOpen}
        onConfirm={() =>
          remove.mutate(branch.id, {
            onSuccess: () => setDeleteOpen(false),
            onError: () =>
              setError(
                "Chi nhánh đã có dữ liệu liên quan; hãy chuyển sang ngừng hoạt động.",
              ),
          })
        }
      />
    </>
  );
}
