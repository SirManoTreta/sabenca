# SABENÇA — pré-promoção DEV → PROD

Base Production: `b4235f7900b36a01d011e23244b487f870d77f43`. Branch proposta: `develop`. PR: **Finalizar MVP do SABENÇA**. Este documento não autoriza merge nem mudanças PROD.

[PR #4 — Finalizar MVP do SABENÇA](https://github.com/SirManoTreta/sabenca/pull/4), aberta para revisão; merge depende de autorização explícita.

## Alterações de banco

- `20261015144754_mvp_administration.sql`
- `20261015145244_mvp_certificates.sql`
- `20261015145544_mvp_moderation_privacy.sql`
- `20261015153929_mvp_security_hardening.sql`

Seis tabelas novas, 20 policies, um bucket privado. Novos objetos: `profile_certificates`, `reports`, `user_blocks`, `profile_privacy`, `private.admin_access_events` e `private.certificate_file_cleanup`. Convites administrativos existentes recebem rastreamento. Não haverá carga/clone de dados DEV.

## Gates de promoção

- DEV restaurado e variáveis local/Preview confirmadas como DEV. Production continua PROD.
- Instalação, lint, tipos, Vitest, build, Playwright e Preview conforme [relatório de fechamento](MVP_FECHAMENTO_RELATORIO.md).
- RLS em todas as tabelas de aplicação; buckets privados; lookups com search_path e grants verificados.
- Aguardar CI do SHA final e autorização explícita antes de qualquer DDL PROD ou merge.

## Riscos e rollback

A revogação de SELECT cru de bio/semestre exige coordenar a migration com o novo deployment. Reservar uma janela curta; o código anterior pode falhar ao consultar essas páginas até o build novo assumir. Não promover Preview para Production, pois variáveis públicas ficam gravadas no build.

Após autorização, validar PROD, criar/validar backup e aplicar somente as quatro migrations pendentes. Conferir Auth/Storage/RLS, fazer merge e aguardar Vercel Production. Usar exclusivamente Supabase PROD `qybcbxrxghykkchnvmhy`.

Preferir correção para frente. Rollback de código exige compensação revisada dos grants; manter tabelas e conteúdo novos. Não executar drop/restore integral automaticamente nem perder dados posteriores ao backup. Manter deployment anterior e backup disponíveis.

Há riscos operacionais preexistentes registrados no relatório: cadeia ESLint/braces em dependências DEV, proteção de senhas vazadas desabilitada e avaliação da manutenção do engine PostgreSQL. Nenhum deles foi ocultado por remoção de testes ou mudança major incompatível.

## Arquivos alterados

69 caminhos na comparação de fechamento, incluindo este documento; exclusões também aparecem. A revisão definitiva é `git diff main...develop` na PR.

O prompt de desenvolvimento foi removido antes da promoção no commit `31a423d618b3ebf2ca40be7e2f08b03c1f6fefd1`; não faz parte da documentação oficial nem desta lista.

- `.env.example`
- `.gitignore`
- `docs/DEMO_TCC.md`
- `docs/DEPLOYMENT_PREPARACAO_2026_09_29.md`
- `docs/DEPLOYMENT.md`
- `docs/MVP_ARQUITETURA_E_OPERACAO.md`
- `docs/MVP_FECHAMENTO_RELATORIO.md`
- `docs/MVP_GAP_ANALYSIS.md`
- `docs/MVP_PRE_PROMOCAO.md`
- `docs/TCC_IMPLEMENTACAO_TECNICA.md`
- `README.md`
- `src/app/(community)/marketplace/[id]/page.tsx`
- `src/app/(community)/profile/certificados/actions.ts`
- `src/app/(community)/profile/certificados/page.tsx`
- `src/app/(community)/profile/privacidade/actions.ts`
- `src/app/(community)/profile/privacidade/page.tsx`
- `src/app/(legal)/comunidade/page.tsx`
- `src/app/(legal)/layout.tsx`
- `src/app/(legal)/privacidade/page.tsx`
- `src/app/(legal)/termos/page.tsx`
- `src/app/admin/administradores/actions.ts`
- `src/app/admin/administradores/page.tsx`
- `src/app/admin/certificados/actions.ts`
- `src/app/admin/certificados/page.tsx`
- `src/app/admin/denuncias/[id]/page.tsx`
- `src/app/admin/denuncias/actions.ts`
- `src/app/admin/denuncias/page.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/loading.tsx`
- `src/app/auth/convite/page.tsx`
- `src/app/certificados/[id]/documento/route.ts`
- `src/app/layout.tsx`
- `src/components/admin/administrator-form.tsx`
- `src/components/admin/certificate-review.tsx`
- `src/components/admin/report-review.tsx`
- `src/components/auth/invitation-session.tsx`
- `src/components/layout/module-foundation.tsx`
- `src/components/profile/certificate-form.tsx`
- `src/components/profile/privacy-form.tsx`
- `src/components/profile/profile-view.tsx`
- `src/components/profile/social-safety.tsx`
- `src/components/profile/verified-certificates.tsx`
- `src/lib/validations/certificate.ts`
- `src/proxy.ts`
- `src/services/administrators.ts`
- `src/services/certificates.ts`
- `src/services/connections.ts`
- `src/services/marketplace.ts`
- `src/services/moderation.ts`
- `src/services/networks.ts`
- `src/services/profile.ts`
- `supabase/migrations/20261015144754_mvp_administration.sql`
- `supabase/migrations/20261015145244_mvp_certificates.sql`
- `supabase/migrations/20261015145544_mvp_moderation_privacy.sql`
- `supabase/migrations/20261015153929_mvp_security_hardening.sql`
- `tests/administrators-integration.test.ts`
- `tests/certificate-validation.test.ts`
- `tests/connections-integration.test.ts`
- `tests/e2e-environment.test.ts`
- `tests/e2e/connections.spec.ts`
- `tests/e2e/dev-environment.ts`
- `tests/e2e/foundation.spec.ts`
- `tests/e2e/marketplace.spec.ts`
- `tests/e2e/mvp.spec.ts`
- `tests/e2e/networks.spec.ts`
- `tests/e2e/profile.spec.ts`
- `tests/institution-integration.test.ts`
- `tests/mvp-integration.test.ts`
- `tests/profile-read.test.ts`
