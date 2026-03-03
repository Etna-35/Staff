import type { Employee, EmployeeLoginOption, EmployeeRole } from '../types/domain';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  onUnauthorized?: () => void;
};

type BootstrapStatusResponse = {
  ok: boolean;
  bootstrapped: boolean;
};

type AuthResponse = {
  ok: boolean;
  sessionToken: string;
  employee: Employee;
};

type EmployeeListResponse = {
  ok: boolean;
  employees: Employee[] | EmployeeLoginOption[];
};

type EmployeeResponse = {
  ok: boolean;
  employee: Employee;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const getApiBaseUrl = () => {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configuredBase) {
    return configuredBase.replace(/\/$/, '');
  }

  return window.location.origin;
};

const request = async <T>(
  path: string,
  { method = 'GET', body, token, onUnauthorized }: RequestOptions = {},
) => {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response
    .json()
    .catch(() => ({ error: response.statusText || 'Request failed' }));

  if (response.status === 401) {
    onUnauthorized?.();
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof payload?.error === 'string' ? payload.error : 'Request failed',
    );
  }

  return payload as T;
};

export const apiClient = {
  getBootstrapStatus: () => request<BootstrapStatusResponse>('/api/bootstrap/status'),
  bootstrapOwner: (input: { fullName: string; pin: string }) =>
    request<AuthResponse>('/api/bootstrap', {
      method: 'POST',
      body: input,
    }),
  login: (input: { employeeId: string; pin: string }) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: input,
    }),
  logout: (token?: string | null) =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      token,
    }),
getLoginEmployees: () =>
  request<EmployeeListResponse>('/api/employees/public').then(
    (payload) => payload.employees as EmployeeLoginOption[],
  ),
  getEmployees: (token: string, includeArchived = false, onUnauthorized?: () => void) =>
    request<EmployeeListResponse>(
      `/api/employees${includeArchived ? '?includeArchived=1' : ''}`,
      {
        token,
        onUnauthorized,
      },
    ).then((payload) => payload.employees as Employee[]),
  getMe: (token: string, onUnauthorized?: () => void) =>
    request<EmployeeResponse>('/api/me', {
      token,
      onUnauthorized,
    }).then((payload) => payload.employee),
  updateMe: (
    token: string,
    input: {
      hourlyRate?: number | null;
      tenureLabel?: string | null;
    },
    onUnauthorized?: () => void,
  ) =>
    request<EmployeeResponse>('/api/me', {
      method: 'PATCH',
      token,
      body: input,
      onUnauthorized,
    }).then((payload) => payload.employee),
  createEmployee: (
    token: string,
    input: {
      fullName: string;
      role: Exclude<EmployeeRole, 'owner'>;
      positionTitle: string;
      pin: string;
      hourlyRate?: number | null;
      tenureLabel?: string;
    },
    onUnauthorized?: () => void,
  ) =>
    request<EmployeeResponse>('/api/employees', {
      method: 'POST',
      token,
      body: input,
      onUnauthorized,
    }).then((payload) => payload.employee),
  updateEmployee: (
    token: string,
    employeeId: string,
    input: {
      fullName?: string;
      role?: EmployeeRole;
      positionTitle?: string;
      isActive?: boolean;
      hourlyRate?: number | null;
      tenureLabel?: string | null;
    },
    onUnauthorized?: () => void,
  ) =>
    request<EmployeeResponse>(`/api/employees/${employeeId}`, {
      method: 'PATCH',
      token,
      body: input,
      onUnauthorized,
    }).then((payload) => payload.employee),
  resetEmployeePin: (
    token: string,
    employeeId: string,
    pin: string,
    onUnauthorized?: () => void,
  ) =>
    request<EmployeeResponse>(`/api/employees/${employeeId}/reset-pin`, {
      method: 'POST',
      token,
      body: { pin },
      onUnauthorized,
    }).then((payload) => payload.employee),
  deactivateEmployee: (token: string, employeeId: string, onUnauthorized?: () => void) =>
    request<EmployeeResponse>(`/api/employees/${employeeId}`, {
      method: 'DELETE',
      token,
      onUnauthorized,
    }).then((payload) => payload.employee),
};
cd ~/Desktop/EtnaStaff
git add .
git commit -m "Fix login employees endpoint"
git push

