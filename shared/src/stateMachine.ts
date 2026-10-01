export type State = 'DRAFT' | 'SUBMITTED' | 'PAID' | 'SCHEDULED' | 'ACCEPTED' | 'INSPECTED_PASS' | 'CERTIFIED' | 'FAILED' | 'CANCELLED';

export type Event =
  | { type: 'submit' }
  | { type: 'payment_succeeded' }
  | { type: 'cancel' }
  | { type: 'schedule' }
  | { type: 'officer_accept' }
  | { type: 'officer_reject'; reason: string }
  | { type: 'inspection_pass' }
  | { type: 'inspection_fail'; reasons: string[] }
  | { type: 'issue_certificate' }
  | { type: 'admin_cancel' };

export function transition(currentState: State, event: Event): State {
  if (event.type === 'admin_cancel') {
    const preAccepted: State[] = ['DRAFT', 'SUBMITTED', 'PAID', 'SCHEDULED'];
    if (preAccepted.includes(currentState)) {
      return 'CANCELLED';
    }
    throw new Error(`Invalid transition: ${currentState} -> admin_cancel`);
  }

  switch (currentState) {
    case 'DRAFT':
      if (event.type === 'submit') return 'SUBMITTED';
      break;
    case 'SUBMITTED':
      if (event.type === 'payment_succeeded') return 'PAID';
      if (event.type === 'cancel') return 'CANCELLED';
      break;
    case 'PAID':
      if (event.type === 'schedule') return 'SCHEDULED';
      break;
    case 'SCHEDULED':
      if (event.type === 'officer_accept') return 'ACCEPTED';
      if (event.type === 'officer_reject') return 'PAID';
      break;
    case 'ACCEPTED':
      if (event.type === 'inspection_pass') return 'INSPECTED_PASS';
      if (event.type === 'inspection_fail') return 'FAILED';
      break;
    case 'INSPECTED_PASS':
      if (event.type === 'issue_certificate') return 'CERTIFIED';
      break;
  }
  throw new Error(`Invalid transition: ${currentState} -> ${event.type}`);
}
