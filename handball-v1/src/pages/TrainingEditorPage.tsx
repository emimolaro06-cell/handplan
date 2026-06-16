import { clsx } from '@/lib/utils'
import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { PlusCircle, Save, FileDown, ArrowLeft, AlertCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useAppStore } from '@/lib/store'
import {
  createSession, updateSession, getSessionById, getExerciseLabels,
} from '@/lib/supabase'
import { downloadTrainingPDF } from '@/lib/pdf'
import { Input, Textarea, Select, Button, Card, Toast, Spinner } from '@/components/ui/index'
import { MomentCard } from '@/components/training/MomentCard'
import { TEAM_CATEGORIES, CONTENT_CATEGORIES } from '@/lib/constants'
import type { Moment, SessionFormData, TrainingSession, ExerciseLabel, ContentCategory, TeamCategory } from '@/types'

function tmpId() { return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}` }

function blankMoment(): Moment {
  return {
    id: tmpId(),
    session_id: '',
    order_index: 0,
    exercise_label: '',
    duration_min: 10,
    exercise_category: 'Técnica individual',
    image_url: null,
    description: '',
    observations: '',
  }
}

export function TrainingEditorPage() {
  const navigate   = useNavigate()
  const { id }     = useParams<{ id?: string }>()
  const isEdit     = Boolean(id)
  const { profile, selectedCategory } = useAppStore()

  const [moments, setMoments]               = useState<Moment[]>([blankMoment()])
  const [exerciseLabels, setExerciseLabels] = useState<ExerciseLabel[]>([])
  const [loading, setLoading]               = useState(isEdit)
  const [saving, setSaving]                 = useState(false)
  const [toast, setToast]                   = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [sessionId, setSessionId]           = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, watch, formState: { errors } } =
    useForm<SessionFormData>({
      defaultValues: {
        session_date:      today,
        team_category:     selectedCategory ?? undefined,
        coach_name:        profile?.full_name ?? '',
        total_duration_min: 90,
        session_number:    1,
        status:            'saved',
      },
    })

  const totalDuration = watch('total_duration_min')
  const momentMinutes = moments.reduce((s, m) => s + (Number(m.duration_min) || 0), 0)
  const durationDiff  = momentMinutes - (Number(totalDuration) || 0)

  useEffect(() => {
    getExerciseLabels().then(({ data }) => setExerciseLabels((data as ExerciseLabel[]) ?? []))

    if (!isEdit || !id) return
    getSessionById(id).then(({ data, error }) => {
      if (error || !data) { navigate('/biblioteca'); return }
      const s = data as TrainingSession
      reset({
        session_date:       s.session_date,
        team_category:      s.team_category,
        content_category:   s.content_category,
        coach_name:         s.coach_name,
        total_duration_min: s.total_duration_min,
        session_number:     s.session_number,
        general_objective:  s.general_objective,
        main_content:       s.main_content,
        status:             s.status,
      })
      const sorted = [...s.moments].sort((a, b) => a.order_index - b.order_index)
      setMoments(sorted)
      setSessionId(s.id)
      setLoading(false)
    })
  }, [id, isEdit, navigate, reset])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setMoments(prev => {
        const oi = prev.findIndex(m => m.id === active.id)
        const ni = prev.findIndex(m => m.id === over.id)
        return arrayMove(prev, oi, ni)
      })
    }
  }

  function moveUp(i: number) {
    if (i === 0) return
    setMoments(prev => arrayMove(prev, i, i - 1))
  }
  function moveDown(i: number) {
    if (i === moments.length - 1) return
    setMoments(prev => arrayMove(prev, i, i + 1))
  }

  const updateMoment = useCallback((id: string, m: Moment) => setMoments(p => p.map(x => x.id === id ? m : x)), [])
  const removeMoment = useCallback((id: string) => setMoments(p => p.filter(x => x.id !== id)), [])

  async function save(formData: SessionFormData) {
    if (!profile) return null
    setSaving(true)

    const momentRows = moments.map((m, i) => ({
      exercise_label:    m.exercise_label,
      duration_min:      m.duration_min,
      exercise_category: m.exercise_category,
      image_url:         m.image_url,
      description:       m.description,
      observations:      m.observations,
      order_index:       i,
    }))

    // Siempre status 'saved' — solo se guarda cuando el entrenador lo pide
    const sessionData = { ...formData, status: 'saved' }

    let result
    if (isEdit && sessionId) {
      result = await updateSession(sessionId, sessionData, momentRows)
    } else {
      result = await createSession(profile.id, sessionData, momentRows)
    }

    setSaving(false)

    if (result.error) {
      setToast({ msg: 'Error al guardar. Intentá de nuevo.', type: 'error' })
      return null
    }

    if (!isEdit && result.data) setSessionId(result.data.id)
    setToast({ msg: isEdit ? 'Entrenamiento actualizado y guardado en biblioteca.' : 'Entrenamiento guardado en biblioteca.', type: 'success' })
    return result.data
  }

  async function onSave(formData: SessionFormData) {
    await save(formData)
  }

  async function onExportPDF(formData: SessionFormData) {
    const session: TrainingSession = {
      ...(formData as SessionFormData),
      id:         sessionId ?? 'preview',
      user_id:    profile?.id ?? '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      moments:    moments.map((m, i) => ({ ...m, order_index: i, session_id: sessionId ?? '' })),
    }
    await downloadTrainingPDF(session)
  }

  const catOptions     = TEAM_CATEGORIES.map(c => ({ value: c, label: c }))
  const contentOptions = CONTENT_CATEGORIES.map(c => ({ value: c, label: c }))

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Spinner size={36}/></div>
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700 p-1 -ml-1">
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-display">
            {isEdit ? 'Editar entrenamiento' : 'Nuevo entrenamiento'}
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Completá los datos y agregá los momentos. Cuando termines, guardá el entrenamiento.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-6">
        {/* Datos generales */}
        <Card>
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-dj-700 text-white text-xs flex items-center justify-center font-bold">1</span>
            Datos generales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Fecha"
              type="date"
              error={errors.session_date?.message}
              {...register('session_date', { required: 'Obligatorio' })}
            />
            <Input
              label="N° de sesión"
              type="number"
              min={1}
              error={errors.session_number?.message}
              {...register('session_number', { required: 'Obligatorio', valueAsNumber: true })}
            />
            <Select
              label="Categoría"
              options={catOptions}
              placeholder="Seleccioná..."
              error={errors.team_category?.message}
              {...register('team_category', { required: 'Obligatorio' })}
            />
            <Input
              label="Profesor/a"
              placeholder="Nombre completo"
              error={errors.coach_name?.message}
              {...register('coach_name', { required: 'Obligatorio' })}
            />
            <Input
              label="Duración total (min)"
              type="number"
              min={10}
              max={300}
              {...register('total_duration_min', { required: 'Obligatorio', valueAsNumber: true })}
            />
            <Select
              label="Categoría de contenido"
              options={contentOptions}
              placeholder="Seleccioná..."
              error={errors.content_category?.message}
              {...register('content_category', { required: 'Obligatorio' })}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <Textarea
                label="Objetivo general"
                placeholder="¿Qué se busca lograr en este entrenamiento?"
                rows={2}
                error={errors.general_objective?.message}
                {...register('general_objective', { required: 'Obligatorio' })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Textarea
                label="Contenido principal"
                placeholder="Descripción del contenido central..."
                rows={2}
                {...register('main_content')}
              />
            </div>
          </div>
        </Card>

        {/* Momentos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-dj-700 text-white text-xs flex items-center justify-center font-bold">2</span>
                Momentos
              </h2>
              <div className={clsx(
                'flex items-center gap-1.5 mt-1 text-xs font-medium',
                durationDiff > 5 ? 'text-amber-600' : durationDiff < -15 ? 'text-blue-500' : 'text-gray-500',
              )}>
                {durationDiff > 5 && <AlertCircle size={12}/>}
                Suma de momentos: <span className="font-bold">{momentMinutes} min</span>
                {' / '}{totalDuration || '?'} min planificados
                {durationDiff > 5 && ` · ${durationDiff} min de exceso`}
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<PlusCircle size={15}/>}
              onClick={() => setMoments(prev => [...prev, blankMoment()])}
            >
              Agregar momento
            </Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={moments.map(m => m.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {moments.map((m, i) => (
                  <MomentCard
                    key={m.id}
                    moment={m}
                    index={i}
                    total={moments.length}
                    exerciseLabels={exerciseLabels}
                    onLabelsChange={setExerciseLabels}
                    onChange={updated => updateMoment(m.id, updated)}
                    onRemove={() => removeMoment(m.id)}
                    onMoveUp={() => moveUp(i)}
                    onMoveDown={() => moveDown(i)}
                    userId={profile?.id ?? ''}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {moments.length === 0 && (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl py-12 text-center">
              <p className="text-gray-400 text-sm mb-2">Sin momentos todavía</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMoments([blankMoment()])}>
                + Agregar el primer momento
              </Button>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
          <Button type="submit" loading={saving} icon={<Save size={16}/>} size="lg">
            Guardar entrenamiento
          </Button>
          <Button
            type="button"
            variant="gold"
            icon={<FileDown size={16}/>}
            onClick={handleSubmit(onExportPDF)}
            size="lg"
          >
            Exportar PDF
          </Button>
        </div>
      </form>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
