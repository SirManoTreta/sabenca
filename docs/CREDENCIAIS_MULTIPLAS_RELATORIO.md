# SABENÇA — até três credenciais por serviço

## Implementação

Um anúncio de serviço aceita de zero a três credenciais verificadas do próprio vendedor, na ordem de seleção. O formulário apresenta caixas de seleção, contador e bloqueio da quarta opção. Na edição, carrega a seleção elegível atual e permite remover/adicionar. A página usa “Credencial verificada pelo SABENÇA” para uma e “Credenciais verificadas pelo SABENÇA” para duas ou três.

Cada documento é revalidado na leitura. Se um voltar a `pending`, for rejeitado, expirar ou perder evidência, somente ele deixa de aparecer como válido; os demais permanecem. A invalidação não apaga automaticamente o relacionamento histórico. Salvar uma seleção revisada substitui o conjunto explicitamente selecionado.

O Perfil mantém a exibição de todos os certificados conforme suas regras anteriores, sem limite de três. Não houve mudança no processo administrativo, contato, Networks, tipos de upload ou linguagem de garantia profissional. A relevância do documento é escolhida pelo aluno, sem classificação automática.

Arquivos da aplicação:

- `src/lib/validations/listing.ts`: array `certificate_ids`, UUIDs, limite três e rejeição de duplicatas.
- `src/types/marketplace.ts`: DTO `credentials: ListingCredential[]`.
- `src/app/(community)/marketplace/actions.ts`: leitura ordenada com `FormData.getAll` e identidade derivada da sessão.
- `src/services/marketplace.ts`: consulta plural e gravação transacional do anúncio e de suas relações.
- `src/services/certificates.ts`: seleção de documentos elegíveis usando o mesmo predicado do banco.
- `src/components/marketplace/listing-form.tsx`: seleção múltipla, contador e ordem.
- `src/app/(community)/marketplace/[id]/page.tsx`: apresentação compacta singular/plural.

Testes alterados/adicionados: `tests/marketplace-actions.test.ts`, `tests/marketplace-credentials-validation.test.ts`, `tests/mvp-integration.test.ts`, `tests/listing-certificates-migration.test.ts` e `tests/e2e/mvp.spec.ts`. Roteiro de demonstração e implementação técnica também foram atualizados.

## Banco

Nova migration aditiva: **`20261027191347_listing_multiple_certificates.sql`**. Nenhuma migration antiga foi alterada.

| Estrutura | Regra |
| --- | --- |
| `public.listing_certificates` | Fonte autoritativa das associações |
| `listing_id` | FK para `listings(id)`, `ON DELETE CASCADE` |
| `certificate_id` | FK para `profile_certificates(id)`, `ON DELETE CASCADE` |
| `position` | `smallint NOT NULL`, `CHECK` entre 0 e 2 |
| `created_at` | Timestamp com `default now()` |
| Chave primária | `(listing_id, certificate_id)`, impede duplicação |
| Chave única | `(listing_id, position)`, deferrable, inicialmente imediata |
| Índice adicional | `certificate_id`, para FK/remoção e consulta reversa |

Existem somente três posições não nulas e únicas. Assim, nem transações concorrentes conseguem confirmar uma quarta associação. Não há contagem vulnerável a concorrência nem dependência exclusiva do frontend.

RLS possui quatro policies: leitura nas mesmas fronteiras sociais/de privacidade do anúncio, e INSERT/UPDATE/DELETE pelo proprietário institucional ativo. `authenticated` pode inserir apenas os três campos da relação e atualizar somente `position`; não pode mover um vínculo para outro anúncio/certificado. `anon` e `PUBLIC` não recebem acesso. O proprietário pode consultar/reordenar seu histórico; colegas só consultam associações elegíveis e visíveis.

Funções novas:

- Dois overloads internos de `private.listing_certificate_eligible`: centralizam ownership, status, emissão, validade e evidência. Não possuem EXECUTE público ou de `authenticated`.
- `private.own_listing_certificate_eligible`: wrapper do próprio usuário ativo, usado no backend e na lista de opções, sem aceitar um vendedor arbitrário.
- `private.listing_certificate_visible`: fronteira de leitura usada pela RLS, incluindo histórico do proprietário.
- `private.guard_listing_certificates` e trigger `listing_certificates_guard`: validações de escrita e locks de anúncio/certificado/evidência.
- `private/public.listing_credentials`: coleção ordenada de metadados seguros; wrapper público `SECURITY INVOKER`, implementação privada `SECURITY DEFINER`, ambos com grants explícitos e `search_path=''`.

O corpo de `private.guard_listing_certificate` foi atualizado pela migration nova, mantendo o trigger existente: impede novas associações na coluna legada, impede troca de vendedor com vínculos e remove relações ao converter para produto. O singular `private.listing_credential` passou a delegar ao primeiro resultado elegível da coleção nova; o wrapper público antigo continua compatível para leitura.

As RPCs retornam apenas `id`, `title`, `issuer`, `issue_date` e `expiration_date`. Não retornam arquivo/original, `file_path`, URL assinada, reviewer IDs ou dados administrativos. A coleção é sempre um array, inclusive `[]` quando não há credenciais visíveis.

## Compatibilidade e migração

Durante a migration, as escritas no anúncio são bloqueadas brevemente e cada `listings.certificate_id` não nulo é copiado para a posição zero da nova tabela. Isso inclui vínculos históricos que tenham deixado de ser elegíveis; sua exibição continua filtrada.

`listings.certificate_id` **permanece**, com comentário de deprecated/snapshot legado, para remoção futura separadamente revisada. A aplicação nova não escreve nem lê essa coluna como fonte das relações. Ela não é sincronizada manualmente com a coleção. Novos valores não nulos pela sessão autenticada são rejeitados; limpeza por exclusão do certificado ou conversão para produto permanece possível. O lookup singular também não ressuscita o snapshot quando a coleção é esvaziada.

