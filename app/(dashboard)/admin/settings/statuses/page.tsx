import type { Metadata } from 'next';
import { ActivityStatusManager } from './_components/ActivityStatusManager';

export const metadata: Metadata = {
  title: 'Activity Statuses',
};

export default function ActivityStatusesPage() {
  return <ActivityStatusManager />;
}
