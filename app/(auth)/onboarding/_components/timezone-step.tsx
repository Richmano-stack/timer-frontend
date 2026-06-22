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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatTimezoneLabel } from './timezone-options';

interface TimezoneStepProps {
  timezone: string;
  timezones: string[];
  onTimezoneChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function TimezoneStep({
  timezone,
  timezones,
  onTimezoneChange,
  onBack,
  onContinue,
}: TimezoneStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational timezone</CardTitle>
        <CardDescription>
          Choose the primary timezone for shift boundaries and reporting. Stored for workspace
          configuration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
            <Select value={timezone} onValueChange={onTimezoneChange}>
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {timezones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {formatTimezoneLabel(zone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              All timestamps are stored in UTC. Reports and day boundaries use this timezone.
            </FieldDescription>
          </Field>
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
