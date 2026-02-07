'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function MiddlewareTestPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const from = searchParams.get('from');
    const [hasCookie, setHasCookie] = useState(false);
    const [status, setStatus] = useState<string>('Checking...');

    useEffect(() => {
        const checkCookie = () => {
            const cookies = document.cookie.split(';');
            const exists = cookies.some(c => c.trim().startsWith('better-auth.session_token='));
            setHasCookie(exists);
            setStatus(exists ? 'Authenticated (Cookie Present)' : 'Guest (No Cookie)');
        };

        checkCookie();
        // Check every second to respond to manual dev tool changes
        const interval = setInterval(checkCookie, 1000);
        return () => clearInterval(interval);
    }, []);

    const setCookie = () => {
        document.cookie = "better-auth.session_token=test-session-token; path=/; max-age=3600";
        setHasCookie(true);
        setStatus('Authenticated (Cookie Present)');
    };

    const clearCookie = () => {
        document.cookie = "better-auth.session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        setHasCookie(false);
        setStatus('Guest (No Cookie)');
    };

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold">Middleware Test Component</h1>

            <div className={`p-4 rounded-lg border-2 ${hasCookie ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-lg font-semibold">
                    Current Status: <span className={hasCookie ? 'text-green-700' : 'text-red-700'}>{status}</span>
                </p>
            </div>

            {from && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <p className="text-blue-800">
                        Redirected from: <code className="bg-blue-100 px-1 rounded">{from}</code>
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                        Login success would typically redirect you back here.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={setCookie}
                    className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                    Mock Login (Set Cookie)
                </button>
                <button
                    onClick={clearCookie}
                    className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                    Mock Logout (Clear Cookie)
                </button>
            </div>

            <div className="mt-8 space-y-4">
                <h2 className="text-xl font-semibold">Test Scenarios</h2>
                <ul className="list-disc pl-5 space-y-2">
                    <li>
                        <strong>Protected Route:</strong>
                        <a href="/dashboard" className="text-blue-600 underline ml-2">Go to Dashboard</a>
                        <p className="text-sm text-gray-500">If Guest, redirects to /login. If Authenticated, allows access.</p>
                    </li>
                    <li>
                        <strong>Public Route:</strong>
                        <a href="/login" className="text-blue-600 underline ml-2">Go to Login</a>
                        <p className="text-sm text-gray-500">Always allowed by middleware.</p>
                    </li>
                    <li>
                        <strong>Internal Asset:</strong>
                        <a href="/favicon.ico" className="text-blue-600 underline ml-2">View Favicon</a>
                        <p className="text-sm text-gray-500">Always allowed (starts with /_next or has extension).</p>
                    </li>
                </ul>
            </div>

            <div className="mt-8 p-4 bg-gray-100 rounded-md">
                <h3 className="font-bold">How to use this test:</h3>
                <ol className="list-decimal pl-5 mt-2 text-sm text-gray-700 space-y-1">
                    <li>Click "Mock Logout" to clear your session.</li>
                    <li>Try clicking "Go to Dashboard". You should be redirected back here OR to the real login page.</li>
                    <li>Note the `from` parameter in the URL.</li>
                    <li>Click "Mock Login" and try "Go to Dashboard" again.</li>
                </ol>
            </div>
        </div>
    );
}
