# SABENÇA — Fase 4: Conexões entre estudantes

## 1. Objetivo da fase

Implementar o módulo **Conexões** do SABENÇA.

A Fase 4 deve transformar a descoberta feita no Networks em uma relação persistente entre estudantes.

Fluxo principal:

```text
Networks
   ↓
Encontrar estudante
   ↓
Perfil
   ↓
Enviar solicitação
   ↓
Outro estudante aceita
   ↓
Conexão estabelecida
```

O módulo deve permanecer voltado a:

- descoberta;
- colaboração;
- relacionamento acadêmico/social;
- integração futura com Marketplace.

Não transformar Conexões em sistema de seguidores ou popularidade.

---

## 2. Estado atual do projeto

Antes desta fase, o SABENÇA já possui:

```text
Fase 1
Acesso institucional
✅

Fase 2
Perfil acadêmico/social
✅

Fase 3A
Catálogo institucional e importação
✅

Fase 3B
Networks
✅
```

Já existem:

- perfis;
- username;
- avatar privado;
- habilidades;
- interesses;
- projetos;
- catálogo de cursos;
- Networks;
- busca;
- filtros;
- paginação;
- RLS;
- identificação de estudantes ativos;
- tabela `public.connections`.

Não recriar essas estruturas.

---

## 3. Estrutura existente de connections

A migration inicial já criou:

```text
public.connections
────────────────────────
id
requester_id
receiver_id
status
created_at
updated_at
```

Relacionamentos:

```text
requester_id → profiles.id
receiver_id  → profiles.id
```

Estados atuais no schema:

```text
pending
accepted
rejected
```

Também já existe:

```text
requester_id != receiver_id
```

e um índice único baseado em:

```text
least(requester_id, receiver_id)
greatest(requester_id, receiver_id)
```

Isso impede que existam simultaneamente:

```text
A → B
B → A
```

como duas relações diferentes.

Preservar esse princípio.

---

## 4. Problema do estado rejected atual

O par de estudantes é único independentemente da direção.

Portanto, se for persistido:

```text
A → B
status = rejected
```

o mesmo registro continua ocupando o par:

```text
A ↔ B
```

e impede uma nova solicitação futura.

Para o MVP, não é necessário manter rejeições permanentemente.

### Decisão recomendada

Persistir somente:

```text
pending
accepted
```

Quando uma solicitação for recusada:

```text
DELETE da solicitação pending
```

Isso significa:

```text
Recusar
≠
Bloquear permanentemente
```

Bloqueio entre usuários não faz parte desta fase.

---

## 5. Migration da Fase 4

Criar uma migration nova.

Exemplo:

```text
supabase/migrations/<timestamp>_connections_phase.sql
```

Nunca alterar migrations anteriores.

A migration deve:

1. verificar se existem registros `rejected`;
2. abortar caso existam, exigindo revisão manual;
3. somente depois restringir os estados válidos a `pending` e `accepted`;
4. revisar as policies de `public.connections`;
5. preservar registros `pending` e `accepted`;
6. preservar IDs e timestamps existentes;
7. não excluir conexões silenciosamente.

---

## 6. Regras de negócio

### 6.1 Enviar solicitação

Um estudante pode solicitar conexão com outro estudante quando:

- ambos possuem perfil;
- ambos possuem vínculo institucional ativo;
- são estudantes diferentes;
- ainda não existe uma relação entre o par.

Resultado:

```text
status = pending
```

O autor da solicitação será:

```text
requester_id
```

O destinatário será:

```text
receiver_id
```

### 6.2 Não permitir conexão consigo mesmo

Bloquear em:

```text
validação da aplicação
+
constraint existente no banco
```

Não depender somente do frontend.

---

## 7. Aceitar solicitação

Somente o destinatário poderá aceitar.

Transição permitida:

```text
pending
    ↓
accepted
```

Não permitir:

```text
requester aceitar a própria solicitação
```

Não permitir:

```text
accepted → pending
```

---

## 8. Recusar solicitação

Somente o destinatário poderá recusar.

Comportamento recomendado:

```text
pending
    ↓
DELETE
```

Não persistir rejeição no MVP.

Após isso, nenhuma conexão existirá entre o par.

Uma nova solicitação poderá ocorrer futuramente.

---

## 9. Cancelar solicitação enviada

O remetente pode cancelar uma solicitação enquanto ela estiver:

```text
pending
```

Comportamento:

```text
DELETE
```

---

## 10. Remover conexão

Após:

```text
status = accepted
```

qualquer um dos dois participantes poderá remover a conexão.

Comportamento:

```text
DELETE
```

