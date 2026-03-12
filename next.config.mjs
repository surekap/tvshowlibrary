/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ],
  },
};

export default nextConfig;
