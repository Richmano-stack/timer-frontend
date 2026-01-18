'use server';

import { z } from 'zod';
import { api } from '@/lib/api';
import { AuthResponse } from '@/types';

const loginSchema = z.object({
    identifier: z.string().min(1, 'Email or username is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type ActionState = {
    error?: string;
    fieldErrors?: Record<string, string[]>;
    success?: boolean;
};

export async function loginAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
    const rawData = Object.fromEntries(formData.entries());

    const validatedFields = loginSchema.safeParse(rawData);

    if (!validatedFields.success) {
        return {
            fieldErrors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        await api.post<AuthResponse>('/api/auth/login', validatedFields.data);
        return { success: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid credentials';
        return { error: message };
    }
}
