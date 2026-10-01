
export const Toast = ({ message, type = 'info' }: { message: string, type?: 'info' | 'error' | 'success' }) => {
  const colors = {
    info: 'bg-calibration-blue',
    error: 'bg-seal-break-red',
    success: 'bg-verified-green'
  };
  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow-lg text-white font-medium text-sm z-50 ${colors[type]}`}>
      {message}
    </div>
  );
};
