#!/bin/bash

echo "🚀 Setting up PWA for Nova Rewards..."

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd novaRewards/backend
npm install

# Generate VAPID keys
echo "🔑 Generating VAPID keys..."
echo ""
echo "Add these to your .env file:"
echo "================================"
npx web-push generate-vapid-keys
echo "================================"
echo ""

# Create icons directory
echo "📱 Creating icons directory..."
mkdir -p ../frontend/public/icons

echo ""
echo "✅ PWA setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy the VAPID keys above to your .env file"
echo "2. Generate app icons (see scripts/generate-pwa-icons.md)"
echo "3. Build and test: cd frontend && npm run build && npm start"
echo ""
