import { getBusinessByOwner } from '../repositories/instrumentsRepo.js';
import { getInstrumentForBusiness, hasPendingApplication, insertApplication, findApplicationsByBusiness, findApplicationById } from '../repositories/applicationsRepo.js';
import { transaction } from '../db/index.js';
import { transition } from '../../shared/src/stateMachine.js'; // Rule 9: confirm submit uses transition()

export function createApplicationService(user: Express.Request['user'], data: { instrument_id: string, documents: Array<{ doc_type: string, file_name: string, file_hash: string }> }) {
  if (!user || user.role !== 'BUSINESS') throw new Error('Forbidden');
  
  const biz = getBusinessByOwner(user.id);
  if (!biz) throw new Error('Business profile not found');

  const instrument = getInstrumentForBusiness(data.instrument_id, biz.id);
  if (!instrument) throw new Error('Instrument not found or does not belong to you');

  if (hasPendingApplication(data.instrument_id)) {
    throw new Error('Pending application already exists for this instrument');
  }

  // Rule 9: confirm submit uses transition() 
  // It starts in DRAFT and transitions to SUBMITTED.
  transition('DRAFT', { type: 'submit' }); // Throws if invalid

  return transaction(() => {
    return insertApplication(biz.id, data.instrument_id, data.documents, user.id, instrument.type_code);
  });
}

export function listApplicationsService(user: Express.Request['user']) {
  if (!user || user.role !== 'BUSINESS') return [];
  
  const biz = getBusinessByOwner(user.id);
  if (!biz) return [];
  
  return findApplicationsByBusiness(biz.id);
}

export function getApplicationService(user: Express.Request['user'], id: string) {
  const app = findApplicationById(id);
  if (!app) throw new Error('Not found');

  if (user && user.role === 'BUSINESS') {
    const biz = getBusinessByOwner(user.id);
    if (!biz || app.business_id !== biz.id) throw new Error('Forbidden');
  }
  
  return app;
}
