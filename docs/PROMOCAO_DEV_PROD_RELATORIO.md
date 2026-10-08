# Relatório — Promoção DEV → PROD

Estado: banco, Auth e Storage migrados e validados. Testes de código e Playwright concluídos. Promoção e novo deployment Production pendentes.

## Backup PROD

Criado em 2026-10-08T01:14:03.364Z. Diretório local fora do Git: `F:\Codexinho\SABENÇA\.local\migration\backups\prod-2026-10-08T01-12-03.038Z`.

| Arquivo | Bytes |
|---|---:|
| roles.sql | 370 |
| schema.sql | 48922 |
| data.sql | 17850 |
| history_schema.sql | 1116 |
| history_data.sql | 45084 |
| managed_schema.sql | 187799 |
| database.dump | 471976 |

Total: 773117 bytes. Todos os arquivos têm checksum SHA-256 validado. O arquivo PostgreSQL completo foi restaurado em container isolado, com igualdade de contagem e conteúdo em 56 tabelas. PROD tinha zero objetos físicos Storage; portanto, não havia arquivos anteriores a baixar. Nenhum backup será apagado.

## Ferramentas utilizadas

Supabase CLI 2.117.0, PostgreSQL/psql/pg_dump/pg_restore 17.6, imagem oficial Supabase PostgreSQL 17.6.1.167, Docker 29.7.2, Node 24.16.0, npm 11.18.0 e supabase-js 2.116.0. Conexões e Secret Keys lidas de `.migration.env`, autorizado pelo titular e ignorado pelo Git; valores não incluídos no relatório.

## DEV origem

SABENÇA — `fidndjlresfxvmerkbhs`. PostgreSQL 17.6. DEV preservado.

## PROD destino

SABENCA-PROD — `qybcbxrxghykkchnvmhy`. PostgreSQL 17.6. Dados anteriores substituídos pelo snapshot DEV após backup validado, sem merge silencioso de registros.

## Migrations DEV antes

- 20260913232140 — initial_schema
- 20260914013440 — institutional_access
- 20260916014556 — restrict_rls_auto_enable_execution
- 20260916015001 — authorize_admin_bootstrap
- 20260922124535 — profile_phase
- 20260927030010 — courses_networks
- 20260927044938 — connections_phase
- 20261006184036 — marketplace_mvp

## Migrations PROD antes

As primeiras sete migrations da lista DEV; Marketplace ausente.

## Migrations PROD depois

As mesmas oito versões, nomes e registros de histórico do DEV. Marketplace aplicada pela CLI oficial com `--skip-vault`; migrations antigas preservadas.

## Auth

DEV: 4 usuários e 4 identidades. PROD depois: 4 usuários e 4 identidades. UUIDs, e-mails, confirmação, metadata e hashes de senha preservados. Conteúdo de 50 tabelas restauradas conferido com o snapshot DEV antes dos testes funcionais.

Duas contas fictícias preexistentes autenticaram no PROD com as mesmas senhas, leram os próprios perfis, encerraram sessão e autenticaram novamente. Nenhuma senha redefinida. JWT secret não copiado. Sessões e timestamps Auth podem divergir após novos logins, conforme esperado entre projetos separados.

## Dados

Contagens no momento da restauração, antes dos testes funcionais:

| Tabela | DEV snapshot | PROD antes | PROD restaurado |
|---|---:|---:|---:|
| auth.users | 4 | 1 | 4 |
| auth.identities | 4 | 1 | 4 |
| private.institution_students | 3 | 0 | 3 |
| private.admin_users | 1 | 1 | 1 |
| private.institutions | 1 | 1 | 1 |
| public.profiles | 3 | 0 | 3 |
| public.courses | 2 | 3 | 2 |
| public.skills | 10 | 8 | 10 |
| public.interests | 6 | 6 | 6 |
| public.profile_skills | 10 | 0 | 10 |
| public.profile_interests | 5 | 0 | 5 |
| public.projects | 1 | 0 | 1 |
| public.connections | 1 | 0 | 1 |
| public.categories | 8 | 8 | 8 |
| public.listings | 1 | 0 | 1 |
| public.listing_images | 0 | 0 | 0 |
| storage.objects | 2 | 0 | 2 |

A substituição ocorreu em uma transação PostgreSQL, com COPY proveniente dos dumps oficiais. Todas as FKs verificadas antes do commit; modo temporário de replica revertido. RLS nunca desabilitado. A função e o event trigger de RLS automática existentes somente no DEV também foram reproduzidos conforme documentação Supabase, mantendo EXECUTE restrito.

## Storage

Buckets: avatars, project-images e listing-images; todos privados, limites e MIME types preservados. DEV e PROD: 2 objetos.

Foram transferidos 2 arquivos físicos via API Storage: avatar de 185143 bytes e imagem de projeto de 146985 bytes. Downloads PROD comparados por SHA-256 com DEV. Caminhos, MIME types, UUIDs e ownership preservados. A versão física e metadata de backend seguem a API PROD; campos de ownership originais foram mantidos/restaurados quando necessário. Cópias locais dos arquivos de origem guardadas fora do Git.

## RLS

