# SABENÇA — implementação técnica do MVP

## Objetivo e recorte

Comunidade universitária fechada que integra descoberta de colegas (Networks), identidade e portfólio (Perfil) e produtos/serviços entre estudantes (Marketplace). Encontrar uma habilidade, conhecer os projetos do estudante, consultar uma oferta e criar uma conexão compõem um mesmo percurso. Feed, chat, pagamentos, eventos, vagas e popularidade ficam fora do recorte.

## Tecnologias

| Tecnologia | Uso e razão |
| --- | --- |
| Next.js 16 / React 19 | Interface, Server Components, rotas e Server Actions no mesmo projeto. |
| TypeScript / Zod | Contratos de dados e validação da entrada no servidor. |
| Tailwind CSS 4 | Identidade visual e layouts responsivos, sem outro framework visual. |
| Supabase Auth | Senhas, confirmação de e-mail, convites e recuperação. |
| PostgreSQL / Supabase | Relacionamentos, constraints, transações, autorização e migrations versionadas. |
| Postgres.js | Consultas parametrizadas e transações; sem ORM. |
| Supabase Storage | Arquivos privados e links assinados com expiração. |
| ExcelJS / yauzl | Importação institucional XLSX com limites e inspeção do arquivo. |
| Vitest / PGlite | Validações e integração com SQL, RLS, triggers e transações reais. |
| Playwright | Jornadas no navegador, desktop/mobile e larguras de 360 a 1440 px. |
| GitHub Actions / Vercel | Verificações automatizadas e deployments por branch. |

As versões exatas e transitivas são fixadas pelo `package-lock.json`; não houve troca de stack para fechar o MVP.

## Arquitetura

O navegador recebe páginas e formulários React. Server Components consultam services exclusivos do servidor. Server Actions validam a identidade, a entrada e a autorização antes de executar operações. O Supabase Auth mantém sessões em cookies; o servidor verifica o usuário e consulta o vínculo institucional a cada operação protegida.

Dados sociais vivem em `public`, com RLS. Importações, alunos institucionais, permissões administrativas, desafios de ativação e auditoria vivem em `private`. A conexão privilegiada permanece no servidor. Nos serviços sociais SQL, `request.jwt.claim.sub` e o papel `authenticated` são definidos localmente dentro da transação, preservando a RLS e evitando identidade residual no pool.

Arquivos são enviados ao Storage depois de validar tamanho, MIME, extensão quando aplicável e assinatura dos bytes. O banco armazena caminhos internos; as telas recebem URLs temporárias após autorização. O download de certificados passa por uma rota protegida e gera um link de 60 segundos com disposição de download.

## Modelo funcional

- **Instituição:** importação validada, prévia com recibo e confirmação transacional. Nome/curso/semestre são mantidos pela instituição.
- **Auth:** inscrição pública fechada por trigger. Primeiro acesso exige RA/nascimento já cadastrados, confirmação no e-mail e senha própria. Recuperação evita revelar existência de contas.
- **Perfil:** identidade acadêmica, username, bio, avatar, habilidades/tecnologias, interesses e projetos. Preenchimento progressivo; sem currículo obrigatório.
- **Networks:** pesquisa por nome/username/habilidade, filtros de curso, semestre, habilidade e interesse; paginação sem ranking de popularidade.
- **Conexões:** solicitação, aceite, recusa, cancelamento e remoção; par único impede duplicatas e solicitações cruzadas.
- **Marketplace:** anúncios de produtos ou serviços, categorias, preço, condição, status e imagens. Novos anúncios começam inativos até a publicação. Vendedor leva ao Perfil e às Conexões.
- **Certificados:** metadados opcionais, documento privado, estados pendente/verificado/rejeitado e revisão manual administrativa. Editar o conteúdo devolve o registro para pendente.
- **Moderação:** denúncias de perfis/anúncios, fila administrativa, estados de análise e bloqueio bilateral entre estudantes.
- **Privacidade:** controles por seção. Bio e semestre são obtidos por lookup seguro; os campos crus não podem ser selecionados pela Data API. Relações e arquivos respeitam bloqueio/visibilidade no banco.

## Segurança e privacidade

RLS exige vínculo institucional ativo, confirmação do e-mail, ausência de banimento e correspondência do e-mail institucional. Papéis administrativos vêm de `private.admin_users`, sem confiança em `user_metadata`. A revogação é revalidada no banco e não depende de esperar a atualização de claims JWT.

CPF é transformado em fingerprint HMAC para detectar duplicidade. O valor original não é publicado no perfil. RA, nascimento, telefone e e-mail institucional são separados dos DTOs sociais. HMACs e credenciais do banco não usam prefixo `NEXT_PUBLIC_`.

Funções `SECURITY DEFINER` são limitadas a lookups ou invariantes que precisam atravessar RLS. Permanecem em `private`, usam `search_path=''` e grants explícitos. Wrappers públicos são `SECURITY INVOKER`, com autorização dentro da função privada.

Certificados originais são acessíveis ao dono e aos administradores. Outros estudantes recebem somente metadados verificados. O selo significa análise pelo SABENÇA, sem promessa de autenticidade absoluta. A fila privada de limpeza registra documentos substituídos e uploads interrompidos para repetição segura; não contém credenciais.

Bloqueios são direcionais na gestão e bilaterais na leitura: escondem perfis, descoberta, ofertas e arquivos; removem conexões incompatíveis. Desbloquear não recria conexões. URLs assinadas já emitidas permanecem utilizáveis até sua expiração curta.

## Principais dificuldades e decisões

| Dificuldade | Decisão |
| --- | --- |
| Cadastro fechado sem expor dados institucionais | Separar Auth, autorização institucional e perfil social; trigger impede inscrição arbitrária. |
| Importações com erros e duplicidade | Prévia, validação, recibo e confirmação transacional; erros do banco não são enviados crus ao cliente. |
| Primeiro acesso e recuperação | E-mail cadastrado pela instituição e links temporários; RA/nascimento servem à ativação, não como senha permanente. |
| Gestão de Auth administrativo | Convite autorizado antes do insert Auth; provisionamento incompleto fica rastreável e pode ser repetido sem apagar contas existentes. |
| DEV/PROD | Projetos Supabase separados, branches e configurações independentes. |
| Migração inicial | Backup e validação antes da promoção anterior; novas alterações usam apenas migrations incrementais, sem clonar DEV novamente. |
| Uploads privados e falhas parciais | Ownership, limite real de request, rollback quando possível e fila de limpeza para certificados. |
| Relações sociais | Constraints, RLS e locks por par para consistência entre bloqueio e conexão. |
| Certificados | Análise humana apoiada por documento/URL/código; sem detecção automática de fraude. |
| Privacidade por campo | Revogar leitura direta de bio/semestre e devolver somente valores autorizados; ocultar no JSX seria insuficiente. |

## Operação e limites do trabalho

`develop` usa Supabase DEV e Preview; `main` usa Supabase PROD e Production. A CI executa instalação, lint, typecheck, Vitest, build e cenários públicos Playwright. A suíte com dados hospedados exige opt-in e validação explícita do projeto DEV; cria somente fixtures isoladas e remove seus registros/arquivos ao finalizar.

Os resultados medidos e a situação da PR devem ser consultados no relatório de fechamento, não inferidos deste documento. Entrega de e-mail depende também do SMTP e das allowlists do Supabase. Os documentos comunitários deixam o canal institucional como placeholder explícito; não inventam entidade jurídica ou responsável.
