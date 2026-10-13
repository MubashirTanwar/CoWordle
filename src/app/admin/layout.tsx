import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AdminNav from '@/components/admin/AdminNav';

export const metadata: Metadata = {
  title: 'CoWordle Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#121213]">
      <AdminNav />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
