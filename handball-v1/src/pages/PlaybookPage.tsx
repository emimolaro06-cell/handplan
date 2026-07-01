import { useRef, useState, useEffect } from 'react'
import { Trash2, Play, Pause, Plus, Film, MousePointer, Minus, Loader2, Video, Save, Folder, FolderOpen, ChevronDown, X, Edit2 } from 'lucide-react'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import {
  getFolders, createFolder, deleteFolder, renameFolder,
  getJugadas, saveJugada, deleteJugada,
} from '@/lib/playbook'
import type { PlaybookFolder, PlaybookJugada } from '@/lib/playbook'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tool =
  | 'select' | 'player-own' | 'player-rival' | 'goalkeeper'
  | 'cone' | 'ball' | 'mannequin' | 'text'
  | 'arrow-solid' | 'arrow-dash' | 'arrow-curve' | 'line' | 'eraser'

type CourtMode = 'full' | 'half'

interface Pt { x: number; y: number }

interface Elem {
  id: string
  kind: 'player-own' | 'player-rival' | 'goalkeeper' | 'cone' | 'ball' | 'mannequin'
  x: number; y: number; n?: number
}

interface TextElem {
  id: string; kind: 'text'
  x: number; y: number
  text: string; color: string
}

interface Arrow {
  id: string
  kind: 'arrow-solid' | 'arrow-dash' | 'arrow-curve' | 'line'
  x1: number; y1: number
  x2: number; y2: number
  cx: number; cy: number
  color: string
}

interface Scene { elems: Elem[]; arrows: Arrow[]; texts: TextElem[] }

// ─── Constants & helpers ──────────────────────────────────────────────────────
function dims(mode: CourtMode) {
  return mode === 'full' ? { w: 820, h: 500 } : { w: 620, h: 700 }
}

const HIT = 16
const COLORS = ['#ffe600', '#ffffff', '#ef4444', '#3b82f6', '#f97316', '#22c55e', '#111111']
const INTERP_STEPS = 40  // steps between keyframes for smooth animation

let _id = 0
function uid() { return `e${++_id}` }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function ptDist(ax: number, ay: number, bx: number, by: number) { return Math.hypot(ax - bx, ay - by) }

// ─── Draw helpers (igual que TacticalBoard) ───────────────────────────────────
const COURT_BG = '#4a85b8'
const COURT_LINE = '#111111'

function drawCourt(ctx: CanvasRenderingContext2D, mode: CourtMode, w: number, h: number) {
  ctx.fillStyle = COURT_BG; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = COURT_LINE; ctx.lineWidth = 2.5
  if (mode === 'full') {
    const halfW = w / 2
    ctx.strokeRect(8, 8, w - 16, h - 16)
    ctx.beginPath(); ctx.moveTo(w / 2, 8); ctx.lineTo(w / 2, h - 8); ctx.stroke()
    const gY = h / 2
    const r6 = halfW * 0.42, r9 = halfW * 0.58
    const halfCourtH = gY - 8
    const ang6 = Math.asin(Math.min(1, halfCourtH / r6))
    const ang9 = Math.asin(Math.min(1, halfCourtH / r9))
    ctx.beginPath(); ctx.arc(8, gY, r6, -ang6, ang6); ctx.stroke()
    ctx.beginPath(); ctx.arc(w - 8, gY, r6, Math.PI - ang6, Math.PI + ang6); ctx.stroke()
    ctx.setLineDash([9, 7])
    ctx.beginPath(); ctx.arc(8, gY, r9, -ang9, ang9); ctx.stroke()
    ctx.beginPath(); ctx.arc(w - 8, gY, r9, Math.PI - ang9, Math.PI + ang9); ctx.stroke()
    ctx.setLineDash([])
    const r7 = (r6 + r9) / 2
    ctx.beginPath(); ctx.moveTo(8 + r7, gY - 7); ctx.lineTo(8 + r7, gY + 7); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(w - 8 - r7, gY - 7); ctx.lineTo(w - 8 - r7, gY + 7); ctx.stroke()
    const gH = 70, gTop = gY - gH / 2
    ctx.lineWidth = 5; ctx.strokeRect(0, gTop, 12, gH); ctx.strokeRect(w - 12, gTop, 12, gH); ctx.lineWidth = 2.5
    return
  }
  const gX = w / 2
  const r6v = w * 0.36, r9v = w * 0.48
  const halfCourtW = gX - 8
  const ang6v = Math.asin(Math.min(1, halfCourtW / r6v))
  const ang9v = Math.asin(Math.min(1, halfCourtW / r9v))
  ctx.strokeRect(8, 8, w - 16, h - 16)
  ctx.beginPath(); ctx.arc(gX, 8, r6v, Math.PI / 2 - ang6v, Math.PI / 2 + ang6v); ctx.stroke()
  ctx.setLineDash([9, 7])
  ctx.beginPath(); ctx.arc(gX, 8, r9v, Math.PI / 2 - ang9v, Math.PI / 2 + ang9v); ctx.stroke()
  ctx.setLineDash([])
  const r7v = (r6v + r9v) / 2
  ctx.beginPath(); ctx.moveTo(gX - 7, 8 + r7v); ctx.lineTo(gX + 7, 8 + r7v); ctx.stroke()
  const gW = 70, gLeft = gX - gW / 2
  ctx.lineWidth = 5; ctx.strokeRect(gLeft, 0, gW, 12); ctx.lineWidth = 2.5
}

