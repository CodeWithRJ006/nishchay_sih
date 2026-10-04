// API client wrappers ensuring CSRF protection and consistent error handling

export class ApiError extends Error {
  constructor(public code: string, public message: string, public requestId?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function getCsrfToken(): string {
  // Extract token from cookie named "csrf" (fallback to standard token)
  const match = document.cookie.match(/(?:^|; )csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : 'nsh-csrf-active';
}

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (response.ok) {
    return parsed as T;
  }

  const errObj = (parsed && typeof parsed === 'object') ? (parsed as Record<string, unknown>) : {};
  const code = typeof errObj.code === 'string' ? errObj.code : typeof errObj.error === 'string' ? errObj.error : `HTTP_${response.status}`;
  const message = typeof errObj.message === 'string' ? errObj.message : typeof errObj.error === 'string' ? errObj.error : (typeof text === 'string' && text ? text : response.statusText || 'Request failed');
  const requestId = typeof errObj.requestId === 'string' ? errObj.requestId : undefined;

  throw new ApiError(code, message, requestId);
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
