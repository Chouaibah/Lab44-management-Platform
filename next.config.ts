import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};


// next.config.js
module.exports = {
  allowedDevOrigins: ['192.168.100.106'],
}


export default nextConfig;
