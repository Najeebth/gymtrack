import { useToast } from '../context/ToastContext';

const COLORS: Record<string, string> = {
  success: 'bg-brand-success text-white',
  error: 'bg-brand-danger text-white',
  info: 'bg-brand-orange text-white'
};

// Fixed-position toast stack (bottom-right), themed to match the rest of
// the app instead of relying on a third-party toast library.
export default function ToastStack() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed bottom-5 right-5 z-[1000] flex flex-col gap-2 max-w-[320px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`px-3.5 py-2.5 rounded-lg text-sm font-semibold shadow-lg cursor-pointer ${
            COLORS[t.type] || COLORS.info
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
