# 🤾 Handball Defensa y Justicia — Planificador v1.0

Aplicación web para entrenadores. Crear, editar, buscar y exportar planificaciones en PDF.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS (verde institucional + dorado DJ) |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| PDF | @react-pdf/renderer (formato Defensa y Justicia) |
| Drag & Drop | @dnd-kit |
| Estado | Zustand |
| Deploy | Vercel |

---

## Flujo de pantallas

```
Login (usuario + contraseña)
  ↓
Selección de categoría (ej: Menores / Infantiles)
  ↓
Menú principal
  ├── Crear entrenamiento → Editor → Exportar PDF
  └── Biblioteca → Ver / Editar / Duplicar / PDF
```

---

## Setup paso a paso

### Paso 1 — Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Nombre: `handball-dj`, región: **South America (São Paulo)**
3. Guardar la contraseña del proyecto

### Paso 2 — Crear las tablas

1. Supabase → **SQL Editor** → **New query**
2. Pegar el contenido completo de `supabase-schema.sql`
3. Ejecutar (▶ **Run**)
4. Verificar en **Table Editor** que aparecen: `profiles`, `training_sessions`, `moments`, `exercises`, `exercise_labels`

### Paso 3 — Crear los buckets de Storage

1. Supabase → **Storage** → **New bucket**
2. Crear bucket `moments` → marcar **Public bucket** → Save
3. Crear bucket `exercises` → marcar **Public bucket** → Save
4. Ir a **SQL Editor** y ejecutar las políticas de storage (las líneas comentadas al final del schema)

### Paso 4 — Variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local`:
- `VITE_SUPABASE_URL` → Supabase → Settings → API → **Project URL**
- `VITE_SUPABASE_ANON_KEY` → Supabase → Settings → API → **anon / public**

### Paso 5 — Correr en local

```bash
npm install
npm run dev
# Abrir http://localhost:5173
```

---

## Crear el primer entrenador

### Método A — Desde Supabase Dashboard (recomendado)

1. Supabase → **Authentication** → **Users** → **Invite user**
2. Email: `nombre_usuario@hbdj.internal`
   - Ejemplo: si el usuario será `emi_garcia`, el email es `emi_garcia@hbdj.internal`
3. El entrenador recibirá un email para setear su contraseña
4. Después de que confirme, ir a **Table Editor** → **profiles** → editar el registro:
   - `username`: `emi_garcia`
   - `full_name`: `Emanuel García`
   - `role`: `coach`
   - `categories`: `{Menores,Infantiles}` ← así con llaves, sin espacios extras
   - `avatar_color`: cualquier color hex, ej: `#1e8a1e`

### Método B — Via SQL

```sql
-- Primero crear el usuario via Authentication → Invite user
-- Luego actualizar el perfil:
UPDATE public.profiles SET
  full_name    = 'Emanuel García',
  username     = 'emi_garcia',
  role         = 'coach',
  categories   = ARRAY['Menores', 'Infantiles'],
  avatar_color = '#1e8a1e'
WHERE id = '<UUID_DEL_USUARIO>';
```

### Login del entrenador

El entrenador entra a la app con:
- **Usuario**: `emi_garcia` (lo que venga antes del `@` en el email)
- **Contraseña**: la que él mismo seteó

---

## Deploy en Vercel

### Opción 1 — GitHub (recomendado, actualizaciones automáticas)

```bash
git init
git add .
git commit -m "Handball DJ v1.0"
git remote add origin https://github.com/tu-usuario/handball-dj.git
git push -u origin main
```

1. Ir a [vercel.com](https://vercel.com) → **Add New Project**
2. Importar el repositorio
3. En **Environment Variables**, agregar:
   - `VITE_SUPABASE_URL` = tu URL
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
4. **Deploy** → URL pública lista en ~2 min

### Opción 2 — Vercel CLI

```bash
npm install -g vercel
vercel
# Seguir el wizard
```

---

## Estructura del proyecto

```
handball-v1/
├── public/
│   └── logo.svg                    # Logo del club
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppLayout.tsx       # Sidebar verde institucional
│   │   ├── training/
│   │   │   └── MomentCard.tsx      # Tarjeta de momento (drag & drop + ↑↓)
│   │   └── ui/
│   │       └── index.tsx           # Button, Input, Select, Card, Toast, Modal...
│   ├── hooks/
│   │   └── useAuth.ts              # Sesión de Supabase
│   ├── lib/
│   │   ├── constants.ts            # Categorías, colores
│   │   ├── pdf.tsx                 # Generador PDF formato DJ
│   │   ├── store.ts                # Estado global (Zustand)
│   │   └── supabase.ts             # Cliente + helpers de BD
│   ├── pages/
│   │   ├── LoginPage.tsx           # Pantalla 1: Login con usuario
│   │   ├── CategoryPage.tsx        # Pantalla 2: Selección categoría
│   │   ├── MenuPage.tsx            # Pantalla 3: Menú principal
│   │   ├── TrainingEditorPage.tsx  # Pantalla 4: Crear/Editar entrenamiento
│   │   ├── LibraryPage.tsx         # Biblioteca de entrenamientos
│   │   └── ExercisesPage.tsx       # Biblioteca de ejercicios
│   ├── types/
│   │   └── index.ts                # Tipos TypeScript
│   ├── App.tsx                     # Router + guards
│   └── main.tsx                    # Entry point
├── supabase-schema.sql             # SQL completo para ejecutar en Supabase
├── .env.example                    # Variables de entorno de ejemplo
└── README.md
```

---

## Funciones incluidas en v1.0

- ✅ Login con nombre de usuario (sin email visible)
- ✅ Selección de categoría por entrenador
- ✅ Menú principal con accesos directos
- ✅ Crear / editar entrenamientos
- ✅ Momentos con drag & drop y botones ↑↓
- ✅ Lista desplegable de ejercicios **editable** (agregar / quitar)
- ✅ Subida de imágenes (capturas de TacticalBoard)
- ✅ Indicador de duración acumulada vs. total
- ✅ Estado borrador / guardado
- ✅ Biblioteca con filtros (categoría, contenido, profesor, búsqueda)
- ✅ Ver / Editar / Duplicar / Eliminar entrenamientos
- ✅ Export PDF con formato Defensa y Justicia (grilla 2x2 con imágenes)
- ✅ Biblioteca de ejercicios

## Funciones para v2.0

- ⬜ Pizarra táctica integrada
- ⬜ Generación automática con IA
- ⬜ Planificación anual / macrociclos / mesociclos
- ⬜ Estadísticas de uso de ejercicios
- ⬜ Compartir entrenamientos entre entrenadores
- ⬜ Logo del club en PDF (subida de imagen real)

---

## Troubleshooting

**"Faltan variables de entorno"**
→ Verificar que `.env.local` existe y tiene las dos variables de Supabase.

**"Usuario o contraseña incorrectos"**
→ El email interno es `username@hbdj.internal`. Verificar en Authentication → Users que está confirmado.

**Las imágenes no suben**
→ Verificar que los buckets `moments` y `exercises` existen en Storage con las políticas aplicadas.

**"Perfil no encontrado"**
→ El usuario existe en Auth pero no en profiles. Actualizar la tabla profiles con el UUID correcto.
