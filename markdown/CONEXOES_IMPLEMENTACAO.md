# Fase 4 — Conexões entre estudantes

## Estado da implementação

Implementados `/connections`, solicitações pelo Networks e pelo perfil, aceite, recusa, cancelamento e remoção confirmada. O relacionamento é mútuo. Contagens aparecem somente na área privada do titular; não há métricas públicas de popularidade.

A migration `20260927044938_connections_phase.sql` foi aplicada ao Supabase em 27/09/2026, após autorização explícita do titular. A auditoria encontrou um aluno, um perfil e nenhuma conexão ou rejeição antiga. As contagens e o resumo criptográfico dos registros de conexões permaneceram iguais antes e depois da aplicação. Migrations anteriores não foram alteradas.

## Arquitetura

O fluxo mantém a divisão `Interface / Server Action / Service / Sessão / RLS e constraints`. `src/services/connections.ts` concentra consultas, construção de DTOs, assinatura de avatares e mutações. Todas as operações públicas do serviço exigem `requireUser()`; a identidade institucional é resolvida pelo UUID Auth da sessão, que não precisa coincidir com o UUID do perfil.

Consultas e mutações usam transações Postgres.js com `SET LOCAL ROLE authenticated` e identidade restrita à transação. A conexão administrativa do servidor não dispensa as policies. Não há identidade persistida no pool. UUIDs são validados no serviço e nas Server Actions.

O cliente envia somente o UUID do perfil destinatário ou da relação. As ações ignoram campos forjados de autoria, destinatário, usuário e status. Operações distintas determinam o status e a direção no servidor. Erros conhecidos têm mensagens em português; detalhes SQL não são devolvidos. Após sucesso ou conflito, são revalidados `/connections`, `/networks` e `/users/[username]`.

## Estados e transições

| Situação             | Ação autorizada                                | Resultado         |
| -------------------- | ---------------------------------------------- | ----------------- |
| Sem relação          | Outro estudante ativo envia                    | `pending`         |
| Solicitação enviada  | Remetente cancela                              | Registro excluído |
| Solicitação recebida | Destinatário aceita                            | `accepted`        |
| Solicitação recebida | Destinatário recusa                            | Registro excluído |
| Conexão aceita       | Qualquer participante remove, após confirmação | Registro excluído |

Recusar não bloqueia o estudante. Uma nova solicitação pode ser criada depois de recusa, cancelamento ou remoção. `accepted` nunca retorna a `pending` por UPDATE. O cliente recebe também os estados visuais `none`, `self` e `unavailable`; eles não são persistidos.

O índice único original continua considerando `least(requester_id, receiver_id)` e `greatest(...)`. Ele impede duplicações na mesma direção e na direção inversa, inclusive em concorrência. O serviço traduz `23505` para “Já existe uma solicitação ou conexão com este estudante.” Não há aceite automático quando duas pessoas tentam enviar ao mesmo tempo.

## Migration e segurança

A migration bloqueia escritas na tabela enquanto verifica estados antigos e troca a constraint. Se existir `rejected`, a transação aborta e exige revisão manual. Nenhum registro é corrigido, consolidado ou apagado silenciosamente. IDs, timestamps, índices e chaves estrangeiras existentes são preservados.

As quatro policies foram recriadas:

- SELECT exige participação e ambos os estudantes ativos no contexto FATECE.
- INSERT exige autoria do perfil da sessão, outro destinatário ativo e status `pending`.
- UPDATE permite somente ao destinatário mudar `pending` para `accepted`.
- DELETE exige vínculo ativo e participação. O serviço distingue cancelamento, recusa e remoção pelo status e pela direção.

`private.is_active_student()` é reutilizada para conferir matrícula, confirmação do e-mail, banimento, anonimato e correspondência institucional. As subconsultas também respeitam a RLS dos perfis. O schema atual permite apenas FATECE; não foi introduzido suporte a múltiplas instituições.

Privilégios de INSERT limitam as colunas a participantes e status. UPDATE permite somente status, preservando participantes, ID e data de criação. O trigger existente controla `updated_at`. A constraint original continua impedindo conexão consigo mesmo.

Se um participante for bloqueado depois, a relação deixa de aparecer nas leituras sociais e ações antigas não conseguem alterá-la. O registro é preservado. Como UPDATE/DELETE com filtro dependem da visibilidade de SELECT, uma relação oculta também fica indisponível à remoção pela interface até a regularização institucional. Isso evita exclusão administrativa implícita.

