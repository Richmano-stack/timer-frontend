const IS_SERVER = typeof window === 'undefined';
const API_URL = IS_SERVER
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000')
    : ''; // Use relative path on client to hit the Next.js proxy

interface FetchOptions extends RequestInit {
    headers?: Record<string, string>;
}

export class ApiError extends Error {
    public statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ApiError';
    }
}

async function fetcher<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const url = `${API_URL}${endpoint}`;

    // Get JWT token from localStorage (only on client side)
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
    };

    const config: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        credentials: 'include', // Important for cookie-based auth
    };

    try {
        const response = await fetch(url, config);

        if (!response.ok) {
            // Try to parse error message from JSON response
            let errorMessage = 'An error occurred';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || response.statusText;
            } catch {
                errorMessage = response.statusText;
            }

            throw new ApiError(errorMessage, response.status);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        return await response.json();
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
