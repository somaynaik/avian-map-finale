# Authentication Setup Script for Windows PowerShell
# This script helps you set up authentication for your app

Write-Host "🔐 Authentication Setup Wizard" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env already exists
if (Test-Path .env) {
    Write-Host "⚠️  .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit 1
    }
}

# Copy .env.example to .env
if (Test-Path .env.example) {
    Copy-Item .env.example .env
    Write-Host "✅ Created .env file from .env.example" -ForegroundColor Green
} else {
    Write-Host "❌ .env.example not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📝 Please provide your Supabase credentials:" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can find these in your Supabase dashboard:"
Write-Host "https://app.supabase.com/project/_/settings/api" -ForegroundColor Blue
Write-Host ""

# Get Supabase URL
$supabase_url = Read-Host "Enter your Supabase URL"
if ([string]::IsNullOrWhiteSpace($supabase_url)) {
    Write-Host "❌ Supabase URL is required!" -ForegroundColor Red
    exit 1
}

# Get Supabase Anon Key
$supabase_key = Read-Host "Enter your Supabase Anon Key"
if ([string]::IsNullOrWhiteSpace($supabase_key)) {
    Write-Host "❌ Supabase Anon Key is required!" -ForegroundColor Red
    exit 1
}

# Update .env file
$content = Get-Content .env
$content = $content -replace "your_supabase_project_url", $supabase_url
$content = $content -replace "your_supabase_anon_key", $supabase_key
$content | Set-Content .env

Write-Host ""
Write-Host "✅ Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Next steps:" -ForegroundColor Cyan
Write-Host "1. Make sure you've enabled Email authentication in Supabase"
Write-Host "2. Run 'npm run dev' to start the development server"
Write-Host "3. Visit http://localhost:5173 to see your app"
Write-Host "4. Read AUTH_SETUP.md for detailed setup instructions"
Write-Host ""
Write-Host "🎉 Happy coding!" -ForegroundColor Green
