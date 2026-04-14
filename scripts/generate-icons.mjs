import sharp from 'sharp'
import { mkdir } from 'fs/promises'

await mkdir('public/icons', { recursive: true })

function svgBuffer(size) {
  const fontSize = Math.round(size * 0.35)
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="#1e293b"/>
      <text x="50%" y="54%" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">CP</text>
    </svg>`
  )
}

for (const size of [192, 512]) {
  await sharp(svgBuffer(size)).png().toFile(`public/icons/icon-${size}.png`)
  console.log(`✓ public/icons/icon-${size}.png`)
}
