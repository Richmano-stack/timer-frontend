'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authClient } from '@/lib/auth-client';

// 1. Decoupled Validation Schema
const loginSchema = z.object({
    identifier: z.string()
        .min(1, 'Identifier is required')
        .refine((val) => {
            const emailRegex = /^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$/;
            const userRegex = /^[a-z0-9_-]{3,15}$/;
            return emailRegex.test(val) || userRegex.test(val);
        }, { message: 'Invalid email or username format' }),
    password: z.string().min(6, 'Security protocol requires 12+ characters'),
    remember_me: z.boolean().optional(),
});

type LoginSchema = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();

    // 2. Optimized Form Hook
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<LoginSchema>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            identifier: '',
            password: '',
            remember_me: false,
        }
    });

    const onSubmit = async (data: LoginSchema) => {
        try {
            const { data: session, error } = await authClient.signIn.email({
                email: data.identifier,
                password: data.password,
                /*  rememberMe: data.remember_me */
            });

            if (error) {
                const message = error.status === 429
                    ? "Infrastructure locked due to too many attempts. Wait 15m."
                    : error.message || "Invalid credentials.";

                setError('root.serverError', { type: 'manual', message });
                return;
            }

            router.push('/dashboard');

        } catch (err) {
            setError('root.serverError', {
                type: 'manual',
                message: 'Network infrastructure failure. Check your connection.'
            });
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-[#000000] font-sans p-4">

            {/* Header Branding */}
            <div className="mb-8">
                <div className="w-12 h-12 relative">
                    <Image
                        src="/assets/logo-dark.svg"
                        alt="Nexuma Logo"
                        fill
                        className="object-contain"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                    <span className="sr-only">Nexuma</span>
                </div>
            </div>

            {/* Login Module */}
            <div
                className="w-full max-w-[480px] bg-white shadow-3xl rounded-[24px] p-8 md:p-16"
                style={{ boxShadow: '0px 10px 40px rgba(0,0,0,0.05)' }}
            >
                <div className="mb-8 text-center">
                    <p className="text-xs font-bold tracking-widest uppercase text-[#666666] mb-2">Access System</p>
                    <h1 className="text-3xl font-bold mb-2 tracking-tight">Welcome Back</h1>
                    <p className="text-[#666666] text-sm">Secure authentication for Nexuma Global infrastructure.</p>
                </div>

                {errors.root?.serverError && (
                    <div className="mb-6 p-3 bg-[#D32F2F]/10 border border-[#D32F2F]/20 rounded-lg text-[#D32F2F] text-sm text-center">
                        {errors.root.serverError.message}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                    {/* Identifier Field */}
                    <div className="space-y-1.5">
                        <label htmlFor="identifier" className="block text-sm font-medium text-[#000000]">
                            Email or Username
                        </label>
                        <input
                            id="identifier"
                            type="text"
                            placeholder="admin@nexuma.com"
                            {...register('identifier')}
                            className={`
                w-full px-4 py-3 rounded-[12px] bg-[#F9F9F9] border transition-all duration-200 outline-none
                ${errors.identifier
                                    ? 'border-[#D32F2F] focus:ring-1 focus:ring-[#D32F2F]'
                                    : 'border-transparent focus:border-[#000000] focus:bg-white hover:bg-[#F0F0F0]'
                                }
              `}
                        />
                        {errors.identifier && (
                            <p className="text-xs text-[#D32F2F] mt-1">{errors.identifier.message}</p>
                        )}
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                        <label htmlFor="password" className="block text-sm font-medium text-[#000000]">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            {...register('password')}
                            className={`
                w-full px-4 py-3 rounded-[12px] bg-[#F9F9F9] border transition-all duration-200 outline-none
                ${errors.password
                                    ? 'border-[#D32F2F] focus:ring-1 focus:ring-[#D32F2F]'
                                    : 'border-transparent focus:border-[#000000] focus:bg-white hover:bg-[#F0F0F0]'
                                }
              `}
                        />
                        {errors.password ? (
                            <p className="text-xs text-[#D32F2F] mt-1">{errors.password.message}</p>
                        ) : (
                            <p className="text-xs text-[#666666] mt-1">Minimum 6 characters required.</p>
                        )}
                    </div>

                    {/* Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember_me"
                                type="checkbox"
                                {...register('remember_me')}
                                className="h-4 w-4 accent-black border-gray-300 rounded focus:ring-black"
                            />
                            <label htmlFor="remember_me" className="ml-2 block text-sm text-[#666666]">
                                Remember this session
                            </label>
                        </div>

                        <div className="text-sm">
                            <button type="button" className="font-medium text-[#000000] hover:text-[#666666] transition-colors">
                                Forgot password?
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-[#000000] hover:bg-[#333333] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                        {isSubmitting ? 'Validating credentials...' : 'Authenticate'}
                    </button>
                </form>
            </div>

            {/* Footer Links */}
            <div className="mt-8 flex space-x-6 text-sm text-[#666666]">
                <Link href="/support" className="hover:text-black transition-colors">
                    Trouble signing in?
                </Link>
                <Link href="/legal/privacy" className="hover:text-black transition-colors">
                    Privacy Policy
                </Link>
            </div>
        </div>
    );
}
