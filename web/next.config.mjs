/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // In production, Vercel routes /api/run straight to the Python function
  // at api/run.py — no rewrite involved, and none is emitted here.
  //
  // `next dev` doesn't run Python, so in development the same path is
  // proxied to api/dev_server.py (see its docstring for how to start it).
  // Without this, "Run cycle" 404s locally.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const port = process.env.DEV_API_PORT ?? "5328";
    return [
      {
        source: "/api/:path*",
        destination: `http://127.0.0.1:${port}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
