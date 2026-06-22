'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthBrand } from '@/components/auth-brand';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import {
  extractEmailDomain,
  normalizeDomain,
} from '@/lib/organization/metadata';
import { slugifyOrganizationName } from '@/lib/utils/org-slug';
import { cn } from '@/lib/utils';
import { AllowedDomainsStep } from './allowed-domains-step';
import { CommercialWarningStep } from './commercial-warning-step';
import { CompanyNameStep } from './company-name-step';
import { TimezoneStep } from './timezone-step';
import { getBrowserTimezone, getIanaTimezones } from './timezone-options';
import { WizardStepper } from './wizard-stepper';

interface OnboardingWizardProps extends React.ComponentProps<'div'> {
  ownerEmail: string;
}

export function OnboardingWizard({
  ownerEmail,
  className,
  ...props
}: OnboardingWizardProps) {
  const router = useRouter();
  const timezones = useMemo(() => getIanaTimezones(), []);

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [timezone, setTimezone] = useState(() => getBrowserTimezone());
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const domain = extractEmailDomain(ownerEmail);
    if (domain) {
      setAllowedDomains([domain]);
    }
  }, [ownerEmail]);

  const handleAddDomain = (event: FormEvent) => {
    event.preventDefault();
    setDomainError(null);

    const normalized = normalizeDomain(domainInput);
    if (!normalized || !normalized.includes('.')) {
      setDomainError('Enter a valid domain, e.g. acme.com');
      return;
    }

    if (allowedDomains.includes(normalized)) {
      setDomainError('That domain is already allowed.');
      return;
    }

    setAllowedDomains((current) => [...current, normalized]);
    setDomainInput('');
  };

  const handleRemoveDomain = (domain: string) => {
    setAllowedDomains((current) => current.filter((item) => item !== domain));
  };

  const handleCompanyContinue = () => {
    if (!companyName.trim()) {
      setCompanyError('Company name is required.');
      return;
    }
    setCompanyError(null);
    setStep(3);
  };

  const handleCreateWorkspace = async () => {
    setSubmitError(null);
    setDomainError(null);

    const name = companyName.trim();
    if (!name) {
      setSubmitError('Company name is required.');
      setStep(2);
      return;
    }

    if (allowedDomains.length === 0) {
      setDomainError('Add at least one allowed email domain.');
      return;
    }

    setIsSubmitting(true);

    try {
      const slug = slugifyOrganizationName(name);
      const orgResult = await authClient.organization.create({
        name,
        slug,
        metadata: {
          allowedDomains: allowedDomains.map(normalizeDomain).filter(Boolean),
          timezone,
        },
      });

      if (orgResult.error) {
        setSubmitError(orgResult.error.message ?? 'Failed to create organization.');
        return;
      }

      const organizationId = orgResult.data?.id;
      if (!organizationId) {
        setSubmitError('Organization was created but no ID was returned.');
        return;
      }

      const activeResult = await authClient.organization.setActive({
        organizationId,
      });

      if (activeResult.error) {
        setSubmitError(activeResult.error.message ?? 'Failed to set active organization.');
        return;
      }

      await api.post<{ seeded: number }>('/api/organization/bootstrap');

      router.replace('/admin/overview');
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create organization.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AuthBrand />
      <WizardStepper currentStep={step} />
      {step === 1 && <CommercialWarningStep onContinue={() => setStep(2)} />}
      {step === 2 && (
        <CompanyNameStep
          companyName={companyName}
          error={companyError}
          onCompanyNameChange={(value) => {
            setCompanyName(value);
            if (companyError) setCompanyError(null);
          }}
          onBack={() => setStep(1)}
          onContinue={handleCompanyContinue}
        />
      )}
      {step === 3 && (
        <TimezoneStep
          timezone={timezones.includes(timezone) ? timezone : 'UTC'}
          timezones={timezones}
          onTimezoneChange={setTimezone}
          onBack={() => setStep(2)}
          onContinue={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <AllowedDomainsStep
          allowedDomains={allowedDomains}
          domainInput={domainInput}
          domainError={domainError}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onDomainInputChange={setDomainInput}
          onAddDomain={handleAddDomain}
          onRemoveDomain={handleRemoveDomain}
          onBack={() => setStep(3)}
          onSubmit={handleCreateWorkspace}
        />
      )}
    </div>
  );
}