O teste de migration preparou dois anúncios antigos, um documento válido e outro que voltou para `pending`: anúncios/metadados e ambos os vínculos foram preservados, enquanto o documento pendente permaneceu oculto. No DEV real, não havia associação legada preenchida antes da aplicação; o backfill esperado nesse ambiente era zero.

O schema anterior não entende a coleção. Um eventual rollback da aplicação deve considerar essa diferença: a leitura singular devolve o primeiro documento válido, mas o fluxo antigo de novas escritas em `certificate_id` não é a interface suportada. Não remover a tabela nova ou reescrever migrations para contornar isso.

## Segurança e transações

- **Certificado de terceiros/inválido:** o backend usa o wrapper do próprio usuário e o trigger confere o vendedor real, `verified`, emissão não futura, validade inclusiva no dia de São Paulo e evidência HTTPS/arquivo existente.
- **Concorrência com invalidação:** o trigger valida a versão do certificado retornada pelo lock, evitando um snapshot antigo após espera. Evidência baseada em arquivo também é protegida por lock durante a associação.
- **Quarta credencial:** limite no formulário e Zod, mais três posições únicas no banco.
- **Produto com credencial:** o backend rejeita seleções indevidas; a conversão de serviço para produto limpa as relações na própria transação. O trigger também cobre mudanças diretas no banco.
- **Duplicação:** Zod e chave primária composta rejeitam o mesmo certificado repetido.
- **Anúncio de outro usuário:** identidade da sessão, lock do anúncio próprio, grants por coluna, RLS e trigger impedem manipulação de IDs.

Metadados e seleção são gravados dentro da mesma transação `withMember`. Alterações de anúncios existentes travam o pai; remoção/inserção das relações mantém a ordem recebida. Falha de qualquer credencial desfaz o conjunto inteiro e a alteração do anúncio. Não há estado confirmado com atualização parcial.

## Validação

- `npm run lint`: **PASS**.
- `npm run typecheck`: **PASS**.
- `npm test`: **309/309 PASS**, 24 arquivos, incluindo integração SQL real em PGlite e migration antes/depois.
- `npm run build`: **PASS**, configuração local conferida contra Supabase DEV.
- E2E completo desktop/mobile: **34/34 PASS, sem skips**, em 16 minutos, usando duas workers e fixtures exclusivamente DEV. O modo local `next start` não usa Supabase PROD.

As capturas com três documentos em 360 e 1440 px foram inspecionadas: leitura clara, ordem correta e ausência de transbordamento horizontal. O Next.js registrou o aviso já observado em validações anteriores, `The destination stream closed early.`; não foi introduzida alteração para suprimi-lo e a suíte passou integralmente.

Após o E2E, foram reconferidos os dados anteriores por fingerprints: quatro usuários Auth, três perfis/alunos, um administrador, um anúncio, um certificado e três objetos Storage preservados; nenhum vínculo, contato ou denúncia fictício permaneceu. A única diferença nos registros anteriores foi `private.auth_attempts`: o mecanismo preexistente de login expira contadores temporários e remove os vencidos há mais de um dia (`src/services/institution-auth.ts`). Esses registros operacionais não foram restaurados nem apagados manualmente pelo roteiro.

Cobertura: 0/1/2/3, quarta, duplicações, ordem de formulário/RPC, manipulação de IDs, ownership, pending/rejected/expirado/futuro/sem evidência, fronteiras sociais, produto e troca de categoria, rollback transacional, invalidação parcial e preservação histórica. O Perfil foi testado com quatro documentos verificados.

Além dos testes locais, três cenários passaram com **duas sessões PostgreSQL independentes no Supabase DEV**:

1. Dois escritores disputam a terceira posição: um confirma, outro recebe `23505`, total permanece três.
2. Documento volta para `pending` enquanto uma associação espera seu lock: a escrita é recusada com `23514`, sem vínculo residual.
3. Serviço vira produto enquanto uma associação espera o lock do anúncio: a escrita é recusada com `23514`, produto termina sem credenciais.

As barreiras foram confirmadas por locks reais, com timeouts limitados. Somente registros novos com UUID/marcador do ensaio foram criados; limpeza e fingerprints finais passaram, sem alteração de dados anteriores, Auth ou Storage.

## DEV, Preview e Production

Migration aplicada exclusivamente no Supabase DEV `fidndjlresfxvmerkbhs`: **14 para 15 migrations**. Os registros das 63 tabelas anteriores foram preservados. Security Advisor após a aplicação: nenhum ERROR; permanecem nove INFO de tabelas privadas com RLS sem policies e o WARN preexistente de proteção contra senhas vazadas desabilitada. [RLS sem policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Branch de trabalho: `develop`. [Preview de develop](https://sabenca-git-develop-sirmanotretas-projects.vercel.app). Os identificadores do commit publicado, CI e deployment, além da validação autenticada do Preview, ficam registrados na entrega e em `.local/multiple-credentials/publication.json`.

Production permanece no SHA `901134ae8520d5bdd61564274e675d722dd762a3`, deployment `dpl_9e1YERKHzRY7p9aUQbpb16nBhhEA`, com 14 migrations. Nenhum merge em `main`, migration PROD, alteração de env/secret ou deploy de Production foi realizado nesta tarefa.

Evidências privadas, logs filtrados e helpers ficam em `.local/multiple-credentials/`, ignorados pelo Git: validação da migration DEV, ensaio de concorrência, execução E2E e conferência de Preview. Os arquivos locais pendentes do usuário e o relatório da release anterior foram preservados.

**Alteração validada somente em DEV/Preview. Production não foi modificada.**
