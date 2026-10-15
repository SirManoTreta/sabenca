# Hospedagem e ambientes

Atualizado em 15/10/2026. O guia inicial foi preservado em `DEPLOYMENT_PREPARACAO_2026_09_29.md` como histórico, sem representar instruções atuais. Ver também [arquitetura e operação do MVP](MVP_ARQUITETURA_E_OPERACAO.md).

## Ambientes e variáveis

| Ambiente | Branch | Supabase | Aplicação |
| --- | --- | --- | --- |
| Local / Preview | `develop` ou branch de trabalho | DEV `fidndjlresfxvmerkbhs` | [Preview develop](https://sabenca-git-develop-sirmanotretas-projects.vercel.app) |
| Production | `main` | PROD `qybcbxrxghykkchnvmhy` | [Production](https://project-q1u7y.vercel.app) |

A PR #3 publicou a base anterior no commit `b4235f7900b36a01d011e23244b487f870d77f43`, com Marketplace, Auth e arquivos migrados. Novas mudanças usam migrations incrementais. **Não repetir o clone DEV → PROD.**

Node 24, `npm ci` e build padrão Next.js. Preservar `.env.local` exclusivamente DEV. Projeto [Vercel sabenca](https://vercel.com/sirmanotretas-projects/sabenca), conectado a [SirManoTreta/sabenca](https://github.com/SirManoTreta/sabenca). Preview usa variáveis DEV; Production usa PROD.

Variáveis obrigatórias: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_INSTITUTION_NAME`, `DATABASE_URL`, `DATABASE_SSL_CA_FILE`, `SUPABASE_SECRET_KEY`, `CPF_HMAC_SECRET`, `AUTH_HMAC_SECRET`. Nenhuma nova credencial foi introduzida. Somente `NEXT_PUBLIC_*` são públicas.

`CPF_HMAC_SECRET` deve preservar a chave dos fingerprints existentes, inclusive no PROD após a migração anterior. Não gerar outra chave ao promover. `AUTH_HMAC_SECRET` permanece independente. `ADMIN_BOOTSTRAP_PASSWORD` é temporária para bootstrap local inicial e não pertence ao deploy. Postgres.js usa TLS com CA, pool limitado e `prepare:false`.

## Auth e Storage

Conferir Site URL do ambiente, redirects `/auth/callback` e `/auth/convite`, SMTP e templates. Cadastro público continua fechado por trigger. Convites administrativos novos usam Supabase Auth; contas confirmadas existentes preservam senha.

Buckets privados: `avatars`, `project-images`, `listing-images` e, após a nova migration, `certificates`. Upload da aplicação: 4 MiB para respeitar o request da Vercel; XLSX: 2 MiB. Certificados aceitam PDF/JPEG/PNG e download assinado por 60 s. Imagens sociais usam até 300 s.

## Verificações

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

GitHub Actions executa instalação, lint, typecheck, Vitest, build e Playwright público em pushes `develop`/`main` e PRs. Integrações hospedadas exigem opt-in e variáveis DEV, sem exposição de segredos à CI pública. Com `.env.local` conferido:

```powershell
$env:SABENCA_E2E_PRODUCTION = '1' # next start local; não seleciona PROD
$env:SABENCA_E2E_INTEGRATION = '1'
node --env-file=.env.local node_modules/@playwright/test/cli.js test --workers=1
```

Fixtures validam o projeto DEV, criam dados sintéticos e removem somente os próprios registros/arquivos. Não executar testes destrutivos no PROD.

## Promoção autorizada

1. Aplicar migrations somente ao DEV, executar suíte completa e validar Preview.
2. Publicar `develop` e abrir PR para `main` com mudanças, riscos e rollback.
3. **Aguardar autorização explícita de merge.**
4. Após autorização: validar PROD, criar backup e conferir integridade antes de DDL.
5. Aplicar somente migrations pendentes; não substituir Auth, tabelas ou arquivos existentes.
6. Validar RLS, grants, Auth e Storage; fazer merge e aguardar novo build Production de `main`.
7. Smoke não destrutivo e confirmação de requisições exclusivamente ao Supabase PROD.

Não promover o artefato Preview: variáveis públicas são gravadas no build.

## Compatibilidade e rollback

O novo MVP revoga SELECT cru de `profiles.bio`/`semester`. O código antigo consulta esses campos. Coordenar migration e deployment numa janela curta: até o build novo assumir, algumas páginas sociais antigas podem falhar de maneira fechada. Não aplicar a migration ao PROD antecipadamente sem coordenar a promoção.

Preferir correção para frente. Rollback de código exige migration compensatória revisada que restabeleça somente os grants necessários, reconhecendo a suspensão temporária dos controles novos desses campos. Manter tabelas e dados novos. Não apagar conteúdo nem fazer restore integral automaticamente: um restore pode perder dados criados depois do backup. Preservar deployment anterior e backup validado.
