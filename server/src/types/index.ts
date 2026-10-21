export type UserRole = 'Admin' | 'Clerk' | 'Treasurer' | 'Lupon';

export interface UserPayload {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  official_id: number | null;
}

export interface UserResponse {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  official_id: number | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

declare global {
  namespace Express {
    interface Request {
      clientIp?: string;
      user?: UserPayload;
    }
  }
}

export * from './audit';