## Consultas, DTOs e interface

`getConnections()` retorna três seções com até 50 itens cada e contagem privada total. Uma consulta classifica e ordena as relações: solicitações mais recentes primeiro; aceitas pelo nome, com UUID para desempate. O limite é aplicado por seção, com aviso quando existem itens além da janela. Paginação pode ser adicionada futuramente; não há rolagem infinita.

Os DTOs contêm UUID da conexão, direção, data e dados sociais do outro participante: UUID do perfil, username, nome, curso, semestre, instituição e avatar assinado. RA, e-mail, telefone, nascimento, CPF, fingerprint e UUID Auth não são serializados. Username pode ser nulo em perfis ainda incompletos; nesse caso, o card continua gerenciável, sem link inválido.

Avatares permanecem no bucket privado. Caminhos de todas as seções são deduplicados e assinados em uma chamada `createSignedUrls`, com validade de cinco minutos. Falhas de assinatura usam as iniciais do estudante.

O Networks consulta os estados de até 24 perfis em lote, dentro da transação existente. Nenhum card faz consulta própria. Busca, filtros e paginação continuam funcionando. Networks, perfil e cards de Conexões compartilham `ConnectionActions`; o próprio perfil não mostra ação de conexão.

Cards usam a identidade visual do Networks, com disposição horizontal em telas maiores e empilhamento no celular. Botões possuem área de toque de 44 px, foco visível e estado desabilitado durante envio. Mensagens usam `role="status"` ou `role="alert"`. A remoção usa `<dialog>` modal nativo, foco inicial em Cancelar, fechamento com Escape e retorno do foco ao botão que o abriu.

## Validação

Lint, TypeScript, 188 testes de aplicação/banco e build de produção passaram. A suíte nova executa migrations reais em PostgreSQL/PGlite e cobre preservação de registros, rejeições legadas, estados, grants, RLS, UUIDs, autoria forjada, destinos indisponíveis, bloqueio posterior, campos privados, ordenação, limite por seção e avatares em lote. Os testes de ações conferem revalidação e mensagens seguras.

`tests/e2e/connections.spec.ts` contém três cenários executados em desktop e celular:

1. Networks, envio, aceite, visualização por ambos e remoção confirmada; Cancelar/Escape preserva a relação e restaura o foco.
2. Perfil, cancelamento, recusa, novo envio, ausência de ação no próprio perfil e ocultação após bloqueio.
3. API autenticada real: autoria forjada, INSERT aceito indevido, corrida de solicitações inversas, aceite restrito ao destinatário, IDs imutáveis e remoção.

Os 18 cenários E2E foram aprovados contra o build de produção em desktop e celular: seis públicos, seis de Conexões/API, quatro de Networks/administração e dois de perfil. A execução completa aprovou 17; o cenário restante falhou no login inicial e passou em repetição isolada, sem alteração no código da aplicação. Não houve cenário autenticado ignorado nessa validação. A revisão visual conferiu cards, Aceitar/Recusar e confirmação de remoção em ambas as larguras.

Os fixtures criam contas e matrículas fictícias com IDs próprios. A limpeza remove somente esses IDs; o teste de Conexões audita ausência de contas, perfis e matrículas após o encerramento. Não usa alunos reais. A auditoria final confirmou um aluno e um perfil preexistentes, zero conexões, nenhuma migration pendente e zero contas, matrículas, perfis ou cursos temporários. Também não encontrou imagens órfãs nos buckets de avatares e projetos.

Comandos locais:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Com autorização e `.env.local` configurado:

```powershell
$env:SABENCA_E2E_INTEGRATION = '1'
$env:SABENCA_E2E_PRODUCTION = '1'
node --env-file=.env.local node_modules/@playwright/test/cli.js test --workers=2
Remove-Item Env:SABENCA_E2E_INTEGRATION
Remove-Item Env:SABENCA_E2E_PRODUCTION
```

O modo de produção usa a porta 3100 e inicia seu próprio servidor. O modo padrão usa 3000. Essa separação impede que uma execução indicada como produção reutilize um `next dev` já aberto.

