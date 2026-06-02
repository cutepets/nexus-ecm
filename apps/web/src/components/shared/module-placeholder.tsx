import { Construction, type LucideIcon } from 'lucide-react';
import { PageHeader } from './page-header';
import { EmptyState } from './empty-state';

export interface ModulePlaceholderProps {
  title: string;
  description: string;
  /** Roadmap phase that delivers this module, shown in the empty state. */
  phase: string;
  icon?: LucideIcon;
}

/**
 * Temporary page used while the app shell (Phase 3) is in place but the
 * module's vertical slice hasn't been built yet. Keeps the shell navigable.
 */
export function ModulePlaceholder({ title, description, phase, icon }: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon ?? Construction}
        title="Modul ini sedang dibangun"
        description={`Akan tersedia pada ${phase}. Lihat docs/05-ROADMAP.md untuk rincian.`}
      />
    </div>
  );
}
