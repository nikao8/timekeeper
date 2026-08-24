export type AuthUser = {
  id: string;
  email: string;
  role: 'FUNCIONARIO' | 'GESTOR';
  isActive: boolean;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    managerId: string | null;
    timezone: string;
    jobTitle: string | null;
  } | null;
};

const TOKEN_KEY = 'timekeeper.accessToken';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}
