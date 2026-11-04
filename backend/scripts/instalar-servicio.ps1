#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Registra Parking Map como servicio de Windows con NSSM (arranque y reinicio automáticos).
.EXAMPLE
  .\instalar-servicio.ps1 -Cuenta "SERVIDOR\svc-parking" -Clave (Read-Host -AsSecureString)
#>
param(
  [string]$Raiz = 'C:\apps\parking-map',
  [string]$Servicio = 'ParkingMap',
  [string]$Puerto = '4040',
  [Parameter(Mandatory)][string]$Cuenta,
  [Parameter(Mandatory)][securestring]$Clave
)
$ErrorActionPreference = 'Stop'

if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) { throw 'No se encontró nssm en el PATH. Descárgalo de https://nssm.cc' }
$node = (Get-Command node).Source

foreach ($carpeta in 'datos', 'logs', 'versiones', 'respaldos') {
  New-Item -ItemType Directory -Force (Join-Path $Raiz $carpeta) | Out-Null
}

$actual = Join-Path $Raiz 'actual\backend'
$datos = Join-Path $Raiz 'datos'
$logs = Join-Path $Raiz 'logs'

nssm install $Servicio $node (Join-Path $actual 'index.js')
nssm set $Servicio AppDirectory $actual
nssm set $Servicio Start SERVICE_AUTO_START
nssm set $Servicio AppExit Default Restart
nssm set $Servicio AppRestartDelay 5000
# Ctrl+C para el apagado ordenado; 12 s para dar margen a los 10 s del proceso
nssm set $Servicio AppStopMethodConsole 12000
nssm set $Servicio AppStdout (Join-Path $logs 'servicio.log')
nssm set $Servicio AppStderr (Join-Path $logs 'servicio-error.log')
nssm set $Servicio AppRotateFiles 1
nssm set $Servicio AppRotateBytes 10485760
nssm set $Servicio AppEnvironmentExtra "NODE_ENV=production" "PORT=$Puerto" "DATA_DIR=$datos" "LOG_DIR=$logs"

# Cuenta sin privilegios de administrador, con acceso solo a la carpeta de la app
$credencial = [System.Net.NetworkCredential]::new('', $Clave).Password
nssm set $Servicio ObjectName $Cuenta $credencial
Remove-Variable credencial
icacls $Raiz /grant "${Cuenta}:(OI)(CI)M" | Out-Null

Write-Host "Servicio $Servicio registrado. Ejecuta desplegar.ps1 para instalar la primera versión."
