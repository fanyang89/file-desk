import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const filePath = (req.query.path as string) || 'file.txt'
  const fileName = filePath.split('/').pop() || 'file.txt'

  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.status(200).send('Demo mode: This is simulated file content for download.')
}
