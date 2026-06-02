'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { NAV_ITEMS } from '@/lib/nav';
import { useAuthStore } from '@/stores/auth-store';
import { globalSearch, type SearchHit } from '@/features/dashboard/api';

const TYPE_LABEL: Record<string, string> = {
  employee: 'Karyawan',
  project: 'Proyek',
  task: 'Tugas',
  document: 'Dokumen',
  customer: 'Pelanggan',
};

/**
 * Global command palette. Opens with ⌘K / Ctrl+K and lets the user jump
 * to any module they have access to. Search backends are wired in Phase 13.
 */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const items = NAV_ITEMS.filter((i) => !i.permission || hasPermission(i.permission));

  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<SearchHit[]>([]);

  // Debounced global search across entities.
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      globalSearch(query).then(setHits).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Pencarian global</DialogTitle>
        <Command shouldFilter={false} className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border">
          <div className="flex items-center gap-2 px-4" cmdk-input-wrapper="">
            <Search className="size-4 text-ink-subtle" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Cari modul, karyawan, proyek, tugas…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-ink-subtle"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-ink-subtle">
              Tidak ada hasil.
            </Command.Empty>

            {hits.length > 0 && (
              <Command.Group
                heading="Hasil Pencarian"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-subtle"
              >
                {hits.map((hit) => (
                  <Command.Item
                    key={`${hit.type}-${hit.id}`}
                    value={`${hit.type}-${hit.id}-${hit.title}`}
                    onSelect={() => go(hit.href)}
                    className="flex cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-muted data-[selected=true]:bg-canvas data-[selected=true]:text-ink"
                  >
                    <span>{hit.title}{hit.subtitle ? ` · ${hit.subtitle}` : ''}</span>
                    <span className="text-xs text-ink-subtle">{TYPE_LABEL[hit.type] ?? hit.type}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading="Navigasi"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-subtle"
            >
              {items.map((item) => (
                <Command.Item
                  key={item.href}
                  value={item.label}
                  onSelect={() => go(item.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-muted data-[selected=true]:bg-canvas data-[selected=true]:text-ink"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
