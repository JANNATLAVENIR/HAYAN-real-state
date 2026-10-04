$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path 'supabase/config.toml')) {
  throw 'Supabase CLI config is missing. Run `pnpm exec supabase init` from the repository root.'
}

$envPath = 'artifacts/mobile/.env'
$projectRef = $null
if (Test-Path $envPath) {
  $envText = Get-Content $envPath -Raw
  $urlMatch = [regex]::Match($envText, '(?m)^\s*EXPO_PUBLIC_SUPABASE_URL\s*=\s*["'']?([^"''#\r\n]+)')
  if ($urlMatch.Success) {
    $urlValue = $urlMatch.Groups[1].Value.Trim()
    $hostName = ([uri]$urlValue).Host
    $refMatch = [regex]::Match($hostName, '^([a-z0-9-]+)\.supabase\.co$', 'IgnoreCase')
    if ($refMatch.Success) {
      $projectRef = $refMatch.Groups[1].Value
    }
  }
}

if (-not $projectRef) {
  $projectRef = Read-Host 'Geli Supabase Project Settings > General > Project ID'
}
if ([string]::IsNullOrWhiteSpace($projectRef)) {
  throw 'A Supabase project ref is required to link this repository.'
}

Write-Host 'Supabase will request your account login below. Enter credentials only in the CLI prompt.'
& pnpm exec supabase login
if ($LASTEXITCODE -ne 0) {
  throw 'Supabase login did not complete.'
}

Write-Host "Linking repository to Supabase project $projectRef ..."
& pnpm exec supabase link --project-ref $projectRef
if ($LASTEXITCODE -ne 0) {
  throw 'Supabase project linking did not complete.'
}

Write-Host 'Checking local and remote migration history (read-only)...'
& pnpm exec supabase migration list
if ($LASTEXITCODE -ne 0) {
  throw 'Could not read migration history. No SQL was applied.'
}

Write-Host 'Connected. No SQL migrations were applied by this setup command.'
