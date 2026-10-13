import { withAuth } from 'next-auth/middleware';

// Every /admin page except the login screen needs an admin session.
export default withAuth({
  pages: { signIn: '/admin/login' },
  callbacks: { authorized: ({ token }) => token?.role === 'admin' },
});

export const config = { matcher: ['/admin', '/admin/((?!login).*)'] };
