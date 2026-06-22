'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface CompanyNameStepProps {
  companyName: string;
  error: string | null;
  onCompanyNameChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function CompanyNameStep({
  companyName,
  error,
  onCompanyNameChange,
  onBack,
  onContinue,
}: CompanyNameStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company legal name</CardTitle>
        <CardDescription>
          Enter the formal legal or display name for your organization workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="company-name">Company name</FieldLabel>
            <Input
              id="company-name"
              type="text"
              placeholder="Acme Inc."
              autoComplete="organization"
              required
              value={companyName}
              onChange={(event) => onCompanyNameChange(event.target.value)}
            />
            <FieldDescription>
              This becomes your organization workspace. You will be assigned the owner role
              automatically.
            </FieldDescription>
          </Field>
          {error && (
            <Field>
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            </Field>
          )}
          <Field className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
              Back
            </Button>
            <Button type="button" className="flex-1" onClick={onContinue}>
              Continue
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
