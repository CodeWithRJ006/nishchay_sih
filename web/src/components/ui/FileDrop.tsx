import React, { useState } from 'react';

type FileDropProps = {
  onFileChange: (file: File | null) => void;
  accept?: string;
  error?: boolean;
};

export const FileDrop = ({ onFileChange, accept, error }: FileDropProps) => {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      onFileChange(selected);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      onFileChange(selected);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed p-4 rounded flex flex-col items-center justify-center text-sm min-h-[100px] transition-colors cursor-pointer relative ${drag ? 'border-calibration-blue bg-blue-50' : error ? 'border-seal-break-red' : 'border-gray-300'} hover:bg-gray-50`}
    >
      <input type="file" aria-label="File upload" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" accept={accept} onChange={handleChange} />
      {file ? (
        <span className="font-medium text-ink">{file.name}</span>
      ) : (
        <span className="text-gray-500">Drag & drop or click to upload</span>
      )}
    </div>
  );
};
