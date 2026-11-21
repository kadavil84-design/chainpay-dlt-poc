import { Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface InfoTooltipProps {
  title: string;
  content: string;
  align?: 'left' | 'right' | 'center';
}

export function InfoTooltip({ title, content, align = 'center' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const positionClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center align-middle ml-1.5"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Explain ${title}`}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-5 h-5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 transition-colors cursor-pointer"
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {open && (
        <span
          role="tooltip"
          className={`absolute z-40 bottom-full mb-2 w-72 p-3.5 rounded-lg bg-slate-900 text-slate-100 text-xs leading-relaxed shadow-lg border border-slate-800 pointer-events-none ${positionClass}`}
        >
          <span className="block font-display font-semibold text-white mb-1">{title}</span>
          <span className="block text-slate-300 font-normal">{content}</span>
        </span>
      )}
    </span>
  );
}
