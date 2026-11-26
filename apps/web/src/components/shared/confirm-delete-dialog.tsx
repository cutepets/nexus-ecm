"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDeleteDialog({
  open,
  title = "Xác nhận xóa",
  description,
  pending = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title?: string;
  description: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
        <DialogDescription className="mt-2">{description}</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Đang xóa…" : "Xóa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
