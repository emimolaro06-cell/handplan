import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, Dumbbell, X, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useAppStore } from '@/lib/store'
import { getExercises, createExercise, deleteExercise, uploadImage } from '@/lib/supabase'
import { Card, Button, Input, Textarea, Select, Spinner, Empty, Toast, Badge } from '@/components/ui/index'
import { EXERCISE_CATEGORIES } from '@/lib/constants'
import type { Exercise, ExerciseCategory } from '@/types'

interface ExForm {
  name: string; category: ExerciseCategory
  description: string; objectives: string; recommended_age: string
}

export function ExercisesPage() {
  const { profile } = useAppStore()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [search,    setSearch]    = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [imgFile,   setImgFile]   = useState<File | null>(null)
  const [imgPrev,   setImgPrev]   = useState<string | null>(null)
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

  const catOptions = [
    { value: '', label: 'Todas' },
    ...EXERCISE_CATEGORIES.map(c => ({ value: c, label: c })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Ejercicios</h1>
          <p className="text-gray-500 text-sm mt-0.5">{exercises.length} en la biblioteca</p>
        </div>
        <Button
          icon={<Plus size={16}/>}
          variant={showForm ? 'secondary' : 'primary'}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Nuevo ejercicio'}
        </Button>
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
              <Select
                label="Categoría"
                options={EXERCISE_CATEGORIES.map(c => ({ value: c, label: c }))}
                placeholder="Seleccioná..."
                error={errors.category?.message}
                {...register('category', { required: 'Obligatorio' })}
              />
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

            {/* Imagen */}
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
                <label className="cursor-pointer inline-flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-dj-400 hover:text-dj-600 transition-colors">
                  <Upload size={16}/> Subir imagen
                  <input type="file" accept="image/*" className="hidden" onChange={handleImg}/>
                </label>
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
        <Select
          options={catOptions}
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="sm:w-52"
        />
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

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
