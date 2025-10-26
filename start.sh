#!/bin/bash

# DeepDive startup script

echo "🚀 Starting DeepDive..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
    echo ""
fi

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Warning: backend/.env not found!"
    echo "   Please create it from backend/.env.example and add your API keys:"
    echo "   - ANTHROPIC_API_KEY (from https://console.anthropic.com/)"
    echo "   - GOOGLE_API_KEY (from https://makersuite.google.com/app/apikey)"
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to exit..."
fi

# Start backend
echo ""
echo "🔥 Starting backend server..."
echo "   Running on http://localhost:3000"
echo ""
echo "📝 Next steps:"
echo "   1. Load the Chrome extension from the 'frontend' folder"
echo "   2. Visit any webpage and click the 🧠 icon"
echo ""
echo "Press Ctrl+C to stop the server"
echo "───────────────────────────────────────────────────────────"
echo ""

cd backend && npm start

