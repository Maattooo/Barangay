export type UserRole = 'Admin' | 'Clerk' | 'Treasurer' | 'Lupon';

export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  official_id: number | null;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
