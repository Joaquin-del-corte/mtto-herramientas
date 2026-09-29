# Mantenimiento de Herramientas

App interna para el mantenimiento de herramientas manuales, eléctricas e instrumentos
(trabajos eléctricos, automatización, CCTV, fotovoltaico y soldadura).

Frontend + API + base de datos, desplegable en **Azure Static Web Apps** (plan gratuito)
con **Azure Functions** y **Azure SQL Database**. Login propio con usuario y contraseña.

## Estructura del repositorio

```
/
├─ index.html                 App (interfaz)
├─ sw.js                      Service worker (uso sin señal)
├─ staticwebapp.config.json   Rutas del Static Web App
├─ api/                       Backend (Azure Functions, Node 18)
│  ├─ host.json
│  ├─ package.json
│  └─ src/
│     ├─ index.js             Login, datos y permisos por rol
│     ├─ dal.js               Acceso a Azure SQL
│     └─ catalog.js           Catálogo de herramientas + datos de ejemplo
└─ docs/
   ├─ db_azure_sql.sql        Script para crear las tablas
   └─ Guia_Despliegue_Azure.html  Guía paso a paso (ábrela en el navegador)
```

## Despliegue (resumen)

1. **Base de datos:** crea un *Azure SQL Database* (autenticación SQL) y ejecuta `docs/db_azure_sql.sql` en el *Query editor*. En *Networking* del servidor, activa "Allow Azure services".
2. **Static Web App:** crea un *Static Web App* (plan Free) conectado a este repositorio con:
   - **App location:** `/`
   - **Api location:** `api`
   - **Output location:** *(vacío)*
3. **Variables de entorno** (Static Web App → *Environment variables*), nunca en el código:

   | Nombre | Valor |
   |---|---|
   | `SQL_SERVER` | `tuservidor.database.windows.net` |
   | `SQL_DATABASE` | `mantenimiento` |
   | `SQL_USER` | usuario admin de SQL |
   | `SQL_PASSWORD` | contraseña del admin de SQL |
   | `JWT_SECRET` | frase secreta larga y aleatoria (30+ caracteres) |

4. **Primer ingreso:** abre la URL del Static Web App y entra con `admin` / `Admin1234` (te obliga a cambiar la contraseña). Se crean solos los datos de ejemplo.

La guía completa con las pantallas del portal está en `docs/Guia_Despliegue_Azure.html`.

## Seguridad

- Las contraseñas se guardan **cifradas** (bcrypt); nunca en texto plano.
- Los secretos (`SQL_PASSWORD`, `JWT_SECRET`) van en la configuración de Azure, **no** en el repositorio.
- Cambia o elimina las cuentas de ejemplo (`jperez`, `msoto`, `rlopez`, clave `Clave1234`) antes de usarlo en producción.