Não utilizar:

```text
accepted → rejected
```

---

## 11. Estados visuais

### Nenhuma relação

```text
[ Conectar ]
```

### Solicitação enviada

```text
Solicitação enviada
[ Cancelar ]
```

### Solicitação recebida

```text
[ Aceitar ]
[ Recusar ]
```

### Conectados

```text
✓ Conectado
```

Na página de Conexões também poderá existir:

```text
[ Remover conexão ]
```

---

## 12. Segurança e estudantes ativos

A Fase 3 criou:

```text
private.is_active_student(...)
```

Reutilizar esse mecanismo.

Uma solicitação só pode envolver estudantes ativos.

Impedir solicitação para:

- aluno bloqueado;
- aluno inativo;
- conta banida;
- conta não confirmada;
- perfil pertencente a outro contexto institucional.

Não confiar apenas no fato de que o perfil deixou de aparecer no Networks.

Um usuário poderia tentar enviar manualmente o UUID antigo de um perfil.

A proteção deve existir no banco.

---

## 13. Revisão de RLS

Recriar as policies de `public.connections` em uma migration nova.

### SELECT

Usuário pode consultar somente conexões das quais participa.

Além disso, as relações apresentadas pela área social devem envolver estudantes ativos.

### INSERT

Somente:

```text
requester = perfil do usuário autenticado
```

e:

```text
receiver = outro perfil ativo
```

Status obrigatório:

```text
pending
```

### UPDATE

Somente o destinatário de uma solicitação pendente poderá fazer:

```text
pending → accepted
```

Nenhuma outra alteração de status deve ser permitida.

`requester_id` e `receiver_id` continuam imutáveis.

### DELETE

Permitir:

```text
requester cancelar pending

receiver recusar pending

qualquer participante remover accepted
```

Sempre exigir vínculo ativo do usuário que executa a operação.

---

## 14. Não confiar apenas nas Server Actions

A proteção deve continuar seguindo o padrão do SABENÇA:

```text
Interface
    ↓
Server Action
    ↓
Service
    ↓
Sessão
    ↓
RLS / constraints
```

Uma requisição manual não pode ultrapassar as mesmas regras.

---

## 15. Service layer

Criar:

```text
src/services/connections.ts
```

Responsabilidades:

- consultar conexões;
- consultar solicitações recebidas;
- consultar solicitações enviadas;
- obter estado entre dois perfis;
- criar solicitação;
- aceitar;
- cancelar;
- recusar;
- remover;
- construir DTOs;
- assinar avatares em lote.

Evitar colocar SQL diretamente nos componentes.

---

## 16. Operações sugeridas

```text
getConnections()
getConnectionState(targetProfileId)

sendConnectionRequest(targetProfileId)
acceptConnectionRequest(connectionId)
rejectConnectionRequest(connectionId)
cancelConnectionRequest(connectionId)
removeConnection(connectionId)
```

Os nomes podem ser ajustados ao padrão atual do projeto.

---

## 17. Identificadores enviados pelo cliente

O cliente pode enviar:

```text
target_profile_id
connection_id
```

Todos devem ser validados com UUID.

Nunca aceitar do formulário:

```text
requester_id
receiver_id
user_id
status arbitrário
```

O requester deve ser derivado da sessão.

---

## 18. DTO de conexão

Criar:

```text
src/types/connections.ts
```

Exemplo:

```ts
type ConnectionPerson = {
  profile_id: string
  username: string
  name: string
  course: string | null
  semester: number | null
  institution: string
  avatar_url: string | null
}

type ConnectionItem = {
  id: string
  direction: "incoming" | "outgoing" | "accepted"
  person: ConnectionPerson
  created_at: string
}
```

Não retornar:

```text
RA
e-mail
telefone
nascimento
CPF
cpf_fingerprint
auth_user_id
user_id
```

---

## 19. Página /connections

Substituir o placeholder atual:

```text
/connections
```

por página funcional.

Estrutura recomendada:

```text
Conexões

Gerencie seus contatos dentro da comunidade.

Solicitações recebidas (2)
──────────────────────────
[ Pessoa ]
[ Aceitar ] [ Recusar ]

Solicitações enviadas (1)
─────────────────────────
[ Pessoa ]
Solicitação enviada
[ Cancelar ]

Minhas conexões
───────────────
[ Pessoa ]
[ Ver perfil ]
[ Remover conexão ]
```

Os números dessas seções são informações privadas do próprio usuário.

Não exibir contagem pública de conexões nos perfis.

---

## 20. Cards de conexão

Reutilizar a identidade visual do Networks.

Mostrar:

