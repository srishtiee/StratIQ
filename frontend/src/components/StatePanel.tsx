import type { ReactNode } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';

interface StatePanelProps {
  title: string;
  body: string;
  icon?: ReactNode;
  tone?: 'empty' | 'error';
  actions?: ReactNode;
}

export default function StatePanel({
  title,
  body,
  icon,
  tone = 'empty',
  actions,
}: StatePanelProps) {
  const accent = tone === 'error'
    ? 'border-rose-500/25 bg-rose-500/8 text-rose-300'
    : 'border-blue-500/20 bg-blue-500/8 text-blue-200';

  return (
    <div className={`state-panel ${accent}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          {icon ?? (tone === 'error'
            ? <AlertTriangle className="h-5 w-5" />
            : <Sparkles className="h-5 w-5" />)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-[#f0f4ff]">{title}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#a4b5d8]">{body}</p>
          {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
