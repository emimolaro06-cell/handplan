import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAppStore } from '@/lib/store'
import { AppLayout } from '@/components/layout/AppLayout'
import { Spinner } from '@/components/ui/index'

import { ClubCodePage }          from '@/pages/ClubCodePage'
import { RegisterPage }          from '@/pages/RegisterPage'
import { ProfilesPage }          from '@/pages/ProfilesPage'
import { CategoryPage }          from '@/pages/CategoryPage'
import { MenuPage }              from '@/pages/MenuPage'
import { TrainingEditorPage }    from '@/pages/TrainingEditorPage'
import { LibraryPage }           from '@/pages/LibraryPage'
import { ExercisesPage }         from '@/pages/ExercisesPage'
import { MonthlyPlanPage }       from '@/pages/MonthlyPlanPage'
import { SharedSessionPage }     from '@/pages/SharedSessionPage'
import { SharedMicrocyclePage }  from '@/pages/SharedMicrocyclePage'
import { AttendancePage }        from '@/pages/AttendancePage'
import { MyAssistantPage }       from '@/pages/MyAssistantPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-dj-900">
      <div className="flex flex-col items-center gap-3">
        <Spinner size={36}/>
        <p className="text-white/50 text-sm">Cargando...</p>
      </div>
    </div>
  )
  if (!profile) return <Navigate to="/" replace/>
  return <>{children}</>
}

function CategoryGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const selectedCategory = useAppStore(s => s.selectedCategory)
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-dj-900"><Spinner size={36}/></div>
  if (!profile) return <Navigate to="/" replace/>
  if (!selectedCategory) return <Navigate to="/categoria" replace/>
  return <>{children}</>
}

function WithLayout({ children }: { children: React.ReactNode }) {
  return <CategoryGuard><AppLayout>{children}</AppLayout></CategoryGuard>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/"          element={<ClubCodePage/>}/>
        <Route path="/registro"  element={<RegisterPage/>}/>
        <Route path="/perfiles"  element={<ProfilesPage/>}/>
        <Route path="/compartido/:token" element={<SharedSessionPage/>}/>
        <Route path="/microciclo-compartido/:token" element={<SharedMicrocyclePage/>}/>

        {/* Auth */}
        <Route path="/categoria" element={<AuthGuard><CategoryPage/></AuthGuard>}/>
        <Route path="/menu"      element={<CategoryGuard><MenuPage/></CategoryGuard>}/>

        {/* App */}
        <Route path="/crear"             element={<WithLayout><TrainingEditorPage/></WithLayout>}/>
        <Route path="/entrenamiento/:id" element={<WithLayout><TrainingEditorPage/></WithLayout>}/>
        <Route path="/biblioteca"        element={<WithLayout><LibraryPage/></WithLayout>}/>
        <Route path="/ejercicios"        element={<WithLayout><ExercisesPage/></WithLayout>}/>
        <Route path="/planificacion"     element={<WithLayout><MonthlyPlanPage/></WithLayout>}/>
        <Route path="/asistencia"        element={<WithLayout><AttendancePage/></WithLayout>}/>
        <Route path="/mi-ayudante"       element={<WithLayout><MyAssistantPage/></WithLayout>}/>

        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </BrowserRouter>
  )
}
