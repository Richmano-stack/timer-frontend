'use client';

import { Building2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface CommercialWarningStepProps {
  onContinue: () => void;
}

export function CommercialWarningStep({ onContinue }: CommercialWarningStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a company workspace</CardTitle>
        <CardDescription>
          You are setting up a commercial B2B workspace for your organization — not a personal
          account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <Building2 />
          <AlertTitle>Business workspace only</AlertTitle>
          <AlertDescription>
            OmniShift workspaces are designed for call centers and teams. Employees should join
            through your company link — they cannot create their own workspace. You will be the
            workspace owner with full administrative access.
          </AlertDescription>
        </Alert>
        <Button type="button" className="w-full" onClick={onContinue}>
          I understand — continue setup
        </Button>
      </CardContent>
    </Card>
  );
}
