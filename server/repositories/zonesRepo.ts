import { db } from '../db/index.js';

export interface Zone {
  id: string;
  code: string;
  name: string;
}

export function getAllZones(): Zone[] {
  return db.prepare('SELECT id, code, name FROM zones ORDER BY name ASC').all() as Zone[];
}