O workflow existente do GitHub Actions mantém `npm ci`, lint, TypeScript, testes, build e E2E públicos. O E2E remoto exige opt-in e credenciais: testes ignorados não contam como aprovados. Os commits desta fase foram criados localmente. A execução do workflow remoto ainda depende de envio ao GitHub; não foi apresentada como concluída.

## Dificuldades e limites

- O CLI Supabase exigiu escrita de telemetria fora do workspace. O projeto não possui vínculo configurado para `--linked`; a auditoria usou a conexão privada já existente, sem imprimir credenciais. O advisor SQL de segurança não encontrou avisos ou erros. Essa verificação não cobre configurações externas de Auth/SMTP.
- A revisão visual identificou reutilização do servidor de desenvolvimento pelo Playwright; a configuração de produção foi separada antes da validação final.
- A primeira execução contra o servidor reutilizado aprovou 16 cenários e falhou nas duas verificações do cabeçalho de cache do Networks, pois `next dev` retorna um cabeçalho diferente. Ambas passaram no servidor de produção isolado. A falha isolada de login da execução final também está registrada acima; sua causa não foi determinada.
- A fase não introduz seguidores, chat, notificações, bloqueio social, recomendações, ranking, reputação ou Marketplace.
- O banco é a autoridade final. Outra aba ou outro usuário verá mudanças ao navegar/reabrir a página; não há sincronização em tempo real.
- Aplicar a migration antes de usar esta versão da aplicação em outro ambiente.

## Contas para teste manual — 28/09/2026

A pedido do titular, duas contas fictícias permanecem no Supabase para exploração manual:

| Estudante | RA de login | Username |
| --- | --- | --- |
| Ana Conexões (teste) | `TESTE4001` | `teste_ana_conexoes` |
| Bruno Conexões (teste) | `TESTE4002` | `teste_bruno_conexoes` |

As senhas e os IDs de manutenção estão em `.env.contas-teste.json`, na raiz local do projeto, ignorado pelo Git. As contas possuem vínculo ativo e acesso de estudante, sem privilégios administrativos. Seus perfis estão identificados como fictícios e começam sem conexão entre si.

Essas contas não pertencem aos fixtures E2E e não são removidas pela limpeza automática. Continuam disponíveis até uma solicitação explícita de remoção. A auditoria de limpeza registrada acima descreve o estado anterior à criação dessas contas manuais.

Para testar, abra `/auth/login` em dois perfis de navegador ou em uma janela normal e outra anônima. Entre com um RA em cada sessão, encontre o outro estudante no Networks e envie uma solicitação. Na outra sessão, abra Conexões para aceitar ou recusar. Depois, teste cancelamento e remoção. As páginas precisam ser reabertas para receber alterações feitas pela outra sessão; não há tempo real.

## Registro para o TCC

## Contas para teste manual — 28/09/2026

A pedido do titular, duas contas fictícias permanecem no Supabase para exploração manual:

| Estudante | RA de login | Username |
| --- | --- | --- |
| Ana Conexões (teste) | `TESTE4001` | `teste_ana_conexoes` |
| Bruno Conexões (teste) | `TESTE4002` | `teste_bruno_conexoes` |

As senhas e os IDs de manutenção estão em `.env.contas-teste.json`, na raiz local do projeto, ignorado pelo Git. As contas possuem vínculo ativo e acesso de estudante, sem privilégios administrativos. Seus perfis estão identificados como fictícios e começam sem conexão entre si.

Essas contas não pertencem aos fixtures E2E e não são removidas pela limpeza automática. Continuam disponíveis até uma solicitação explícita de remoção. A auditoria de limpeza registrada acima descreve o estado anterior à criação dessas contas manuais.

Para testar, abra `/auth/login` em dois perfis de navegador ou em uma janela normal e outra anônima. Entre com um RA em cada sessão, encontre o outro estudante no Networks e envie uma solicitação. Na outra sessão, abra Conexões para aceitar ou recusar. Depois, teste cancelamento e remoção. As páginas precisam ser reabertas para receber alterações feitas pela outra sessão; não há tempo real.

## Registro para o TCC

A descoberta no Networks conduz a uma solicitação. O destinatário decide aceitá-la e estabelece uma relação persistente visível a ambos. O vínculo institucional ativo delimita quem pode participar e quais relações aparecem na comunidade. A quantidade de conexões não representa confiança, competência ou reputação. A integração futura com Marketplace poderá consultar o estado da relação entre estudantes.
