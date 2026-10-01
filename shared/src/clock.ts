let mockNow: number | null = null;

export const clock = {
  now: () => mockNow !== null ? mockNow : Date.now(),
  setMock: (timeMs: number) => { mockNow = timeMs; },
  resetMock: () => { mockNow = null; }
};
