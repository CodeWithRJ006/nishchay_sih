// API client wrappers ensuring CSRF protection and consistent error handling

export class ApiError extends Error {
  constructor(public code: string, public message: string, public requestId?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function getCsrfToken(): string {
  // Extract token from cookie named "csrf" (fallback to empty string)
  const match = document.cookie.match(/(?:^|; )csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as unknown as Promise<T>;
  }
  return response.json().then((err) => {
    throw new ApiError(err.code ?? 'UNKNOWN_ERROR', err.message ?? 'Error', err.requestId);
  }) as unknown as Promise<T>;
}

export function get<T>(url: string): Promise<T> {
  return fetch(url, { credentials: 'include' }).then((r) => handleResponse<T>(r));
}

export function post<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    body: JSON.stringify(body),
  }).then((r) => handleResponse<T>(r));
}


export function put<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    body: JSON.stringify(body),
  }).then((r) => handleResponse<T>(r));
}


export function patch<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    body: JSON.stringify(body),
  }).then(handleResponse<T>);
}


export function del<T>(url: string): Promise<T> {
  return fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'x-csrf-token': getCsrfToken(),
    },
  }).then(handleResponse<T>);
}

export function upload<T>(url: string, form: FormData): Promise<T> {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'x-csrf-token': getCsrfToken(),
    },
    body: form,
  }).then(handleResponse<T>);
}
