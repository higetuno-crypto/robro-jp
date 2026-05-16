import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 親ディレクトリの余分な lockfile を Turbopack がワークスペースルートと誤検出するのを防ぐ
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
