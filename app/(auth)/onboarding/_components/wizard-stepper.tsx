'use client';

import { cn } from '@/lib/utils';

const STEPS = ['Workspace', 'Company', 'Timezone', 'Domains'] as const;

export function WizardStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label="Onboarding progress">
      {STEPS.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isComplete = stepNumber < currentStep;

        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border text-xs font-medium',
                  isComplete && 'border-primary bg-primary text-primary-foreground',
                  isActive && 'border-primary text-primary',
                  !isActive && !isComplete && 'border-muted-foreground/30 text-muted-foreground'
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {stepNumber}
              </div>
              <span
                className={cn(
                  'hidden text-[10px] uppercase tracking-wide sm:block',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'mb-4 h-px w-6 sm:w-8',
                  isComplete ? 'bg-primary' : 'bg-muted-foreground/20'
                )}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
