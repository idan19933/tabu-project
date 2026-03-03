import { Building2, GitCompare, X, Layers } from 'lucide-react';
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
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <aside
        className={clsx(
          'fixed inset-y-0 right-0 z-50 w-60 sidebar-gradient text-white flex flex-col shrink-0',
          'md:static md:z-auto',
        )}
      >
        {/* Logo area */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Layers size={18} className="text-primary-200" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight" style={{ fontFamily: 'Rubik, Heebo, sans-serif' }}>
                TabuApp
              </h1>
              <p className="text-[10px] text-primary-300 font-medium -mt-0.5">
                פלטפורמת התחדשות עירונית
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer md:hidden transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white/15 text-white shadow-lg shadow-black/10 backdrop-blur-sm'
                    : 'text-primary-200 hover:bg-white/8 hover:text-white',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom decorative element */}
        <div className="p-4 border-t border-white/10">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-[11px] text-primary-300 font-medium">גרסה 1.0</p>
            <p className="text-[10px] text-primary-400/60 mt-0.5">ניתוח כדאיות מבוסס AI</p>
          </div>
        </div>
      </aside>
    </>
  );
}
