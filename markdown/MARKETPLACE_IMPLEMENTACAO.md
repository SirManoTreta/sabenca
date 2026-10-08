# Marketplace MVP

Produtos e serviços reutilizam `listings`, `listing_images`, `categories` e o bucket privado `listing-images`. Autenticação institucional, perfil, Networks e conexões permanecem compartilhados.

## Arquitetura

- Server Components exibem dados; componentes client cuidam de formulários, uploads e confirmações.
- Server Actions autenticam cada operação, validam Zod e derivam vendedor da sessão. Campos de identidade enviados pelo navegador são ignorados.
- Serviço PostgreSQL usa o padrão existente: transação com `request.jwt.claim.sub` e `SET LOCAL ROLE authenticated`, mantendo RLS e identidade fora do pool.
- Listagem pagina 12 anúncios, usa joins e agregação de imagens, evitando uma consulta por card. Signed URLs de imagens/avatares são geradas em lote por 5 minutos.
- Pesquisa por título, descrição e vendedor; filtros por categoria, condição e preços; ordenação recente/preço; status somente em Meus anúncios. Parâmetros ficam na URL.

## Banco e autorização

Migration `20261006184036_marketplace_mvp.sql`, aplicada somente no DEV:

- `categories.is_service` classifica Serviços, Aulas particulares e Freelance. Categorias continuam vindo do banco.
- Trigger exige `not_applicable` para serviço e condição de produto para demais categorias, inclusive na API direta.
- Imagens limitadas às posições 0–4, com caminho do proprietário/anúncio validado e unicidade adiável para reorganização atômica.
- Policies de INSERT/UPDATE no Storage exigem propriedade do anúncio além da pasta Auth. Policies de avatar/projeto mantêm comportamento anterior.
- Vendedor permanece imutável por grants e aplicação. RLS original mantém anúncios vendidos/inativos visíveis somente ao proprietário; anúncio indisponível não revela existência a terceiros.

Nenhuma tabela ou bucket recriado; nenhum novo índice necessário para tamanho do MVP. Bucket permanece privado. Nenhuma alteração no PROD.

## Rotas e integração

`/marketplace`, `/marketplace/novo`, `/marketplace/[id]`, `/marketplace/[id]/editar`, `/marketplace/meus-anuncios`.

Anúncios ativos aparecem no Perfil. Detalhes abrem perfil do vendedor e ações de conexão existentes. Para estudantes sem username, `/users/id/[id]` reutiliza o mesmo perfil e autorização pelo ID público do perfil, nunca por RA ou identidade institucional.

## Imagens e preço

Até cinco imagens JPEG/PNG/WebP, 4 MiB cada. Assinatura dos bytes e MIME são validados no servidor; extensão não define formato. Caminho: `<auth-user-uuid>/<listing-uuid>/<arquivo-uuid>.<extensão>`.

Criação salva anúncio inativo, envia cada imagem em uma Server Action separada e publica ao concluir. Isso evita agrupar 20 MiB numa requisição limitada pela Vercel. Falha parcial mantém anúncio editável em Meus anúncios. Remoção usa caminhos lidos do banco e só exclui registros depois de confirmar remoção no Storage; upload malsucedido tenta compensação do objeto. Storage e PostgreSQL não compartilham transação: interrupção de rede exige retomada/limpeza direcionada; não há fila de manutenção nesta fase.

Preço é transformado em centavos inteiros e string decimal, sem escrita por ponto flutuante. Aceita `45,00`, `45.00` e `1.234,56`; rejeita valores negativos, ambíguos, exponenciais, centavos extras e fora de numeric(12,2). Exibição BRL/pt-BR.

## Testes

Unitários: limites de texto, decimal/preço, categoria/condição/status, filtros e regras de serviço. PostgreSQL local: criação/edição/exclusão, propriedade, RLS, Storage, ordenação numérica, paginação, status, limite/caminhos/posições de imagens e rollback de falhas.

Playwright opt-in `SABENCA_E2E_INTEGRATION=1`: no máximo dois alunos temporários DEV por cenário, publicação com imagens, perfil sem username, edição, remoção, vendido/inativo/reativação, filtros persistentes, serviço, acesso anônimo e API de outro membro. Teardown remove apenas seus registros e arquivos.

Lint, typecheck, 238 testes locais e build passaram. Foram validados 18 cenários E2E desktop/mobile: 17 na execução completa e Marketplace mobile em reteste após corrigir espera de logout no teste. Outra correção do teste usa logout local da sessão API para preservar sessão do navegador do segundo aluno. O fluxo de exclusão passou novamente em desktop/mobile após mover o redirecionamento para a Server Action, seguindo o padrão de Projetos; isso evita depender do componente client na página já removida. Preview será registrado no relatório da entrega. Chat, pagamento, checkout e certificados continuam fora do escopo.

Durante navegações rápidas no build local, Next.js registrou `The destination stream closed early`. Há reprodução upstream para cancelamento de streams RSC pelo cliente ([issue #96704](https://github.com/vercel/next.js/issues/96704)); os fluxos funcionais passaram e nenhum log foi suprimido ou build error ignorado. Advisors DEV mantêm avisos anteriores de [tabelas privadas fechadas por RLS sem policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [proteção de senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); configurações Auth não foram alteradas nesta fase.
