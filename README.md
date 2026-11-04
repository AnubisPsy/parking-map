# Parking Map

Mapa de estacionamientos, recorridos GPS y reportes semanales y de infracciones de la flota, a partir de archivos Excel del sistema GPS.

## Requisitos

Node.js 24.

## Ejecutar en desarrollo

En Windows, abre `run parking-map.bat`. Instala las dependencias si faltan, levanta el backend y el frontend, y abre http://localhost:5050.

O bien, en dos terminales:

```powershell
cd backend; npm ci; npm run dev
cd frontend; npm ci; npm run dev
```

La configuración es opcional en desarrollo. Para cambiarla, copia `backend/.env.example` como `backend/.env`.

## Datos

Se guardan en archivos JSON en `backend/data/`, que no se versiona porque contiene información de la flota.

## Pruebas

```powershell
cd backend; npm test; npm run lint
cd frontend; npm run typecheck; npm run build
```

## Producción

Ver [backend/OPERACION.md](backend/OPERACION.md).
