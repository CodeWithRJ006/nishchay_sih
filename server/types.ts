/* eslint-disable @typescript-eslint/no-namespace */
export interface UserSession {
  id: string;
  role: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
  }
}