- avatar;
- nome;
- username;
- curso;
- semestre;
- instituição;
- ação correspondente.

Não é necessário repetir habilidades e interesses completos.

---

## 21. Integração com Networks

Adicionar estado da conexão ao card do Networks.

Exemplo:

```text
João Oliveira

React · TypeScript · Node

[ Ver perfil ] [ Conectar ]
```

Após envio:

```text
[ Ver perfil ]

Solicitação enviada
```

Se houver solicitação recebida:

```text
[ Ver perfil ]

[ Aceitar ] [ Recusar ]
```

Se já estiver conectado:

```text
[ Ver perfil ]

✓ Conectado
```

---

## 22. Evitar N+1 no Networks

Não fazer:

```text
24 estudantes
↓
24 chamadas getConnectionState()
```

Adicionar o estado das conexões em lote.

Estratégia sugerida:

```text
IDs dos estudantes da página
        ↓
uma consulta às connections
        ↓
mapear estado por profile_id
        ↓
anotar os DTOs do Networks
```

ou integrar o estado à consulta principal se isso continuar legível.

---

## 23. Integração com perfil

Em:

```text
/users/[username]
```

adicionar ação de conexão.

Estados:

```text
Conectar
Solicitação enviada
Aceitar / Recusar
Conectado
```

Não mostrar o botão ao visualizar o próprio perfil.

---

## 24. Ação principal deve funcionar em dois lugares

O estudante poderá iniciar uma conexão por:

```text
Networks
```

ou:

```text
Perfil do estudante
```

Os dois locais devem utilizar a mesma regra de serviço.

Não duplicar lógica.

---

## 25. Concorrência

Considerar:

```text
A envia para B
e
B envia para A
quase simultaneamente
```

O índice único do par deve continuar sendo a última proteção.

Capturar:

```text
23505
```

e retornar mensagem segura:

```text
Já existe uma solicitação ou conexão com este estudante.
```

Não retornar erro SQL ao usuário.

---

## 26. Solicitação duplicada

Clique repetido em:

```text
Conectar
```

não pode criar duplicidades.

A operação deve ser segura diante de:

- double click;
- refresh;
- duas abas;
- corrida entre usuários.

O banco permanece a autoridade final.

---

## 27. Revalidação de páginas

Após alteração, revalidar pelo menos:

```text
/connections
/networks
/users/[username]
```

Não depender de refresh manual.

---

## 28. Avatares

Continuar usando bucket privado.

Na página `/connections`:

```text
coletar paths
↓
createSignedUrls em lote
↓
montar DTO
```

Não gerar chamada ao Storage por card.

---

## 29. Sem métricas de popularidade

Não adicionar:

```text
123 conexões
top conectado
popular
mais conectado
grau de influência
ranking
```

ao perfil público ou ao Networks.

---

## 30. Sem seguidores

Não implementar:

```text
seguir
seguidores
seguindo
```

Conexões são relações mútuas.

---

## 31. Sem mensagens nesta fase

Não criar:

```text
chat
DM
inbox
WebSocket
Supabase Realtime
```

---

## 32. Sem notificações em tempo real

Não implementar push ou realtime.

Ao abrir:

```text
/connections
```

o usuário verá as solicitações atuais.

Indicadores no menu podem ser estudados futuramente.

---

## 33. Sem bloqueio entre usuários

Não implementar bloqueio social nesta fase.

O bloqueio existente é institucional/administrativo e possui outra finalidade.

---

## 34. Ordenação

Solicitações recebidas:

```text
mais recentes primeiro
```

Solicitações enviadas:

```text
mais recentes primeiro
```

Conexões aceitas:

```text
nome em ordem alfabética
```

Não ordenar por popularidade.

---

## 35. Paginação

Para o MVP, pode-se iniciar sem paginação se houver limite razoável por seção.

Recomendação:

```text
até 50 por seção
```

Se necessário, adicionar paginação simples.

Não implementar infinite scroll.

---

## 36. Estados vazios

### Nenhuma solicitação

```text
Nenhuma solicitação recebida.
Quando alguém quiser se conectar, ela aparecerá aqui.
```

### Nenhuma conexão

```text
Você ainda não possui conexões.

Explore o Networks para encontrar estudantes.
[ Explorar Networks ]
```

---

## 37. Responsividade

Desktop:

```text
seções separadas
cards horizontais quando houver espaço
```

Mobile:

```text
cards empilhados
ações com área de toque adequada
sem rolagem horizontal
```

Testar especialmente:

```text
Aceitar + Recusar
```

em telas pequenas.

---

## 38. Acessibilidade

Garantir:

