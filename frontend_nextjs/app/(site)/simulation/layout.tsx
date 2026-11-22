import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '3D Live Twin',
  description: 'A real-time 3D airport terminal built with React Three Fiber. Passengers move through check-in, security and boarding while you change staffing and weather.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
