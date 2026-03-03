import { useState } from 'react';
import { Upload, CheckCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { uploadDocument } from '../../api';
import Button from '../ui/Button';
import FileDropzone from '../ui/FileDropzone';
import Spinner from '../ui/Spinner';

const DOC_TYPES = [
  { value: 'tabu', label: 'נסח טאבו' },
  { value: 'planning', label: 'תב"ע' },
  { value: 'economic', label: 'דוח כלכלי' },
  { value: 'general', label: 'מסמך כללי' },
];

interface Props {
  projectId: string;
  defaultDocType?: string;
  onUploaded: () => void;
}

export default function InlineUpload({ projectId, defaultDocType, onUploaded }: Props) {
  const [docType, setDocType] = useState(defaultDocType || 'tabu');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(projectId, file, docType);
      setDone(true);
      setTimeout(() => {
        onUploaded();
        setDone(false);
        setFile(null);
      }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהעלאת הקובץ');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-200 p-6"
    >
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
            <p className="font-semibold text-emerald-700">הועלה בהצלחה!</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Doc type selector */}
            {!defaultDocType && (
              <div className="flex gap-2 mb-4">
                {DOC_TYPES.map((dt) => (
                  <button
                    key={dt.value}
                    onClick={() => setDocType(dt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      docType === dt.value
                        ? 'bg-primary-100 text-primary-700 border border-primary-300'
                        : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            )}

            <FileDropzone onFile={setFile} />

            {file && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <FileText size={16} />
                  <span className="truncate max-w-xs">{file.name}</span>
                  <span className="text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? <Spinner size={16} /> : <><Upload size={16} /> העלה</>}
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
