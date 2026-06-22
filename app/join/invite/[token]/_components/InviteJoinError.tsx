import { AuthBrand } from '@/components/auth-brand';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface InviteJoinErrorProps {
  title: string;
  message: string;
}

export function InviteJoinError({ title, message }: InviteJoinErrorProps) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <AuthBrand />
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{message}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contact your workspace administrator if you need a new invitation.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
