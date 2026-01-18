'use client';

import { useActionState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginAction, ActionState } from './actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TimerLogo } from '@/components/ui/TimerLogo';

const initialState: ActionState = {};

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const from = searchParams.get('from') || '/dashboard';

    const [state, formAction, isPending] = useActionState(loginAction, initialState);

    useEffect(() => {
        if (state.success) {
            router.push(from);
            router.refresh();
        }
    }, [state.success, router, from]);

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-white">
            <div className="flex-1 flex items-center justify-center p-6 md:p-12">
                <div className="w-full max-w-[480px] bg-card-bg p-10 rounded-card shadow-lg border border-input-border">
                    <div className="mb-10 text-center md:text-left">
                        <div className="md:hidden flex justify-center mb-6">
                            <TimerLogo className="w-10 h-10 text-primary-action" />
                        </div>
                        <h2 className="text-3xl font-bold text-text-main">Sign in</h2>
                        <p className="mt-2 text-text-muted">
                            Enter your credentials to access your account
                        </p>
                    </div>

                    <form action={formAction} className="space-y-6">
                        <Input
                            label="Email or Username"
                            name="identifier"
                            placeholder="name@company.com"
                            error={state.fieldErrors?.identifier?.[0]}
                            required
                        />

                        <div className="space-y-1">
                            <Input
                                label="Password"
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                error={state.fieldErrors?.password?.[0]}
                                required
                            />
                            <div className="flex justify-end">
                                <Link
                                    href="/forgot-password"
                                    className="text-sm font-medium text-text-muted hover:text-primary-action transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        {state.error && (
                            <div className="p-3 bg-error/10 border border-error/20 rounded-input flex items-center space-x-2 text-error text-sm">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span>{state.error}</span>
                            </div>
                        )}

                        <Button type="submit" isLoading={isPending} className='shadow-xl'>
                            Sign in
                        </Button>

                        {/*                         <p className="text-center text-sm text-text-muted">
                            Don&apos;t have an account?{' '}
                            <Link
                                href="/register"
                                className="font-semibold text-primary-action hover:underline"
                            >
                                Create account
                            </Link>
                        </p> */}
                    </form>
                </div>
            </div>
        </div>
    );
}
