"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlaskConical, Menu, PlaneTakeoff, X } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { GithubIcon } from '@/components/ui';
import { site } from '@/lib/site';
import { cn } from '@/lib/utils';

const NAV = [
  { name: 'Home', href: '/' },
  { name: 'Scenario Lab', href: '/what-if' },
  { name: '3D Twin', href: '/simulation' },
  { name: 'Analytics', href: '/graphs-stats' },
  { name: 'Models', href: '/models' },
  { name: 'Architecture', href: '/overview' },
  { name: 'About', href: '/about' },
];

function isActive(pathname: string, href: string) {
  const clean = pathname.replace(/\/$/, '') || '/';
  return href === '/' ? clean === '/' : clean.endsWith(href);
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.name} home`}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25">
              <PlaneTakeoff className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">{site.name}</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive(pathname, link.href)
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <a
              href={site.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
              aria-label="Source code on GitHub"
            >
              <GithubIcon className="h-5 w-5" />
            </a>
            <Link href="/what-if" className="btn-dark hidden md:inline-flex !px-4 !py-2.5">
              <FlaskConical className="h-4 w-4" />
              Run a scenario
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="lg:hidden border-t border-slate-200/70 bg-white px-4 py-3 shadow-lg" aria-label="Mobile">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'block rounded-xl px-4 py-3 text-base font-medium',
                  isActive(pathname, link.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 md:py-16">{children}</main>

      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-white">
                <PlaneTakeoff className="h-4 w-4" />
              </span>
              <span className="font-bold text-slate-900">{site.name}</span>
            </div>
            <p className="text-sm text-slate-500">
              Airport digital twin · SimPy, XGBoost, LSTM, FastAPI and Next.js. Built by{' '}
              <a href={site.authorUrl} className="font-medium text-slate-700 hover:text-brand-700" target="_blank" rel="noopener noreferrer">
                {site.author}
              </a>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <Link href="/what-if" className="hover:text-slate-900">Scenario Lab</Link>
            <Link href="/models" className="hover:text-slate-900">Models</Link>
            <Link href="/overview" className="hover:text-slate-900">Architecture</Link>
            <a href={site.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-slate-900">
              <GithubIcon className="h-4 w-4" /> Source
            </a>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
