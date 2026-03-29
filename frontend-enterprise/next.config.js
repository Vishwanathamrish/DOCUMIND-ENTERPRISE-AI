// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // 🔥 ADD THIS BLOCK
  devIndicators: false,

  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;