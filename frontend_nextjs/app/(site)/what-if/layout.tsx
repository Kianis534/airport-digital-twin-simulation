import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scenario Lab',
  description: 'Run what-if scenarios on a simulated airport day: change security lanes, check-in counters, gates, traffic and weather, and compare queues, missed flights and satisfaction with the baseline.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
