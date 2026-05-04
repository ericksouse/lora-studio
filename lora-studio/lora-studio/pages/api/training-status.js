export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { id, token } = req.query

  if (!id || !token) return res.status(400).json({ error: 'id e token obrigatórios' })

  try {
    const response = await fetch(`https://api.replicate.com/v1/trainings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const error = await response.json()
      return res.status(response.status).json({ error: error.detail })
    }

    const data = await response.json()
    return res.status(200).json({
      status: data.status,
      logs: data.logs || '',
      output: data.output || null,
      error: data.error || null,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
