import { User } from 'lucide-react';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export default function ProfilPage() {
  return (
    <ModulePlaceholder
      icon={User}
      title="Profil"
      description="Kelola informasi akun dan keamanan Anda."
      phase="Fase 13 — Cross-cutting"
    />
  );
}
