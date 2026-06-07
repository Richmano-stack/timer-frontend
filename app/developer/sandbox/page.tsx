import { notFound } from 'next/navigation';
import { ApiSandboxDashboard } from '@/components/developer/ApiSandboxDashboard';

export const metadata = {
  title: 'API Sandbox (Dev Only)',
  robots: { index: false, follow: false },
};

export default function DeveloperSandboxPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <ApiSandboxDashboard />;
}
