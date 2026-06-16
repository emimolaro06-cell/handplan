import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAppStore } from '@/lib/store'
import { AppLayout } from '@/components/layout/AppLayout'
import { Spinner } from '@/components/ui/index'

// Pages
import { LoginPage }          from '@/pages/LoginPage'
import { CategoryPage }       from '@/pages/CategoryPage'
import { MenuPage }           from '@/pages/MenuPage'
import { TrainingEditorPage } from '@/pages/TrainingEditorPage'
import { LibraryPage }        from '@/pages/LibraryPage'
import { ExercisesPage }      from '@/pages/ExercisesPage'

// ─── Guards ──────────────────────────────────────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dj-900">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={36}/>
          <p className="text-white/50 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace/>
  return <>{children}</>
}

// Requiere que el usuario haya seleccionado categoría
function CategoryGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const selectedCategory = useAppStore(s => s.selectedCategory)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dj-900">
        <Spinner size={36}/>
      </div>
    )
  }

  if (!profile)           return <Navigate to="/login"    replace/>
  if (!selectedCategory)  return <Navigate to="/categoria" replace/>
  return <>{children}</>
}

// Rutas con layout de app (sidebar)
function WithLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoryGuard>
      <AppLayout>{children}</AppLayout>
    </CategoryGuard>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<LoginPage/>}/>

        {/* Requiere auth pero no categoría */}
        <Route path="/categoria" element={
          <AuthGuard><CategoryPage/></AuthGuard>
        }/>

        {/* Menú principal (sin sidebar) */}
        <Route path="/menu" element={
          <CategoryGuard><MenuPage/></CategoryGuard>
        }/>

        {/* App principal con sidebar */}
        <Route path="/" element={
          <WithLayout><Navigate to="/menu" replace/></WithLayout>
        }/>
        <Route path="/crear" element={
          <WithLayout><TrainingEditorPage/></WithLayout>
        }/>
        <Route path="/entrenamiento/:id" element={
          <WithLayout><TrainingEditorPage/></WithLayout>
        }/>
        <Route path="/biblioteca" element={
          <WithLayout><LibraryPage/></WithLayout>
        }/>
        <Route path="/ejercicios" element={
          <WithLayout><ExercisesPage/></WithLayout>
        }/>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace/>}/>
      </Routes>
    </BrowserRouter>
  )
}
