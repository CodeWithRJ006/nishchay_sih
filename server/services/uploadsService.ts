import { getBusinessByOwner } from '../repositories/instrumentsRepo.js';
import { findApplicationByDocumentUrl } from '../repositories/uploadsRepo.js';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const storageDir = path.join(process.cwd(), 'storage');

export function saveUploadService(buf: Buffer) {
  let ext = '';
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    ext = '.jpg';
  } else if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    ext = '.png';
  } else if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    ext = '.pdf';
  } else {
    throw new Error('Invalid file type');
  }

  const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
  const fileName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const filePath = path.join(storageDir, fileName);
  
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
  fs.writeFileSync(filePath, buf);

  return { fileName, fileHash };
}

export function authorizeDownloadService(user: Express.Request['user'], fileName: string) {
  if (!/^[a-f0-9]{32}\.(jpg|png|pdf)$/.test(fileName)) {
    throw new Error('Invalid file name');
  }

  const app = findApplicationByDocumentUrl(fileName);
  if (!app) throw new Error('Not found');

  if (user && user.role === 'BUSINESS') {
    const biz = getBusinessByOwner(user.id);
    if (!biz || app.business_id !== biz.id) throw new Error('Forbidden');
  }
  
  const filePath = path.join(storageDir, fileName);
  if (!fs.existsSync(filePath)) throw new Error('Not found on disk');

  return filePath;
}
