# Hospedagem e ambientes

## Ambientes

| Ambiente      | Branch                            | Hospedagem        | Supabase |
| ------------- | --------------------------------- | ----------------- | -------- |
| Local         | `feature/*`, `fix/*` ou `codex/*` | Node 24 / Next.js | DEV      |
| Staging       | `develop`                         | Vercel Preview    | DEV      |
| Preview de PR | Branch da funcionalidade          | Vercel Preview    | DEV      |
| Produção      | `main`                            | Vercel Production | PROD     |

Fluxo: funcionalidade → PR para `develop` → testes → PR para `main`.
O ambiente Preview usa variáveis DEV em **todas** as branches, não apenas em `develop`.
Não promover um artefato Preview para produção: `NEXT_PUBLIC_*` fica gravado no build.
Produção precisa de um novo build de `main` com variáveis PROD.

Projetos confirmados em 29/09/2026, organização **SirManoTreta's**, região `us-east-1`:

- DEV: projeto existente **SABENÇA**, ref `fidndjlresfxvmerkbhs`. Nome preservado; seu papel é DEV.
- PROD: **SABENCA-PROD**, ref `qybcbxrxghykkchnvmhy`, criado com custo informado de US$ 0/mês.
- Ambos possuem sete migrations, 19 tabelas de aplicação com RLS e três buckets privados.
- PROD recebeu estrutura e catálogos básicos das migrations, sem usuários ou arquivos do DEV.
- Vercel: [sabenca](https://vercel.com/sirmanotretas-projects/sabenca), projeto criado no plano Hobby e conectado a `SirManoTreta/sabenca`. Sem deploy ou URL pública validada.
- Production já acompanha `main`. Domínio automático reservado: `project-q1u7y.vercel.app`, sem aplicação publicada.

## Configuração local

Use Node 24 (também registrado em `.nvmrc` e `package.json`), npm e o lockfile versionado.
Copie `.env.example` para `.env.local` apenas se o arquivo não existir; preencha com DEV.
O `.env.local` atual já aponta para DEV. Nunca troque esse arquivo por credenciais PROD para testar.

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` local permite telas públicas sem secrets. Na Vercel, configuração incompleta
interrompe o build. A validação também rejeita URLs Supabase/PostgreSQL de projetos diferentes,
HMACs curtos/iguais e URL de produção sem HTTPS. Ela não autentica as chaves nem substitui os testes online.

## Variáveis na Vercel

Em **Project → Settings → Environment Variables**, cadastre valores separados:

| Variável usada no código               | Development e Preview                                            | Production                                              |
| -------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL DEV                                                          | URL PROD                                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key DEV                                              | Publishable key PROD                                    |
| `NEXT_PUBLIC_APP_URL`                  | `http://localhost:3000` apenas em Development; omitir em Preview | URL HTTPS real de produção                              |
| `NEXT_PUBLIC_INSTITUTION_NAME`         | `Comunidade FATECE`                                              | `Comunidade FATECE`                                     |
| `DATABASE_URL`                         | Conexão PostgreSQL DEV                                           | Conexão PostgreSQL PROD                                 |
| `DATABASE_SSL_CA_FILE`                 | `supabase/certs/prod-ca-2021.crt`                                | Certificado correspondente ao PROD em `supabase/certs/` |
| `SUPABASE_SECRET_KEY`                  | Secret key DEV                                                   | Secret key PROD                                         |
| `CPF_HMAC_SECRET`                      | Preservar segredo DEV existente                                  | Novo segredo aleatório, mínimo 32 bytes                 |
| `AUTH_HMAC_SECRET`                     | Preservar segredo DEV existente                                  | Outro segredo aleatório, mínimo 32 bytes                |

Somente as quatro variáveis `NEXT_PUBLIC_*` são públicas. As demais devem ser marcadas como
sensíveis quando disponível. Não cadastrar `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_ANON_KEY`:
o projeto usa os nomes acima. Nunca colar valores reais em commits, documentos ou chat.

Supabase **Settings → API Keys** fornece publishable/secret keys. **Connect → Transaction pooler**
fornece a conexão para `DATABASE_URL` (porta 6543). Codifique caracteres especiais da senha na URI.
O código usa `prepare: false`, pool de até três conexões por instância e validação TLS ativa.
O PROD foi criado pelo conector sem fornecer a senha do banco nesta conversa. Em **PROD → Database
Settings → Database password**, defina a senha diretamente no painel e guarde-a no seu gerenciador;
use-a somente na conexão PROD. Essa entrada de credencial é uma ação manual, não envie a senha ao chat.
Gere também dois segredos aleatórios independentes (por exemplo, 64 caracteres hexadecimais cada)
no gerenciador de senhas para os HMACs PROD. Os HMACs DEV existentes devem ser preservados.
Baixe/confira o certificado público em **Database → SSL Configuration**; o nome `prod-ca-2021.crt`
é o nome do certificado da autoridade, não indica que o banco local é PROD.
Arquivos `.crt` dessa pasta entram no pacote das funções; nunca colocar chaves privadas ali.

`ADMIN_BOOTSTRAP_PASSWORD` é uma variável temporária do script de criação do administrador;
nunca é necessária no deploy. Consulte o [guia institucional](../markdown/ACESSO_INSTITUCIONAL_IMPLEMENTACAO.md).

## Primeiro deploy de staging

1. Finalize a revisão e repita lint, tipos, testes e build. Faça commit na branch de preparação,
   integre localmente em `develop` (já criada a partir de `main`) e publique somente `develop`.
   Esse fluxo inicial foi autorizado pelo responsável; novas funcionalidades seguem o fluxo de PRs.
2. Abra o [projeto Vercel já criado](https://vercel.com/sirmanotretas-projects/sabenca).
   GitHub já conectado, preset **Next.js**, raiz do repositório, Node **24.x**,
   instalação `npm ci`, build `npm run build` e output padrão. Não criar outro projeto.
3. Em **Settings → Environments → Production**, confira a branch `main`.
   Prepare primeiro o Preview de `develop`; não inicie build de produção antes da configuração PROD.
4. Variáveis de Preview (DEV) e Production (PROD) já cadastradas conforme informado pelo responsável.
   `NEXT_PUBLIC_APP_URL` permanece ausente em Preview; não alterar automaticamente após obter a URL.
   Para novos cadastros, use a tabela: **Preview e Development = DEV; Production = PROD**.
   Não selecione todos os ambientes ao inserir uma credencial PROD.
5. Em **Settings → Environment Variables**, mantenha disponíveis as variáveis de sistema da Vercel.
   Preview usa `VERCEL_ENV`, `VERCEL_URL` e `VERCEL_BRANCH_URL` automaticamente.
6. Gere um Preview de `develop`, copie a URL real e configure Auth DEV conforme a próxima seção.
   Verifique status **Ready**, login, sessão, perfil, Networks e conexões.
7. Somente em etapa futura expressamente autorizada, após staging validado: PR de `develop` para `main`, novo build Production com PROD,
   configuração das URLs Auth PROD e testes de acesso. Entregue ao orientador somente essa URL.

O conector Vercel conseguiu ler equipe/projetos, mas `deploy_to_vercel` retornou
`Tool deploy_to_vercel not found`. CLI sem instalação/login e sem token local. A criação e configuração foram concluídas pelo navegador,
sem iniciar deploy e sem cadastrar secrets.

## Auth e callbacks

Configurações de `supabase/config.toml` valem para o Supabase local; não são aplicadas automaticamente
ao projeto hospedado pelas migrations. Configure cada projeto em **Authentication**:

- Desabilitar cadastro público e login anônimo; manter confirmação de e-mail e senha mínima de oito caracteres.
- Configurar SMTP e validar envio real. O provedor padrão pode limitar destinatários/envios.
- Preservar fluxo institucional: admin autoriza aluno, primeiro acesso confirma e-mail e define senha.
- Em **URL Configuration**, Site URL DEV = URL de staging; Site URL PROD = URL canônica de produção.
- Redirect URLs DEV: `http://localhost:3000/auth/callback**` e os hosts reais de staging/preview com `/auth/callback**`.
  Preferir hosts exatos; se usar wildcard, restringir ao projeto/equipe, nunca `https://**.vercel.app/**`.
- Redirect URLs PROD: apenas a URL canônica com `/auth/callback`,
  `/auth/callback?next=/auth/definir-senha` e `/auth/callback?next=/auth/update-password`.

No Preview, o link volta ao host da requisição, validado contra `VERCEL_URL` ou `VERCEL_BRANCH_URL`.
Isso mantém os cookies PKCE/ativação no mesmo domínio. Abra o e-mail no mesmo navegador usado
para iniciar o fluxo. Domínios customizados de Preview precisariam de configuração explícita adicional.
Em produção, inicie o login pela URL canônica configurada em `NEXT_PUBLIC_APP_URL`.
Cookies de produção são seguros; proxy renova sessão e mantém respostas privadas sem cache.

## Migrations, RLS e Storage

Versione toda alteração futura em `supabase/migrations`. Não modifique migrations já aplicadas.
As sete migrations atuais foram aplicadas no PROD vazio. Como o conector gera novas versões,
somente os identificadores do histórico PROD foram alinhados aos nomes/versões originais,
com verificação posterior. O histórico DEV não foi alterado.

Para próximas migrations, após `supabase login`, use o CLI fixado no projeto:

```powershell
npx supabase migration new nome_da_alteracao
# Escrever/revisar a migration antes de prosseguir.
npx supabase db push --project-ref fidndjlresfxvmerkbhs --dry-run --skip-vault
npx supabase db push --project-ref fidndjlresfxvmerkbhs --skip-vault
# Validar DEV. Só então revisar a aplicação no PROD:
npx supabase db push --project-ref qybcbxrxghykkchnvmhy --dry-run --skip-vault
# Aplicação PROD é uma etapa deliberada; não automatizada pelo build/CI.
```

Nunca usar `db reset` no remoto ou `--include-seed` em PROD. Seeds automáticos desabilitados;
fixtures dos testes geram/removem seus próprios registros fictícios. Não copiar alunos ou Auth entre ambientes.
O build e CI não executam migrations, seeds ou bootstrap administrativo.

RLS permanece ativa em todas as tabelas `public`/`private`. Membership exige vínculo institucional ativo;
permissão administrativa vem de `private.admin_users`, não de metadados editáveis do usuário.
As seis tabelas privadas sem policies são acesso exclusivo do backend; o advisor informa essa condição,
sem justificar abrir acesso público. [Entenda o aviso](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Buckets `avatars`, `project-images` e `listing-images`: privados, limite Storage 5 MiB,
JPEG/PNG/WEBP. Policies limitam escrita ao proprietário e leitura a membros autorizados;
aplicação usa URLs assinadas de curta duração. Upload da aplicação aceita **4 MiB** para caber
na requisição da Vercel com campos do formulário. Arquivos maiores são bloqueados no navegador
e no servidor. `.xlsx` permanece limitado a 2 MiB. Nenhum bucket foi tornado público.

## GitHub e testes

Em **Repository → Settings → Rules → Rulesets**, crie regra para `main`:
PR obrigatório, check `verify` obrigatório, bloquear force push/exclusão. Uma aprovação do colega
é recomendada quando ambos estiverem disponíveis; não exigir dois aprovadores numa equipe de duas pessoas.
Habilite proteção somente depois que o check já tiver sido publicado/executado. Não foi alterada remotamente.

CI roda em pushes para `main`/`develop` e em PRs: instalação, lint, tipos, testes, build e navegador
contra `next start`. Testes de integração remota permanecem opt-in e fora do CI sem credenciais.

Com `.env.local` conferido como **DEV**, para testar o build local com fixtures remotas:

```powershell
$env:SABENCA_E2E_PRODUCTION = '1' # next start local; não seleciona Supabase PROD
$env:SABENCA_E2E_INTEGRATION = '1'
node --env-file=.env.local node_modules/@playwright/test/cli.js test --workers=1
```

Após deploy, verificar login/logout, sessão renovada, acesso sem autorização, primeiro acesso e recuperação
por e-mail, perfil/edição/avatar/projetos, busca/filtros Networks e solicitar/aceitar/recusar/cancelar/remover
conexões. Testes que criam fixtures devem rodar somente no DEV. Em PROD validar com contas autorizadas,
sem seed automático. Marketplace ainda é uma tela de fase futura.

## Referências

- [Variáveis por ambiente](https://vercel.com/docs/environment-variables/manage-across-environments)
- [Limites das funções Vercel](https://vercel.com/docs/functions/limitations)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Relatório desta preparação](DEPLOYMENT_REPORT.md)
