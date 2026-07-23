/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  transpilePackages: ['cobe'],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs ships a universal bundle importing `node:fs` / `node:https`
      // for its Node path — never executed in the browser, but webpack rejects
      // the `node:` scheme outright. Strip the scheme, then stub the modules.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '')
        }),
      )
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, https: false, http: false, path: false, os: false, crypto: false,
      }
    }
    return config
  },
}

export default nextConfig
