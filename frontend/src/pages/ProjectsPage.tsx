import { FolderPlus, Building2, ArrowLeft, Calendar, FileText, Layers } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createProject, getProjects } from '../api';
import AnimatedPage from '../components/ui/AnimatedPage';
import AnimatedCard from '../components/ui/AnimatedCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useAsync } from '../hooks/useAsync';

export default function ProjectsPage() {
  const { data: projects, loading, refetch } = useAsync(() => getProjects(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createProject(name.trim());
      setName('');
      setShowCreate(false);
      refetch();
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <AnimatedPage>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'Rubik, Heebo, sans-serif' }}>
            פרויקטים
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ניהול וניתוח כדאיות פרויקטי התחדשות עירונית
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <FolderPlus size={16} />
          פרויקט חדש
        </Button>
      </div>

      {!projects?.length ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="relative rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 backdrop-blur-sm py-20 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary-50 mx-auto mb-5 flex items-center justify-center">
            <Layers size={36} className="text-primary-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            אין פרויקטים עדיין
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            צור פרויקט חדש כדי להתחיל לנתח כדאיות התחדשות עירונית עם AI
          </p>
          <Button onClick={() => setShowCreate(true)} size="lg">
            <FolderPlus size={18} />
            צור פרויקט ראשון
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p, i) => (
            <AnimatedCard
              key={p.id}
              hover
              index={i}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="group"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200/60 flex items-center justify-center shrink-0 group-hover:from-primary-200 group-hover:to-primary-300/60 transition-colors duration-300">
                  <Building2 size={20} className="text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-800 truncate text-[15px]">{p.name}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Calendar size={12} />
                      {new Date(p.created_at).toLocaleDateString('he-IL')}
                    </span>
                    {p.simulations?.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary-500 font-medium">
                        <FileText size={12} />
                        {p.simulations.length} סימולציות
                      </span>
                    )}
                  </div>
                </div>
                <ArrowLeft size={16} className="text-slate-300 group-hover:text-primary-400 transition-colors mt-1 shrink-0" />
              </div>
            </AnimatedCard>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="פרויקט חדש">
        <div className="space-y-5">
          <Input
            label="שם הפרויקט"
            placeholder="לדוגמה: פרויקט התחדשות רחוב הרצל"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? <Spinner size={16} /> : 'צור פרויקט'}
            </Button>
          </div>
        </div>
      </Modal>
    </AnimatedPage>
  );
}
