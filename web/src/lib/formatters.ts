// Helper functions for consistent formatting across the app
export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  // Indian locale, abbreviated weekday, day, short month (e.g., "3 Sep 2026")
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
};

export const formatInr = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
