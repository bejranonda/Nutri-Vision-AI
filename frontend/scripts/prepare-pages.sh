#!/bin/bash
# Post-build script to prepare assets for Cloudflare Pages deployment
# Required for Windows compatibility with OpenNext Cloudflare

ASSETS_DIR=".open-next/assets"

echo "Preparing assets for Cloudflare Pages..."

# Copy worker.js as _worker.js
cp .open-next/worker.js "$ASSETS_DIR/_worker.js"

# Copy dependencies
cp -r .open-next/cloudflare "$ASSETS_DIR/" 2>/dev/null || true
cp -r .open-next/middleware "$ASSETS_DIR/" 2>/dev/null || true
cp -r .open-next/.build "$ASSETS_DIR/" 2>/dev/null || true
cp -r .open-next/server-functions "$ASSETS_DIR/" 2>/dev/null || true

# Create _routes.json for Cloudflare Pages Functions routing
cat > "$ASSETS_DIR/_routes.json" << 'EOF'
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/_next/static/*",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.gif",
    "/*.svg",
    "/*.ico",
    "/*.webp"
  ]
}
EOF

echo "Assets prepared successfully!"
echo "Total files: $(find $ASSETS_DIR -type f | wc -l)"
