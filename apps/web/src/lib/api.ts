import { getAccessToken, setAccessToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Success<T> = { success: true; data: T };
type Failure = { success: false; error: { code: string; message: string } };

async function parse<T>(res: Response): Promise<T> {
  if (res.headers.get('content-type')?.includes('spreadsheet')) {
    return (await res.blob()) as T;
  }
  const json = (await res.json()) as Success<T> | Failure;
  if (!res.ok || json.success === false) {
    const err = json as Failure;
    throw new ApiError(res.status, err.error?.code ?? 'ERROR', err.error?.message ?? 'Erro inesperado');
  }
  return (json as Success<T>).data;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    setAccessToken(null);
    return false;
  }
  const data = await parse<{ accessToken: string }>(res);
  setAccessToken(data.accessToken);
  return true;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const ok = await refreshPromise;
    if (ok) {
      return api<T>(path, init, false);
    }
  }

  if (path.includes('time-bank.xlsx')) {
    if (!res.ok) {
      throw new ApiError(res.status, 'REPORT_ERROR', 'Não foi possível gerar o relatório.');
    }
    return (await res.blob()) as T;
  }

  return parse<T>(res);
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
export const apiPatch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
export const apiPut = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });
