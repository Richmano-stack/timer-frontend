'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthResponse } from '@/types';
import { TimerLogo } from '@/components/ui/TimerLogo';

export default function RegisterPage() {
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            await api.post<AuthResponse>('/api/auth/register', { username, firstName, lastName, email, password });
            router.push('/dashboard');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-[450px] border border-gray-200 rounded-lg px-6 py-10 sm:px-10">
                <div className="flex flex-col items-center mb-8">
                    <TimerLogo />
                    <h1 className="mt-3 text-2xl font-normal text-gray-900">Create your Timer Account</h1>
                    <p className="mt-2 text-base text-gray-700 text-center">to continue to Timer</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <Input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="h-12 border-gray-300 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] rounded-[4px]"
                        />

                        <Input
                            id="firstName"
                            name="firstName"
                            type="text"
                            autoComplete="firstName"
                            required
                            placeholder="First Name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="h-12 border-gray-300 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] rounded-[4px]"
                        />
                        <Input
                            id="lastName"
                            name="lastName"
                            type="text"
                            autoComplete="lastName"
                            required
                            placeholder="Last Name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="h-12 border-gray-300 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] rounded-[4px]"
                        />
                        {/*
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-12 border-gray-300 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] rounded-[4px]"
                        />
                        */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 border-gray-300 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] rounded-[4px]"
                            />

                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                placeholder="Confirm"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="h-12 border-gray-300 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] rounded-[4px]"
                            />
                        </div>
                        <p className="text-xs text-gray-500 px-1">
                            Use 8 or more characters with a mix of letters, numbers & symbols
                        </p>
                    </div>

                    {error && (
                        <div className="text-sm text-[#d93025] flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-4">
                        <Link
                            href="/login"
                            className="text-sm font-medium text-[#1a73e8] hover:bg-blue-50 px-2 py-2 -ml-2 rounded transition-colors"
                        >
                            Sign in instead
                        </Link>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="bg-[#1a73e8] hover:bg-[#1b66c9] text-white px-6 h-10 rounded-[4px] font-medium transition-shadow hover:shadow-md"
                        >
                            Register
                        </Button>
                    </div>
                </form>
            </div>

            <div className="mt-6 w-full max-w-[450px] flex justify-between text-xs text-gray-500 px-2">
                <div className="flex space-x-4">
                    <button className="hover:underline">English (United States)</button>
                </div>
                <div className="flex space-x-4">
                    <button className="hover:underline">Help</button>
                    <button className="hover:underline">Privacy</button>
                    <button className="hover:underline">Terms</button>
                </div>
            </div>
        </div>
    );
}