- botões reais;
- labels claros;
- estados não dependentes apenas de cor;
- foco visível;
- mensagens com `role="status"` ou `role="alert"` quando necessário;
- navegação por teclado.

---

## 39. Confirmação ao remover conexão

Remover conexão aceita é operação destrutiva.

Solicitar confirmação:

```text
Remover conexão com João?

[ Cancelar ]
[ Remover ]
```

---

## 40. Server Actions

Criar preferencialmente:

```text
src/app/(community)/connections/actions.ts
```

ou local compartilhado se Networks e Perfil precisarem das mesmas ações.

As ações devem:

1. executar `requireUser()`;
2. validar UUID;
3. chamar service;
4. mapear erros conhecidos;
5. nunca retornar detalhes SQL;
6. revalidar rotas necessárias.

---

## 41. Erros amigáveis

Exemplos:

```text
Não foi possível enviar a solicitação.

Esta solicitação não está mais disponível.

Já existe uma solicitação ou conexão com este estudante.

Este estudante não está disponível para novas conexões.

Não foi possível remover a conexão.
```

Não expor:

```text
constraint
policy
SQL
stack trace
```

---

## 42. Testes da migration

Testar:

- migration preserva pending;
- migration preserva accepted;
- migration aborta se houver rejected antigo;
- par único continua funcionando;
- self-connection continua impossível;
- endpoints permanecem imutáveis.

---

## 43. Testes de RLS

### INSERT

- membro ativo → membro ativo: permitido;
- para si mesmo: recusado;
- para bloqueado: recusado;
- para inativo: recusado;
- admin sem membership: recusado;
- requester forjado: recusado;
- status accepted no INSERT: recusado.

### UPDATE

- receiver aceita pending: permitido;
- requester tenta aceitar: recusado;
- terceiro tenta aceitar: recusado;
- accepted → pending: recusado;
- alteração de IDs: recusada.

### DELETE

- requester cancela pending: permitido;
- receiver recusa pending: permitido;
- terceiro tenta apagar: recusado;
- qualquer participante remove accepted: permitido.

---

## 44. Testes de service

Cobrir:

```text
sendConnectionRequest
acceptConnectionRequest
rejectConnectionRequest
cancelConnectionRequest
removeConnection
getConnections
getConnectionState
```

Também:

- UUID inválido;
- registro inexistente;
- duplicidade;
- reverse duplicate;
- corrida tratada;
- bloqueio posterior de participante;
- ausência de campos privados.

---

## 45. Testes do Networks

Após integração:

- nenhuma relação → Conectar;
- outgoing pending → Solicitação enviada;
- incoming pending → Aceitar/Recusar;
- accepted → Conectado;
- estados carregados em lote;
- nenhuma consulta por card;
- filtros continuam funcionando;
- paginação continua funcionando.

---

## 46. Testes do perfil

Em `/users/[username]`:

- botão Conectar;
- pending outgoing;
- pending incoming;
- accepted;
- próprio perfil sem ação;
- estudante bloqueado não acessível.

---

## 47. E2E principal

Criar dois usuários fictícios:

```text
Aluno A
Aluno B
```

Fluxo:

```text
A entra
↓
Networks
↓
encontra B
↓
Conectar
↓
Solicitação enviada

B entra
↓
Conexões
↓
vê solicitação de A
↓
Aceita

A entra
↓
Conexões
↓
B aparece em Minhas conexões
```

---

## 48. E2E de cancelamento

```text
A envia solicitação
↓
A cancela
↓
B não possui solicitação
```

---

## 49. E2E de recusa

```text
A envia solicitação
↓
B recusa
↓
registro deixa de existir
↓
A pode futuramente solicitar novamente
```

---

## 50. E2E de remoção

```text
A ↔ B conectados
↓
A remove
↓
relação desaparece para ambos
```

---

## 51. E2E mobile

Validar:

```text
Networks
Perfil
Connections
Aceitar/Recusar
Remover
```

em viewport mobile.

Sem rolagem horizontal.

---

## 52. Testes no Supabase real

Seguir a abordagem da Fase 3:

- dados fictícios temporários;
- ambiente autorizado;
- IDs conhecidos;
- cleanup explícito;
- nunca usar alunos reais em E2E.

Após os testes, auditar os fixtures.

---

## 53. GitHub Actions

Continuar exigindo:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

O commit final da fase deve possuir workflow verde.

Não afirmar que E2E autenticado remoto passou se ele tiver sido ignorado por falta de opt-in.

---

## 54. Documentação

Criar:

```text
markdown/CONEXOES_IMPLEMENTACAO.md
```

Atualizar:

