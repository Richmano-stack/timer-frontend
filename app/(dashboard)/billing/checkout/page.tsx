import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Billing',
};
import { AuthBrand } from '@/components/auth-brand';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function BillingCheckoutPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col gap-6">
          <AuthBrand />
          <Card>
            <CardHeader>
              <CardTitle>Choose a plan</CardTitle>
              <CardDescription>
                Select a subscription plan for your organization. Billing integration
                will be connected here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">Starter</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Time tracking for small teams — coming soon.
                </p>
              </div>
              <Button disabled className="w-full">
                Subscribe (coming soon)
              </Button>
              <Link
                href="/admin/overview"
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
              >
                Skip for now
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
