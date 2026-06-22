import { notFound } from 'next/navigation';
import { ApiSandboxDashboard } from '@/components/developer/ApiSandboxDashboard';
import { isDevSandboxEnabled } from '@/lib/developer/is-dev-sandbox-enabled';

export const metadata = {
  title: 'API Sandbox',
  robots: { index: false, follow: false },
};

export default function DeveloperSandboxPage() {
  if (!isDevSandboxEnabled()) {
    notFound();
  }

  return <ApiSandboxDashboard />;
}
