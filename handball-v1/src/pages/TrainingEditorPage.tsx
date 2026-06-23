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
import {
  PlusCircle, Save, FileDown, ArrowLeft, AlertCircle,
  BookmarkPlus, Eye, Share2, Copy, Check, MessageSquare,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { useAppStore } from '@/lib/store'
import { createSession, updateSession, getSessionById, getExerciseLabels, createShareLink } from '@/lib/supabase'
import { listTrainingComments } from '@/lib/comments'
import { downloadTrainingPDF } from '@/lib/pdf'
import { Input, Textarea, Select, Button, Card, Toast, Spinner } from '@/components/ui/index'
import { MomentCard } from '@/components/training/MomentCard'
import { PDFPreview } from '@/components/training/PDFPreview'
import { TEAM_CATEGORIES, CONTENT_CATEGORIES } from '@/lib/constants'
import type { Moment, SessionFormData, TrainingSession, ExerciseLabel, TrainingComment } from '@/types'

function tmpId() { return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}` }

function blankMoment(): Moment {
  return {
    id: tmpId(), session_id: '', order_index: 0,
    exercise_label: '', duration_min: 10,
    exercise_category: 'Técnica individual',
    image_url: null, description: '', observations: '',
  }
}

export function TrainingEditorPage() {
  const navigate = useNavigate()
  const { id }   = useParams<{ id?: string }>()
  const isEdit   = Boolean(id)
  const { profile, effectiveUserId, selectedCategory, account } = useAppStore()

  const [moments, setMoments]               = useState<Moment[]>([blankMoment()])
  const [exerciseLabels, setExerciseLabels] = useState<ExerciseLabel[]>([])
  const [loading, setLoading]               = useState(isEdit)
  const [saving, setSaving]                 = useState(false)
  const [toast, setToast]                   = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [sessionId, setSessionId]           = useState<string | null>(null)

  // Vista previa
  const [showPreview, setShowPreview]       = useState(false)
  const [previewSession, setPreviewSession] = useState<TrainingSession | null>(null)

  // Compartir
  const [shareUrl, setShareUrl]   = useState<string | null>(null)
  const [sharing, setSharing]     = useState(false)
  const [copied, setCopied]       = useState(false)

  // Comentarios del coordinador (solo lectura para el coach)
  const [comments, setComments] = useState<TrainingComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, watch, formState: { errors } } =
    useForm<SessionFormData>({
      defaultValues: {
        session_date: today,
        team_category: selectedCategory ?? undefined,
        coach_name: profile?.full_name ?? '',
        total_duration_min: 60,
        session_number: 1,
        status: 'saved',
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
        session_date: s.session_date, team_category: s.team_category,
        content_category: s.content_category, coach_name: s.coach_name,
        total_duration_min: s.total_duration_min, session_number: s.session_number,
        general_objective: s.general_objective, main_content: s.main_content,
        status: s.status,
      })
      setMoments([...s.moments].sort((a, b) => a.order_index - b.order_index))
      setSessionId(s.id)
      setLoading(false)

      // Cargar comentarios del coordinador para este entrenamiento
      setLoadingComments(true)
      listTrainingComments(s.id)
        .then(setComments)
        .catch(() => {}) // si el coach no tiene permiso o falla, simplemente no se muestran
        .finally(() => setLoadingComments(false))
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

  function moveUp(i: number)   { if (i > 0) setMoments(prev => arrayMove(prev, i, i-1)) }
  function moveDown(i: number) { if (i < moments.length-1) setMoments(prev => arrayMove(prev, i, i+1)) }

  const updateMoment = useCallback((id: string, m: Moment) => setMoments(p => p.map(x => x.id===id ? m : x)), [])
  const removeMoment = useCallback((id: string) => setMoments(p => p.filter(x => x.id!==id)), [])

  // ─── Guardar ───────────────────────────────────────────────────────────────
  async function save(formData: SessionFormData, status: 'draft'|'saved' = 'saved') {
    if (!effectiveUserId) return null
    setSaving(true)
    const momentRows = moments.map((m, i) => ({
      exercise_label: m.exercise_label, duration_min: m.duration_min,
      exercise_category: m.exercise_category, image_url: m.image_url,
      description: m.description, observations: m.observations, order_index: i,
      content_category: m.content_category ?? null, subcontent_id: m.subcontent_id ?? null,
    }))
    const sessionData = { ...formData, status }
    let result
    if (isEdit && sessionId) result = await updateSession(sessionId, sessionData, momentRows)
    else result = await createSession(effectiveUserId, sessionData, momentRows)
    setSaving(false)
    if (result.error) { setToast({ msg: 'Error al guardar.', type: 'error' }); return null }
    if (!isEdit && result.data) setSessionId(result.data.id)
    setToast({ msg: isEdit ? 'Actualizado.' : 'Guardado.', type: 'success' })
    return result.data
  }

  async function onSave(formData: SessionFormData)      { await save(formData) }
  async function onSaveDraft(formData: SessionFormData) { await save(formData, 'draft') }

  async function onExportPDF(formData: SessionFormData) {
    const session: TrainingSession = {
      ...(formData as SessionFormData),
      id: sessionId ?? 'preview', user_id: effectiveUserId ?? '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      moments: moments.map((m, i) => ({ ...m, order_index: i, session_id: sessionId ?? '' })),
    }
    await downloadTrainingPDF(session, account)
  }

  function onPreview(formData: SessionFormData) {
    const session: TrainingSession = {
      ...(formData as SessionFormData),
      id: sessionId ?? 'preview', user_id: effectiveUserId ?? '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      moments: moments.map((m, i) => ({ ...m, order_index: i, session_id: sessionId ?? '' })),
    }
    setPreviewSession(session)
    setShowPreview(true)
  }

  async function onShare(formData: SessionFormData) {
    const s = await save(formData)
    if (!s) return
    setSharing(true)
    const { token, error } = await createShareLink(s.id)
    setSharing(false)
    if (error || !token) { setToast({ msg: 'Error al generar enlace.', type: 'error' }); return }
    setShareUrl(`${window.location.origin}/compartido/${token}`)
  }

  async function copyShareUrl() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const catOptions     = TEAM_CATEGORIES.map(c => ({ value: c, label: c }))
  const contentOptions = CONTENT_CATEGORIES.map(c => ({ value: c, label: c }))

  if (loading) return <div className="flex justify-center items-center py-24"><Spinner size={36}/></div>

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700 p-1 -ml-1">
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-display">
            {isEdit ? 'Editar entrenamiento' : 'Nuevo entrenamiento'}
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">Completá los datos y agregá los momentos</p>
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
            <Input label="Fecha" type="date" error={errors.session_date?.message}
              {...register('session_date', { required: 'Obligatorio' })}/>
            <Input label="N° de sesión" type="number" min={1} error={errors.session_number?.message}
              {...register('session_number', { required: 'Obligatorio', valueAsNumber: true })}/>
            <Select label="Categoría" options={catOptions} placeholder="Seleccioná..."
              error={errors.team_category?.message}
              {...register('team_category', { required: 'Obligatorio' })}/>
            <Input label="Profesor/a" placeholder="Nombre completo" error={errors.coach_name?.message}
              {...register('coach_name', { required: 'Obligatorio' })}/>
            <Input label="Duración total (min)" type="number" min={10} max={300}
              {...register('total_duration_min', { required: 'Obligatorio', valueAsNumber: true })}/>
            <Select label="Categoría de contenido" options={contentOptions} placeholder="Seleccioná..."
              error={errors.content_category?.message}
              {...register('content_category', { required: 'Obligatorio' })}/>
            <div className="sm:col-span-2 lg:col-span-3">
              <Textarea label="Objetivo general" placeholder="¿Qué se busca lograr?" rows={2}
                error={errors.general_objective?.message}
                {...register('general_objective', { required: 'Obligatorio' })}/>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Textarea label="Contenido principal" placeholder="Descripción del contenido..." rows={2}
                {...register('main_content')}/>
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
              <div className={`flex items-center gap-1.5 mt-1 text-xs font-medium ${durationDiff > 5 ? 'text-amber-600' : 'text-gray-500'}`}>
                {durationDiff > 5 && <AlertCircle size={12}/>}
                Suma: <span className="font-bold">{momentMinutes} min</span> / {totalDuration || '?'} min
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" icon={<PlusCircle size={15}/>}
              onClick={() => setMoments(prev => [...prev, blankMoment()])}>
              Agregar momento
            </Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={moments.map(m => m.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {moments.map((m, i) => (
                  <MomentCard key={m.id} moment={m} index={i} total={moments.length}
                    exerciseLabels={exerciseLabels} onLabelsChange={setExerciseLabels}
                    onChange={updated => updateMoment(m.id, updated)}
                    onRemove={() => removeMoment(m.id)}
                    onMoveUp={() => moveUp(i)} onMoveDown={() => moveDown(i)}
                    userId={effectiveUserId ?? ''}/>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {moments.length === 0 && (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl py-12 text-center">
              <p className="text-gray-400 text-sm mb-2">Sin momentos todavía</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMoments([blankMoment()])}>
                + Agregar el primero
              </Button>
            </div>
          )}
        </div>

        {/* Comentarios del coordinador (solo lectura) */}
        {isEdit && comments.length > 0 && (
          <Card className="border-gold-200 bg-gold-50/30">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare size={18} className="text-gold-600"/>
              Comentarios del coordinador
            </h2>
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-gold-100 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gold-700">{c.admin_name}</span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(c.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{c.comment}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
          <Button type="submit" loading={saving} icon={<Save size={16}/>}>
            Guardar
          </Button>
          <Button type="button" variant="secondary" icon={<BookmarkPlus size={16}/>}
            loading={saving} onClick={handleSubmit(onSaveDraft)}>
            Borrador
          </Button>
          <Button type="button" variant="gold" icon={<FileDown size={16}/>}
            onClick={handleSubmit(onExportPDF)}>
            Exportar PDF
          </Button>
          <Button type="button" variant="secondary" icon={<Eye size={16}/>}
            onClick={handleSubmit(onPreview)}>
            Vista previa
          </Button>
          <Button type="button" variant="secondary" icon={<Share2 size={16}/>}
            loading={sharing} onClick={handleSubmit(onShare)}>
            Compartir
          </Button>
        </div>
      </form>

      {/* Vista previa PDF */}
      {showPreview && previewSession && (
        <PDFPreview
          session={previewSession}
          onClose={() => setShowPreview(false)}
          onDownload={() => { downloadTrainingPDF(previewSession, account); setShowPreview(false) }}
        />
      )}

      {/* Modal compartir */}
      {shareUrl && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-900">Enlace para compartir</h3>
            <p className="text-sm text-gray-600">
              Cualquier persona con este enlace puede ver el entrenamiento y descargar el PDF, sin iniciar sesión.
            </p>
            <div className="flex gap-2">
              <input value={shareUrl} readOnly
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 bg-gray-50"/>
              <button onClick={copyShareUrl}
                className="flex items-center gap-1.5 bg-dj-600 hover:bg-dj-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
                {copied ? <Check size={14}/> : <Copy size={14}/>}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <button onClick={() => setShareUrl(null)} className="w-full text-sm text-gray-500 hover:text-gray-700">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
