// Extrae los colores dominantes de una imagen analizando sus píxeles con un canvas.
// No usa librerías externas — corre 100% en el navegador.

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

// Agrupa colores parecidos para no devolver 10 variantes casi idénticas del mismo tono.
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

export async function extractDominantColors(file: File, maxColors = 4): Promise<string[]> {
  const imgUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = imgUrl
    })

    const size = 80 // achicar la imagen acelera el análisis sin perder precisión de color
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return []
    ctx.drawImage(img, 0, 0, size, size)

    const { data } = ctx.getImageData(0, 0, size, size)
    const counts = new Map<string, { count: number; rgb: [number, number, number] }>()

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      if (a < 200) continue // ignorar píxeles transparentes
      // ignorar blancos y negros casi puros — suelen ser fondo, no la identidad del club
      const isNearWhite = r > 235 && g > 235 && b > 235
      const isNearBlack = r < 20 && g < 20 && b < 20
      if (isNearWhite || isNearBlack) continue

      // Cuantizar a steps de 24 para agrupar tonos parecidos en el mismo bucket
      const qr = Math.round(r / 24) * 24
      const qg = Math.round(g / 24) * 24
      const qb = Math.round(b / 24) * 24
      const key = `${qr},${qg},${qb}`
      const existing = counts.get(key)
      if (existing) existing.count++
      else counts.set(key, { count: 1, rgb: [qr, qg, qb] })
    }

    const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count)

    const result: [number, number, number][] = []
    for (const candidate of sorted) {
      if (result.length >= maxColors) break
      const tooClose = result.some(r => colorDistance(r, candidate.rgb) < 60)
      if (!tooClose) result.push(candidate.rgb)
    }

    return result.map(([r, g, b]) => rgbToHex(r, g, b))
  } catch {
    return []
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}
