# SABENÇA — Migração completa DEV → PROD e promoção para produção

## Objetivo

Quero promover o estado atual do SABENÇA para produção.

Existem dois ambientes Supabase separados:

DEV:
- Nome: SABENÇA
- Project ref: `fidndjlresfxvmerkbhs`

PROD:
- Nome: SABENCA-PROD
- Project ref: `qybcbxrxghykkchnvmhy`

Repositório:

`SirManoTreta/sabenca`

Branches:

- `develop` = desenvolvimento/staging
- `main` = produção

A Vercel Production acompanha `main`.

---

# IMPORTANTE

Quero que o conteúdo do banco DEV seja migrado para PROD.

Isso inclui:

- estrutura;
- migrations;
- dados;
- usuários Supabase Auth;
- identidades Auth;
- hashes de senha;
- perfis;
- alunos institucionais;
- administradores;
- cursos;
- skills;
- interesses;
- projetos;
- conexões;
- anúncios;
- imagens;
- demais dados de aplicação;
- objetos do Supabase Storage.

O objetivo é que PROD represente o estado atual do DEV.

NÃO copiar secrets para arquivos versionados.

NÃO imprimir:

- database passwords;
- service role keys;
- secret keys;
- SMTP password;
- JWT secret;
- HMAC secrets.

Nunca adicionar credenciais ao Git.

---

# 1. NÃO ALTERAR PRODUÇÃO SEM BACKUP

Antes de qualquer operação destrutiva, criar backup completo do PROD atual.

Preservar localmente, fora do Git:

- roles;
- schema;
- data;
- migration history quando aplicável.

Usar procedimento oficial do Supabase CLI / PostgreSQL.

Exemplo conceitual:

`supabase db dump`

Não improvisar uma migração manual se existir procedimento oficial mais seguro.

Validar que os arquivos de backup foram realmente criados antes de prosseguir.

Registrar no relatório:

- data;
- tamanho;
- arquivos gerados;
- sem revelar conteúdo sensível.

---

# 2. Verificar ferramentas

Confirmar disponibilidade de:

- Supabase CLI;
- PostgreSQL / `psql`;
- Node.js;
- npm.

Se Supabase CLI precisar de login:

`AÇÃO MANUAL NECESSÁRIA`

Solicitar que eu execute:

`supabase login`

Não solicitar token pelo chat.

Se precisar de database password, solicitar que eu forneça diretamente pelo terminal/variável de ambiente.

Nunca pedir para colar a senha no prompt.

---

# 3. Comparar DEV e PROD

Antes da migração, comparar:

## Migrations

DEV deve conter atualmente pelo menos:

- initial_schema
- institutional_access
- restrict_rls_auto_enable_execution
- authorize_admin_bootstrap
- profile_phase
- courses_networks
- connections_phase
- marketplace_mvp

PROD pode ainda não possuir `marketplace_mvp`.

Confirmar o estado real antes de fazer qualquer alteração.

---

# 4. Migração do banco

Usar o procedimento oficial Supabase para backup/restore entre projetos.

Referência conceitual:

- `supabase db dump`
- `psql`
- Session Pooler ou conexão adequada recomendada pelo Supabase.

Migrar o banco do DEV para PROD preservando:

- schema;
- constraints;
- índices;
- functions;
- triggers;
- RLS;
- policies;
- grants;
- dados;
- relacionamentos;
- UUIDs.

Não gerar novos UUIDs para registros existentes.

Isso é essencial porque várias tabelas referenciam `auth.users`.

---

# 5. Supabase Auth

A migração precisa preservar os usuários do DEV.

Migrar corretamente as tabelas necessárias do schema:

`auth`

incluindo usuários e identidades.

Preservar:

- UUID do usuário;
- e-mail;
- estado de confirmação;
- password hash;
- metadata necessária;
- identities.

O Supabase permite migração de usuários mantendo os hashes de senha.

Não transformar hashes em senha plaintext.

Não redefinir as senhas automaticamente.

Após a migração, os usuários devem conseguir autenticar com suas senhas existentes.

---

# 6. JWT

