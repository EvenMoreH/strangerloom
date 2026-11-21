#!/bin/sh
# Regenerates the favicons and PWA icons from assets/icon.svg and assets/icon-maskable.svg.
# Requires rsvg-convert (librsvg) and magick (ImageMagick 7) for the .ico file.
set -e
cd "$(dirname "$0")/.."
cp assets/icon.svg public/favicon.svg
for s in 16 32 48; do
	rsvg-convert -w $s -h $s assets/icon.svg -o public/favicon-$s.png
done
magick public/favicon-16.png public/favicon-32.png public/favicon-48.png public/favicon.ico
rsvg-convert -w 180 -h 180 assets/icon.svg -o public/apple-touch-icon.png
rsvg-convert -w 192 -h 192 assets/icon.svg -o public/pwa-192x192.png
rsvg-convert -w 512 -h 512 assets/icon.svg -o public/pwa-512x512.png
rsvg-convert -w 512 -h 512 assets/icon-maskable.svg -o public/maskable-512x512.png
echo "icons written to public/"
