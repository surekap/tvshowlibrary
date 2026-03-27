import path from "node:path";
import { fileURLToPath } from "node:url";

// Needed because there is a package-lock.json at ~/package-lock.json which
// causes Turbopack to pick the home directory as the workspace root instead
// of this project. Setting root explicitly silences the warning and prevents
// the dev server from hanging on compilation.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "artworks.thetvdb.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.thetvdb.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
