import { getAllZones, Zone } from '../repositories/zonesRepo.js';

export function listZones(): Zone[] {
  return getAllZones();
}
