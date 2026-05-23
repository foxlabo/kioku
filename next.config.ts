import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // better-sqlite3 ships a native binding that must be loaded server-side
  // rather than bundled. Keeping it external avoids the turbopack warning
  // and the "Could not locate the bindings file" error in dev.
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
