'use client';

import { StatusType } from '@prisma/client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STATUS_TYPE_OPTIONS } from './status-type-labels';

const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export interface ActivityStatusFormValues {
  name: string;
  type: StatusType;
  colorCode: string;
  isBillable: boolean;
}

interface ActivityStatusFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  instanceKey?: string;
  initialValues?: ActivityStatusFormValues;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ActivityStatusFormValues) => void;
}

const DEFAULT_VALUES: ActivityStatusFormValues = {
  name: '',
  type: StatusType.PRODUCTIVE,
  colorCode: '#6366f1',
  isBillable: true,
};

function toColorInputValue(hex: string): string {
  if (!HEX_COLOR_PATTERN.test(hex)) return '#6366f1';
  if (hex.length === 4) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex;
}

function ActivityStatusFormModalContent({
  mode,
  initialValues,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: Omit<ActivityStatusFormModalProps, 'open'>) {
  const values = initialValues ?? DEFAULT_VALUES;
  const [name, setName] = useState(values.name);
  const [type, setType] = useState<StatusType>(values.type);
  const [colorCode, setColorCode] = useState(values.colorCode);
  const [isBillable, setIsBillable] = useState(values.isBillable);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onClose();
  }, [isSubmitting, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) handleClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isSubmitting, handleClose]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('Name is required.');
      return;
    }

    if (!HEX_COLOR_PATTERN.test(colorCode)) {
      setValidationError('Color must be a valid hex code (e.g. #6366f1).');
      return;
    }

    onSubmit({
      name: trimmedName,
      type,
      colorCode,
      isBillable,
    });
  };

  const displayError = validationError ?? error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Close dialog"
        disabled={isSubmitting}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-status-form-title"
        className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="activity-status-form-title" className="text-lg font-semibold text-foreground">
              {mode === 'create' ? 'Create activity status' : 'Edit activity status'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'create'
                ? 'Add a new trackable status for employee time tracking.'
                : 'Update display settings for this status.'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <X />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status-name">Name</Label>
            <Input
              id="status-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="After Call Work"
              maxLength={80}
              disabled={isSubmitting}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status-type">Type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as StatusType)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="status-type" aria-label="Status type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status-color">Display color</Label>
            <div className="flex items-center gap-3">
              <input
                id="status-color"
                type="color"
                value={toColorInputValue(colorCode)}
                onChange={(event) => setColorCode(event.target.value)}
                disabled={isSubmitting}
                className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Color picker"
              />
              <Input
                value={colorCode}
                onChange={(event) => setColorCode(event.target.value)}
                placeholder="#6366f1"
                disabled={isSubmitting}
                className="font-mono"
                aria-label="Hex color code"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="status-billable"
              type="checkbox"
              checked={isBillable}
              onChange={(event) => setIsBillable(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="status-billable" className="cursor-pointer font-normal">
              Billable time
            </Label>
          </div>

          {displayError && (
            <Alert variant="destructive">
              <AlertDescription>{displayError}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving…'
                : mode === 'create'
                  ? 'Create status'
                  : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ActivityStatusFormModal({
  open,
  mode,
  instanceKey,
  initialValues,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: ActivityStatusFormModalProps) {
  if (!open) return null;

  const formKey = instanceKey ?? (mode === 'create' ? 'create' : 'edit');

  return (
    <ActivityStatusFormModalContent
      key={formKey}
      mode={mode}
      initialValues={initialValues}
      isSubmitting={isSubmitting}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
