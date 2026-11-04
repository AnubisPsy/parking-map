<#
.SYNOPSIS
  Instala una versión nueva en una carpeta con fecha y vuelve atrás si no arranca.
.DESCRIPTION
  Requiere `npm run build` previo en frontend. Los datos y los logs viven fuera de la
  carpeta de versión, así que cambiar de versión nunca los toca.
.EXAMPLE
  .\desplegar.ps1 -EnvFile C:\apps\parking-map\.env.production
.EXAMPLE
  .\desplegar.ps1 -VolverA 2026-11-01_1050
#>
param(
  [string]$Raiz = 'C:\apps\parking-map',
  [string]$Servicio = 'ParkingMap',
  [string]$Puerto = '4040',
  [string]$EnvFile,
  [string]$VolverA,
  [int]$Conservar = 5,
  # Para ensayar la copia y el enlace en un equipo sin el servicio instalado
  [switch]$SinServicio
)
$ErrorActionPreference = 'Stop'

$versiones = Join-Path $Raiz 'versiones'
$actual = Join-Path $Raiz 'actual'

function Get-VersionActual {
  if (Test-Path $actual) { return (Get-Item $actual).Target | Select-Object -First 1 }
}

function Set-VersionActual([string]$destino) {
  # rmdir sobre un enlace de carpeta quita solo el enlace, no su contenido
  if (Test-Path $actual) { cmd /c rmdir "$actual" | Out-Null }
  New-Item -ItemType Junction -Path $actual -Target $destino | Out-Null
}

function Test-Salud {
  foreach ($intento in 1..15) {
    try {
      $respuesta = Invoke-RestMethod "http://localhost:$Puerto/api/health" -TimeoutSec 3
      if ($respuesta.status -eq 'ok') { return $true }
    } catch { Start-Sleep -Seconds 2 }
  }
  return $false
}

function Restart-App {
  if ($SinServicio) { return $true }
  Restart-Service $Servicio
  return Test-Salud
}

function Use-Version([string]$destino) {
  $anterior = Get-VersionActual
  Set-VersionActual $destino
  if (Restart-App) {
    Write-Host "Activa: $(Split-Path $destino -Leaf)"
    return
  }
  if ($anterior) {
    Write-Warning 'La versión nueva no pasó /api/health. Volviendo a la anterior.'
    Set-VersionActual $anterior
    if (Restart-App) { throw "Se restauró $(Split-Path $anterior -Leaf). La versión $(Split-Path $destino -Leaf) no quedó activa." }
    throw 'Tampoco arrancó la versión anterior: revisa los logs de inmediato.'
  }
  throw 'La versión no pasó /api/health y no hay una anterior a la que volver.'
}

if ($VolverA) {
  $destino = Join-Path $versiones $VolverA
  if (-not (Test-Path $destino)) { throw "No existe la versión $VolverA" }
  Use-Version $destino
  return
}

if (-not $EnvFile -or -not (Test-Path $EnvFile)) { throw 'Indica -EnvFile con el .env.production del servidor.' }

$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$dist = Join-Path $repo 'frontend\dist'
if (-not (Test-Path (Join-Path $dist 'index.html'))) { throw 'Falta frontend\dist: ejecuta npm run build en frontend.' }

$destino = Join-Path $versiones (Get-Date -Format 'yyyy-MM-dd_HHmm')
if (Test-Path $destino) { throw "Ya existe $destino" }
New-Item -ItemType Directory -Force "$destino\backend", "$destino\frontend" | Out-Null

robocopy (Join-Path $repo 'backend') "$destino\backend" /E /NFL /NDL /NJH /NJS /NP `
  /XD node_modules data logs test /XF '.env' '.env.production' | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falló con código $LASTEXITCODE" }
robocopy $dist "$destino\frontend\dist" /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falló con código $LASTEXITCODE" }

Copy-Item $EnvFile "$destino\backend\.env.production"

Push-Location "$destino\backend"
try {
  npm ci --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci falló' }
} finally {
  Pop-Location
}

Use-Version $destino

# Conserva las últimas versiones y nunca borra la activa
$activa = Get-VersionActual
Get-ChildItem $versiones -Directory | Sort-Object Name -Descending | Select-Object -Skip $Conservar |
  Where-Object { $_.FullName -ne $activa } |
  ForEach-Object { Remove-Item $_.FullName -Recurse -Force -Confirm:$false }
