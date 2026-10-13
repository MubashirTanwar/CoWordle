import { createHash, timingSafeEqual } from 'crypto';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Single admin account from env: ADMIN_USERNAME (default "admin") + ADMIN_PASSWORD.
// No password set → nobody can sign in.
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/admin/login' },
  providers: [
    CredentialsProvider({
      name: 'Admin',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const password = process.env.ADMIN_PASSWORD;
        const username = process.env.ADMIN_USERNAME || 'admin';
        if (!password || !credentials) return null;
        const okUser = safeEqual(credentials.username ?? '', username);
        const okPass = safeEqual(credentials.password ?? '', password);
        return okUser && okPass ? { id: 'admin', name: username, role: 'admin' } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = 'admin';
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.role = token.role;
      return session;
    },
  },
};
