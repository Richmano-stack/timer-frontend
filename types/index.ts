export type UserRole = 'admin' | 'supervisor' | 'user';

export interface User {
    id: string;
    username: string;
    role: UserRole;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    email: string;
    name: string;
}

export interface AuthResponse {
    user: User;
    token?: string;
}

// Updated to match backend StatusSchema
export type StatusType = 'available' | 'lunch_break' | 'on_production' | 'away' | 'meeting' | 'short_break' | 'training' | 'off_duty';

// Updated to match backend response (snake_case)
export interface Status {
    id: number; // Postman showed 323
    userId: string;
    statusName: StatusType; // Changed from status_name
    startTime: number;
    endTime?: number | null;
    durationMs: number;
}

export interface StatusHistoryItem extends Status {
    // user?: User; // Backend doesn't seem to return user in history endpoint yet, but keeping for future
}

export interface TeamStatus {
    id: string;
    username: string;
    current_status: StatusType;
    last_status_change: string;
}

export interface ApiError {
    message: string;
    statusCode: number;
}

export interface SummaryItem {
    status_name: StatusType;
    total_duration: string;
}

