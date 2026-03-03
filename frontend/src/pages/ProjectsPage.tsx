import { FolderPlus, Building2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">פרויקטים</h1>
        <Button onClick={() => setShowCreate(true)}>
          <FolderPlus size={16} />
          פרויקט חדש
        </Button>
      </div>

      {!projects?.length ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-50" />
          <p>אין פרויקטים עדיין. צור פרויקט חדש כדי להתחיל.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <AnimatedCard key={p.id} hover index={i} onClick={() => navigate(`/projects/${p.id}`)}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                  <Building2 size={20} className="text-primary-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(p.created_at).toLocaleDateString('he-IL')}
                  </p>
                </div>
              </div>
            </AnimatedCard>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="פרויקט חדש">
        <div className="space-y-4">
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
