# Perfil acadêmico/social — Fase 2

## Estrutura

- `/profile`: identidade do aluno autenticado, consultada em `public.profiles`.
- `/profile/edit`: username, bio, habilidades, interesses e foto.
- `/profile/projects/new` e `/profile/projects/[id]/edit`: criação, edição e exclusão de projetos.
- `/users/[username]`: apresentação do perfil a membros ativos da comunidade.

`src/services/profile.ts` lê dados com o cliente Supabase da sessão e seleções explícitas. `src/types/profile.ts` define os dados sociais entregues às telas. Auth continua responsável pela autenticação; metadados editáveis de Auth não definem a identidade exibida.

O username é obrigatório ao salvar, normalizado para minúsculas e limitado a 3–30 letras ASCII, números ou `_`, sem espaços. A bio admite até 500 caracteres. Perfis ainda sem username continuam acessíveis em `/profile`. Nome, curso, semestre e instituição não são editáveis pelo aluno.

## Habilidades e interesses

O seletor pesquisa o catálogo no servidor, permite selecionar/criar opções e remover associações. Há até 20 habilidades e 20 interesses por perfil, com nomes de até 60 e 80 caracteres, respectivamente. As mudanças são aplicadas ao clicar em **Salvar perfil**.

`saveProfile()` valida o conteúdo, verifica novamente o vínculo ativo no banco e localiza o perfil pelo usuário autenticado. A criação controlada de catálogo usa a conexão privada já existente, exclusivamente no servidor. Atualização do perfil e das relações usa `SET LOCAL ROLE authenticated`, reaplicando RLS. Tudo ocorre em uma transação: conflito de username desfaz também catálogos novos e alterações nas relações.

Nomes são normalizados com NFC, espaços colapsados e minúsculas para comparação, mantendo a grafia de exibição do catálogo. Os índices únicos de `normalized_name` evitam duplicatas concorrentes. Excluir uma seleção não exclui o catálogo compartilhado. O cliente não recebeu permissão de inserir em `skills` ou `interests`.

## Imagens privadas

Reutilizados os buckets `avatars` e `project-images`, ambos privados, com limite de 5 MiB e JPEG/PNG/WEBP. O servidor confere tamanho, MIME e assinatura dos bytes. O limite de requisição das Server Actions passou a 6 MiB para acomodar o arquivo e o formulário; o limite de imagem permanece 5 MiB.

- Avatar: `<auth-user-id>/<uuid>.<extensão>`.
- Projeto: `<auth-user-id>/<project-id>/<uuid>.<extensão>`.
- O banco guarda somente caminhos. URLs assinadas são geradas após autenticação e autorização e expiram em 5 minutos.
- A imagem usa exibição direta, sem passar pelo cache compartilhado de otimização do Next.js. Falha de carregamento mostra iniciais ou ícone.
- Na substituição, a imagem anterior só é removida após salvar o novo caminho. Falha de persistência tenta remover o upload novo. A atualização compara o caminho anterior para evitar conflitos entre abas.

