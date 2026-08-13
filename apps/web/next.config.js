/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  allowedDevOrigins: ['127.0.0.1'],
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
