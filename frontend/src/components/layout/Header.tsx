import { Bell, Menu, Sparkles } from 'lucide-react';

interface Props {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: Props) {
  return (
    <header className="h-16 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} className="text-slate-600" />
      </button>

      <div className="flex items-center gap-2">
        {/* AI indicator chip */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-100">
          <Sparkles size={13} className="text-primary-500" />
          <span className="text-xs font-semibold text-primary-600">AI מופעל</span>
        </div>

        <button className="p-2 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors relative">
          <Bell size={18} className="text-slate-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-white" />
        </button>

        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-primary-500/20">
          א
        </div>
      </div>
    </header>
  );
}
