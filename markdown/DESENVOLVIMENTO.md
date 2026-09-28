# Registro de desenvolvimento

## 28/09/2026 — Contas persistentes para teste manual

Por solicitação do titular, foram criadas duas contas fictícias de estudante, Ana Conexões (teste) e Bruno Conexões (teste), com RAs `TESTE4001` e `TESTE4002`. Elas permanecem disponíveis para teste manual e não fazem parte da limpeza dos fixtures E2E. Credenciais e IDs ficam somente em `.env.contas-teste.json`, ignorado pelo Git. Acesso estudantil ativo, ausência de privilégio administrativo e visibilidade mútua dos perfis foram verificados.

A entrega da Fase 4 foi organizada em commits de banco/serviço, interface/testes e documentação. O envio ao GitHub e a execução do workflow remoto continuam pendentes.

## 27/09/2026 — Fase 4: conexões entre estudantes

Implementados `/connections`, envio pelo Networks e pelo perfil, aceite, recusa, cancelamento e remoção confirmada. Estados no Networks são consultados em lote; avatares das três seções usam uma assinatura coletiva. DTOs preservam a separação entre dados sociais e institucionais privados. Não há contagem pública de conexões ou mecanismo de popularidade.

A migration `20260927044938_connections_phase.sql` foi aplicada após autorização explícita do titular. Audita rejeições antigas antes de restringir estados, mantém a unicidade do par, preserva dados e recria policies para participantes ativos. A auditoria confirmou um aluno, um perfil e zero conexões antes e depois. O advisor SQL de segurança não encontrou avisos ou erros.

Lint, TypeScript, 188 testes locais e build passaram. Os 18 cenários E2E foram aprovados em desktop e celular contra produção local e Supabase real: 17 na execução completa e um em repetição isolada após falha no login inicial. Os seis cenários de Conexões incluem API real e corrida de solicitações inversas. A revisão visual confirmou ações e confirmação de remoção; a auditoria final não encontrou contas, matrículas, perfis, cursos temporários ou imagens órfãs. Permanecem o aluno e o perfil preexistentes e zero conexões.

A configuração Playwright passou a usar porta própria no modo de produção, evitando reutilização de um servidor de desenvolvimento aberto e resultados incorretos nas verificações de cache. Os commits foram criados localmente em 28/09; o workflow remoto ainda depende do envio ao GitHub. Arquitetura, comandos, limites e resultados: [Conexões: implementação](CONEXOES_IMPLEMENTACAO.md).

## 27/09/2026 — Fase 3: cursos, importação e Networks

Implementados catálogo institucional administrável, referências de curso em alunos e perfis, modelo Excel gerado pela aplicação, validação de curso ativo na prévia/confirmação, relatório CSV de erros e Networks com busca, filtros combinados, paginação e avatares privados.

A migration `20260927030010_courses_networks.sql` foi aplicada após autorização explícita do titular. Preserva os textos antigos, associa as referências e aborta conflitos. A auditoria confirmou o mesmo aluno e perfil existentes, um curso, zero divergências, RLS ativa e catálogo sem escrita pelo navegador. Migrations anteriores não foram editadas. A revisão automática havia bloqueado a primeira tentativa por exigir autorização para alterar o banco compartilhado.

Lint, TypeScript, 153 testes locais de banco/aplicação e build passaram. Os 12 cenários E2E foram aprovados em desktop e celular contra o build de produção: oito na execução completa e os quatro restantes na repetição após ajustes nas verificações de imagem/texto. Os seis cenários autenticados usaram dados fictícios temporários no Supabase real. A revisão visual conferiu Networks e administração; o GitHub Actions valida o commit enviado. Detalhes, limites e comandos em [Networks: implementação](NETWORKS_IMPLEMENTACAO.md).

## 22/09/2026 — Fase 2: perfil acadêmico/social

Implementados perfil real, edição de username/bio, pesquisa/criação/remoção de habilidades e interesses, avatar privado, CRUD de projetos com imagens e links e perfil da comunidade em `/users/[username]`. O fluxo institucional foi preservado. Nome, curso e semestre continuam sob controle institucional.

A gravação de perfil e relações é transacional. A criação de catálogo fica no servidor, com normalização e índice único; ações restantes usam o cliente Supabase da sessão e RLS. URLs de imagens expiram em 5 minutos e o banco guarda apenas caminhos. DTOs sociais usam seleção explícita de campos.

Migration `20260922124535_profile_phase.sql` aplicada ao Supabase: proteção das colunas institucionais, proibição de recriar/excluir o próprio perfil pela API e índices normalizados de habilidades/interesses. Nenhum registro foi excluído. A proposta inicial de consolidação de duplicados foi recusada pela revisão automática; a versão final interrompe a aplicação se houver conflitos. A consulta prévia confirmou ausência de duplicados.

