export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, trigger, steps, rank, scheduler } = req.body

  if (!token || !token.startsWith('r8_')) {
    return res.status(400).json({ error: 'Token inválido' })
  }

  try {
    const response = await fetch('https://api.replicate.com/v1/trainings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
      body: JSON.stringify({
        // Flux Dev LoRA trainer
        input: {
          trigger_word: trigger || 'TOK',
          steps: steps || 1000,
          lora_rank: rank || 16,
          lr_scheduler: scheduler || 'constant',
          learning_rate: 0.0004,
          batch_size: 1,
          resolution: '512,768,1024',
          autocaption: true,
          // input_images should be a zip URL — in production upload the zip first
          // For demo, we use a sample dataset
          input_images: 'https://storage.googleapis.com/bria-assets/datasets/sample_dataset.zip',
        },
        // You need to create a model first on Replicate or use an existing destination
        destination: `jeadson/lora-${Date.now()}`,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return res.status(response.status).json({ error: error.detail || 'Erro no Replicate' })
    }

    const data = await response.json()
    return res.status(200).json({ id: data.id, status: data.status })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