DEV e PROD possuem projetos Supabase diferentes e, portanto, podem possuir JWT secrets diferentes.

Não copiar automaticamente JWT secret sem analisar a necessidade.

Não expor JWT secrets.

É aceitável que sessões existentes do DEV não funcionem no PROD.

O requisito é:

- usuário conseguir fazer novo login no PROD;
- senha existente continuar funcionando.

Não é necessário preservar sessões já abertas no DEV.

---

# 7. Dados PROD atuais

O PROD possui dados anteriores.

Como o objetivo desta tarefa é deixar o PROD equivalente ao DEV:

- não tentar mesclar silenciosamente dados conflitantes;
- o DEV deve ser considerado a fonte de verdade dos dados da aplicação.

Entretanto:

BACKUP DO PROD É OBRIGATÓRIO antes da substituição.

Se houver algum dado PROD impossível de substituir de forma segura:

PARE e informe exatamente o conflito.

---

# 8. Migration Marketplace

O DEV possui:

`20261006184036_marketplace_mvp.sql`

Confirmar se PROD ainda não possui essa migration.

Após a migração, PROD deve possuir o mesmo estado estrutural do DEV.

Não editar migrations antigas.

---

# 9. Supabase Storage

Também migrar os arquivos físicos do Storage.

Buckets esperados incluem:

- `avatars`
- `project-images`
- `listing-images`

Os buckets devem continuar privados.

Preservar:

- nomes;
- caminhos;
- MIME types;
- estrutura de pastas;
- arquivos.

Formato utilizado pela aplicação:

`<auth-user-uuid>/<resource-uuid>/<filename>`

Como os UUIDs serão preservados, os caminhos devem continuar funcionando.

---

# 10. Não confundir Storage DB com arquivos

Copiar registros de:

`storage.objects`

não é suficiente.

Os objetos reais precisam existir no Storage do PROD.

Utilizar procedimento recomendado pelo Supabase para migrar Storage.

Pode utilizar script com `@supabase/supabase-js` ou ferramentas oficiais quando adequado.

Credenciais DEV/PROD devem ser fornecidas via variáveis de ambiente locais.

Nunca hardcode secrets.

---

# 11. Verificação após banco

Depois da migração, comparar DEV e PROD.

Criar relatório de contagens para as principais tabelas.

Exemplos:

- auth.users
- auth.identities
- private.institution_students
- private.admin_users
- private.institutions
- public.profiles
- public.courses
- public.skills
- public.interests
- public.profile_skills
- public.profile_interests
- public.projects
- public.connections
- public.categories
- public.listings
- public.listing_images

As contagens devem ser equivalentes quando esperado.

Também comparar:

- migrations;
- buckets;
- quantidade de objetos Storage.

---

# 12. Testar Auth PROD

Depois da migração, validar:

- usuário existente;
- login com senha existente;
- perfil associado;
- sessão;
- logout;
- login novamente.

Não modificar senha apenas para fazer o teste passar.

Se o teste exigir credenciais pessoais:

`AÇÃO MANUAL NECESSÁRIA`

Eu realizarei o login.

---

# 13. Configurações Auth não pertencentes ao banco

Lembrar que nem todas as configurações Supabase são restauradas por migrations/database dump.

Verificar no PROD:

- Site URL;
- Redirect URLs;
- SMTP;
- templates de e-mail;
- configurações Auth relevantes.

NÃO copiar URLs do staging para Production.

Production deve utilizar a URL Production correspondente.

Caso alguma configuração exija acesso manual ao Dashboard:

`AÇÃO MANUAL NECESSÁRIA`

Explicar exatamente o que configurar.

---

# 14. SMTP

Não colocar senha SMTP em código.

Verificar se PROD possui SMTP configurado.

Se precisar configurar Gmail SMTP manualmente:

PARE e informe os campos que precisam ser configurados.

Não solicitar senha de aplicativo pelo prompt.

---

# 15. Verificação de segurança

Após migração verificar:

