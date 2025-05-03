/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'encrypted-tbn0.gstatic.com',
      'tbn0.gstatic.com',
      'tbn1.gstatic.com',
      'tbn2.gstatic.com',
      'tbn3.gstatic.com',
      'localhost',
      '127.0.0.1',
      '192.168.1.100',
    ],
  },
};

module.exports = nextConfig;
