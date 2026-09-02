#!/bin/bash
# Vercel build script for Vite + React + TypeScript

set -e

echo "Installing dependencies..."
npm install --legacy-peer-deps || npm install

echo "Running TypeScript type check..."
npx tsc --noEmit

echo "Building Vite app..."
npm run build

echo "Build complete!"
ls -la dist/
