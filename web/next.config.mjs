/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The live-run endpoint is a Python serverless function (api/run.py),
  // served by Vercel alongside this Next.js app — nothing to rewrite.
};

export default nextConfig;