function drawArrow(ctx: CanvasRenderingContext2D, a: Arrow, alpha = 1, sel = false) {
  ctx.save(); ctx.globalAlpha = alpha
  if (sel) { ctx.shadowColor = 'white'; ctx.shadowBlur = 12 }
  ctx.strokeStyle = a.color; ctx.fillStyle = a.color; ctx.lineWidth = 2.8
  if (a.kind === 'arrow-dash') ctx.setLineDash([9, 6]); else ctx.setLineDash([])
  ctx.beginPath()
  if (a.kind === 'arrow-curve') {
    ctx.moveTo(a.x1, a.y1); ctx.quadraticCurveTo(a.cx, a.cy, a.x2, a.y2)
  } else {
    ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2)
  }
  ctx.stroke(); ctx.setLineDash([])
  if (a.kind !== 'line') {
    const angle = a.kind === 'arrow-curve'
      ? Math.atan2(a.y2 - a.cy, a.x2 - a.cx)
      : Math.atan2(a.y2 - a.y1, a.x2 - a.x1)
    const s = 13
    ctx.beginPath()
    ctx.moveTo(a.x2, a.y2)
    ctx.lineTo(a.x2 - s * Math.cos(angle - .5), a.y2 - s * Math.sin(angle - .5))
    ctx.lineTo(a.x2 - s * Math.cos(angle + .5), a.y2 - s * Math.sin(angle + .5))
    ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, fill = 'white', stroke = '#888') {
  ctx.save()
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.restore()
}

function drawElem(ctx: CanvasRenderingContext2D, el: Elem, sel: boolean) {
  if (sel) { ctx.shadowColor = 'white'; ctx.shadowBlur = 14 }
  const { x, y } = el
  if (el.kind === 'player-own' || el.kind === 'player-rival' || el.kind === 'goalkeeper') {
    const c = el.kind === 'player-own' ? '#d32f2f' : el.kind === 'player-rival' ? '#ffffff' : '#f9a825'
    const textColor = el.kind === 'player-rival' ? '#111111' : 'white'
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 19, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = el.kind === 'player-rival' ? '#111111' : 'white'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = textColor; ctx.font = 'bold 13px Arial'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(el.n ?? ''), x, y)
  } else if (el.kind === 'cone') {
    ctx.fillStyle = '#ff6600'
    ctx.beginPath(); ctx.moveTo(x, y - 15); ctx.lineTo(x - 11, y + 10); ctx.lineTo(x + 11, y + 10)
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke()
  } else if (el.kind === 'ball') {
    ctx.fillStyle = '#f5f5f5'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.moveTo(x, y - 11); ctx.lineTo(x, y + 11); ctx.stroke()
  } else if (el.kind === 'mannequin') {
    ctx.strokeStyle = '#ff9800'; ctx.fillStyle = '#ff9800'; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(x, y - 16, 7, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x - 11, y - 1); ctx.lineTo(x + 11, y - 1); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y + 9); ctx.lineTo(x - 9, y + 22)
    ctx.moveTo(x, y + 9); ctx.lineTo(x + 9, y + 22); ctx.stroke()
  }
  ctx.shadowBlur = 0
}

function drawText(ctx: CanvasRenderingContext2D, t: TextElem, sel: boolean) {
  ctx.save()
  if (sel) { ctx.shadowColor = 'white'; ctx.shadowBlur = 10 }
  ctx.font = 'bold 16px Arial'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const w = ctx.measureText(t.text).width
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(t.x - w / 2 - 6, t.y - 12, w + 12, 24)
  ctx.fillStyle = t.color
  ctx.fillText(t.text, t.x, t.y)
  ctx.restore()
}

// ─── Interpolación entre fotogramas ──────────────────────────────────────────
function interpolateScene(s1: Scene, s2: Scene, t: number): Scene {
  const elems: Elem[] = []
  for (const e1 of s1.elems) {
    const e2 = s2.elems.find(e => e.id === e1.id)
    if (!e2) { if (t < 0.5) elems.push(e1) }
    else elems.push({ ...e1, x: lerp(e1.x, e2.x, t), y: lerp(e1.y, e2.y, t) })
  }
  for (const e2 of s2.elems) {
    if (!s1.elems.find(e => e.id === e2.id) && t >= 0.5) elems.push(e2)
  }
  const arrows: Arrow[] = []
  for (const a1 of s1.arrows) {
    const a2 = s2.arrows.find(a => a.id === a1.id)
    if (!a2) { if (t < 0.5) arrows.push(a1) }
    else arrows.push({
      ...a1,
      x1: lerp(a1.x1, a2.x1, t), y1: lerp(a1.y1, a2.y1, t),
      x2: lerp(a1.x2, a2.x2, t), y2: lerp(a1.y2, a2.y2, t),
      cx: lerp(a1.cx, a2.cx, t), cy: lerp(a1.cy, a2.cy, t),
    })
  }
  for (const a2 of s2.arrows) {
    if (!s1.arrows.find(a => a.id === a2.id) && t >= 0.5) arrows.push(a2)
  }
  return { elems, arrows, texts: t < 0.5 ? s1.texts : s2.texts }
}

// ─── Componente principal ─────────────────────────────────────────────────────
const emptyScene = (): Scene => ({ elems: [], arrows: [], texts: [] })

