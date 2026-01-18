import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className = '', ...props }, ref) => {
        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label className="text-sm font-medium text-text-main">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`
            w-full px-4 py-3 
            bg-card-bg border border-input-border 
            rounded-input text-text-main 
            placeholder:text-text-muted
            focus:outline-none focus:border-primary-action
            transition-all duration-200
            ${error ? 'border-error focus:border-error' : ''}
            ${className}
          `}
                    {...props}
                />
                {error && (
                    <p className="text-xs text-error mt-1">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
