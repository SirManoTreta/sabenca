# Acesso institucional — implementação de 13/09/2026

O documento `SABENCA_Acesso_Institucional_Importacao_Layout.md` substitui a decisão anterior de cadastro aberto com e-mail pessoal. E-mails pessoais podem continuar nos registros fornecidos pela instituição; o estudante não escolhe nem informa um novo e-mail no primeiro acesso.

## Implementado

- `/auth/register` redireciona para `/auth/primeiro-acesso`. Não existe Server Action de cadastro público.
- Login por **RA + senha**, resolução de e-mail apenas no servidor e erro uniforme: “RA ou senha inválidos.”
- Primeiro acesso por **RA + nascimento**, link para o e-mail já cadastrado, confirmação de posse do endereço e definição de senha própria.
- Uma prova aleatória, expirada após 20 minutos, vincula a identificação ao usuário e ao navegador. Sem essa prova, ter uma sessão Supabase não permite ativar uma matrícula. Ela é consumida após a ativação.
- Registros com estados `pending`, `active`, `blocked`, `inactive`; só `active` permite consultar dados sociais. Bloqueios invalidam o acesso nas próximas consultas sem apagar o histórico.
- Administração em `/admin/alunos`, importação em `/admin/alunos/importar` e histórico em `/admin/alunos/importacoes`.
- Controle administrativo em `private.admin_users`, independente de perfil e de metadados editáveis. Cada página/ação administrativa verifica a autorização no servidor.
- Processamento `.xlsx` no servidor com ExcelJS e Zod. CPF validado por dígitos verificadores e armazenado apenas como HMAC-SHA256 com segredo exclusivo.
- Prévia sem gravação; confirmação vinculada ao administrador, conteúdo exato do arquivo e estado da validação, válida por 15 minutos. Uma transação grava lote e alunos. Repetição da confirmação é idempotente.
- Registros existentes são preservados. RA, CPF ou e-mail repetidos viram erros; importação não sobrescreve dados e não desbloqueia acessos. Para este MVP, e-mail e CPF permanecem únicos na instituição inclusive em registros inativos, evitando associações ambíguas de contas.
- Limites de 2 MiB, 1.000 alunos, uma aba preenchida, 300 entradas ZIP e 20 MiB descompactados. Fórmulas, hyperlinks, macros e formatos `.xls`/`.xlsm` são recusados.
- Telefone normalizado com país 55. Data textual `DD/MM/AAAA` e datas nativas Excel, inclusive sistema de datas 1904. RA textual mantém zeros; RA numérico exige formato explícito de zeros para evitar perda silenciosa.
- A prévia contém somente linha, RA, nome, curso, semestre e erros. Listas administrativas não retornam CPF, fingerprint, nascimento, telefone ou e-mail. Arquivo original não é armazenado.
- Perfil mínimo inicializado após ativação com nome, curso, semestre e instituição. Edição completa do Perfil ainda não foi iniciada.
- Limite persistente de tentativas por identificador e origem: 5 por identificador e 100 por origem em 15 minutos. Identificadores são protegidos por HMAC. Em Vercel, usa o cabeçalho de IP controlado pela plataforma; localmente, o limite de origem é compartilhado.
- Layout azul/branco, títulos sem serifa, azul escuro e pequenos detalhes laranja. Marca SABENÇA principal; FATECE identificada em texto, sem uso de logotipo oficial.

## Banco

Aplique as migrações na ordem:

1. `supabase/migrations/20260913232140_initial_schema.sql`
2. `supabase/migrations/20260914013440_institutional_access.sql`
3. `supabase/migrations/20260916014556_restrict_rls_auto_enable_execution.sql`
4. `supabase/migrations/20260916015001_authorize_admin_bootstrap.sql`

A segunda migração acrescenta `private.institutions`, `private.institution_students`, `private.admin_users`, `private.import_batches`, `private.activation_challenges`, `private.auth_attempts` e `private.access_events`. Todas têm RLS. Contas da aplicação não possuem grants para ler os registros privados, nem quando administradoras. O papel interno de Auth recebe apenas leitura dos e-mails necessária ao bloqueio de novos cadastros.

