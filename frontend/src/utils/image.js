const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

export function isSupportedImageFile(file) {
  return Boolean(file && SUPPORTED_IMAGE_TYPES.has(file.type))
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_decode_failed'))
    }
    image.src = url
  })
}

export async function resizeImage(file, { maxSide, maxLength, quality = 0.86 }) {
  const image = await loadImage(file)
  const initialScale = Math.min(1, maxSide / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) throw new Error('canvas_unavailable')

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const scale = initialScale * Math.pow(0.82, attempt)
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    context.fillStyle = '#181719'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const data = canvas.toDataURL('image/jpeg', Math.max(0.58, quality - attempt * 0.04))
    if (data.length <= maxLength) return data
  }

  throw new Error('image_too_large')
}
