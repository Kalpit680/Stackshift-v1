/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/projects.json',
        '**/users.json',
        '**/public/uploads/**',
        '**/.git/**',
        '**/.next/**'
      ]
    };
    return config;
  }
};

export default nextConfig;


