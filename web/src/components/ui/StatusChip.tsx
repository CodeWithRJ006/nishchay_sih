
type Status = 'Draft' | 'Submitted' | 'Paid' | 'Scheduled' | 'Accepted' | 'Certified' | 'Failed' | 'Valid' | 'Expired' | 'Revoked' | 'Seal broken';

export const StatusChip = ({ status }: { status: Status }) => {
  const colors: Record<Status, string> = {
    'Draft': 'bg-gray-200 text-ink',
    'Submitted': 'bg-blue-100 text-calibration-blue',
    'Paid': 'bg-blue-100 text-calibration-blue',
    'Scheduled': 'bg-blue-100 text-calibration-blue',
    'Accepted': 'bg-blue-100 text-calibration-blue',
    'Certified': 'bg-verified-green text-white',
    'Valid': 'bg-verified-green text-white',
    'Failed': 'bg-seal-break-red text-white',
    'Expired': 'bg-amber-100 text-[#8A5A00]',
    'Revoked': 'bg-seal-break-red text-white',
    'Seal broken': 'bg-seal-break-red text-white',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${colors[status]}`}>
      {status}
    </span>
  );
};
