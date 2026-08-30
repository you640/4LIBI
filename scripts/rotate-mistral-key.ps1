=====================================================
🔄 Rotácia MISTRAL_API_KEY do GitHub Secrets
=====================================================

param(
    [string]$Repo = "you640/4LIBI"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " Rotácia MISTRAL_API_KEY → GitHub Secrets" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# --- Krok 1: Načítaj nový kľúč maskovaný ---
$NewKey = Read-Host "Vlož nový Mistral API key (bude zamaskovaný)" -AsSecureString
$PlainKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($NewKey)
)

if ($PlainKey.Length -lt 16) {
    Write-Host "✗ Kľúč je príliš krátky (min. 16 znakov). Skontroluj hodnotu." -ForegroundColor Red
    exit 1
}

# --- Krok 2: Overenie platnosti volaním Mistral API ---
Write-Host ""
Write-Host "1. Overujem platnosť kľúča volaním Mistral API..." -ForegroundColor Yellow

$Body = @{
    model    = "mistral-tiny"
    messages = @(@{ role = "user"; content = "ping" })
    max_tokens = 1
} | ConvertTo-Json -Depth 5

try {
    $Response = Invoke-RestMethod `
        -Uri "https://api.mistral.ai/v1/chat/completions" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $PlainKey"
            "Content-Type"  = "application/json"
        } `
        -Body $Body `
        -TimeoutSec 15

    if ($Response.choices) {
        Write-Host "   ✓ Kľúč je platný — Mistral API odpovedal OK" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Neočakávaná odpoveď od Mistral API" -ForegroundColor Red
        exit 1
    }
} catch {
    $StatusCode = $_.Exception.Response?.StatusCode?.value__
    if ($StatusCode -eq 401) {
        Write-Host "   ✗ Neautorizovaný (401) — kľúč je neplatný alebo expiroval" -ForegroundColor Red
    } elseif ($StatusCode -eq 429) {
        Write-Host "   ⚠ Rate limit (429) — kľúč pravdepodobne platný, ale prekročil limit" -ForegroundColor Yellow
        Write-Host "   Pokračujem s ukladaním..." -ForegroundColor Yellow
    } else {
        Write-Host "   ✗ Chyba: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# --- Krok 3: Ulož do GitHub Secrets ---
Write-Host ""
Write-Host "2. Ukladám do GitHub Secrets ($Repo)..." -ForegroundColor Yellow

try {
    $PlainKey | gh secret set MISTRAL_API_KEY -R $Repo
    Write-Host "   ✓ MISTRAL_API_KEY uložený do $Repo" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Chyba pri ukladaní do GitHub Secrets: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Skontroluj: gh auth status" -ForegroundColor Yellow
    exit 1
}

# --- Hotovo ---
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " ✅ HOTOVO: MISTRAL_API_KEY úspešne rotovaný!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Overiť: gh secret list -R $Repo" -ForegroundColor Gray
Write-Host "Pozor: Railway používa vlastné env premenné —" -ForegroundColor Gray
Write-Host "       aktualizuj aj MISTRAL_API_KEY v Railway dashboarde!" -ForegroundColor Yellow
Write-Host ""
