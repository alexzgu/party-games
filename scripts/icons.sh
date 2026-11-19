#!/bin/sh
# Rasterises public/icon.svg into the PNG sizes the manifest and iOS need.
set -e
cd "$(dirname "$0")/../public"
rsvg-convert -w 192 -h 192 icon.svg -o icon-192.png
rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png
# iOS adds its own rounded mask; give it a full-bleed square.
rsvg-convert -w 180 -h 180 -b '#120d24' icon.svg -o apple-touch-icon.png
