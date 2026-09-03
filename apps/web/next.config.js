/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  allowedDevOrigins: ['127.0.0.1', 'localhost', '*.trycloudflare.com'],
  // Loại bỏ toàn bộ console.log, console.info, console.warn, console.error ở tầng compiler trên production
  compiler: {
    removeConsole: isProd ? true : false,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.INTERNAL_API_ORIGIN || 'http://127.0.0.1:3001'}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
