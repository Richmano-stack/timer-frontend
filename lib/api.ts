const IS_SERVER = typeof window === 'undefined';
const API_URL = IS_SERVER
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
    : (process.env.NEXT_PUBLIC_API_URL || '');

interface FetchOptions extends RequestInit {
    headers?: Record<string, string>;
}

export interface ApiEnvelope<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export class ApiError extends Error {
    public statusCode: number;
    public code?: string;

    constructor(message: string, statusCode: number, code?: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'ApiError';
    }
}

export function parseApiResponse<T>(payload: ApiEnvelope<T>): T {
    if (!payload.success) {
        throw new ApiError(
            payload.error?.message || 'Request failed',
            400,
            payload.error?.code
        );
    }

    return payload.data as T;
}

async function fetcher<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const url = `${API_URL}${endpoint}`;

    const config: RequestInit = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, config);
        const payload = await response.json().catch(() => null);

        if (payload && typeof payload === 'object' && 'success' in payload) {
            if (!response.ok || payload.success === false) {
                throw new ApiError(
                    payload.error?.message || response.statusText,
                    response.status,
                    payload.error?.code
                );
            }

            return payload.data as T;
        }

        if (!response.ok) {
            let errorMessage = 'An error occurred';
            if (payload && typeof payload === 'object' && 'message' in payload) {
                errorMessage = (payload as { message?: string }).message || response.statusText;
            } else {
                errorMessage = response.statusText;
            }

            throw new ApiError(errorMessage, response.status);
        }

        if (response.status === 204) {
            return {} as T;
        }

        return payload as T;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new Error(error instanceof Error ? error.message : 'Network error');
    }
}

export const api = {
    get: <T>(endpoint: string, options?: FetchOptions) =>
        fetcher<T>(endpoint, { ...options, method: 'GET' }),

    post: <T>(endpoint: string, body: any, options?: FetchOptions) =>
        fetcher<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),

    put: <T>(endpoint: string, body: any, options?: FetchOptions) =>
        fetcher<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),

    patch: <T>(endpoint: string, body: any, options?: FetchOptions) =>
        fetcher<T>(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),

    delete: <T>(endpoint: string, options?: FetchOptions) =>
        fetcher<T>(endpoint, { ...options, method: 'DELETE' }),
};
