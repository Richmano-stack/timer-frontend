import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StatusType, Status } from '@/types';
import { StatusControlGrid } from './StatusControlGrid';


export const StatusManager = () => {
    const [currentStatus, setCurrentStatus] = useState<StatusType>('off_duty');
    const [init, setInit] = useState(false);

    useEffect(() => {
        const fetchTruth = async () => {
            try {
                const data = await api.get('/api/status/current') as unknown as Status;
                setCurrentStatus(data.statusName || 'off_duty');
            } catch (err: any) {
                if (err.response?.status === 404) {
                    setCurrentStatus('off_duty');
                } else {
                    console.error("Hydration Error:", err);
                }
            } finally {
                setInit(true);
            }
        };
        fetchTruth();
    }, []);

    if (!init) return <div>Synchronizing with server...</div>;

    return <StatusControlGrid currentStatus={currentStatus} onStatusChange={setCurrentStatus} />;
};