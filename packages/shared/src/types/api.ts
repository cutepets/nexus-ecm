/** Standard API response envelope returned by the backend. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  avatarPortraitUrl?: string | null;
  avatarCropUrl?: string | null;
  roles: string[];
  permissions: string[];
  permissionScopes?: Record<string, 'ALL' | 'BRANCH' | 'SELF'>;
  /** Linked Employee id, when this user is also an employee (self-service). */
  employeeId?: string | null;
  mustChangePassword?: boolean;
}
