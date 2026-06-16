import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Eye, Edit, Copy, FileDown, Trash2,
  BookOpen, SlidersHorizontal, X, Calendar,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { getSessions, deleteSession, duplicateSession, getAllCoaches } from '@/lib/supabase'
import { downloadTrainingPDF } from '@/lib/pdf'
import { Card, Button, Spinner, Empty, Toast, Select, Modal } from '@/components/ui/index'
import { TEAM_CATEGORIES, CONTENT_CATEGORIES, TEAM_CATEGORY_STYLES } from '@/lib/constants'
import type { TrainingSession, LibraryFilters, TeamCategory } from '@/types'

export function LibraryPage() {
  const navigate = useNavigate()
  const { profile } = useAppStore()

  const [sessions, setSessions]   = useState<TrainingSession[]>([])
  const [coaches,  setCoaches]    = useState<string[]>([])
  const [loading,  setLoading]    = useState(true)
  const [filters,  setFilters]    = useState<LibraryFilters>({
    search: '', team_category: '', content_category: '', coach_name: '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [preview,     setPreview]     = useState<TrainingSession | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)

  useEffect(() => {
    if (!profile) return
    setLoading(true)
    Promise.all([
      getSessions(profile.id, {
        team_category:    filters.team_category    || undefined,
        content_category: filters.content_category || undefined,
        coach_name:       filters.coach_name       || undefined,
        search:           filters.search           || undefined,
      }),
      getAllCoaches(),
    ]).then(([{ data: s }, { data: c }]) => {
      // Solo mostrar entrenamientos con status 'saved' (no borradores)
      const saved = ((s as TrainingSession[]) ?? []).filter(x => x.status === 'saved')
      setSessions(saved)
      setCoaches(((c as { full_name: string }[]) ?? []).map(x => x.full_name))
      setLoading(false)
    })
  }, [profile, filters])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este entrenamiento? No se puede deshacer.')) return
    const { error } = await deleteSession(id)
    if (error) { setToast({ msg: 'Error al eliminar.', type: 'error' }); return }
    setSessions(p => p.filter(s => s.id !== id))
    setToast({ msg: 'Entrenamiento eliminado.', type: 'success' })
  }

  async function handleDuplicate(s: TrainingSession) {
    if (!profile) return
    const { data, error } = await duplicateSession(s.id, profile.id)
    if (error || !data) { setToast({ msg: 'Error al duplicar.', type: 'error' }); return }
    setToast({ msg: 'Duplicado. Abriendo editor...', type: 'success' })
    setTimeout(() => navigate(`/entrenamiento/${data.id}`), 800)
  }

  function setFilter<K extends keyof LibraryFilters>(key: K, val: LibraryFilters[K]) {
    setFilters(p => ({ ...p, [key]: val }))
  }

  const activeFiltersCount = [
    filters.team_category, filters.content_category, filters.coach_name, filters.search,
  ].filter(Boolean).length

  const teamOptions    = [{ value: '', label: 'Todas las categorías' }, ...TEAM_CATEGORIES.map(c => ({ value: c, label: c }))]
  const contentOptions = [{ value: '', label: 'Todos los contenidos' }, ...CONTENT_CATEGORIES.map(c => ({ value: c, label: c }))]
  const coachOptions   = [{ value: '', label: 'Todos los profesores' }, ...coaches.map(c => ({ value: c, label: c }))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Biblioteca</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {sessions.length} entrenamiento{sessions.length !== 1 ? 's' : ''} guardado{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant={activeFiltersCount > 0 ? 'primary' : 'secondary'}
          size="sm"
          icon={<SlidersHorizontal size={15}/>}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
        </Button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          placeholder="Buscar por objetivo, contenido..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
        />
        {filters.search && (
          <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
            <X size={14}/>
          </button>
        )}
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card className="animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Categoría de equipo"
              options={teamOptions}
              value={filters.team_category}
              onChange={e => setFilter('team_category', e.target.value as LibraryFilters['team_category'])}
            />
            <Select
              label="Categoría de contenido"
              options={contentOptions}
              value={filters.content_category}
              onChange={e => setFilter('content_category', e.target.value as LibraryFilters['content_category'])}
            />
            <Select
              label="Profesor/a"
              options={coachOptions}
              value={filters.coach_name}
              onChange={e => setFilter('coach_name', e.target.value)}
            />
          </div>
          {activeFiltersCount > 0 && (
            <button
              onClick={() => setFilters({ search: '', team_category: '', content_category: '', coach_name: '' })}
              className="mt-3 text-xs text-dj-600 hover:text-dj-800 font-medium"
            >
              Limpiar todos los filtros
            </button>
          )}
        </Card>
      )}

      {/* Listado */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32}/></div>
      ) : sessions.length === 0 ? (
        <Card>
          <Empty
            icon={<BookOpen size={44}/>}
            title={activeFiltersCount > 0 ? 'Sin resultados' : 'Biblioteca vacía'}
            description={activeFiltersCount > 0
              ? 'Probá con otros filtros.'
              : 'Guardá un entrenamiento para verlo aquí. Usá el botón "Guardar entrenamiento" al finalizar.'}
            action={!activeFiltersCount
              ? <Button onClick={() => navigate('/crear')}>Crear entrenamiento</Button>
              : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const catStyle = TEAM_CATEGORY_STYLES[s.team_category as TeamCategory]
            // Formato: Fecha + CONTENIDO
            const fechaFormateada = format(new Date(s.session_date), "dd/MM/yyyy", { locale: es })
            const titulo = `${fechaFormateada} — ${s.content_category}`

            return (
              <Card key={s.id} padded={false} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4 p-4">
                  <div className="w-11 h-11 rounded-xl bg-dj-50 flex items-center justify-center flex-shrink-0">
                    <Calendar size={20} className="text-dj-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* TITULO: Fecha + CONTENIDO */}
                    <p className="font-bold text-gray-900 text-base">{titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.coach_name} · Sesión {s.session_number} · {s.total_duration_min} min · {s.moments?.length ?? 0} momentos
                    </p>
                    {s.general_objective && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{s.general_objective}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', catStyle.bg, catStyle.text)}>
                        {s.team_category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 px-3 py-2.5 bg-gray-50 border-t border-gray-100 flex-wrap">
                  <Button variant="ghost" size="xs" icon={<Eye size={13}/>} onClick={() => setPreview(s)}>Ver</Button>
                  <Button variant="ghost" size="xs" icon={<Edit size={13}/>} onClick={() => navigate(`/entrenamiento/${s.id}`)}>Editar</Button>
                  <Button variant="ghost" size="xs" icon={<Copy size={13}/>} onClick={() => handleDuplicate(s)}>Duplicar</Button>
                  <Button variant="ghost" size="xs" icon={<FileDown size={13}/>} onClick={() => downloadTrainingPDF(s)}>PDF</Button>
                  <Button
                    variant="ghost" size="xs" icon={<Trash2 size={13}/>}
                    className="ml-auto text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(s.id)}
                  >Eliminar</Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal: Vista previa */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview ? `${format(new Date(preview.session_date), "dd/MM/yyyy")} — ${preview.content_category}` : ''}
        maxWidth="max-w-2xl"
      >
        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Fecha',      format(new Date(preview.session_date), "d 'de' MMMM yyyy", { locale: es })],
                ['Categoría',  preview.team_category],
                ['Profesor/a', preview.coach_name],
                ['Duración',   `${preview.total_duration_min} min`],
                ['Contenido',  preview.content_category],
                ['N° sesión',  String(preview.session_number)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-500">{k}</p>
                  <p className="font-medium text-gray-900">{v}</p>
                </div>
              ))}
            </div>
            {preview.general_objective && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Objetivo</p>
                <p className="text-sm text-gray-800">{preview.general_objective}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-2">Momentos ({preview.moments?.length ?? 0})</p>
              <div className="space-y-2">
                {[...( preview.moments ?? [])].sort((a,b) => a.order_index - b.order_index).map((m, i) => (
                  <div key={m.id} className="flex gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-6 h-6 rounded-lg bg-dj-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i+1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900">
                        {m.exercise_label || m.exercise_category} · {m.duration_min} min
                      </p>
                      {m.description && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{m.description}</p>}
                    </div>
                    {m.image_url && (
                      <img src={m.image_url} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0"/>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Button size="sm" icon={<Edit size={14}/>} onClick={() => { setPreview(null); navigate(`/entrenamiento/${preview.id}`) }}>
                Editar
              </Button>
              <Button variant="gold" size="sm" icon={<FileDown size={14}/>} onClick={() => downloadTrainingPDF(preview)}>
                Exportar PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