```text
README.md
markdown/DESENVOLVIMENTO.md
```

Registrar:

- arquitetura;
- estados;
- decisão de rejeição;
- RLS;
- integrações;
- testes;
- dificuldades;
- limites.

---

## 55. Documentação para o TCC

Registrar tecnicamente:

```text
descoberta
↓
solicitação
↓
aceite mútuo
↓
relação persistente
```

Não apresentar quantidade de conexões como mecanismo de confiança ou reputação.

---

## 56. Commits recomendados

Evitar concentrar a Fase 4 inteira em um único commit.

Sugestão:

```text
feat(connections): harden connection state and RLS

feat(connections): add request and response services

feat(connections): add connections page

feat(connections): integrate network and profile actions

test(connections): cover RLS and connection workflows

test(connections): add browser flows

docs(connections): document phase 4
```

---

## 57. Ordem de implementação

### 4.1 Banco e RLS

- auditar `connections`;
- criar migration;
- resolver `rejected`;
- endurecer policies;
- testar diretamente no banco.

### 4.2 Service

- DTOs;
- consultas;
- ações de escrita;
- avatares em lote;
- concorrência.

### 4.3 Página Connections

- recebidas;
- enviadas;
- aceitas;
- estados vazios;
- responsividade.

### 4.4 Networks

- estado de conexão em lote;
- botão Conectar;
- Aceitar/Recusar;
- sem N+1.

### 4.5 Perfil

- ação de conexão;
- estados;
- não mostrar no próprio perfil.

### 4.6 Testes

- unitários;
- integração;
- RLS;
- E2E;
- mobile;
- Supabase autorizado.

### 4.7 Documentação e CI

- documentação;
- README;
- histórico;
- commits;
- GitHub Actions.

---

## 58. Fora do escopo

Não implementar agora:

- seguidores;
- feed;
- curtidas;
- comentários;
- chat;
- mensagens;
- notificações push;
- realtime;
- bloqueio social;
- recomendações automáticas;
- porcentagem de afinidade;
- ranking;
- conexão sugerida por IA;
- Marketplace;
- avaliações;
- reputação.

---

## 59. Critérios de conclusão

- [ ] `/connections` deixar de ser placeholder;
- [ ] migration nova preservar dados existentes;
- [ ] `rejected` possuir tratamento definido e seguro;
- [ ] RLS ser revisada;
- [ ] apenas estudantes ativos poderem se conectar;
- [ ] solicitação poder ser enviada;
- [ ] solicitação poder ser cancelada;
- [ ] solicitação recebida poder ser aceita;
- [ ] solicitação recebida poder ser recusada;
- [ ] conexão aceita poder ser removida;
- [ ] duplicidade A↔B ser impedida;
- [ ] conexão consigo mesmo ser impedida;
- [ ] race conditions serem tratadas;
- [ ] `/connections` mostrar recebidas;
- [ ] `/connections` mostrar enviadas;
- [ ] `/connections` mostrar aceitas;
- [ ] Networks mostrar estado da relação;
- [ ] Networks não criar N+1;
- [ ] perfil mostrar ação da conexão;
- [ ] avatares continuarem privados;
- [ ] DTOs não expuserem dados pessoais;
- [ ] bloqueados não aparecerem nas relações sociais;
- [ ] responsividade passar;
- [ ] lint passar;
- [ ] typecheck passar;
- [ ] testes passarem;
- [ ] build passar;
- [ ] E2E público passar;
- [ ] E2E autenticado ser validado em ambiente autorizado;
- [ ] GitHub Actions ficar verde;
- [ ] documentação ser atualizada.

---

## 60. Resultado esperado

```text
Samuel encontra João no Networks
↓
Samuel envia solicitação
↓
João recebe a solicitação
↓
João aceita
↓
Samuel e João tornam-se conexões
```

A relação poderá ser visualizada por ambos em:

```text
/connections
```

e o estado deverá aparecer também no:

```text
Networks
Perfil
```

sem transformar essa relação em ranking, seguidores ou popularidade.

---

## 61. Próxima fase

Após a conclusão:

```text
Perfil
✅

Networks
✅

Conexões
✅

Marketplace
← próxima fase
```

O Marketplace poderá utilizar uma base social mais completa:

```text
Anúncio
   ↓
Vendedor
   ↓
Perfil
   ↓
Vínculo acadêmico
   ↓
Habilidades / projetos
   ↓
Estado de conexão
```

Essa integração aproxima o projeto do objetivo central do SABENÇA: permitir que estudantes descubram pessoas, estabeleçam relações e negociem dentro de uma comunidade acadêmica contextualizada e controlada.
