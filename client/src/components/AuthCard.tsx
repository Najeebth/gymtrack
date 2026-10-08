import type { InputHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// Shared card + form pieces for the member and admin login screens.
export default function AuthCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-800/90 p-7 shadow-2xl">
      <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <Icon size={24} className="text-brand-orange" /> {title}
      </h1>
      <p className="text-sm text-slate-400 mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

export function AuthField({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-4">
      <span className="text-sm text-slate-300 block mb-1.5">{label}</span>
      <input
        {...input}
        className="w-full p-2.5 rounded-lg bg-slate-900/60 border border-white/15 text-white placeholder:text-slate-500 focus:border-brand-orange focus:outline-none"
      />
    </label>
  );
}

export function AuthNotice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  const colors =
    tone === 'error'
      ? 'bg-red-500/10 text-red-300 border-red-500/30'
      : 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={`p-2.5 rounded-lg mb-4 text-sm border ${colors}`}>
      {children}
    </div>
  );
}

export function AuthSubmit({ disabled, children }: { disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full mt-2 p-3 bg-brand-orange hover:bg-brand-orange-hover transition-colors text-white border-none rounded-lg font-semibold cursor-pointer flex justify-center items-center gap-1.5 disabled:opacity-70"
    >
      {children}
    </button>
  );
}