Lint, TypeScript, build de produção, 125 testes de aplicação/banco e 8 E2E passaram. O fluxo completo foi validado no Supabase real em desktop e celular contra o build local de produção. Os dados temporários foram removidos. O E2E detectou e confirmou a correção da edição de projeto sem nova imagem; a navegação móvel também passou a caber sem rolagem horizontal. Detalhes em `PERFIL_IMPLEMENTACAO.md`.

Decisões, limites, testes e manutenção: [Perfil: implementação](PERFIL_IMPLEMENTACAO.md).

## Histórico: acesso institucional

Os registros abaixo descrevem a fundação anterior. A decisão de cadastro aberto com e-mail pessoal foi substituída pelo documento `SABENCA_Acesso_Institucional_Importacao_Layout.md`.

Implementados: registro institucional privado, controle administrativo, importação Excel com prévia sem gravação, confirmação transacional e idempotente, primeiro acesso com confirmação de e-mail e senha própria, login por RA, RLS por vínculo ativo, bloqueio/restauração e layout azul/branco da comunidade FATECE.

Configuração, limites e validação atual: `ACESSO_INSTITUCIONAL_IMPLEMENTACAO.md`. A validação local inicial passou em 69 testes de aplicação/banco e 6 testes de navegador. Em 15/09/2026, o Supabase foi conectado, quatro migrações foram aplicadas e a conta administrativa e um aluno fictício autorizado foram criados. A suíte atual passou em 75 testes, lint, TypeScript e build.

## Histórico: decisões da fundação anterior

- **Escopo:** fundação e autenticação primeiro. O perfil completo permanece para depois da validação real de cadastro/login, como exige a seção 24 do guia.
- **E-mail pessoal:** autorizado pelo usuário durante o desenvolvimento. Retirada a exigência de domínio institucional. Confirmação de endereço permanece obrigatória. Isso comprova acesso ao e-mail, não vínculo universitário.
- **Stack:** instalação manual na raiz para preservar o guia existente e evitar uma pasta aninhada. Next.js 16, React 19, TypeScript, Tailwind 4 e componentes shadcn/ui. Versões exatas em package.json e lockfile.
- **Identidade visual inicial:** verde, creme, tipografia editorial e ilustrações em HTML/CSS. Sem fotos de terceiros ou dados fictícios apresentados como reais.
- **Supabase SSR:** PKCE com callback de código e cookies. Compatível com templates padrão de e-mail. Função privada de associação com verificação no banco; RLS e grants explícitos.
- **Dados:** schema inicial de todo o MVP, sem antecipar os formulários dos próximos módulos. IDs UUID; conexão única por par; propriedade imutável via privilégios por coluna.
- **Storage:** buckets privados; imagens até 5 MiB. Sem bucket público de avatares. URLs assinadas serão geradas nos módulos correspondentes.
- **Testes:** validação Zod e Server Actions, execução da migração/RLS em PGlite e fluxos de navegador via Playwright.

## Pendências de integração

- Configurar SMTP próprio para o envio a alunos reais. Supabase, Auth, TLS e Redirect URLs locais já configurados.
- Concluir o teste manual de recuperação de senha e a interação de bloqueio/restauração pela interface administrativa. Recebimento do link, ativação e novo login por RA foram confirmados pelo titular; matrícula ativa, perfil e consumo da prova foram conferidos no banco. Login administrativo, navegação administrativa, importação e RLS no bloqueio/restauração já validados no serviço remoto.
- Repositório remoto: [SirManoTreta/sabenca](https://github.com/SirManoTreta/sabenca), preparado para o primeiro envio em 21/09/2026. Credenciais locais, arquivos gerados e ZIP de backup ficam fora do versionamento.
- Perfil implementado na Fase 2. Próximos módulos seguem os respectivos guias de desenvolvimento.

## Histórico: validação da fundação anterior

- ESLint sem erros ou avisos.
- Build de produção concluído, incluindo verificação TypeScript.
- 35 testes de validação, Server Actions e banco passaram.
- 6 testes Playwright passaram em desktop e celular.
- Revisão visual da página inicial e cadastro em 1440 px e 390 px.
- `.env.local` confirmado como ignorado pelo Git.

Os testes automatizados de Auth utilizam respostas simuladas. A integração remota atual e suas pendências estão registradas no documento de implementação.

## Dificuldades do ambiente

O Docker está instalado, mas o daemon não estava em execução. A validação SQL independente usa PGlite e não simula um serviço Supabase completo. As ferramentas locais exigiram acesso de rede para instalar dependências; nenhuma chave secreta foi adicionada ao código.
