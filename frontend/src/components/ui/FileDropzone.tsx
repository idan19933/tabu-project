import { Upload } from 'lucide-react';
import { useCallback, useState, type DragEvent } from 'react';
import { clsx } from 'clsx';

interface Props {
  onFile: (file: File) => void;
  accept?: string;
}

export default function FileDropzone({ onFile, accept = '.pdf' }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={clsx(
        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer',
        dragging ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-primary-400',
      )}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) onFile(file);
        };
        input.click();
      }}
    >
      <Upload size={32} className="text-slate-400" />
      <p className="text-sm text-slate-500">גרור קובץ PDF לכאן או לחץ לבחירה</p>
    </div>
  );
}
