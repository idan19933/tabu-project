import { ArrowRight, CheckCircle, FileUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { uploadDocument } from '../api';
import Button from '../components/ui/Button';
import FileDropzone from '../components/ui/FileDropzone';
import Spinner from '../components/ui/Spinner';

const DOC_TYPES = [
  { value: 'tabu', label: 'נסח טאבו' },
  { value: 'planning', label: 'תוכנית בניין עיר (תב"ע)' },
  { value: 'economic', label: 'דוח כלכלי / שמאות' },
  { value: 'general', label: 'מסמך כללי' },
];

export default function DocumentUploadPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('tabu');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleUpload = async () => {
    if (!file || !projectId) return;
    setUploading(true);
    try {
      await uploadDocument(projectId, file, docType);
      setDone(true);
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <CheckCircle size={48} className="text-emerald-500" />
        <h2 className="text-xl font-semibold">המסמך הועלה בהצלחה</h2>
        <p className="text-sm text-slate-500">
          {docType !== 'tabu' ? 'חילוץ נתונים בעזרת AI מתבצע ברקע...' : 'נתוני הנכס מעובדים...'}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => { setFile(null); setDone(false); }}>
            העלאת מסמך נוסף
          </Button>
          <Button onClick={() => navigate(`/projects/${projectId}`)}>
            חזרה לפרויקט
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <button
        onClick={() => navigate(`/projects/${projectId}`)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 mb-4 cursor-pointer transition-colors"
      >
        <ArrowRight size={16} />
        חזרה לפרויקט
      </button>
      <h1 className="text-2xl font-bold mb-6">העלאת מסמך</h1>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">סוג המסמך</label>
          <div className="grid grid-cols-2 gap-2">
            {DOC_TYPES.map((dt) => (
              <button
                key={dt.value}
                onClick={() => setDocType(dt.value)}
                className={`rounded-lg border px-4 py-3 text-sm text-right transition-all cursor-pointer ${
                  docType === dt.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>
        </div>

        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
            <FileUp size={20} className="text-primary-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-slate-400 hover:text-red-500 cursor-pointer"
            >
              הסר
            </button>
          </div>
        ) : (
          <FileDropzone onFile={setFile} />
        )}

        <Button onClick={handleUpload} disabled={!file || uploading} className="w-full" size="lg">
          {uploading ? <Spinner size={18} /> : 'העלה מסמך'}
        </Button>
      </div>
    </div>
  );
}
