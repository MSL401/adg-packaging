/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // better-sqlite3 is a native module; keep it out of the webpack bundle
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
