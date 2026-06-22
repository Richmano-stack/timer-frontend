import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuthBrand } from '@/components/auth-brand';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getOrganizationBySlug } from '@/lib/services/join.service';

export const metadata: Metadata = {
  title: 'Join',
};

interface JoinPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { orgSlug } = await params;

  const orgResult = await getOrganizationBySlug(orgSlug);
  if (!orgResult.success) {
    notFound();
  }

  const organization = orgResult.data;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <AuthBrand className="mb-4 justify-center" />
            <CardTitle>Invitation required</CardTitle>
            <CardDescription>
              Open join links for {organization.name} are no longer available.
              Ask your administrator for an invitation link to join this
              organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
