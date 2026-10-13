'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

/** Only follow same-site admin paths (never `//evil.com` or another origin). */
function safeCallback(cb: string | null): string {
  if (!cb) return '/admin';
  const path = cb.startsWith(window.location.origin) ? cb.slice(window.location.origin.length) : cb;
  return path.startsWith('/admin') && !path.startsWith('//') ? path : '/admin';
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { username, password, redirect: false });
    setLoading(false);
    if (res?.ok) {
      router.replace(safeCallback(params.get('callbackUrl')));
      router.refresh();
    } else {
      setError('Wrong username or password');
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div className="border-b border-[#3a3a3c] pb-4 mb-2 text-center">
        <h1 className="text-3xl font-bold tracking-widest uppercase text-white">CoWordle</h1>
        <p className="text-[#b59f3b] text-xs mt-1 uppercase tracking-widest font-bold">Admin</p>
      </div>
      <div>
        <label className="block text-[#818384] text-xs uppercase tracking-widest mb-2">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="w-full bg-[#1a1a1b] border border-[#3a3a3c] rounded text-white px-4 py-3 focus:outline-none focus:border-[#565758]"
        />
      </div>
      <div>
        <label className="block text-[#818384] text-xs uppercase tracking-widest mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          className="w-full bg-[#1a1a1b] border border-[#3a3a3c] rounded text-white px-4 py-3 focus:outline-none focus:border-[#565758]"
        />
      </div>
      {error && <div className="bg-red-900/30 border border-red-700 rounded px-3 py-2 text-red-300 text-sm text-center">{error}</div>}
      <button
        type="submit"
        disabled={loading || !password}
        className="w-full bg-[#538d4e] hover:bg-[#6aaf64] disabled:opacity-50 text-white font-bold py-4 rounded text-sm uppercase tracking-widest transition-colors"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
