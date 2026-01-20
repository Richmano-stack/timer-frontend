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
    token?: string;
}

// Updated to match backend StatusSchema
export type StatusType = 'available' | 'lunch_break' | 'on_production' | 'away' | 'meeting' | 'short_break' | 'training' | 'off_duty';

// Updated to match backend response (snake_case)
export interface Status {
    id: string;
    user_id: string;
    status_name: StatusType;
    start_time: string; // Backend returns string (bigint) or number
    end_time?: string | null;
    duration_ms?: number;
}

export type StatusHistoryItem = Status;

export interface SummaryItem {
    status_name: string;
    total_duration: string;
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

