const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = {
    async post<T>(url: string, data: unknown): Promise<T> {
        const response = await fetch(`${BASE_URL}${url}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'An error occurred');
        }

        return response.json();
    },

    async get<T>(url: string): Promise<T> {
        const response = await fetch(`${BASE_URL}${url}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'An error occurred');
        }

        return response.json();
    },
};
