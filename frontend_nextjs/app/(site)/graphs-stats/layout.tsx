import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Analytics',
  description: 'Seven live charts that follow the 3D airport twin: satisfaction, crowding, stage load, time in stage and queue time versus delay.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
