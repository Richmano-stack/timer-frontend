import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="flex justify-center">
                    <div className="p-3 bg-red-100 rounded-full">
                        <AlertCircle className="h-12 w-12 text-red-600" />
                    </div>
                </div>
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900">404 - Page Not Found</h2>
                <p className="mt-2 text-sm text-gray-600">
                    The page you are looking for doesn't exist or has been moved.
                </p>
                <div className="mt-8">
                    <Link href="/dashboard">
                        <Button className="flex items-center gap-2 mx-auto">
                            <Home size={18} />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