A terceira migração remove a execução pela API da função de plataforma `public.rls_auto_enable()`, quando existente, preservando seu event trigger. A quarta acrescenta `private.admin_invitations`, com autorizações temporárias para criar contas administrativas. Auth insere a conta antes de gravar os metadados administrativos; por isso o trigger consulta o convite privado, não os metadados. O convite não concede privilégios: somente `private.admin_users` autoriza administração. O script remove o convite após a tentativa, inclusive em caso de erro. Total: 18 tabelas da aplicação, todas com RLS.

O servidor Next.js usa uma conexão PostgreSQL privilegiada para acessar o schema privado. Ela deve permanecer **somente no servidor**, em `DATABASE_URL`; use a conexão do projeto, TLS verificado e acesso restrito ao ambiente de execução. `postgres` está configurado com até 3 conexões e prepared statements desabilitados, compatível com transaction pooling do Supavisor. Nunca publique essa URL.

A função `private.is_member()` exige usuário confirmado, não anônimo, não banido, vínculo ativo e correspondência entre o e-mail da conta e o registro. `public.access_context()` retorna apenas dois booleanos do usuário atual: `member` e `admin`. Nenhum registro institucional é exposto via RPC.

## Configuração do ambiente

Preencha `.env.local` usando `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_INSTITUTION_NAME=Comunidade FATECE
DATABASE_URL=postgresql://...
DATABASE_SSL_CA_FILE=supabase/certs/prod-ca-2021.crt
SUPABASE_SECRET_KEY=sb_secret_...
CPF_HMAC_SECRET=SEGREDO_ALEATORIO_EXCLUSIVO_DE_PELO_MENOS_32_BYTES
AUTH_HMAC_SECRET=OUTRO_SEGREDO_ALEATORIO_EXCLUSIVO_DE_PELO_MENOS_32_BYTES
```

Não use os valores explicativos acima como segredos. Gere dois valores independentes, por exemplo com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Guarde o segredo de CPF junto dos backups: perdê-lo impede comparar novos CPFs aos fingerprints existentes. Rotação exige estratégia de migração; não substitua esse valor casualmente.

A aplicação e o script de administrador exigem TLS com validação do certificado e do hostname. `DATABASE_SSL_CA_FILE` aponta para o certificado CA público baixado do Supabase; caminhos relativos partem da raiz do projeto. O arquivo deve estar presente também no ambiente de publicação. Ativar SSL no painel exige conexões criptografadas, mas o cliente ainda precisa confiar na CA. Não desative a verificação do certificado para contornar erros.

No Supabase Auth:

