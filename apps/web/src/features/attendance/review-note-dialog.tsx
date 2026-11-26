"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ReviewNoteDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  noteLabel?: string;
  noteRequired?: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note?: string) => void;
}

/** Shared application dialog for approving, rejecting, or requesting more information. */
export function ReviewNoteDialog({
  open,
  title,
  description,
  confirmLabel,
  noteLabel,
  noteRequired = false,
  pending = false,
  onOpenChange,
  onConfirm,
}: ReviewNoteDialogProps) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) setNote("");
  }, [open]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = note.trim();
    if (noteRequired && !trimmed) return;
    onConfirm(trimmed || undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6">
        <DialogTitle className="text-lg font-semibold text-ink">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-muted">
          {description}
        </DialogDescription>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          {noteLabel ? (
            <label className="block text-sm font-medium text-ink">
              {noteLabel}
              {noteRequired ? <span className="text-red-600"> *</span> : null}
              <Textarea
                autoFocus
                value={note}
                onChange={(event) => setNote(event.target.value)}
                minLength={noteRequired ? 3 : undefined}
                maxLength={1000}
                placeholder="Nhập nội dung…"
                className="mt-2"
              />
            </label>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={pending || (noteRequired && !note.trim())}
            >
              {pending ? "Đang lưu…" : confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
