import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Trash2, ChevronDown, ChevronUp,
  ArrowUp, ArrowDown, Upload, X, Plus, Settings, PenTool,
} from 'lucide-react'
import { clsx } from '@/lib/utils'
import { uploadImage, addExerciseLabel, deleteExerciseLabel } from '@/lib/supabase'
import { EXERCISE_CATEGORIES } from '@/lib/constants'
import { Select, Textarea, Input, Button, Modal, Toast } from '@/components/ui/index'
import { TacticalBoard } from '@/components/training/TacticalBoard'
import type { Moment, ExerciseLabel } from '@/types'

interface Props {
  moment: Moment
  index: number
  total: number
  exerciseLabels: ExerciseLabel[]
  onLabelsChange: (labels: ExerciseLabel[]) => void
  onChange: (m: Moment) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  userId: string
}

export function MomentCard({
  moment, index, total, exerciseLabels, onLabelsChange,
  onChange, onRemove, onMoveUp, onMoveDown, userId,
}: Props) {
  const [collapsed, setCollapsed]         = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [showLabelMgr, setShowLabelMgr]  = useState(false)
  const [showBoard, setShowBoard]         = useState(false)
  const [newLabel, setNewLabel]           = useState('')
  const [toast, setToast]                 = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: moment.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  function update<K extends keyof Moment>(field: K, value: Moment[K]) {
    onChange({ ...moment, [field]: value })
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { url, error } = await uploadImage('moments', file)
    setUploading(false)
    if (error || !url) { setToast({ msg: 'Error al subir imagen.', type: 'error' }); return }
    update('image_url', url)
  }

  async function handleBoardSave(dataUrl: string) {
    // Convertir dataUrl a File y subir
    setShowBoard(false)
    setUploading(true)
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], `pizarra-${Date.now()}.png`, { type: 'image/png' })
    const { url, error } = await uploadImage('moments', file)
    setUploading(false)
    if (error || !url) { setToast({ msg: 'Error al guardar la pizarra.', type: 'error' }); return }
    update('image_url', url)
    setToast({ msg: 'Pizarra guardada en el momento.', type: 'success' })
  }

  async function handleAddLabel() {
    if (!newLabel.trim()) return
    const { data, error } = await addExerciseLabel(newLabel.trim(), userId)
    if (error || !data) { setToast({ msg: 'Error al agregar.', type: 'error' }); return }
    onLabelsChange([...exerciseLabels, data as ExerciseLabel])
    setNewLabel('')
  }

  async function handleDeleteLabel(id: string) {
    await deleteExerciseLabel(id)
    onLabelsChange(exerciseLabels.filter(l => l.id !== id))
  }

  const catOptions   = EXERCISE_CATEGORIES.map(c => ({ value: c, label: c }))
  const labelOptions = [
    { value: '', label: '— Seleccioná un ejercicio —' },
    ...exerciseLabels.map(l => ({ value: l.label, label: l.label })),
  ]

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={clsx(
          'bg-white rounded-2xl border transition-all duration-150',
          isDragging ? 'shadow-2xl border-gold-400 z-50 opacity-95' : 'border-gray-100 shadow-sm',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none p-0.5">
            <GripVertical size={17}/>
          </button>
          <div className="w-7 h-7 rounded-lg bg-dj-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {moment.exercise_label || moment.exercise_category || 'Sin nombre'} · {moment.duration_min} min
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <button disabled={index === 0} onClick={onMoveUp} className="p-1 text-gray-300 hover:text-dj-600 disabled:opacity-30 disabled:cursor-not-allowed">
              <ArrowUp size={15}/>
            </button>
            <button disabled={index === total - 1} onClick={onMoveDown} className="p-1 text-gray-300 hover:text-dj-600 disabled:opacity-30 disabled:cursor-not-allowed">
              <ArrowDown size={15}/>
            </button>
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 text-gray-400 hover:text-gray-700">
            {collapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
          </button>
          <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
            <Trash2 size={15}/>
          </button>
        </div>

        {/* Body */}
        {!collapsed && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Lista desplegable */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Nombre del ejercicio</label>
                  <button onClick={() => setShowLabelMgr(true)} className="text-xs text-dj-600 hover:text-dj-800 flex items-center gap-1">
                    <Settings size={12}/> Editar lista
                  </button>
                </div>
                <select
                  value={moment.exercise_label}
                  onChange={e => update('exercise_label', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-dj-400 hover:border-gray-300 transition-colors"
                >
                  {labelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <Input
                label="Tiempo (minutos)"
                type="number"
                min={1}
                max={120}
                value={moment.duration_min}
                onChange={e => update('duration_min', Number(e.target.value))}
              />

              <Select
                label="Categoría del ejercicio"
                options={catOptions}
                placeholder="Seleccioná categoría"
                value={moment.exercise_category}
                onChange={e => update('exercise_category', e.target.value as Moment['exercise_category'])}
              />

              {/* Imagen */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1.5">Imagen</p>
                {moment.image_url ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-100 h-28">
                    <img src={moment.image_url} alt="" className="w-full h-full object-cover"/>
                    <button
                      onClick={() => update('image_url', null)}
                      className="absolute top-2 right-2 bg-white/90 text-red-500 rounded-lg p-1 hover:bg-white shadow"
                    >
                      <X size={13}/>
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 h-28">
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex-1 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-dj-400 hover:text-dj-600 transition-colors"
                    >
                      {uploading ? <p className="text-xs">Subiendo...</p> : (
                        <><Upload size={18}/><p className="text-xs font-medium">Subir imagen</p></>
                      )}
                    </button>
                    <button
                      onClick={() => setShowBoard(true)}
                      className="flex-1 border-2 border-dashed border-dj-200 rounded-xl flex flex-col items-center justify-center gap-1 text-dj-400 hover:border-dj-500 hover:text-dj-600 transition-colors bg-dj-50/30"
                    >
                      <PenTool size={18}/>
                      <p className="text-xs font-medium">Pizarra táctica</p>
                    </button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/>
              </div>
            </div>

            <Textarea
              label="Descripción"
              placeholder="Describí el ejercicio, organización, reglas..."
              rows={3}
              value={moment.description}
              onChange={e => update('description', e.target.value)}
            />
            <Textarea
              label="Observaciones"
              placeholder="Variantes, correcciones, puntos a enfatizar..."
              rows={2}
              value={moment.observations}
              onChange={e => update('observations', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Pizarra táctica */}
      {showBoard && (
        <TacticalBoard
          onSave={handleBoardSave}
          onClose={() => setShowBoard(false)}
          initialImage={moment.image_url}
        />
      )}

      {/* Modal: administrar lista */}
      <Modal open={showLabelMgr} onClose={() => setShowLabelMgr(false)} title="Editar lista de ejercicios">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddLabel()}
              placeholder="Ej: Drill ofensivo 2x1"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
            />
            <Button size="sm" onClick={handleAddLabel} icon={<Plus size={14}/>}>Agregar</Button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {exerciseLabels.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin ejercicios todavía.</p>
            ) : exerciseLabels.map(l => (
              <div key={l.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-800">{l.label}</p>
                <button onClick={() => handleDeleteLabel(l.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <X size={14}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </>
  )
}
