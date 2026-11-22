export const site = {
  name: 'AeroTwin',
  title: 'AeroTwin · Airport Digital Twin Simulation',
  description:
    'Airport digital twin built on discrete-event simulation (SimPy) and machine learning. Run what-if scenarios for check-in, security and gates, and see queues, missed flights and passenger satisfaction change.',
  author: 'Muhammad Abdullah Raja',
  authorUrl: 'https://github.com/Kianis534',
  repoUrl: 'https://github.com/Kianis534/airport-digital-twin-simulation',
  demoUrl: 'https://kianis534.github.io/airport-digital-twin-simulation/',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  apiUrl: (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, ''),
};

/** Prefix a public asset with the deployment base path (GitHub Pages serves from a sub-path). */
export function asset(path: string): string {
  return `${site.basePath}${path.startsWith('/') ? path : `/${path}`}`;
}
