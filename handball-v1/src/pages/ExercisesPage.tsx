import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, Dumbbell, X, Upload, PenTool, Settings } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useAppStore } from '@/lib/store'
import { getExercises, createExercise, deleteExercise, uploadImage } from '@/lib/supabase'
import { getExerciseCategories, addExerciseCategory, deleteExerciseCategory } from '@/lib/exerciseCategories'
import { Card, Button, Input, Textarea, Spinner, Empty, Toast, Badge, Modal } from '@/components/ui/index'
import { TacticalBoard } from '@/components/training/TacticalBoard'
import type { Exercise } from '@/types'

interface ExerciseCategoryRow {
  id: string
  category: string
  created_by: string | null
}

interface ExForm {
  name: string; category: string
  description: string; objectives: string; recommended_age: string
}

export function ExercisesPage() {
  const { profile } = useAppStore()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [categories, setCategories] = useState<ExerciseCategoryRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [search,    setSearch]    = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [imgFile,   setImgFile]   = useState<File | null>(null)
  const [imgPrev,   setImgPrev]   = useState<string | null>(null)
  const [showBoard, setShowBoard] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExForm>()

  function load(cat?: string) {
    setLoading(true)
    getExercises(cat || undefined).then(({ data }) => {
      setExercises((data as Exercise[]) ?? [])
      setLoading(false)
    })
  }

  useEffect(() => { load(filterCat || undefined) }, [filterCat])

  useEffect(() => {
    getExerciseCategories().then(({ data }) => {
      setCategories((data as ExerciseCategoryRow[]) ?? [])
    })
  }, [])

  const filtered = exercises.filter(e =>
    !search ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  )

  async function onSubmit(data: ExForm) {
    if (!profile) return
    setSubmitting(true)
    let image_url: string | null = null
    if (imgFile) {
      const { url } = await uploadImage('exercises', imgFile)
      image_url = url
    }
    const { data: ex, error } = await createExercise({ ...data, image_url, created_by: profile.id })
    setSubmitting(false)
    if (error) { setToast({ msg: 'Error al guardar.', type: 'error' }); return }
    setExercises(p => [ex as Exercise, ...p])
    setToast({ msg: 'Ejercicio agregado.', type: 'success' })
    reset(); setImgFile(null); setImgPrev(null); setShowForm(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este ejercicio?')) return
    await deleteExercise(id)
    setExercises(p => p.filter(e => e.id !== id))
    setToast({ msg: 'Ejercicio eliminado.', type: 'success' })
  }

  function handleImg(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setImgFile(f); setImgPrev(URL.createObjectURL(f))
  }

  async function handleBoardSave(dataUrl: string) {
    setShowBoard(false)
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], `pizarra-${Date.now()}.png`, { type: 'image/png' })
    setImgFile(file)
    setImgPrev(dataUrl)
    setToast({ msg: 'Pizarra agregada al ejercicio.', type: 'success' })
  }

  async function handleAddCategory() {
    if (!newCatLabel.trim() || !profile) return
    const { data, error } = await addExerciseCategory(newCatLabel.trim(), profile.id)
    if (error || !data) { setToast({ msg: 'Error al agregar categoría.', type: 'error' }); return }
    setCategories(p => [...p, data as ExerciseCategoryRow].sort((a, b) => a.category.localeCompare(b.category)))
    setNewCatLabel('')
  }

  async function handleDeleteCategory(id: string) {
    await deleteExerciseCategory(id)
    setCategories(p => p.filter(c => c.id !== id))
  }

  const catOptions = [
    { value: '', label: 'Todas' },
    ...categories.map(c => ({ value: c.category, label: c.category })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Ejercicios</h1>
          <p className="text-gray-500 text-sm mt-0.5">{exercises.length} en la biblioteca</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Settings size={15}/>} onClick={() => setShowCatMgr(true)}>
            Categorías
          </Button>
          <Button
            icon={<Plus size={16}/>}
            variant={showForm ? 'secondary' : 'primary'}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancelar' : 'Nuevo ejercicio'}
          </Button>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card className="animate-slide-up">
          <h2 className="font-bold text-gray-900 mb-4">Agregar ejercicio a la biblioteca</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                placeholder="Ej: 2x1 hacia portería"
                error={errors.name?.message}
                {...register('name', { required: 'Obligatorio' })}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Categoría</label>
                <select
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-dj-400"
                  {...register('category', { required: 'Obligatorio' })}
                >
                  <option value="">Seleccioná...</option>
                  {categories.map(c => <option key={c.id} value={c.category}>{c.category}</option>)}
                </select>
                {errors.category && <p className="text-xs text-red-600">{errors.category.message}</p>}
              </div>
              <Input
                label="Edad recomendada"
                placeholder="Ej: 12-15 años"
                {...register('recommended_age')}
              />
              <div/>
              <div className="sm:col-span-2">
                <Textarea
                  label="Descripción"
                  placeholder="Organización del ejercicio, espacio, jugadores..."
                  rows={3}
                  {...register('description')}
                />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Objetivos"
                  placeholder="¿Qué habilidades desarrolla este ejercicio?"
                  rows={2}
                  {...register('objectives')}
                />
              </div>
            </div>

            {/* Imagen / Pizarra */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Imagen (opcional)</p>
              {imgPrev ? (
                <div className="relative w-44 h-32 rounded-xl overflow-hidden border border-gray-100">
                  <img src={imgPrev} alt="" className="w-full h-full object-cover"/>
                  <button type="button" onClick={() => { setImgFile(null); setImgPrev(null) }}
                    className="absolute top-1.5 right-1.5 bg-white/90 text-red-500 rounded-lg p-1"
                  ><X size={12}/></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-dj-400 hover:text-dj-600 transition-colors">
                    <Upload size={16}/> Subir imagen
                    <input type="file" accept="image/*" className="hidden" onChange={handleImg}/>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBoard(true)}
                    className="inline-flex items-center gap-2 border border-dashed border-dj-200 rounded-xl px-4 py-3 text-sm text-dj-500 hover:border-dj-500 hover:text-dj-600 transition-colors bg-dj-50/30"
                  >
                    <PenTool size={16}/> Pizarra táctica
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" loading={submitting}>Guardar ejercicio</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="sm:w-52 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-dj-400"
        >
          {catOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Grilla */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32}/></div>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty
            icon={<Dumbbell size={44}/>}
            title="Sin ejercicios"
            description="Agregá ejercicios a la biblioteca para reutilizarlos en tus entrenamientos."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(e => (
            <Card key={e.id} padded={false} className="flex flex-col overflow-hidden">
              {e.image_url && (
                <img src={e.image_url} alt={e.name} className="w-full h-36 object-cover"/>
              )}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{e.name}</p>
                  <button onClick={() => handleDelete(e.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors">
                    <Trash2 size={14}/>
                  </button>
                </div>
                <Badge color="gray" className="self-start mb-2">{e.category}</Badge>
                {e.description && <p className="text-xs text-gray-500 line-clamp-2">{e.description}</p>}
                {e.objectives && <p className="text-xs text-dj-700 mt-1.5 line-clamp-1">Obj: {e.objectives}</p>}
                {e.recommended_age && <p className="text-xs text-gray-400 mt-1">Edad: {e.recommended_age}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pizarra táctica */}
      {showBoard && (
        <TacticalBoard
          onSave={handleBoardSave}
          onClose={() => setShowBoard(false)}
          initialImage={null}
        />
      )}

      {/* Modal: gestionar categorías */}
      <Modal open={showCatMgr} onClose={() => setShowCatMgr(false)} title="Editar categorías de ejercicio">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={newCatLabel}
              onChange={e => setNewCatLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              placeholder="Ej: Trabajo de pies"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
            />
            <Button size="sm" onClick={handleAddCategory} icon={<Plus size={14}/>}>Agregar</Button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin categorías todavía.</p>
            ) : categories.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-800">{c.category}</p>
                <button onClick={() => handleDeleteCategory(c.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <X size={14}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
