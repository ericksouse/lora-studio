# LoRA Studio — Deploy no Vercel

## Estrutura
```
lora-studio/
├── pages/
│   ├── _app.js
│   ├── index.js          ← App principal
│   └── api/
│       ├── train.js          ← Inicia treino
│       ├── training-status.js ← Monitora treino
│       └── generate.js       ← Gera imagens
├── styles/
│   └── globals.css
├── package.json
└── next.config.js
```

## Deploy no Vercel (passo a passo)

### Opção 1 — GitHub (recomendado)
1. Crie um repositório no github.com
2. Faça upload de todos os arquivos
3. Acesse vercel.com → "New Project"
4. Importe o repositório
5. Clique em "Deploy"

### Opção 2 — Vercel CLI
```bash
npm install -g vercel
cd lora-studio
vercel deploy
```

### Opção 3 — Drag & Drop
1. Zippe a pasta `lora-studio`
2. Acesse vercel.com/new
3. Arraste o ZIP

## Uso
1. Abra o app no Vercel
2. Cole seu token do Replicate (r8_...)
3. Carregue 10-25 fotos do personagem
4. Configure trigger word e parâmetros
5. Inicie o treino (~30min)
6. Gere imagens com o LoRA treinado

## Importante
- O token nunca é salvo — fica apenas no browser
- O treino custa ~$0.50 no Replicate
- Mínimo 5 imagens, ideal 15-25
