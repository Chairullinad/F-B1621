"use client";

import { useEffect, useId, useState } from "react";
import { CalendarRange, RotateCcw } from "lucide-react";

interface DateRangeFilterProps {
  startDate?: string;
  endDate?: string;
  onApply: (range: { startDate: string; endDate: string }) => void;
  onReset?: () => void;
  hasActiveCustomRange?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DateRangeFilter({
  startDate = "",
  endDate = "",
  onApply,
  onReset,
  hasActiveCustomRange = false,
  disabled = false,
  className = "",
}: DateRangeFilterProps) {
  const startId = useId();
  const endId = useId();
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);

  useEffect(() => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
  }, [startDate, endDate]);

  const canApply = Boolean(draftStart || draftEnd);
  const showReset = Boolean(hasActiveCustomRange || draftStart || draftEnd);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canApply || disabled) return;
    const resolvedStart = draftStart || draftEnd;
    const resolvedEnd = draftEnd || draftStart;
    if (resolvedStart <= resolvedEnd) {
      onApply({ startDate: resolvedStart, endDate: resolvedEnd });
    } else {
      onApply({ startDate: resolvedEnd, endDate: resolvedStart });
    }
  }

  function handleClear() {
    setDraftStart("");
    setDraftEnd("");
    onReset?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
    >
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 h-11 shadow-2xs">
        <CalendarRange className="h-4 w-4 text-slate-400 shrink-0" />
        <label htmlFor={startId} className="sr-only">
          Dari Tanggal
        </label>
        <input
          id={startId}
          type="date"
          aria-label="Dari tanggal"
          value={draftStart}
          disabled={disabled}
          onChange={(e) => setDraftStart(e.target.value)}
          className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
        />
        <span className="text-xs text-slate-400">–</span>
        <label htmlFor={endId} className="sr-only">
          Sampai Tanggal
        </label>
        <input
          id={endId}
          type="date"
          aria-label="Sampai tanggal"
          value={draftEnd}
          disabled={disabled}
          onChange={(e) => setDraftEnd(e.target.value)}
          className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
        />
      </div>

      <button
        type="submit"
        disabled={!canApply || disabled}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1E88E5] hover:bg-[#1976D2] disabled:opacity-45 px-3.5 text-xs font-semibold text-white transition cursor-pointer"
      >
        Terapkan
      </button>

      {showReset && onReset && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          title="Reset filter tanggal"
          className="inline-flex h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      )}
    </form>
  );
}