Estrutura, constraints, índices, funções, triggers, policies, grants, grants por coluna e flags RLS coincidem em DEV e PROD. Nenhum bucket público ou permissão relaxada para fazer testes passar.

## Security Advisors

Nenhum ERROR. Seis INFO de RLS sem policy em tabelas privadas exclusivas do backend, iguais ao DEV; acesso público permanece negado. [Explicação oficial](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

WARN preexistente: proteção contra senhas vazadas desabilitada, igual ao DEV. [Documentação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Nenhum recurso pago ativado.

## SMTP/Auth config

Vercel Production NEXT_PUBLIC_SUPABASE_URL aponta para PROD e NEXT_PUBLIC_APP_URL corresponde a https://project-q1u7y.vercel.app. Usuário confirmou ajuste de CPF_HMAC_SECRET de Production para a mesma chave DEV. Preview preservado.

Pendentes de confirmação manual: Site URL, redirects, SMTP e templates Auth PROD. O login no deployment Production antigo foi recusado; contador de tentativa não foi alterado no PROD. Solicitada atualização de DATABASE_URL Production com a conexão atual do arquivo local. O novo build deverá carregar a configuração atualizada.

## Testes

### lint

Passou após excluir artefatos locais de migração.

### typecheck

Passou.

### unit

238 testes passaram em 18 arquivos, incluindo testes de integração abaixo.

### integration

Cobertura PostgreSQL/PGlite de Auth institucional, RLS, perfis, Networks, conexões e Marketplace passou. Ensaio de restauração e igualdade de conteúdo em bancos reais também passaram.

### Playwright

20 testes passaram em desktop/mobile, com fixtures temporárias DEV e um worker (12,8 minutos). Contagens principais DEV voltaram ao inventário original após a limpeza. Nenhuma fixture Auth criada no PROD para esses testes. O Next.js emitiu oito mensagens não fatais de cancelamento de stream durante navegação; todos os cenários passaram e o log foi preservado fora do Git.

### build

Passou com Next.js 16.3.8. npm ci repetido após patches compatíveis sharp 0.35.5 e source-map-js 1.2.2. npm audit --omit=dev: zero vulnerabilidades. Restam cinco avisos high derivados de braces 3.0.3 no lint; não há release corrigida e o downgrade de Next.js sugerido pelo audit não foi aplicado.

## Git

Develop antes: c90b45747e7d4efb287ea90e59556697c9d6a922.

Main antes: e2b22a3e4bc775382945e06b020ea50e010371ec.

Esta revisão registra a preparação da promoção; PR develop → main e merge serão registrados no relatório final. Sem force push. Main e develop preservadas.

## Vercel

Deployment Production anterior: dpl_5UjZamvw3JN3hnd5hcpeTVQeMjxu, SHA 9eb66a9720353205bd0087c59917b52dfbfb29ef. URL canônica: https://project-q1u7y.vercel.app.

Novo deployment: pendente da promoção.

## Smoke test Production

Auth Supabase PROD validado diretamente. Smoke da nova aplicação Production e teste cruzado de criação de anúncio/arquivo pendentes de deployment.

## Problemas encontrados

Uma conexão Node inicial foi recusada; CLI e psql autenticaram e os parâmetros explícitos foram usados nas ferramentas locais. Causa inicial não comprovada; nenhuma credencial alterada pelo agente. Primeiro container de validação foi iniciado com usuário incompatível com o entrypoint da imagem; apenas esse container descartável foi recriado, e a restauração passou. Navegador automático indisponível; verificação de Dashboard delegada ao titular. Login da aplicação Production antiga ainda recusado. Advisories npm patcháveis corrigidos.

## Correções realizadas

Backup completo validado antes de substituir PROD; Marketplace/histórico e mecanismo de RLS alinhados; Auth/data/Storage migrados; dumps e credenciais excluídos do Git; patches transitivos de segurança e exclusões de lint aplicados.

## Ações manuais realizadas

Titular disponibilizou DEV_DB_URL/PROD_DB_URL e DEV_SUPABASE_SECRET_KEY/PROD_SUPABASE_SECRET_KEY em arquivo local. Confirmou alinhamento de CPF_HMAC_SECRET Production.

## Pendências

Confirmar Auth/SMTP/URL e DATABASE_URL Production, publicar alterações develop, abrir PR, aguardar CI, mergear somente com gates satisfeitos, validar novo deployment e executar smoke/teste cruzado. Não promover enquanto houver falha de teste ou configuração pendente.

## Rollback

Preservar o diretório e manifest originais. Antes de restaurar, interromper novos writes e guardar backup do estado PROD pós-migração. As mesmas versões PostgreSQL e o arquivo database.dump já foram testados em banco isolado; roles/schema/data/history e managed_schema também estão disponíveis. Restauração hospedada exige plano transacional para substituir app/Auth, preservar schemas gerenciados e reverter Marketplace/RLS às definições do backup. Não executar pg_restore --clean indiscriminadamente no Supabase hospedado. PROD anterior não tinha arquivos Storage; quaisquer novos arquivos a remover deverão ser identificados pelo manifesto específico desta migração, via API Storage. Reverter também código e configurações Vercel/Auth conforme a situação. Rollback não executado.
