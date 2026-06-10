import type { Metadata } from 'next';
import { TimeCardDashboard } from '@/components/employee/TimeCardDashboard';

export const metadata: Metadata = {
  title: 'Time Card',
};

export default function EmployeeTrackPage() {
  return <TimeCardDashboard />;
}
