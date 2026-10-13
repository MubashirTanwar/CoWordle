'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/games', label: 'History' },
  { href: '/admin/players', label: 'Players' },
  { href: '/admin/records', label: 'Records' },
];

export default function AdminNav() {
  const pathname = usePathname();
  if (pathname === '/admin/login') return null;

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  return (
    <header className="border-b border-[#3a3a3c] bg-[#121213] sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-4 h-14">
        <Link href="/admin" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-base font-bold uppercase tracking-widest">CoWordle</span>
          <span className="text-[10px] font-bold text-[#b59f3b] border border-[#b59f3b] rounded px-1.5 py-0.5">ADMIN</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className="text-xs text-[#818384] hover:text-white uppercase tracking-widest"
        >
          Sign out
        </button>
      </div>
      <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-widest border-b-2 whitespace-nowrap transition-colors ${
              isActive(t.href) ? 'border-[#538d4e] text-white' : 'border-transparent text-[#818384] hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