Storage e PostgreSQL não compartilham transações. Uma falha na limpeza pode deixar um objeto órfão; a limpeza é de melhor esforço. URLs assinadas já emitidas continuam válidas até expirar, inclusive após bloqueio. Novas consultas e assinaturas exigem vínculo ativo. Veja [a documentação de URLs assinadas do Supabase](https://supabase.com/docs/guides/storage/serving/downloads#signing-urls).

## Privacidade e RLS

Todas as páginas e ações exigem `requireUser()`. A autorização depende do vínculo institucional ativo, não apenas de uma sessão válida ou acesso administrativo. O middleware também cobre `/users`, renova a sessão e marca respostas como `private, no-store`. Páginas da comunidade usam `noindex`.

As respostas sociais contêm apenas nome, username, curso, semestre, instituição, bio, habilidades, interesses, projetos e imagens autorizadas. Não consultam tabelas institucionais privadas para exibição. E-mail, telefone, nascimento, CPF/fingerprint e campos administrativos não compõem os dados da interface.

Projetos e imagens usam o cliente da sessão, com RLS. A edição e exclusão filtram também pelo perfil proprietário. IDs e caminhos enviados pelo cliente não definem propriedade. Links de projetos só aceitam HTTP/HTTPS, sem credenciais embutidas.

## Migration

`20260922124535_profile_phase.sql`, aplicada ao Supabase conectado em 22/09/2026:

- revoga edição de nome, curso, semestre e instituição pelo cliente;
- revoga criação/exclusão direta de perfil, impedindo recriação com dados institucionais forjados;
- adiciona normalização e índices únicos aos catálogos;
- preserva tabelas, buckets, dados e migrations anteriores.

Antes da aplicação, a consulta dos dois catálogos encontrou zero grupos duplicados. A migration não faz limpeza automática: se houver duplicados em outro ambiente, o índice único interrompe a transação e os registros devem ser revisados separadamente. O bootstrap institucional continua criando perfis pela conexão privada.

## Validação

Resultado final em 22/09/2026: **lint, TypeScript, 125 testes de aplicação/banco, build de produção e 8 E2E passaram**. O E2E autenticado rodou com Supabase real em desktop e celular contra o build local de produção. Foram conferidos ausência de rolagem horizontal, imagens privadas, perfil da comunidade sem dados sensíveis, CRUD de projetos e bloqueio. A consulta final confirmou zero alunos, contas Auth ou catálogos temporários remanescentes e manteve os buckets privados.

Comandos locais:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

A suíte de aplicação cobre normalização, limites, URLs, arquivos, mensagens de erro, seleção de dados sociais e autorização das ações. PGlite executa as migrations reais, PostgreSQL via TCP, transações, RLS e privilégios por coluna. Os testes antigos continuam preservados.

O E2E padrão verifica as telas públicas e o redirecionamento das novas rotas. O fluxo completo autenticado é opt-in, pois usa o Supabase configurado e cria alunos fictícios temporários. Não envia e-mails nem usa contas existentes; remove contas, vínculos, imagens e catálogos exclusivos de teste ao final:

```powershell
npm run build
$env:SABENCA_E2E_INTEGRATION = '1'
$env:SABENCA_E2E_PRODUCTION = '1'
node --env-file=.env.local node_modules/@playwright/test/cli.js test --workers=1
Remove-Item Env:SABENCA_E2E_INTEGRATION
Remove-Item Env:SABENCA_E2E_PRODUCTION
```

Exige as variáveis já documentadas para acesso institucional, incluindo `DATABASE_URL`, CA TLS e chave privada de servidor. Execute apenas em um projeto autorizado para testes. Capturas e traces ficam em `test-results/`, fora do Git.

## Dificuldades e decisões

- O acesso inicial à CLI exigiu permissão para sua telemetria local; não foram alteradas credenciais.
- A primeira proposta de migration incluía consolidação de duplicados. A revisão automática recusou essa limpeza no banco ativo. A versão aplicada removeu toda exclusão de dados e foi aprovada após confirmar ausência de duplicados.
- O E2E real detectou que React pode enviar um arquivo vazio com nome preenchido quando o campo opcional de imagem não foi selecionado. A edição agora preserva a imagem anterior nesse caso; um teste de regressão cobre esse comportamento. Também foram ajustadas as esperas do teste para a latência remota, e as associações passaram a ser gravadas em lote.
- O Next.js registrou `The destination stream closed early` em transições de navegação durante o E2E, sem falha nas verificações de interface ou persistência. Se aparecer fora de navegações canceladas, investigar separadamente; não foram alterados os internals do framework.
- Foram mantidas as policies existentes de membro ativo e propriedade. Nenhum catálogo ganhou escrita livre pelo navegador.
- O advisor de segurança não apontou novos problemas. Permanecem os avisos anteriores: tabelas privadas deliberadamente sem policies de acesso e proteção de senhas vazadas desabilitada no Auth. Esta última é uma pendência de configuração anterior, descrita na [documentação de segurança de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Marketplace, descoberta no Networks, conexões e mensagens permanecem fora desta fase.
