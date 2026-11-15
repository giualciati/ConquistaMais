# Conquista+ (React + Vite, mobile-first)

```bash
npm install
npm run dev      # abre em http://localhost:5173 (use o IP da rede para testar no celular)
npm run build    # gera a pasta dist/
```

Login aceita qualquer usuário/senha (mock). Dados, regras e a "API" simulada ficam em `src/data.js`.

## Versão com alunos reais (Supabase)
1. Crie um projeto no Supabase e rode `supabase/schema.sql`, depois `002_desafios.sql` e `004_ranking_loja.sql`, `005_foto_perfil.sql`, `006_foto_visivel.sql` (e, se precisar, `003_precisao_configuravel.sql`) no SQL Editor (antes, ajuste as coordenadas do campus na tabela `campus`).
2. Copie `.env.example` para `.env.local` e preencha URL e chave publishable.
3. Crie `.env.admin` (URL + secret key) e importe os alunos: `node --env-file=.env.admin scripts/importar-alunos.mjs alunos.csv`.
4. `npm run dev` — o aluno entra com usuário/senha fornecidos e é obrigado a trocar a senha no 1º acesso.

Já real: login, troca de senha, saldo, check-in por localização, desafios (QR/código e certificado em PDF) e painel da equipe. Também reais: ranking por curso, loja com vouchers (o resgate debita o saldo), desafio relâmpago lançado pela equipe e aba Certificados.

Para a equipe, inclua `papel` = `equipe` no CSV de importação.

## Testar no celular (GPS e câmera exigem HTTPS)
- `npm run dev:https` e abra no celular o endereço **https://** de "Network" (aceite o aviso de certificado: Avançado → continuar).
- Para um link definitivo: `npm run build` e envie a pasta `dist` em app.netlify.com/drop (o `.env.local` precisa existir na hora do build).
