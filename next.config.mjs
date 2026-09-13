// Express backend the browser talks to. REST calls go through the same-origin
// `/api/*` rewrite below; Socket.io connects to it directly.
const SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${SERVER_URL}/api/:path*` }];
  },
};

export default nextConfig;