- RLS continua habilitado;
- buckets continuam privados;
- service role não aparece no frontend;
- secrets não foram versionados;
- `.env` continua ignorado;
- nenhum dump foi incluído no Git;
- nenhum arquivo de backup foi incluído no Git.

Executar Supabase security advisors quando possível.

Não flexibilizar RLS para corrigir testes.

---

# 16. Só depois promover código

Somente quando PROD estiver estruturalmente pronto:

comparar:

`main...develop`

A branch `develop` atualmente está à frente da `main`.

Antes do merge executar:

`npm ci`

`npm run lint`

`npm run typecheck`

`npm test`

`npm run build`

Executar também Playwright relevante.

Todos precisam passar.

---

# 17. Git

Não fazer force push.

Preferir:

`develop`
↓
Pull Request
↓
`main`

Criar PR de:

`develop → main`

Registrar no PR:

- Marketplace;
- preparação de hospedagem;
- correções Auth;
- migrations;
- testes;
- estado da migração DEV → PROD.

---

# 18. NÃO fazer merge imediatamente se houver erro

Antes do merge verificar:

- CI verde;
- banco PROD pronto;
- Auth PROD funcional;
- Storage PROD migrado;
- variáveis Production da Vercel apontando para Supabase PROD.

Caso qualquer item esteja incorreto:

NÃO MERGEAR.

Corrigir primeiro.

---

# 19. Vercel Production

A Vercel Production já deve estar configurada para acompanhar:

`main`

Não alterar Preview.

Não apontar Production para Supabase DEV.

Variáveis Production devem apontar exclusivamente para:

Supabase PROD
`qybcbxrxghykkchnvmhy`

Nunca imprimir seus valores secretos.

---

# 20. Após merge

Depois de `develop → main`:

aguardar deployment Production da Vercel.

Validar status.

Executar smoke test:

- home;
- login;
- perfil;
- Networks;
- conexões;
- Marketplace;
- criar anúncio;
- visualizar anúncio;
- imagens;
- perfil do vendedor.

---

# 21. Teste cruzado crítico

Confirmar que Production realmente usa PROD.

Criar/consultar um dado controlado e confirmar que aparece em:

Supabase PROD

e NÃO depende do Supabase DEV.

Nenhuma requisição Production deve utilizar:

`fidndjlresfxvmerkbhs`

---

# 22. DEV deve continuar existindo

Após a promoção:

NÃO apagar o Supabase DEV.

NÃO apagar a branch `develop`.

O fluxo continuará:

feature/*
↓
develop
↓
Preview / Supabase DEV
↓
main
↓
Production / Supabase PROD

---

# 23. Não versionar backups

Adicionar ao `.gitignore` se necessário:

- dumps;
- backups;
- arquivos temporários contendo dados;
- scripts locais com secrets.

Não incluir dados reais de usuários no repositório.

---

# 24. Relatório final

Ao terminar apresentar:

# Relatório — Promoção DEV → PROD

## Backup PROD

## Ferramentas utilizadas

## DEV origem

## PROD destino

## Migrations DEV antes

## Migrations PROD antes

## Migrations PROD depois

## Auth

Quantidade de usuários DEV:
Quantidade PROD depois:

## Dados

Comparação de contagens das tabelas.

## Storage

Buckets DEV:
Buckets PROD:

Objetos DEV:
Objetos PROD:

## RLS

## Security Advisors

## SMTP/Auth config

## Testes

### lint
### typecheck
### unit
### integration
### Playwright
### build

## Git

Commit `develop`:
Commit `main` antes:
PR:
Commit final de `main`:

## Vercel

Deployment:
Status:
URL:

## Smoke test Production

## Problemas encontrados

## Correções realizadas

## Ações manuais realizadas

## Pendências

## Rollback

Explicar como restaurar o backup PROD caso seja necessário.

---

# REGRA FINAL

Segurança e integridade de dados têm prioridade sobre velocidade.

Não tentar contornar erros de migração.

Não apagar backup após concluir.

Se uma etapa envolver credencial, login, MFA, senha de banco ou senha SMTP:

mostrar:

`AÇÃO MANUAL NECESSÁRIA`

e aguardar minha intervenção.