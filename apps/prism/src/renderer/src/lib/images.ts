/** Longest side of a picture on a slide; bigger photos are scaled down to keep files small. */
const MAX_SIDE = 1920
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** A picture file as a data URL, so it can be stored inside the .prism file. */
export async function imageToDataUrl(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('type')
  const dataUrl = await readAsDataUrl(file)
  if (file.type === 'image/gif') return dataUrl
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1) {
    bitmap.close()
    return dataUrl
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88)
}

export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = IMAGE_TYPES.join(',')
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}
