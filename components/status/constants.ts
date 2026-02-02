import { UserCheck, Monitor, Phone, Coffee, Clock, GraduationCap, Zap } from 'lucide-react';
import { StatusType } from '@/types';

export const STATUS_CONFIG: { label: string; value: StatusType; icon: any }[] = [
    { label: 'Available', value: 'available', icon: UserCheck },
    { label: 'On Production', value: 'on_production', icon: Monitor },
    { label: 'Meeting', value: 'meeting', icon: Phone },
    { label: 'Lunch Break', value: 'lunch_break', icon: Coffee },
    { label: 'Short Break', value: 'short_break', icon: Coffee },
    { label: 'Away', value: 'away', icon: Clock },
    { label: 'Training', value: 'training', icon: GraduationCap },
    { label: 'Off Duty', value: 'off_duty', icon: Zap },
];