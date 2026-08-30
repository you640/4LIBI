# Skript na diagnostiku oboch typov Railway Tokenov (Project Token aj Account Token)
$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "🔍 Diagnostika Railway Tokenu (36 znakov)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vložte token (bude zamaskovaný hviezdičkami)." -ForegroundColor Yellow

$token = Read-Host -Prompt "Vložte váš Railway Token" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
$plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

if ([string]::IsNullOrWhiteSpace($plain)) {
    Write-Host "❌ Token nesmie byť prázdny." -ForegroundColor Red
    exit 1
}

$plain = $plain.Trim()
Write-Host "`nℹ️ Dĺžka tokenu: $($plain.Length) znakov." -ForegroundColor Cyan

# Test 1: Test ako PROJECT TOKEN (Project-Access-Token)
Write-Host "`n1. Testujem ako Project Token (Project-Access-Token)..." -ForegroundColor Cyan
try {
    $body = '{"query": "query { projectToken { projectId environmentId } }"}'
    $projResp = Invoke-RestMethod -Uri "https://backboard.railway.com/graphql/v2" `
        -Method Post `
        -Headers @{
            "Project-Access-Token" = $plain
            "Content-Type"         = "application/json"
        } `
        -Body $body `
        -ErrorAction Stop

    if ($projResp.data.projectToken) {
        Write-Host "🎉 ÚSPECH! Toto JE platný Railway Project Token!" -ForegroundColor Green
        Write-Host "   Project ID:     $($projResp.data.projectToken.projectId)" -ForegroundColor Green
        Write-Host "   Environment ID: $($projResp.data.projectToken.environmentId)" -ForegroundColor Green
        Write-Host "   💡 Tento token sa v CI/CD a GitHub Actions používa presne pod názvom: RAILWAY_TOKEN" -ForegroundColor Gray
        exit 0
    } elseif ($projResp.errors) {
        Write-Host "   Nie je to Project Token: $($projResp.errors[0].message)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Volanie ako Project Token zlyhalo: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Test 2: Test ako USER / ACCOUNT TOKEN (Bearer)
Write-Host "`n2. Testujem ako User/Account Token (Bearer)..." -ForegroundColor Cyan
try {
    $body = '{"query": "query { me { email name id } }"}'
    $userResp = Invoke-RestMethod -Uri "https://backboard.railway.com/graphql/v2" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $plain"
            "Content-Type"  = "application/json"
        } `
        -Body $body `
        -ErrorAction Stop

    if ($userResp.data.me) {
        Write-Host "🎉 ÚSPECH! Toto JE platný Railway Account/Workspace Token!" -ForegroundColor Green
        Write-Host "   Používateľ: $($userResp.data.me.email) ($($userResp.data.me.name))" -ForegroundColor Green
        Write-Host "   💡 Tento token sa používa pod názvom: RAILWAY_API_TOKEN" -ForegroundColor Gray
        exit 0
    } elseif ($userResp.errors) {
        Write-Host "   Nie je to Account Token: $($userResp.errors[0].message)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Volanie ako Account Token zlyhalo: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n❌ Token nebol rozpoznaný ani ako Project Token, ani ako Account Token." -ForegroundColor Red
Write-Host "Overte, prosím, či ste neskopírovali ID projektu/služby namiesto vygenerovaného tajného kľúča." -ForegroundColor Yellow
