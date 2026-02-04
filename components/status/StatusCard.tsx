import React, { memo } from 'react';
import { STATUS_CONFIG } from './constants';

interface StatusCardProps {
    config: typeof STATUS_CONFIG[0];
    isActive: boolean;
    isLoading: boolean;
    onClick: () => void;
}

export const StatusCard = memo(({ config, isActive, isLoading, onClick }: StatusCardProps) => {
    const Icon = config.icon;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isLoading}
            className={`group relative flex flex-col p-8 rounded-xl transition-all duration-300 text-left min-h-[160px] 
                ${isActive ? 'bg-black text-white shadow-xl scale-[1.03]' : 'bg-white text-gray-900 shadow-lg hover:shadow-xl hover:scale-[1.03]'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <div className="flex items-start justify-between mb-auto">
                <div className={`p-3 rounded-lg ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>
                    <Icon size={24} />
                </div>
                {isActive && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            </div>
            <h3 className="font-bold text-lg">{config.label}</h3>
            <p className="text-xs opacity-70">{isLoading ? 'Syncing...' : isActive ? 'Active' : 'Switch'}</p>
        </button>
    );
});
StatusCard.displayName = 'StatusCard';