export function PlaybookPage() {
  // Frames
  const framesRef = useRef<Scene[]>([emptyScene()])
  const [frames, setFrames] = useState<Scene[]>([emptyScene()])
  const [currentFrame, setCurrentFrame] = useState(0)
  const currentFrameRef = useRef(0)
  const [thumbnails, setThumbnails] = useState<string[]>([''])

  // Editor
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(COLORS[0])
  const [courtMode, setCourtMode] = useState<CourtMode>('full')
  const [editMode, setEditMode] = useState(false)
  const editModeRef = useRef(false)
  const [, tick] = useState(0)
  const rerender = () => tick(n => n + 1)

  // Playback
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)
  const [playProgress, setPlayProgress] = useState(0)
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1)
  const speedRef = useRef<0.5 | 1 | 2>(1)
  const playAnimRef = useRef<number | null>(null)

  // Export
  const [exporting, setExporting] = useState<'gif' | 'mp4' | null>(null)

  // Metadata de la jugada actual
  const [jugadaTitle, setJugadaTitle] = useState('')
  const [jugadaDesc, setJugadaDesc] = useState('')
  const [jugadaId, setJugadaId] = useState<string | null>(null)  // null = nueva jugada

  // Biblioteca
  const { effectiveUserId, account } = useAppStore()
  const [folders, setFolders] = useState<PlaybookFolder[]>([])
  const [jugadas, setJugadas] = useState<PlaybookJugada[]>([])
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const [loadingLib, setLoadingLib] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveFolder, setSaveFolder] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  // Canvas refs
  const cvRef = useRef<HTMLCanvasElement>(null)
  const toolRef = useRef<Tool>('select')
  const colorRef = useRef(COLORS[0])
  const courtRef = useRef<CourtMode>('full')
  const selId = useRef<string | null>(null)
  const selArrowId = useRef<string | null>(null)
  const counts = useRef({ own: 1, rival: 1, gk: 1 })
  const drag = useRef<{
    what: 'none' | 'elem' | 'text' | 'arrow-body' | 'arrow-p1' | 'arrow-p2' | 'arrow-ctrl' | 'drawing'
    id: string; ox: number; oy: number
  }>({ what: 'none', id: '', ox: 0, oy: 0 })

  function setT(t: Tool) { toolRef.current = t; setTool(t) }
  function setC(c: string) { colorRef.current = c; setColor(c) }
  function setM(m: CourtMode) { courtRef.current = m; setCourtMode(m); paintScene(framesRef.current[currentFrameRef.current]) }

  // ─── Paint ────────────────────────────────────────────────────────────────
  function paintScene(scene: Scene, canvas?: HTMLCanvasElement) {
    const cv = canvas ?? cvRef.current; if (!cv) return
    const { w, h } = dims(courtRef.current)
    if (!canvas) {
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h }
    }
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    drawCourt(ctx, courtRef.current, cv.width, cv.height)
    scene.arrows.forEach(a => drawArrow(ctx, a, 1, a.id === selArrowId.current))
    if (!canvas && editModeRef.current) {
      scene.arrows.forEach(a => {
        drawHandle(ctx, a.x1, a.y1, '#fff', a.color)
        drawHandle(ctx, a.x2, a.y2, '#fff', a.color)
        if (a.kind === 'arrow-curve') drawHandle(ctx, a.cx, a.cy, '#ffff00', '#fff')
      })
    }
    scene.elems.forEach(el => drawElem(ctx, el, el.id === selId.current))
    scene.texts.forEach(t => drawText(ctx, t, t.id === selId.current))
  }

  function paint(idx?: number) {
    paintScene(framesRef.current[idx ?? currentFrameRef.current])
  }

  // ─── Thumbnails ──────────────────────────────────────────────────────────
  function renderThumbnail(scene: Scene): string {
    const off = document.createElement('canvas')
    const { w, h } = dims(courtRef.current)
    off.width = 160; off.height = Math.round(160 * h / w)
    const ctx = off.getContext('2d')!
    ctx.scale(160 / w, off.height / h)
    drawCourt(ctx, courtRef.current, w, h)
    scene.arrows.forEach(a => drawArrow(ctx, a))
    scene.elems.forEach(el => drawElem(ctx, el, false))
    scene.texts.forEach(t => drawText(ctx, t, false))
    return off.toDataURL('image/png')
  }

  function updateThumbnail(idx: number, scene: Scene) {
    const url = renderThumbnail(scene)
    setThumbnails(prev => { const n = [...prev]; n[idx] = url; return n })
  }

  // ─── Commit ──────────────────────────────────────────────────────────────
  function commit(scene: Scene, idx?: number) {
    const i = idx ?? currentFrameRef.current
    const nf = [...framesRef.current]; nf[i] = scene
    framesRef.current = nf; setFrames([...nf])
    paintScene(scene); updateThumbnail(i, scene)
  }

  // ─── Frame management ─────────────────────────────────────────────────────
  function addFrame() {
    const cur = JSON.parse(JSON.stringify(framesRef.current[currentFrameRef.current])) as Scene
    const newIdx = currentFrameRef.current + 1
    const nf = [...framesRef.current]; nf.splice(newIdx, 0, cur)
    framesRef.current = nf
    const nt = [...thumbnails]; nt.splice(newIdx, 0, renderThumbnail(cur))
    setThumbnails(nt); setFrames([...nf])
    goToFrame(newIdx)
  }

  function deleteFrame(idx: number) {
    if (framesRef.current.length <= 1) return
    const nf = framesRef.current.filter((_, i) => i !== idx); framesRef.current = nf
    const nt = thumbnails.filter((_, i) => i !== idx); setThumbnails(nt); setFrames([...nf])
    goToFrame(Math.min(idx, nf.length - 1))
  }

  function goToFrame(idx: number) {
    currentFrameRef.current = idx; setCurrentFrame(idx)
    selId.current = null; selArrowId.current = null
    paint(idx); rerender()
  }

  function clearCurrentFrame() {
    commit(emptyScene())
    counts.current = { own: 1, rival: 1, gk: 1 }
  }

  // ─── Playback ─────────────────────────────────────────────────────────────
  function stopPlay() {
    if (playAnimRef.current) cancelAnimationFrame(playAnimRef.current)
    playAnimRef.current = null
    isPlayingRef.current = false; setIsPlaying(false); setPlayProgress(0)
    paint(currentFrameRef.current)
  }

  function startPlay() {
    if (framesRef.current.length < 2) return
    isPlayingRef.current = true; setIsPlaying(true)
    const totalTrans = framesRef.current.length - 1
    const msPerTrans = 1000 / speedRef.current
    const totalMs = totalTrans * msPerTrans
    const startTime = performance.now()
    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / totalMs, 1)
      setPlayProgress(progress)
      const globalStep = progress * totalTrans
      const fi = Math.min(Math.floor(globalStep), totalTrans - 1)
      const t = globalStep - fi
      const scene = t >= 1
        ? framesRef.current[fi + 1]
        : interpolateScene(framesRef.current[fi], framesRef.current[fi + 1], t)
      paintScene(scene)
      if (progress < 1) playAnimRef.current = requestAnimationFrame(tick)
      else { isPlayingRef.current = false; setIsPlaying(false); setPlayProgress(0); paint(framesRef.current.length - 1) }
    }
    playAnimRef.current = requestAnimationFrame(tick)
  }

  // ─── Export MP4 ───────────────────────────────────────────────────────────
  async function exportMP4() {
    if (framesRef.current.length < 2 || exporting) return
    setExporting('mp4')
    const canvas = cvRef.current!
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
      : 'video/webm'
    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'jugada.mp4'; a.click()
      URL.revokeObjectURL(url); setExporting(null)
    }
    recorder.start()
    const totalTrans = framesRef.current.length - 1
    const msPerTrans = 1200  // 1.2s per transition for export
    const totalMs = totalTrans * msPerTrans
    const startTime = performance.now()
    await new Promise<void>(resolve => {
      function tick(now: number) {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / totalMs, 1)
        const globalStep = progress * totalTrans
        const fi = Math.min(Math.floor(globalStep), totalTrans - 1)
        const t = globalStep - fi
        const scene = t >= 1 ? framesRef.current[fi + 1] : interpolateScene(framesRef.current[fi], framesRef.current[fi + 1], t)
        paintScene(scene)
        if (progress < 1) requestAnimationFrame(tick); else resolve()
      }
      requestAnimationFrame(tick)
    })
    await new Promise(r => setTimeout(r, 800))  // hold last frame
    recorder.stop()
  }

  // ─── Export GIF ───────────────────────────────────────────────────────────
  async function exportGIF() {
    if (framesRef.current.length < 2 || exporting) return
    setExporting('gif')
    try {
      await new Promise<void>((resolve, reject) => {
        if ((window as any).GIF) { resolve(); return }
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js'
        s.onload = () => resolve(); s.onerror = reject
        document.head.appendChild(s)
      })
      const { w, h } = dims(courtRef.current)
      const off = document.createElement('canvas'); off.width = w; off.height = h
      const GIFLib = (window as any).GIF
      const gif = new GIFLib({
        workers: 2, quality: 6, width: w, height: h,
        workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js',
      })
      const totalTrans = framesRef.current.length - 1
      const delay = Math.round(1000 / 25)  // ~25fps
      for (let fi = 0; fi < totalTrans; fi++) {
        for (let step = 0; step <= INTERP_STEPS; step++) {
          const t = step / INTERP_STEPS
          const scene = interpolateScene(framesRef.current[fi], framesRef.current[fi + 1], t)
          paintScene(scene, off)
          gif.addFrame(off, { copy: true, delay })
        }
      }
      paintScene(framesRef.current[framesRef.current.length - 1], off)
      gif.addFrame(off, { copy: true, delay: 1000 })
      gif.on('finished', (blob: Blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'jugada.gif'; a.click()
        URL.revokeObjectURL(url); setExporting(null)
      })
      gif.render()
    } catch {
      setExporting(null)
      alert('Error al exportar GIF. Intentá con MP4.')
    }
  }

  // ─── Biblioteca ───────────────────────────────────────────────────────────
  async function loadLibrary() {
    if (!effectiveUserId) return
    setLoadingLib(true)
    try {
      const [f, j] = await Promise.all([
        getFolders(effectiveUserId),
        getJugadas(effectiveUserId),
      ])
      setFolders(f); setJugadas(j)
    } catch { /* silencioso */ }
    finally { setLoadingLib(false) }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || !effectiveUserId || !account?.id) return
    setCreatingFolder(true)
    try {
      const f = await createFolder(effectiveUserId, account.id, newFolderName)
      setFolders(prev => [...prev, f])
      setOpenFolders(prev => new Set([...prev, f.id]))
      setNewFolderName('')
    } catch { /* silencioso */ }
    finally { setCreatingFolder(false) }
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm('¿Borrar la carpeta y todas sus jugadas?')) return
    await deleteFolder(id)
    setFolders(prev => prev.filter(f => f.id !== id))
    setJugadas(prev => prev.filter(j => j.folder_id !== id))
  }

  async function handleSaveJugada() {
    if (!effectiveUserId || !account?.id) return
    setSaving(true)
    try {
      const thumbnail = renderThumbnail(framesRef.current[0])
      const result = await saveJugada({
        id: jugadaId ?? undefined,
        coachId: effectiveUserId,
        accountId: account.id,
        folderId: saveFolder,
        title: jugadaTitle,
        description: jugadaDesc,
        frames: framesRef.current,
        courtMode: courtRef.current,
        thumbnail,
      })
      setJugadaId(result.id)
      setJugadas(prev => {
        const exists = prev.find(j => j.id === result.id)
        return exists ? prev.map(j => j.id === result.id ? result : j) : [result, ...prev]
      })
      setShowSaveModal(false)
    } catch { alert('Error al guardar.') }
    finally { setSaving(false) }
  }

  function loadJugada(j: PlaybookJugada) {
    if (!confirm(`¿Cargar "${j.title}"? Se perderán los cambios no guardados.`)) return
    const loadedFrames = j.frames as Scene[]
    framesRef.current = loadedFrames
    courtRef.current = j.court_mode as CourtMode
    setFrames([...loadedFrames])
    setCourtMode(j.court_mode as CourtMode)
    setJugadaId(j.id)
    setJugadaTitle(j.title)
    setJugadaDesc(j.description)
    setThumbnails(loadedFrames.map(f => renderThumbnail(f)))
    currentFrameRef.current = 0; setCurrentFrame(0)
    selId.current = null; selArrowId.current = null
    paint(0)
  }

  async function handleDeleteJugada(id: string) {
    if (!confirm('¿Borrar esta jugada?')) return
    await deleteJugada(id)
    setJugadas(prev => prev.filter(j => j.id !== id))
    if (jugadaId === id) setJugadaId(null)
  }

  function toggleFolder(id: string) {
    setOpenFolders(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function newJugada() {
    if (!confirm('¿Empezar una jugada nueva? Se perderán los cambios no guardados.')) return
    framesRef.current = [emptyScene()]
    setFrames([emptyScene()])
    setThumbnails([''])
    setJugadaId(null); setJugadaTitle(''); setJugadaDesc('')
    currentFrameRef.current = 0; setCurrentFrame(0)
    counts.current = { own: 1, rival: 1, gk: 1 }
    paint(0)
  }

  // ─── Init & keyboard ─────────────────────────────────────────────────────
  useEffect(() => { paint(); loadLibrary() }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      const s = framesRef.current[currentFrameRef.current]
      if (selArrowId.current) {
        const id = selArrowId.current; commit({ ...s, arrows: s.arrows.filter(a => a.id !== id) }); selArrowId.current = null
      } else if (selId.current) {
        const id = selId.current
        commit({ elems: s.elems.filter(el => el.id !== id), texts: s.texts.filter(t => t.id !== id), arrows: s.arrows })
        selId.current = null
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ─── Mouse ────────────────────────────────────────────────────────────────
  function pos(e: React.MouseEvent<HTMLCanvasElement>): Pt {
    const cv = cvRef.current!; const rect = cv.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (cv.width / rect.width), y: (e.clientY - rect.top) * (cv.height / rect.height) }
  }

  function down(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isPlayingRef.current) return
    e.preventDefault()
    const p = pos(e); const s = framesRef.current[currentFrameRef.current]; const t = toolRef.current
    if (t === 'eraser') {
      const he = [...s.elems].reverse().find(el => ptDist(el.x, el.y, p.x, p.y) < HIT + 10)
      const ha = s.arrows.find(a => ptDist((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2, p.x, p.y) < HIT + 10)
      if (he) commit({ ...s, elems: s.elems.filter(el => el.id !== he.id) })
      else if (ha) commit({ ...s, arrows: s.arrows.filter(a => a.id !== ha.id) })
      return
    }
    if (t === 'select') {
      if (editModeRef.current) {
        for (const a of s.arrows) {
          if (ptDist(a.x1, a.y1, p.x, p.y) < HIT) { drag.current = { what: 'arrow-p1', id: a.id, ox: 0, oy: 0 }; selArrowId.current = a.id; rerender(); return }
          if (ptDist(a.x2, a.y2, p.x, p.y) < HIT) { drag.current = { what: 'arrow-p2', id: a.id, ox: 0, oy: 0 }; selArrowId.current = a.id; rerender(); return }
          if (a.kind === 'arrow-curve' && ptDist(a.cx, a.cy, p.x, p.y) < HIT) { drag.current = { what: 'arrow-ctrl', id: a.id, ox: 0, oy: 0 }; selArrowId.current = a.id; rerender(); return }
        }
      }
      const he = [...s.elems].reverse().find(el => ptDist(el.x, el.y, p.x, p.y) < HIT + 6)
      if (he) { drag.current = { what: 'elem', id: he.id, ox: he.x - p.x, oy: he.y - p.y }; selId.current = he.id; selArrowId.current = null; paint(); rerender(); return }
      const ht = [...s.texts].reverse().find(tx => ptDist(tx.x, tx.y, p.x, p.y) < HIT + 10)
      if (ht) { drag.current = { what: 'text', id: ht.id, ox: ht.x - p.x, oy: ht.y - p.y }; selId.current = ht.id; selArrowId.current = null; paint(); rerender(); return }
      const ha = s.arrows.find(a => ptDist((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2, p.x, p.y) < HIT + 6)
      if (ha) { drag.current = { what: 'arrow-body', id: ha.id, ox: 0, oy: 0 }; selArrowId.current = ha.id; selId.current = null; paint(); rerender(); return }
      selId.current = null; selArrowId.current = null; paint(); rerender(); return
    }
    if (t === 'text') {
      const text = prompt('Texto:') ?? ''; if (!text) return
      commit({ ...s, texts: [...s.texts, { id: uid(), kind: 'text', x: p.x, y: p.y, text, color: colorRef.current }] }); return
    }
    if (['arrow-solid', 'arrow-dash', 'arrow-curve', 'line'].includes(t)) {
      drag.current = { what: 'drawing', id: '', ox: p.x, oy: p.y }; return
    }
    const kind = t as Elem['kind']
    const n = kind === 'player-own' ? counts.current.own++
      : kind === 'player-rival' ? counts.current.rival++
      : kind === 'goalkeeper' ? counts.current.gk++
      : undefined
    commit({ ...s, elems: [...s.elems, { id: uid(), kind, x: p.x, y: p.y, n }] })
  }

  function move(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isPlayingRef.current) return
    e.preventDefault()
    const p = pos(e); const d = drag.current
    if (d.what === 'none') return
    const s = framesRef.current[currentFrameRef.current]
    const updateCur = (scene: Scene) => {
      const nf = [...framesRef.current]; nf[currentFrameRef.current] = scene
      framesRef.current = nf; paintScene(scene)
    }
    if (d.what === 'elem') { updateCur({ ...s, elems: s.elems.map(el => el.id === d.id ? { ...el, x: p.x + d.ox, y: p.y + d.oy } : el) }); return }
    if (d.what === 'text') { updateCur({ ...s, texts: s.texts.map(tx => tx.id === d.id ? { ...tx, x: p.x + d.ox, y: p.y + d.oy } : tx) }); return }
    if (d.what === 'arrow-p1') { updateCur({ ...s, arrows: s.arrows.map(a => a.id === d.id ? { ...a, x1: p.x, y1: p.y } : a) }); return }
    if (d.what === 'arrow-p2') { updateCur({ ...s, arrows: s.arrows.map(a => a.id === d.id ? { ...a, x2: p.x, y2: p.y } : a) }); return }
    if (d.what === 'arrow-ctrl') { updateCur({ ...s, arrows: s.arrows.map(a => a.id === d.id ? { ...a, cx: p.x, cy: p.y } : a) }); return }
    if (d.what === 'arrow-body') {
      const a = s.arrows.find(x => x.id === d.id); if (!a) return
      if (d.ox === 0 && d.oy === 0) { drag.current = { ...d, ox: p.x, oy: p.y }; return }
      const dx = p.x - d.ox, dy = p.y - d.oy; drag.current = { ...d, ox: p.x, oy: p.y }
      updateCur({ ...s, arrows: s.arrows.map(x => x.id === d.id ? { ...x, x1: x.x1 + dx, y1: x.y1 + dy, x2: x.x2 + dx, y2: x.y2 + dy, cx: x.cx + dx, cy: x.cy + dy } : x) }); return
    }
    if (d.what === 'drawing') {
      const cv = cvRef.current!; const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, cv.width, cv.height)
      drawCourt(ctx, courtRef.current, cv.width, cv.height)
      s.arrows.forEach(a => drawArrow(ctx, a)); s.elems.forEach(el => drawElem(ctx, el, false)); s.texts.forEach(t => drawText(ctx, t, false))
      const tl = toolRef.current
      drawArrow(ctx, {
        id: 'prev', kind: tl as Arrow['kind'],
        x1: d.ox, y1: d.oy, x2: p.x, y2: p.y,
        cx: tl === 'arrow-curve' ? (d.ox + p.x) / 2 : (d.ox + p.x) / 2,
        cy: tl === 'arrow-curve' ? Math.min(d.oy, p.y) - 60 : (d.oy + p.y) / 2,
        color: colorRef.current
      }, 0.6)
    }
  }

  function up(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isPlayingRef.current) return
    e.preventDefault()
    const p = pos(e); const d = drag.current; const s = framesRef.current[currentFrameRef.current]
    if (['elem', 'text', 'arrow-p1', 'arrow-p2', 'arrow-ctrl', 'arrow-body'].includes(d.what)) {
      d.what = 'none'; commit(framesRef.current[currentFrameRef.current]); return
    }
    if (d.what === 'drawing') {
      if (ptDist(p.x, p.y, d.ox, d.oy) > 15) {
        const tl = toolRef.current
        commit({ ...s, arrows: [...s.arrows, { id: uid(), kind: tl as Arrow['kind'], x1: d.ox, y1: d.oy, x2: p.x, y2: p.y, cx: tl === 'arrow-curve' ? (d.ox + p.x) / 2 : (d.ox + p.x) / 2, cy: tl === 'arrow-curve' ? Math.min(d.oy, p.y) - 60 : (d.oy + p.y) / 2, color: colorRef.current }] })
      } else paintScene(s)
      d.what = 'none'
    }
  }

  // ─── Tools config ─────────────────────────────────────────────────────────
  const TOOLS: { id: Tool; label: string; el: React.ReactNode }[] = [
    { id: 'select', label: 'Mover', el: <MousePointer size={14} /> },
    { id: 'player-own', label: 'Jugador', el: <span className="w-4 h-4 rounded-full bg-red-600 border border-white inline-block" /> },
    { id: 'player-rival', label: 'Rival', el: <span className="w-4 h-4 rounded-full bg-white border-2 border-black inline-block" /> },
    { id: 'goalkeeper', label: 'Portero', el: <span className="w-4 h-4 rounded-full bg-yellow-400 border border-white inline-block" /> },
    { id: 'mannequin', label: 'Muñeco', el: <span className="text-base">🚶</span> },
    { id: 'cone', label: 'Cono', el: <span className="text-orange-500 font-bold">▲</span> },
    { id: 'ball', label: 'Pelota', el: <span className="text-gray-200 font-bold">●</span> },
    { id: 'text', label: 'Texto', el: <span className="text-white font-bold text-sm">T</span> },
    { id: 'arrow-solid', label: 'Trayectoria', el: <span className="text-yellow-400 text-xs font-bold">——▶</span> },
    { id: 'arrow-dash', label: 'Pase', el: <span className="text-yellow-400 text-xs font-bold">- -▶</span> },
    { id: 'arrow-curve', label: 'Curva', el: <span className="text-yellow-400 text-xs font-bold">∿▶</span> },
    { id: 'line', label: 'Línea', el: <Minus size={14} /> },
    { id: 'eraser', label: 'Borrar', el: <Trash2 size={14} /> },
  ]

  const cursor = tool === 'select' ? 'default'
    : ['arrow-solid', 'arrow-dash', 'arrow-curve', 'line'].includes(tool) ? 'crosshair'
    : tool === 'eraser' ? 'crosshair' : 'copy'

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Pizarra</h1>
          <p className="text-gray-500 text-sm mt-0.5">Creá jugadas y animaciones por fotogramas</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['full', 'half'] as CourtMode[]).map((m, i) => (
              <button key={m} type="button" onClick={() => setM(m)}
                className={clsx('text-xs px-3 py-1.5 rounded-lg transition-colors font-medium',
                  courtMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                {['Completa', 'Mitad'][i]}
              </button>
            ))}
          </div>
          <button type="button" onClick={clearCurrentFrame}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors">
            <Trash2 size={13} /> Limpiar
          </button>
          <button type="button" onClick={newJugada}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:border-gray-300 transition-colors">
            <Plus size={13} /> Nueva
          </button>
          <button type="button" onClick={() => { setSaveFolder(null); setShowSaveModal(true) }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors">
            <Save size={13} /> Guardar jugada
          </button>
          <button type="button" onClick={exportGIF}
            disabled={!!exporting || frames.length < 2}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium transition-colors">
            {exporting === 'gif' ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
            {exporting === 'gif' ? 'Generando...' : 'GIF'}
          </button>
          <button type="button" onClick={exportMP4}
            disabled={!!exporting || frames.length < 2}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium transition-colors">
            {exporting === 'mp4' ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />}
            {exporting === 'mp4' ? 'Grabando...' : 'MP4'}
          </button>
        </div>
      </div>

      {/* Campos de texto: título y descripción */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <input
          type="text"
          value={jugadaTitle}
          onChange={e => setJugadaTitle(e.target.value)}
          placeholder="Título de la jugada (ej: Contraataque 2 vs 1)"
          className="w-full text-lg font-semibold text-gray-900 placeholder:text-gray-300 border-none outline-none focus:ring-0 bg-transparent"
        />
        <textarea
          value={jugadaDesc}
          onChange={e => setJugadaDesc(e.target.value)}
          placeholder="Descripción, consignas, variantes, errores a evitar..."
          rows={3}
          className="w-full text-sm text-gray-600 placeholder:text-gray-300 border-none outline-none focus:ring-0 bg-transparent resize-none"
        />
        {jugadaId && (
          <p className="text-xs text-gray-300">Jugada guardada · ID {jugadaId.slice(0, 8)}</p>
        )}
      </div>

      <div className="flex gap-3">
        {/* Panel de herramientas */}
        <div className="flex flex-col gap-0.5 bg-gray-900 rounded-2xl p-2 flex-shrink-0" style={{ width: 148 }}>
          <div className="px-1 pb-2 border-b border-white/10 mb-1">
            <p className="text-white/40 text-[10px] mb-1.5 uppercase tracking-wide">Color</p>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setC(c)} title={c}
                  className={clsx('w-5 h-5 rounded-full border-2 transition-transform',
                    color === c ? 'border-white scale-125' : 'border-transparent hover:scale-110')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {TOOLS.map(t => (
            <button key={t.id} type="button" onClick={() => setT(t.id)}
              className={clsx('flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs transition-all text-left',
                tool === t.id ? 'bg-neutral2-700 text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/10')}>
              <span className="w-5 flex items-center justify-center flex-shrink-0">{t.el}</span>
              <span>{t.label}</span>
            </button>
          ))}
          <button type="button"
            onClick={() => { editModeRef.current = !editModeRef.current; setEditMode(editModeRef.current); paint() }}
            className={clsx('mt-1 flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs transition-all text-left border',
              editMode ? 'border-neutral2-500 text-neutral2-300 bg-neutral2-900/60' : 'border-white/10 text-white/40 hover:text-white/60')}>
            <span className="w-5 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-white inline-block" />
            </span>
            <span>Editar flechas</span>
          </button>
        </div>

        {/* Canvas + playback */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="bg-gray-800 rounded-2xl p-2 flex items-center justify-center">
            <canvas
              ref={cvRef}
              width={dims(courtMode).w} height={dims(courtMode).h}
              style={{ cursor, maxHeight: '58vh', maxWidth: '100%', borderRadius: 10 }}
              className="select-none"
              onMouseDown={down} onMouseMove={move} onMouseUp={up}
              onMouseLeave={e => { if (drag.current.what !== 'none') up(e) }}
            />
          </div>

          {/* Playback bar */}
          <div className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-2.5">
            <button type="button"
              onClick={isPlaying ? stopPlay : startPlay}
              disabled={frames.length < 2}
              className="flex items-center gap-1.5 bg-neutral2-700 hover:bg-neutral2-600 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Detener' : 'Reproducir'}
            </button>
            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-neutral2-400 rounded-full transition-none"
                style={{ width: `${playProgress * 100}%` }} />
            </div>
            <p className="text-white/40 text-xs flex-shrink-0">
              {frames.length < 2 ? 'Necesitás 2+ frames' : `${frames.length} frames`}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {([0.5, 1, 2] as const).map(s => (
                <button key={s} type="button"
                  onClick={() => { speedRef.current = s; setSpeed(s) }}
                  className={clsx('text-xs px-2 py-0.5 rounded-lg transition-colors',
                    speed === s ? 'bg-neutral2-600 text-white font-medium' : 'text-white/40 hover:text-white/70')}>
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de fotogramas */}
        <div className="flex-shrink-0 flex flex-col gap-2" style={{ width: 128 }}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fotogramas</p>
          <div className="flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: '60vh' }}>
            {frames.map((_, idx) => (
              <div
                key={idx}
                onClick={() => !isPlaying && goToFrame(idx)}
                className={clsx(
                  'relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all group',
                  idx === currentFrame ? 'border-neutral2-500 shadow-lg shadow-neutral2-900/30' : 'border-gray-200 hover:border-gray-300',
                )}>
                {thumbnails[idx]
                  ? <img src={thumbnails[idx]} alt={`Frame ${idx + 1}`} className="w-full block" />
                  : <div className="bg-gray-800 h-16" />}
                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/60 flex items-center justify-between">
                  <span className="text-white text-[10px] font-bold">F{idx + 1}</span>
                  {frames.length > 1 && (
                    <button type="button"
                      onClick={e => { e.stopPropagation(); deleteFrame(idx) }}
                      className="text-white/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={9} />
                    </button>
                  )}
                </div>
                {idx === currentFrame && (
                  <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-neutral2-400 shadow" />
                )}
              </div>
            ))}
          </div>
          <button type="button"
            onClick={() => !isPlaying && addFrame()}
            className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 hover:border-gray-400 rounded-xl py-2 transition-colors">
            <Plus size={12} /> Agregar
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Editá cada fotograma → mové los jugadores de posición → "Agregar" para sumar frames → Reproducir para ver la animación
      </p>

      {/* ─── Biblioteca de jugadas ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Mis jugadas</h2>
          <button type="button" onClick={loadLibrary}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Actualizar
          </button>
        </div>

        {/* Crear carpeta */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
            placeholder="Nueva carpeta..."
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-gray-400 transition-colors"
          />
          <button type="button" onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-medium transition-colors">
            <Plus size={13} /> Crear carpeta
          </button>
        </div>

        {loadingLib ? (
          <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
        ) : folders.length === 0 && jugadas.filter(j => !j.folder_id).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Todavía no hay jugadas guardadas. Creá tu primera carpeta y guardá una jugada.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Jugadas sin carpeta */}
            {jugadas.filter(j => !j.folder_id).map(j => (
              <JugadaCard key={j.id} jugada={j} onLoad={loadJugada} onDelete={handleDeleteJugada} />
            ))}

            {/* Carpetas */}
            {folders.map(folder => {
              const isOpen = openFolders.has(folder.id)
              const folderJugadas = jugadas.filter(j => j.folder_id === folder.id)
              return (
                <div key={folder.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button type="button"
                    onClick={() => toggleFolder(folder.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                    {isOpen ? <FolderOpen size={15} className="text-amber-500 flex-shrink-0" /> : <Folder size={15} className="text-amber-500 flex-shrink-0" />}
                    <span className="text-sm font-medium text-gray-800 flex-1">{folder.name}</span>
                    <span className="text-xs text-gray-400">{folderJugadas.length}</span>
                    <ChevronDown size={14} className={clsx('text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                    <button type="button"
                      onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.id) }}
                      className="text-gray-300 hover:text-red-400 transition-colors ml-1">
                      <Trash2 size={12} />
                    </button>
                  </button>
                  {isOpen && (
                    <div className="p-3 space-y-2">
                      {folderJugadas.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">Carpeta vacía</p>
                      ) : (
                        folderJugadas.map(j => (
                          <JugadaCard key={j.id} jugada={j} onLoad={loadJugada} onDelete={handleDeleteJugada} />
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Modal guardar ──────────────────────────────────────────────────── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Guardar jugada</h3>
              <button type="button" onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Título</label>
                <input type="text" value={jugadaTitle} onChange={e => setJugadaTitle(e.target.value)}
                  placeholder="Sin título"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Carpeta</label>
                <select
                  value={saveFolder ?? ''}
                  onChange={e => setSaveFolder(e.target.value || null)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white">
                  <option value="">Sin carpeta</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowSaveModal(false)}
                className="flex-1 text-sm py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveJugada} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tarjeta de jugada ────────────────────────────────────────────────────────
function JugadaCard({ jugada, onLoad, onDelete }: {
  jugada: PlaybookJugada
  onLoad: (j: PlaybookJugada) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl p-2.5 transition-colors group">
      {jugada.thumbnail ? (
        <img src={jugada.thumbnail} alt={jugada.title} className="w-16 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-16 h-10 rounded-lg bg-blue-200 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{jugada.title}</p>
        {jugada.description && (
          <p className="text-xs text-gray-400 truncate">{jugada.description}</p>
        )}
        <p className="text-[10px] text-gray-300 mt-0.5">
          {(jugada.frames as unknown[]).length} frame{(jugada.frames as unknown[]).length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={() => onLoad(jugada)}
          className="text-xs px-2 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-colors">
          Cargar
        </button>
        <button type="button" onClick={() => onDelete(jugada.id)}
          className="text-gray-300 hover:text-red-400 transition-colors p-1">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
