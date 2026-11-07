export default function StaffLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top indeterminate progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-slate-200 overflow-hidden">
        <div className="h-full bg-[#3B7097] animate-[shimmer_1.5s_infinite] w-1/2 rounded-full" />
      </div>

      {/* Header skeleton */}
      <div className="h-28 rounded-2xl bg-slate-200/80" />

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-24 rounded-2xl bg-slate-200/70" />
        <div className="h-24 rounded-2xl bg-slate-200/70" />
        <div className="h-24 rounded-2xl bg-slate-200/70" />
        <div className="h-24 rounded-2xl bg-slate-200/70" />
      </div>

      {/* Main content table skeleton */}
      <div className="h-96 rounded-2xl bg-slate-200/60" />
    </div>
  );
}

