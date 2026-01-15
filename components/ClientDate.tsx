'use client';

import React, { useEffect, useState } from 'react';

interface ClientDateProps {
    date: number | string | Date;
    options?: Intl.DateTimeFormatOptions;
}

export const ClientDate: React.FC<ClientDateProps> = ({ date, options }) => {
    const [formattedDate, setFormattedDate] = useState<string>('');

    useEffect(() => {
        if (date) {
            setFormattedDate(new Date(date).toLocaleString([], options));
        }
    }, [date, options]);

    if (!formattedDate) {
        return null; // Or a loading skeleton / placeholder
    }

    return <>{formattedDate}</>;
};