- Desative **Allow new users to sign up**. A configuração local já está assim. Um trigger também recusa cadastros sem registro institucional, como proteção adicional.
- Mantenha provedor Email, confirmação de e-mail e senha mínima de 8 caracteres.
- Mantenha anonymous sign-ins desabilitado.
- Configure SMTP e templates padrão de confirmação de cadastro, Magic Link e recuperação. O primeiro acesso cria a conta não confirmada pela API administrativa e solicita `resend({ type: "signup" })`, compatível com PKCE e cadastro público fechado. Se o endereço já estiver confirmado, mas a ativação institucional não tiver terminado, usa Magic Link com `shouldCreateUser: false`. Não use OTP para contas não confirmadas: o servidor pode tratá-lo como novo cadastro e recusar com `signup_disabled`.
- Configure Site URL e estas Redirect URLs exatas, substituindo a origem ao publicar:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?next=/auth/definir-senha
http://localhost:3000/auth/callback?next=/auth/update-password
```

Abra links no mesmo navegador que iniciou o fluxo, por causa do PKCE e do cookie de primeiro acesso. Não desative confirmação para contornar problemas de SMTP.

### Primeiro administrador

Não há promoção a administrador pela interface. O operador autorizado executa uma vez:

```powershell
node --env-file=.env.local scripts/bootstrap-admin.mjs --email email-do-administrador
```

Para criar uma conta nova, defina antes `ADMIN_BOOTSTRAP_PASSWORD` no ambiente local com pelo menos 12 caracteres. O script não imprime a senha. Ele confirma administrativamente o endereço indicado pelo operador e autoriza a conta em `private.admin_users`. Use somente um endereço controlado pela equipe institucional. Para conta existente, exige e-mail já confirmado e mantém a senha atual. Remova a variável de bootstrap após o uso.

O administrador entra em `/auth/admin` com e-mail/senha. Estudantes entram em `/auth/login` com RA/senha. Essa separação permite administrar os cadastros sem inventar um RA para funcionários.

Após entrar, o administrador pode usar **Alterar senha**. A página e a ação verificam sessão confirmada e autorização administrativa ou vínculo estudantil ativo. A alteração encerra a sessão e volta ao login correspondente.

## Formato da planilha

A primeira linha deve conter estes cabeçalhos; `curso` e `semestre` são opcionais:

```text
ra | nome | email | telefone | data_nascimento | cpf | curso | semestre
```

Formate a coluna `ra` como **Texto antes de preencher**. Datas aceitam `DD/MM/AAAA` ou células nativas de data. CPF aceita pontuação, mas precisa ter dígitos verificadores válidos; os números ilustrativos do documento de requisitos não são dados válidos para importação. Use somente dados de teste controlados na validação inicial. O campo `semestre`, quando informado, é um número inteiro.

Na área administrativa, selecione o arquivo e clique em **Analisar planilha**. Confira as linhas e os erros, marque a confirmação e clique em **Confirmar importação**. Somente linhas válidas são gravadas. Corrija as linhas recusadas em outro arquivo para uma nova prévia.

## Validação

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Os testes leem arquivos `.xlsx` reais, exercitam SQL/RLS e usam conexões PostgreSQL para as transações de importação e ativação. Nos testes automatizados, a entrega de e-mail e as respostas Supabase Auth são simuladas. Isso **não comprova entrega SMTP nem integração hospedada**.

Resultados desta execução:

- 75 testes de validação, autenticação, importação, transações e RLS passaram na atualização de 15/09/2026.
- 6 testes de navegador passaram em desktop e celular.
- ESLint, verificação TypeScript e build de produção passaram.
- Auditoria de dependências: nenhuma vulnerabilidade reportada.
- Página inicial, login e primeiro acesso revisados visualmente em 1440 px e 390 px, sem rolagem horizontal. Administração protegida depende da conexão configurada para revisão visual autenticada.

Os critérios da seção 28 do documento de requisitos estão implementados no código e cobertos pela validação local correspondente. A conclusão integrada permanece pendente do roteiro abaixo, especialmente entrega do link e uso das telas administrativas com Supabase conectado.

Validação final com serviço integrado:

1. Autorizar o administrador e importar uma planilha com dados de teste controlados.
2. Confirmar que a prévia não cria alunos nem histórico; confirmar importação e verificar estado pendente.
3. Testar duplicidades, linhas inválidas, arquivo alterado e confirmação repetida.
4. Iniciar primeiro acesso com RA/nascimento; receber e abrir o link.
5. Definir senha, verificar perfil mínimo e acesso à comunidade.
6. Sair e entrar com RA/senha; recuperar senha por RA.
7. Bloquear o aluno na administração e verificar bloqueio de navegação e consultas com a sessão existente.
8. Confirmar que outro usuário não acessa administração e que respostas públicas não contêm CPF, nascimento ou telefone.

Na execução inicial, ficaram pendentes as credenciais, aplicação das migrações, SMTP e bootstrap do administrador. Não houve importação de alunos reais, criação de contas reais ou envio de mensagens. O estado da conexão foi atualizado abaixo.

### Atualização de conexão — 15/09/2026

As chaves pública e secreta foram aceitas pelo projeto SABENÇA. Cadastro público confirmado como desabilitado, provedor de e-mail habilitado e confirmação de e-mail obrigatória. A conexão PostgreSQL foi validada com TLS, usando o certificado `prod-ca-2021.crt` baixado pelo usuário. O certificado CA público foi copiado para `supabase/certs/`, e seu caminho foi configurado no ambiente local. Nenhuma senha ou chave foi alterada.

Na verificação inicial da conexão, os schemas ainda não continham tabelas. A continuidade descrita abaixo aplicou as migrações e iniciou a validação integrada.

### Integração remota — 15/09/2026

- Quatro migrações aplicadas ao projeto SABENÇA, na organização autorizada. Histórico remoto corresponde aos arquivos locais.
- 18 tabelas com RLS e três buckets privados (`avatars`, `listing-images`, `project-images`). Convite temporário do administrador consumido e removido.
- Administrador criado no endereço indicado pelo titular. Login real aceito; `access_context()` retornou `admin: true` e `member: false`. Credenciais iniciais estão somente no arquivo local `.env.admin-inicial`, ignorado pelo Git. Use o valor de `ADMIN_BOOTSTRAP_PASSWORD` em `/auth/admin`, troque a senha pelo menu e remova o arquivo após guardar a nova senha.
- Um aluno fictício foi importado pelo serviço da aplicação: RA `TESTE-001`, nascimento `14/05/2003`, e-mail de teste autorizado pelo titular. Não corresponde a uma matrícula real. CPF foi validado e persistido somente como HMAC.
- Prévia não alterou alunos/histórico. Confirmação criou um lote e um aluno pendente; repetição permaneceu idempotente. Nova prévia recusou a duplicidade.
- Rotas administrativas de lista, importação e histórico responderam HTTP 200 com sessão real. As respostas não continham e-mail nem CPF do aluno. Acesso sem sessão redirecionou para o login administrativo.
- URLs locais exatas de callback cadastradas. Primeiro acesso exercitado no Chrome do usuário. O fluxo OTP inicial foi recusado pelo cadastro fechado; a correção usa confirmação da conta já provisionada. Nova solicitação aceita pela API, com `confirmation_sent_at` preenchido; isso não comprova recebimento na caixa de entrada.
- SMTP próprio ainda desativado; o titular informou não ter provedor. O envio padrão tem [restrições de destinatários e volume](https://supabase.com/docs/guides/auth/auth-smtp). Configurar SMTP próprio antes de uso por alunos reais. Não adicionar alunos à equipe administrativa do Supabase para contornar essa limitação.
- O titular confirmou recebimento no endereço autorizado, ativação e novo login por RA/senha. O banco confirmou e-mail verificado, matrícula `active`, perfil mínimo criado, nenhuma permissão administrativa e consumo das provas de ativação. A comunidade foi aberta no Chrome com a sessão estudantil; a tentativa de abrir `/admin/alunos` nessa sessão foi negada. A mensagem de recusa foi ajustada para não afirmar incorretamente que um aluno ativo está sem vínculo quando ele tenta acessar a administração.
- RLS foi exercitada no banco remoto com o papel `authenticated` e a identidade do aluno: ativo enxerga o perfil; bloqueado perde o vínculo e a consulta retorna zero perfis; restaurado volta a enxergar. A transação foi revertida ao final e a matrícula permaneceu ativa. Este teste valida as regras do banco; a interação de bloqueio/restauração pela interface administrativa ainda pode ser conferida pelo operador.
- Recuperação de senha está coberta pelos testes locais; o fluxo completo por e-mail ainda não foi repetido com a conta real de teste. Para solicitar novo primeiro acesso quando pertinente, abrir o link no mesmo navegador, em até 20 minutos. Alunos já ativos devem usar login ou recuperação, não repetir a ativação.
- Advisor de segurança: nenhum erro; um aviso de proteção contra senhas vazadas desativada, recurso [disponível no plano Pro ou superior](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Não houve mudança de plano. Seis [informativos de RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) são esperados nas tabelas privadas que bloqueiam acesso dos clientes. As permissões da função de plataforma foram corrigidas por migração.
- Advisor de desempenho: somente informativos de [índices ainda não usados](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), esperados nesta base inicial. Nenhum índice removido.
- 75 testes, lint, TypeScript e build passaram. Os seis testes de navegador e a auditoria de dependências acima pertencem à validação anterior; não foram repetidos nesta atualização.

## Referências

- [Supabase: Magic Links e shouldCreateUser](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase: criação administrativa de usuário](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [ExcelJS](https://github.com/exceljs/exceljs)
- [Postgres.js: transações](https://github.com/porsager/postgres#transactions)
- [FATECE](https://www.fatece.edu.br/) — referência institucional; cores aproximadas fornecidas no documento do projeto.
