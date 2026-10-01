import { Request, Response } from 'express';
import multer from 'multer';
import { saveUploadService, authorizeDownloadService } from '../services/uploadsService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

export const uploadMiddleware = upload.single('file');
export const uploadMultipleMiddleware = upload.array('files', 10);

export function handleUpload(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  try {
    const result = saveUploadService(req.file.buffer);
    res.status(201).json(result);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Invalid file type') {
      return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG, and PDF are allowed.' });
    }
    throw err;
  }
}

export function downloadDocument(req: Request, res: Response) {
  try {
    const filePath = authorizeDownloadService(req.user, req.params.fileName);
    res.sendFile(filePath);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Invalid file name') return res.status(400).json({ message: 'Invalid file name' });
    if (error.message === 'Not found') return res.status(404).json({ message: 'Document not found' });
    if (error.message === 'Forbidden') return res.status(403).json({ message: 'Forbidden' });
    if (error.message === 'Not found on disk') return res.status(404).json({ message: 'File not found on disk' });
    throw err;
  }
}
