// Utilidad clsx inline - combina clases CSS condicionalmente
export function clsx(...args: (string | boolean | undefined | null | Record<string, boolean>)[]): string {
  return args
    .flatMap(arg => {
      if (!arg) return []
      if (typeof arg === 'string') return [arg]
      if (typeof arg === 'object') {
        return Object.entries(arg)
          .filter(([, v]) => v)
          .map(([k]) => k)
      }
      return []
    })
    .join(' ')
}
