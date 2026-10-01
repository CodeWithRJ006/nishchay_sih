import { getBusinessByOwner, insertInstrument, findInstrumentsByBusiness, findInstrumentById } from '../repositories/instrumentsRepo.js';
import { transaction } from '../db/index.js';

export function registerInstrumentService(user: Express.Request['user'], data: { type_code: string, make: string, model: string, capacity: string, serial: string, accuracy_class?: string, location?: string }) {
  if (!user || user.role !== 'BUSINESS') throw new Error('Forbidden');
  
  const biz = getBusinessByOwner(user.id);
  if (!biz) throw new Error('Business profile not found');

  return transaction(() => {
    return insertInstrument(biz.id, data, user.id);
  });
}

export function listInstrumentsService(user: Express.Request['user']) {
  if (!user || user.role !== 'BUSINESS') throw new Error('Forbidden');
  
  const biz = getBusinessByOwner(user.id);
  if (!biz) return [];
  
  return findInstrumentsByBusiness(biz.id);
}

export function getInstrumentService(user: Express.Request['user'], id: string) {
  const instrument = findInstrumentById(id);
  if (!instrument) throw new Error('Not found');

  if (user && user.role === 'BUSINESS') {
    const biz = getBusinessByOwner(user.id);
    if (!biz || instrument.business_id !== biz.id) throw new Error('Forbidden');
  }
  
  return instrument;
}
