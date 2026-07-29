const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repository root holds the separate Vite app and its own lockfile, so
  // Next otherwise infers the parent directory as the workspace root and traces
  // the wrong files into the serverless bundle.
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
