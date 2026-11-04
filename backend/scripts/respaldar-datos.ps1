<#
.SYNOPSIS
  Copia los archivos de datos a una carpeta con fecha y conserva los últimos días.
  Pensado para el Programador de tareas. -Destino debería estar fuera de este servidor.
.EXAMPLE
  .\respaldar-datos.ps1 -Datos C:\apps\parking-map\datos -Destino \\respaldos\parking-map
#>
param(
  [string]$Datos = 'C:\apps\parking-map\datos',
  [string]$Destino = 'C:\apps\parking-map\respaldos',
  [int]$DiasRetencion = 30
)
$ErrorActionPreference = 'Stop'

$archivos = Get-ChildItem $Datos -Filter '*.json'
if (-not $archivos) { throw "No hay archivos de datos en $Datos" }

# Un respaldo con un JSON dañado no sirve: se detecta aquí y no el día que haga falta
foreach ($archivo in $archivos) {
  Get-Content $archivo.FullName -Raw | ConvertFrom-Json | Out-Null
}

$carpeta = Join-Path $Destino (Get-Date -Format 'yyyy-MM-dd_HHmm')
New-Item -ItemType Directory -Force $carpeta | Out-Null
$archivos | Copy-Item -Destination $carpeta

Get-ChildItem $Destino -Directory |
  Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{4}$' -and $_.LastWriteTime -lt (Get-Date).AddDays(-$DiasRetencion) } |
  ForEach-Object { Remove-Item $_.FullName -Recurse -Force -Confirm:$false }

Write-Host "Respaldo creado en $carpeta"
