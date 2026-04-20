#!/bin/bash

# Authentication Setup Script
# This script helps you set up authentication for your app

echo "🔐 Authentication Setup Wizard"
echo "================================"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

# Copy .env.example to .env
if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
else
    echo "❌ .env.example not found!"
    exit 1
fi

echo ""
echo "📝 Please provide your Supabase credentials:"
echo ""
echo "You can find these in your Supabase dashboard:"
echo "https://app.supabase.com/project/_/settings/api"
echo ""

# Get Supabase URL
read -p "Enter your Supabase URL: " supabase_url
if [ -z "$supabase_url" ]; then
    echo "❌ Supabase URL is required!"
    exit 1
fi

# Get Supabase Anon Key
read -p "Enter your Supabase Anon Key: " supabase_key
if [ -z "$supabase_key" ]; then
    echo "❌ Supabase Anon Key is required!"
    exit 1
fi

# Update .env file
sed -i.bak "s|your_supabase_project_url|$supabase_url|g" .env
sed -i.bak "s|your_supabase_anon_key|$supabase_key|g" .env
rm .env.bak 2>/dev/null

echo ""
echo "✅ Configuration complete!"
echo ""
echo "📚 Next steps:"
echo "1. Make sure you've enabled Email authentication in Supabase"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:5173 to see your app"
echo "4. Read AUTH_SETUP.md for detailed setup instructions"
echo ""
echo "🎉 Happy coding!"
