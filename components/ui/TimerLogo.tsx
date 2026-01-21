import React from 'react';
import Image from 'next/image';

export const TimerLogo: React.FC = () => {
    return (
        <div className="w-12 h-12 relative">
            <Image
                src="/assets/logo-dark.svg"
                alt="Nexuma Logo"
                fill
                className="object-contain"
            />
        </div>
    );
};
