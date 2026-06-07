import { AlertTriangle } from 'lucide-react';
import { useT } from '@/contexts/I18nContext';
import type { DuplicateMatch, Project } from '@/types/project';

interface Props {
  project: Project;
}

export default function DuplicateWarningBanner({ project }: Props) {
  const { t } = useT();
  const matches = project.duplicate_matches ?? [];
  if (!project.is_duplicate_flag && matches.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start gap-2 font-medium">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div>
          <p>{t('workflow.duplicateWarning')}</p>
          {project.duplicate_reason && (
            <p className="mt-1 font-normal opacity-90">{project.duplicate_reason}</p>
          )}
          {matches.length > 0 && (
            <ul className="mt-2 list-disc pl-5 font-normal">
              {matches.map((m: DuplicateMatch) => (
                <li key={m.project_id}>
                  {m.project_code} — {m.project_name} ({m.reason})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
