/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is used for Docker images (Linux). Skipped on local
  // Windows dev where creating symlinks needs elevated privileges.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
