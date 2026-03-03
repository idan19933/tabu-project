import { Building2, GitCompare, X } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useEffect } from 'react';

const NAV_ITEMS = [
  { to: '/', icon: Building2, label: 'פרויקטים' },
  { to: '/compare', icon: GitCompare, label: 'השוואה' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const location = useLocation();

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    onClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <aside
        className={clsx(
          'fixed inset-y-0 right-0 z-50 w-56 bg-slate-900 text-white flex flex-col shrink-0',
          'md:static md:z-auto',
        )}
      >
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">TabuApp</h1>
            <p className="text-xs text-slate-400 mt-0.5">ניהול פרויקטים</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700 cursor-pointer md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
