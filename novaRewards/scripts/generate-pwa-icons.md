# Generate PWA Icons

## Option 1: Using PWA Asset Generator (Recommended)

```bash
npm install -g pwa-asset-generator

# Generate all icons from a single source image
pwa-asset-generator source-logo.png ./novaRewards/frontend/public/icons \
  --icon-only \
  --favicon \
  --type png \
  --padding "10%"
```

## Option 2: Using ImageMagick

```bash
# Install ImageMagick first
# Then run these commands with your source image

convert source-logo.png -resize 72x72 novaRewards/frontend/public/icons/icon-72x72.png
convert source-logo.png -resize 96x96 novaRewards/frontend/public/icons/icon-96x96.png
convert source-logo.png -resize 128x128 novaRewards/frontend/public/icons/icon-128x128.png
convert source-logo.png -resize 144x144 novaRewards/frontend/public/icons/icon-144x144.png
convert source-logo.png -resize 152x152 novaRewards/frontend/public/icons/icon-152x152.png
convert source-logo.png -resize 192x192 novaRewards/frontend/public/icons/icon-192x192.png
convert source-logo.png -resize 384x384 novaRewards/frontend/public/icons/icon-384x384.png
convert source-logo.png -resize 512x512 novaRewards/frontend/public/icons/icon-512x512.png
```

## Option 3: Online Tools

Use online PWA icon generators:
- https://www.pwabuilder.com/imageGenerator
- https://realfavicongenerator.net/

Upload your logo and download the generated icons to `novaRewards/frontend/public/icons/`
