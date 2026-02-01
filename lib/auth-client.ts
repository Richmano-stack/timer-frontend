import { createAuthClient } from "better-auth/react";

export interface UserCustom {
    id: string;
    email: string;
    name: string;
    role: "agent" | "admin" | "supervisor";
    is_active: boolean;
}

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    fetchOptions: {
        credentials: "include",
    }
});

export const { signUp, signIn, signOut, useSession } = authClient;