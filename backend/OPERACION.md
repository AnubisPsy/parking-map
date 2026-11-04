# Operación de Parking Map

Guía para instalar y mantener el sistema en un servidor Windows.

## Estructura en el servidor

```
C:\apps\parking-map\
  actual\           enlace a la versión activa
  versiones\        una carpeta por despliegue (se conservan las últimas 5)
  datos\            archivos JSON: nunca se tocan al desplegar
  logs\             un archivo por día (se conservan 30 días)
  respaldos\
  .env.production   configuración de producción
```

## Primera instalación

1. Instala Node 24, [NSSM](https://nssm.cc) y crea una cuenta local sin privilegios de administrador.
2. Crea `C:\apps\parking-map\.env.production` a partir de `backend\.env.example`.
3. Registra el servicio, como administrador:
   ```powershell
   .\backend\scripts\instalar-servicio.ps1 -Cuenta "SERVIDOR\svc-parking" -Clave (Read-Host -AsSecureString)
   ```
4. Copia los datos actuales a `C:\apps\parking-map\datos`.
5. Restringe el archivo de configuración a la cuenta del servicio y a los administradores:
   ```powershell
   icacls C:\apps\parking-map\.env.production /inheritance:r /grant "SERVIDOR\svc-parking:R" "*S-1-5-32-544:F"
   ```
6. Despliega con `backend\scripts\desplegar.ps1`.

## Desplegar y volver atrás

```powershell
cd frontend; npm ci; npm run build; cd ..
.\backend\scripts\desplegar.ps1 -EnvFile C:\apps\parking-map\.env.production

# Volver a una versión anterior
.\backend\scripts\desplegar.ps1 -VolverA 2026-11-01_1050
```

El script reinicia el servicio y consulta `/api/health`. Si falla, restaura la versión anterior.

Después de desplegar, comprueba a mano: abrir el mapa, abrir un reporte y abrir un enlace compartido.

## Respaldos

Programa una tarea diaria con `backend\scripts\respaldar-datos.ps1`, con `-Destino` en otro equipo:

```powershell
$accion = New-ScheduledTaskAction -Execute powershell.exe -Argument '-File C:\apps\parking-map\actual\backend\scripts\respaldar-datos.ps1 -Destino \\respaldos\parking-map'
Register-ScheduledTask ParkingMapRespaldo -Action $accion -Trigger (New-ScheduledTaskTrigger -Daily -At 2am)
```

Para restaurar: detén el servicio, copia los `.json` del respaldo a `datos\` e inicia el servicio. Haz una restauración de prueba de vez en cuando.

## Monitoreo y diagnóstico

- **Salud:** `GET /api/health` responde 200 si los datos se pueden leer, y 503 si no. Puedes consultarlo cada 5 minutos desde el Programador de tareas o con Uptime Kuma.
- **Errores:** el usuario ve un mensaje con un código, por ejemplo `Código: a1b2c3d4`. Búscalo en los logs:
  ```powershell
  Select-String a1b2c3d4 C:\apps\parking-map\logs\app-*.log
  ```
- **Lentitud:** busca `Pedido lento` y `Operación de datos lenta` en los logs.
- **Memoria:** cada 15 minutos se registra `Uso de memoria`. Una subida constante durante días indica una fuga.

## Antes de cada versión

```powershell
cd backend; npm test; npm run lint; npm audit --omit=dev
cd ..\frontend; npm run typecheck; npm audit --omit=dev
```
