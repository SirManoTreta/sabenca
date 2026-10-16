# MVP — arquitetura, configuração e manutenção

## Estrutura

| Diretório | Responsabilidade |
| --- | --- |
| `src/app` | Páginas, layouts, rotas e Server Actions. |
| `src/components` | Interface de Auth, administração, Perfil, Marketplace, Networks e Conexões. |
| `src/services` | Autorização, DTOs, consultas e operações transacionais; código exclusivo do servidor. |
| `src/lib/validations` | Validação Zod e inspeção de arquivos. |
| `src/lib/institution` | Importação, HMAC, conexão PostgreSQL e configuração institucional. |
| `supabase/migrations` | Histórico incremental do banco, RLS, funções e buckets. |
| `tests` | Vitest, integração SQL/PGlite e E2E Playwright. |
| `docs`, `markdown` | Documentação operacional atual e registros históricos. |

## Novas áreas

- `/admin/administradores`: lista, inclusão, convite/reenvio e revogação. E-mail normalizado e duplicatas impedidas. Contas confirmadas existentes são promovidas sem alterar senha. Novas contas precisam confirmar convite e definir senha em `/auth/convite` → `/auth/update-password`.
- `/profile/certificados`: CRUD e upload privado de até 4 MiB (PDF/JPEG/PNG). Assinatura, MIME e extensão precisam corresponder. Edição devolve documento para análise. Ações destrutivas exigem confirmação.
- `/admin/certificados`: fila de até 100 registros, pendentes primeiro; revisão por fonte/código/documento. Rejeição exige motivo. Versão impede analisar dados alterados após carregar a tela.
- `/admin/denuncias`: fila de até 100 registros e consulta restrita ao conteúdo denunciado; analisada, dispensada ou resolvida. Marcar resolvida registra o tratamento; não bloqueia conta automaticamente.
- `/profile/privacidade`: controle de semestre, bio, habilidades, interesses, projetos/links e anúncios/serviços; lista de bloqueados com desbloqueio.
- `/privacidade`, `/termos`, `/comunidade`: documentos públicos do MVP. Placeholders institucionais precisam ser preenchidos antes de adoção definitiva.

## Banco e arquivos

Novas migrations: `20261015144754_mvp_administration`, `20261015145244_mvp_certificates`, `20261015145544_mvp_moderation_privacy` e `20261015153929_mvp_security_hardening`. A última restringe os identificadores de revisores e impede sondagem de bloqueios de terceiros pelo trigger de conexões.

Novas tabelas: `private.admin_access_events`, `private.certificate_file_cleanup`, `public.profile_certificates`, `public.reports`, `public.user_blocks`, `public.profile_privacy`. Convites administrativos existentes ganham dados de recuperação. `certificates` é o único bucket novo: privado, 4 MiB, PDF/JPEG/PNG.

Campos opcionais crus de `profiles` (bio e semestre) deixam de ter SELECT para `authenticated`. `social_profile` e `private.visible_semester` filtram a exposição, preservando o acesso do dono. Relações sociais usam policies restritivas para bloqueio e privacidade. Certificados de terceiros são retornados por `visible_certificates`, sem caminho do arquivo, reviewer, motivo de rejeição ou estado não verificado.

Downloads de certificados geram URL assinada de 60 s e anexam o arquivo. Outras imagens usam links de até 300 s. Links já emitidos não são revogados imediatamente por alteração de configuração.

A fila `certificate_file_cleanup` registra uploads antes do envio, com janela de 15 min para não remover uploads em andamento. Salvar vincula o arquivo e remove a entrada; substituir registra o anterior. Falhas ficam disponíveis para nova tentativa pela tela do dono. Não há cron ou serviço adicional de processamento.

## Configuração

Usar Node.js 24 e `npm ci`. Não sobrescrever `.env.local` existente. Ver `.env.example` e `docs/DEPLOYMENT.md` para a lista completa.

| Variável | Finalidade |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto correspondente ao ambiente. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do projeto; nunca Secret Key. |
| `NEXT_PUBLIC_APP_URL` | Origem do aplicativo para redirecionamentos. |
| `NEXT_PUBLIC_INSTITUTION_NAME` | Nome apresentado na interface. |
| `DATABASE_URL` | Conexão privada de servidor, com TLS e projeto correspondente. |
| `DATABASE_SSL_CA_FILE` | Certificado CA disponível ao servidor. |
| `SUPABASE_SECRET_KEY` | Operações Auth privilegiadas, exclusivamente server-side. |
| `CPF_HMAC_SECRET` | Fingerprints institucionais; preservar a chave dos registros existentes. |
| `AUTH_HMAC_SECRET` | Desafios, recibos e controles de tentativa; manter independente do CPF. |

Nenhuma credencial adicional foi introduzida. SMTP e allowlist de redirects são configurações externas do Supabase. Permitir a origem do ambiente com `/auth/callback` e `/auth/convite`; não copiar DEV para Production. O convite nativo usa tokens transitórios no fragmento: a página remove o fragmento, estabelece a sessão e encaminha à definição de senha. Não registrar links nem tokens em logs.

## Testes

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

A CI executa os testes públicos sem segredos. E2E com banco hospedado exige `SABENCA_E2E_INTEGRATION=1`, variáveis DEV válidas e `SABENCA_E2E_PRODUCTION=1` para usar o build local. “PRODUCTION” neste flag significa `next start`, não o ambiente remoto Production. As fixtures recusam o projeto PROD. Não versionar credenciais, resultados com dados privados, traces de falhas ou backups.

## Deploy e rollback

Trabalhar em `develop`; aplicar migrations somente ao DEV e validar Preview. Abrir PR para `main` e aguardar autorização explícita. Depois: backup PROD validado, aplicar somente migrations pendentes, verificar e fazer merge. Não repetir o clone integral de banco, Auth ou Storage da migração inicial.

Estas migrations e o novo código precisam ser promovidos juntos: o código antigo consulta bio/semestre diretamente e não é compatível com os novos grants. Rollback requer restaurar a compatibilidade dos grants ou manter o código novo e corrigir para frente. Novas tabelas com dados não devem ser apagadas automaticamente para desfazer uma release. Detalhes e autorização ficam no relatório de pré-promoção.
