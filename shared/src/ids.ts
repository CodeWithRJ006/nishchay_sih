export const generateId = {
  instrument: (seq: number) => `NSH-I-${seq.toString().padStart(6, '0')}`,
  application: (year: number, seq: number) => `NSH-A-${year}-${seq.toString().padStart(6, '0')}`,
  receipt: (year: number, seq: number) => `NSH-R-${year}-${seq.toString().padStart(6, '0')}`,
  certificate: (year: number, seq: number) => `NSH-C-${year}-${seq.toString().padStart(6, '0')}`
};
