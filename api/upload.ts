import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    success: true,
    files: ['demo-upload.txt'],
    message: 'Demo mode: upload simulated',
  })
}
