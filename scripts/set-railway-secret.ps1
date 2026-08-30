# Skript na bezpečné uloženie Railway tokenu do GitHub Secrets
$ErrorActionPreference = "Stop"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "🔒 Bezpečné nastavenie Railway Tokenu do GitHub Secrets" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Token sa pri vkladaní zamaskuje hviezdičkami (****)." -ForegroundColor Yellow

$token = Read-Host -Prompt "Vložte váš Railway Token" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
$plainToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

if ([string]::IsNullOrWhiteSpace($plainToken)) {
    Write-Host "❌ Chyba: Token nesmie byť prázdny." -ForegroundColor Red
    exit 1
}

# Odstránenie nechcených medzier / odriadkovaní
$plainToken = $plainToken.Trim()

Write-Host "`nUkladám do GitHub repozitára you640/4LIBI (dĺžka: $($plainToken.Length) znakov)..." -ForegroundColor Cyan
$plainToken | gh secret set RAILWAY_API_TOKEN -R you640/4LIBI
$plainToken | gh secret set RAILWAY_TOKEN -R you640/4LIBI

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ HOTOVO: Token bol bezpečne uložený do GitHub Secrets (RAILWAY_API_TOKEN aj RAILWAY_TOKEN)!" -ForegroundColor Green
    Write-Host "Môžete si to overiť príkazom: gh secret list -R you640/4LIBI" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Nastala chyba pri ukladaní do GitHub Secrets." -ForegroundColor Red
}
