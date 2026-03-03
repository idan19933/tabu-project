import { Bell, Menu } from 'lucide-react';

interface Props {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: Props) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} className="text-slate-600" />
      </button>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
          <Bell size={18} className="text-slate-500" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
          א
        </div>
      </div>
    </header>
  );
}
