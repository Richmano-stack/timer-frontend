import { notFound } from 'next/navigation';
import { JoinForm } from '@/components/join/JoinForm';
import { getOrganizationBySlug } from '@/lib/services/join.service';

interface JoinPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}

function resolveJoinError(
  error: string | undefined,
  message: string | undefined
): string | null {
  if (message) {
    try {
      return decodeURIComponent(message);
    } catch {
      return message;
    }
  }

  if (error === 'auth_failed') {
    return 'Sign-in link is invalid or expired. Request a new link below.';
  }

  return null;
}

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
  const { orgSlug } = await params;
  const { error, message } = await searchParams;

  const orgResult = await getOrganizationBySlug(orgSlug);
  if (!orgResult.success) {
    notFound();
  }

  const organization = orgResult.data;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <JoinForm
          orgSlug={organization.slug}
          orgName={organization.name}
          allowedDomains={organization.allowedDomains}
          initialError={resolveJoinError(error, message)}
        />
      </div>
    </div>
  );
}
