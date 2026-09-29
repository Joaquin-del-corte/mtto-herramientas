-- ============================================================
--  MANTENIMIENTO DE HERRAMIENTAS · Base de datos (Azure SQL)
--  Ejecuta este script una vez en tu base de Azure SQL Database
--  (desde el "Query editor" del portal, o Azure Data Studio / SSMS).
--  Es seguro re-ejecutarlo: no borra datos existentes.
-- ============================================================

-- Usuarios (con contraseña cifrada). role: 'admin' o 'tecnico'
IF OBJECT_ID('dbo.usuarios','U') IS NULL
CREATE TABLE dbo.usuarios (
  id            NVARCHAR(50)  NOT NULL PRIMARY KEY,
  username      NVARCHAR(100) NOT NULL UNIQUE,
  name          NVARCHAR(200) NOT NULL,
  role          NVARCHAR(20)  NOT NULL DEFAULT 'tecnico',
  password_hash NVARCHAR(200) NOT NULL,
  must_change   BIT           NOT NULL DEFAULT 1,      -- forzar cambio de clave inicial
  created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Inventario de herramientas (checklists guardados como JSON)
IF OBJECT_ID('dbo.herramientas','U') IS NULL
CREATE TABLE dbo.herramientas (
  id                  NVARCHAR(50)  NOT NULL PRIMARY KEY,
  code                NVARCHAR(50),
  name                NVARCHAR(300),
  category            NVARCHAR(100),
  brand               NVARCHAR(200),
  serial              NVARCHAR(200),
  location            NVARCHAR(200),
  assigned_to         NVARCHAR(50),
  status              NVARCHAR(50)  DEFAULT 'Operativa',
  last_monthly        DATE NULL,
  last_quarterly      DATE NULL,
  monthly_checklist   NVARCHAR(MAX),   -- JSON: ["item", ...]
  quarterly_checklist NVARCHAR(MAX)
);

-- Revisiones firmadas
IF OBJECT_ID('dbo.tickets','U') IS NULL
CREATE TABLE dbo.tickets (
  id         NVARCHAR(50) NOT NULL PRIMARY KEY,
  tool_id    NVARCHAR(50),
  tool_code  NVARCHAR(50),
  tool_name  NVARCHAR(300),
  user_id    NVARCHAR(50),
  user_name  NVARCHAR(200),
  type       NVARCHAR(20),        -- 'mensual' o 'trimestral'
  date       DATE,
  results    NVARCHAR(MAX),       -- JSON: [{item, value}]
  notes      NVARCHAR(MAX),
  result     NVARCHAR(20),        -- 'APROBADO' o 'REVISAR'
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Registro de fallas (abierta -> resuelta), con fotos en base64 dentro del JSON
IF OBJECT_ID('dbo.fallas','U') IS NULL
CREATE TABLE dbo.fallas (
  id               NVARCHAR(50) NOT NULL PRIMARY KEY,
  tool_id          NVARCHAR(50),
  tool_code        NVARCHAR(50),
  tool_name        NVARCHAR(300),
  reported_by      NVARCHAR(50),
  reported_by_name NVARCHAR(200),
  reported_date    DATE,
  items            NVARCHAR(MAX),   -- JSON: [{item, photo}]
  notes            NVARCHAR(MAX),
  status           NVARCHAR(20) DEFAULT 'abierta',
  resolved_by      NVARCHAR(50),
  resolved_by_name NVARCHAR(200),
  resolved_date    DATE,
  resolution_notes NVARCHAR(MAX),
  created_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Configuración general
IF OBJECT_ID('dbo.settings','U') IS NULL
CREATE TABLE dbo.settings (
  id      INT NOT NULL PRIMARY KEY,
  company NVARCHAR(200)
);

-- Índices útiles
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_herr_assigned')
  CREATE INDEX ix_herr_assigned ON dbo.herramientas(assigned_to);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_fallas_status')
  CREATE INDEX ix_fallas_status ON dbo.fallas(status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_tickets_tool')
  CREATE INDEX ix_tickets_tool ON dbo.tickets(tool_id);

-- Nota: la API crea automáticamente el usuario admin y los datos de
-- ejemplo la primera vez que se conecta (no hace falta insertarlos aquí).
