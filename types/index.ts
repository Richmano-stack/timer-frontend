export type UserRole = 'admin' | 'supervisor' | 'user';

export interface User {
    id: string;
    username: string;
    role: UserRole;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
}

export interface AuthResponse {
    user: User;
    token?: string; // If using tokens, though cookies are specified
}

export type StatusType = 'AVAILABLE' | 'BUSY' | 'BREAK' | 'OFFLINE' | 'MEETING';

export interface Status {
    id: string;
    userId: string;
    status: StatusType;
    startedAt: string;
    endedAt?: string;
    duration?: number; // in seconds
}

export interface StatusHistoryItem extends Status {
    user?: User;
}

export interface TeamStatus {
    userId: string;
    username: string;
    currentStatus: StatusType;
    lastStatusChange: string;
}

export interface ApiError {
    message: string;
    statusCode: number;
}
