export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, prompt, loraWeights } = req.body

  if (!token || !prompt || !loraWeights) {
    return res.status(400).json({ error: 'token, prompt e loraWeights obrigatórios' })
  }

  try {
    // Start prediction
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'black-forest-labs/flux-dev-lora',
        input: {
          prompt,
          extra_lora: loraWeights,
          extra_lora_scale: 0.85,
          num_inference_steps: 28,
          guidance: 3.5,
          width: 1024,
          height: 1024,
          output_format: 'jpg',
          output_quality: 90,
        },
      }),
    })

    if (!startRes.ok) {
      const error = await startRes.json()
      return res.status(startRes.status).json({ error: error.detail || 'Erro ao iniciar geração' })
    }

    let prediction = await startRes.json()

    // Poll until done (max 90s)
    let attempts = 0
    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      attempts < 45
    ) {
      await new Promise(r => setTimeout(r, 2000))
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      prediction = await pollRes.json()
      attempts++
    }

    if (prediction.status === 'succeeded') {
      return res.status(200).json({ imageUrl: prediction.output[0] })
    } else {
      return res.status(500).json({ error: prediction.error || 'Geração falhou' })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
