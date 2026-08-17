/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/projects.json',
        '**/users.json',
        '**/public/uploads/**',
        '**/laravel-api/**',
        '**/frontend/**',
        '**/backend/uploads/**',
        '**/.git/**',
        '**/.next/**'
      ]
    };
    return config;
  }
};

export default nextConfig;


