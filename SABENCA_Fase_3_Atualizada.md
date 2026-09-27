# SABENÇA — Fase 3: Catálogo institucional, importação e Networks

## 1. Objetivo da etapa

A Fase 3 deverá consolidar duas bases necessárias antes de expandir a descoberta de estudantes:

1. melhorar a administração dos dados institucionais;
2. implementar o módulo **Networks**.

Esta fase passa a ser dividida em duas partes:

```text
Fase 3A
Administração institucional
├── Catálogo de cursos
├── Modelo oficial de planilha
└── Validação da importação

Fase 3B
Networks
├── Busca de estudantes
├── Filtros
├── Cards
├── Paginação
└── Acesso ao perfil
```

A implementação deve preservar tudo que já existe nas fases anteriores.

---

# 2. Motivo das alterações

O SABENÇA não deve depender de alterações no código sempre que a instituição:

- criar um novo curso;
- descontinuar um curso;
- alterar o nome de um curso;
- precisar importar uma nova turma de alunos.

Da mesma forma, o administrador não deve precisar descobrir sozinho o formato correto da planilha de importação.

Por isso, a instituição deve controlar seu próprio catálogo de cursos e a página de importação deve oferecer um modelo `.xlsx` oficial.

---

# 3. Princípio institucional

Dados acadêmicos devem permanecer sob controle da instituição.

Exemplos:

```text
Nome institucional
Curso
Semestre
Instituição
Vínculo ativo
```

Informações sociais continuam sob controle do estudante:

```text
Username
Bio
Avatar
Habilidades
Interesses
Projetos
```

Não apresentar habilidades, interesses ou projetos como informações verificadas pela instituição.

---

# 4. Estado atual que deve ser preservado

O projeto já possui:

- autenticação institucional;
- login por RA;
- primeiro acesso;
- recuperação de senha;
- administração;
- importação `.xlsx`;
- prévia da importação;
- histórico de lotes;
- bloqueio/restauração;
- RLS;
- Perfil acadêmico/social;
- habilidades;
- interesses;
- projetos;
- avatar privado;
- `/users/[username]`;
- testes automatizados;
- GitHub Actions;
- Supabase conectado.

Não recriar essas estruturas.

Não editar migrations antigas.

---

# PARTE A — ADMINISTRAÇÃO INSTITUCIONAL

# 5. Catálogo institucional de cursos

Criar um catálogo de cursos administrado pela instituição.

A aplicação não deve utilizar uma lista hardcoded de cursos.

A instituição deve poder cadastrar novos cursos sem:

- alterar código;
- executar migration manual;
- editar arquivos;
- solicitar intervenção do desenvolvedor.

---

# 6. Estrutura de cursos

Criar uma tabela própria para cursos.

Sugestão conceitual:

```text
courses
────────────────────
id
institution_id
name
normalized_name
status
created_at
updated_at
```

Campos principais:

### `id`

UUID.

### `institution_id`

Identifica a instituição à qual o curso pertence.

Inicialmente:

```text
fatece
```

A estrutura deve continuar preparada para múltiplas instituições futuramente, sem implementar multi-tenant completo nesta fase.

### `name`

Nome exibido.

Exemplo:

```text
Ciência da Computação
Administração
Pedagogia
Engenharia de Software
```

### `normalized_name`

Utilizado para evitar duplicidades equivalentes.

Exemplo:

```text
Ciência da Computação
ciência da computação
 CIÊNCIA DA COMPUTAÇÃO
```

devem representar o mesmo curso.

### `status`

Valores:

```text
active
inactive
```

Não excluir fisicamente um curso já utilizado por alunos.

---

# 7. Área administrativa de cursos

Criar:

```text
/admin/cursos
```

A página deverá permitir:

- visualizar cursos;
- cadastrar curso;
- editar nome;
- ativar curso;
- inativar curso.

Exemplo:

```text
Cursos da instituição

[ + Novo curso ]

Ciência da Computação      Ativo      [Editar]
Administração              Ativo      [Editar]
Pedagogia                  Ativo      [Editar]
Curso antigo               Inativo    [Editar]
```

---

# 8. Exclusão de cursos

Não permitir exclusão definitiva de curso associado a alunos.

Nestes casos utilizar:

```text
Inativar
```

Um curso inativo:

- permanece em registros históricos;
- continua identificando alunos antigos;
- não pode ser selecionado para novas importações;
- não precisa aparecer nos filtros padrão de novos cadastros.

---

# 9. Segurança do catálogo

Somente administradores autorizados devem alterar cursos.

Membros comuns podem consultar os cursos ativos quando necessário ao funcionamento do Networks.

Não conceder escrita direta no catálogo pelo navegador.

Preferir Server Actions ou serviço server-side com verificação administrativa.

---

# 10. Relação aluno → curso

## 10.1 Mudança da lógica de curso

O curso não deve depender de texto digitado livremente em cada aluno.

O ideal é que o aluno seja relacionado a um curso cadastrado pela instituição.

Modelo conceitual:

```text
institution_students
        │
        └── course_id
                │
                ▼
             courses
```

O Perfil também deve obter o curso a partir dessa referência institucional.

Objetivo:

```text
Ciência da Computação
```

não deve coexistir com erros como:

```text
Ciencia da Computacao
Ciências da Computação
C. da Computação
CC
```

---

# 11. Migração dos dados atuais

A implementação deverá analisar os cursos já existentes antes de alterar o schema.

Criar migration nova.

Nunca modificar migration antiga.

Estratégia recomendada:

```text
1. localizar valores distintos de curso existentes;
2. normalizá-los;
3. criar entradas correspondentes no catálogo;
4. associar alunos existentes;
5. associar perfis existentes;
6. validar os resultados;
7. somente então tornar o novo relacionamento obrigatório quando aplicável.
```

A migration não deve excluir ou fundir dados silenciosamente em caso de conflito inesperado.

Se houver ambiguidade, abortar e exigir revisão.

---

# 12. Alteração de nome do curso

Se o administrador alterar:

```text
Ciência da Computação
```

para:

```text
Bacharelado em Ciência da Computação
```

os alunos associados devem refletir automaticamente o novo nome.

Não copiar novamente o texto do curso para centenas de perfis.

Esse é um dos motivos para utilizar uma referência ao catálogo.

---

# 13. Networks e catálogo de cursos

O filtro de curso em Networks deve utilizar o catálogo institucional.

Não derivar a lista a partir de strings soltas dos perfis.

Exemplo:

```text
Todos os cursos
Ciência da Computação
Administração
Pedagogia
Engenharia de Software
```

Por padrão, mostrar cursos ativos.

---

# 14. Modelo oficial de planilha Excel

A página de importação de alunos deve disponibilizar um modelo oficial.

Adicionar botão:

```text
[ Baixar modelo de planilha ]
```

O administrador deverá poder:

```text
baixar
↓
preencher
↓
enviar
↓
analisar
↓
confirmar
```

sem precisar montar manualmente a estrutura.

---

# 15. Formato do modelo

O modelo deverá utilizar `.xlsx`.

Cabeçalhos:

```text
ra
nome
email
telefone
data_nascimento
cpf
curso
semestre
```

Manter compatibilidade com o importador atual.

---

# 16. Formatação do modelo

O arquivo deve ser preparado para reduzir erros humanos.

### RA

Formatar como texto.

Objetivo:

```text
001234
```

não virar:

```text
1234
```

### CPF

Formatar como texto.

### Data de nascimento

Formato visual:

```text
DD/MM/AAAA
```

### Semestre

Campo numérico.

### Curso

Campo textual que deverá corresponder a um curso cadastrado na instituição.

---

# 17. Aparência do modelo

O modelo pode conter:

- cabeçalhos destacados;
- primeira linha congelada;
- largura das colunas ajustada;
- autofiltro nos cabeçalhos;
- comentários ou notas de preenchimento nas células de cabeçalho.

Não adicionar alunos fictícios preenchidos como exemplo.

A planilha deve vir sem registros.

Isso evita importações acidentais de linhas de demonstração.

---

# 18. Geração do modelo

Preferir gerar o arquivo através da própria aplicação.

O projeto já utiliza ExcelJS.

Não adicionar nova biblioteca apenas para criar o modelo.

Possível rota:

```text
/admin/alunos/modelo
```

ou Route Handler equivalente.

Ao acessar, devolver:

```text
modelo-importacao-alunos-sabenca.xlsx
```

---

# 19. Não criar segunda aba preenchida

O importador atual trabalha com uma única aba preenchida.

Não adicionar uma segunda planilha contendo:

```text
Cursos
Instruções
Exemplos
```

sem antes adaptar o parser.

Nesta fase, manter o arquivo simples e compatível.

Instruções devem aparecer:

- na página;
- nos comentários de cabeçalho;
- ou na documentação.

---

# 20. Página de importação atualizada

A página pode seguir o fluxo:

```text
Importar alunos

Use o modelo oficial para evitar erros de formatação.

[ Baixar modelo .xlsx ]

Campos obrigatórios:
RA · Nome · E-mail · Telefone · Data de nascimento · CPF

Campos acadêmicos:
Curso · Semestre

[ Selecionar arquivo ]

[ Analisar planilha ]
```

---

# 21. Validação de curso na importação

Ao importar um aluno com:

```text
curso = Ciência da Computação
```

o sistema deve procurar o curso no catálogo da instituição.

Utilizar comparação normalizada.

Exemplo:

```text
 ciência da computação
```

pode ser associado corretamente a:

```text
Ciência da Computação
```

desde que a normalização determine equivalência segura.

---

# 22. Curso inexistente

Se a planilha possuir:

```text
Engenharia Mecatrônica
```

e o curso não estiver cadastrado, não criar automaticamente.

A linha deve ser marcada como inválida:

```text
Curso "Engenharia Mecatrônica" não está cadastrado na instituição.
Cadastre o curso antes de importar este aluno.
```

Motivo:

Curso é dado institucional.

Não deve ser criado automaticamente a partir de uma planilha potencialmente preenchida com erro.

---

# 23. Curso inativo

Não associar novos alunos a cursos inativos.

Erro sugerido:

```text
O curso informado está inativo.
```

Registros antigos continuam preservados.

---

# 24. Curso opcional

Se o projeto decidir manter `curso` como campo opcional na importação durante o MVP:

- célula vazia pode ser aceita;
- valor preenchido deve obrigatoriamente existir no catálogo.

Documentar essa regra.

---

# 25. Semestre

Continuar aceitando semestre como número.

Não há necessidade de criar uma tabela de semestres.

Validação:

```text
inteiro
>= 1
<= limite atualmente adotado no projeto
```

---

# 26. Prévia da importação

A prévia deve continuar sem gravar dados.

Adicionar validação de curso aos erros apresentados.

Exemplo:

```text
Linha 7
RA: 12345
Nome: João Silva
Curso: Engenharia Mecatrônica

Erro:
Curso não cadastrado.
```

---

# 27. Correção de erros

A prévia deve continuar permitindo que:

- linhas válidas sejam identificadas;
- linhas inválidas sejam apresentadas claramente;
- administrador corrija o arquivo e faça nova análise.

Não tentar corrigir silenciosamente dados institucionais.

---

# 28. Sugestão adicional — relatório de erros

Se a implementação for simples, adicionar:

```text
[ Baixar relatório de erros ]
```

após uma prévia com linhas inválidas.

Pode ser `.csv` ou `.xlsx`.

Campos mínimos:

```text
linha
ra
nome
erro
```

Esta funcionalidade é recomendada, mas pode ser adiada caso aumente excessivamente o escopo.

Não bloquear a conclusão da Fase 3 por ela.

---

# 29. Histórico de importação

Preservar o histórico existente.

Não armazenar o arquivo original.

Continuar registrando apenas informações necessárias sobre o lote.

---

# 30. Testes do modelo Excel

Adicionar testes para garantir:

- arquivo é `.xlsx` válido;
- possui os cabeçalhos corretos;
- utiliza apenas uma aba preenchida;
- RA está formatado como texto;
- CPF está formatado como texto;
- data possui formatação esperada;
- arquivo gerado pode ser lido pelo próprio importador.

O teste mais importante:

```text
gerar modelo
↓
preencher dados válidos em memória
↓
passar pelo parser atual
↓
importação ser reconhecida corretamente
```

---

# 31. Testes do catálogo de cursos

Cobrir:

- admin cria curso;
- membro comum não cria;
- duplicidade normalizada é rejeitada;
- curso pode ser renomeado;
- curso pode ser inativado;
- curso inativo não é aceito em nova importação;
- curso associado não pode ser removido de forma destrutiva;
- alunos existentes preservam a referência;
- alteração do nome aparece nos locais que consultam o catálogo.

---

# PARTE B — NETWORKS

# 32. Objetivo do Networks

Networks será a área de descoberta de pessoas.

O objetivo é ajudar estudantes a localizar outros membros com base em:

- curso;
- semestre;
- habilidades;
- interesses;
- nome;
- username.

Networks prioriza:

```text
descoberta
afinidade
colaboração
```

e não:

```text
seguidores
curtidas
popularidade
influência
ranking
```

---

# 33. Rota

Substituir o placeholder:

```text
/networks
```

por uma implementação funcional.

Somente membros ativos poderão acessar.

---

# 34. Página principal

Estrutura sugerida:

```text
Networks

Encontre pessoas, habilidades e interesses dentro da sua comunidade.

[ Buscar por nome, username ou habilidade ]

Curso          Habilidade        Interesse        Semestre
[Todos ▼]      [Todos ▼]         [Todos ▼]        [Todos ▼]

24 estudantes encontrados

[Card] [Card] [Card]
[Card] [Card] [Card]
```

---

# 35. Busca geral

Pesquisar por:

- nome;
- username;
- habilidade.

Exemplo:

```text
React
```

deve poder encontrar pessoas com React nas habilidades.

---

# 36. Filtro por curso

O filtro deve usar `courses`.

Não manter cursos hardcoded.

Não derivar o catálogo apenas dos perfis existentes.

Exemplo:

```text
Todos os cursos
Ciência da Computação
Administração
Pedagogia
Engenharia de Software
```

Por padrão, utilizar cursos ativos.

---

# 37. Filtro por semestre

Exemplo:

```text
Todos
1º semestre
2º semestre
...
```

---

# 38. Filtro por habilidade

Utilizar o catálogo existente:

```text
skills
```

---

# 39. Filtro por interesse

Utilizar:

```text
interests
```

---

# 40. Combinação de filtros

Utilizar interseção.

Exemplo:

```text
Curso: Ciência da Computação
Habilidade: React
Interesse: Jogos
```

significa:

```text
curso
AND habilidade
AND interesse
```

---

# 41. Estado na URL

Preferir `searchParams`.

Exemplo:

```text
/networks?q=react&course=<uuid>&skill=<uuid>&page=1
```

Utilizar IDs em filtros estruturados quando apropriado.

Não colocar dados sensíveis na URL.

---

# 42. Perfil descobrível

Para aparecer em Networks, o perfil deve possuir:

```text
username != null
```

Isso garante que exista:

```text
/users/[username]
```

Perfis incompletos sem username não aparecem.

---

# 43. Usuário atual

Não mostrar o próprio usuário nos resultados.

Networks existe para descobrir outras pessoas.

---

# 44. Card

Exemplo:

```text
Samuel Sampaio Lins
@samuel

Ciência da Computação
8º semestre · FATECE

React · Python · Redes
Jogos · Desenvolvimento Web

[ Ver perfil ]
```

---

# 45. Dados acadêmicos no card

Curso, semestre e instituição podem receber indicação discreta de origem institucional.

Exemplo:

```text
Dados acadêmicos
Ciência da Computação · 8º semestre
```

Não utilizar:

```text
especialista verificado
habilidade verificada
profissional certificado
```

O vínculo acadêmico não comprova automaticamente competência.

---

# 46. Habilidades e interesses no card

Mostrar poucos itens.

Sugestão:

```text
3 habilidades
2 ou 3 interesses
```

Exemplo:

```text
React · Python · Docker · +4
```

---

# 47. Paginação

Não carregar todos os estudantes.

Sugestão:

```text
24 por página
```

Utilizar:

```text
Anterior
Próxima
```

ou paginação numerada simples.

Não implementar infinite scroll.

---

# 48. Ordenação

Não utilizar ranking social.

Preferência:

```text
nome em ordem alfabética
```

Não ordenar por:

- conexões;
- quantidade de habilidades;
- projetos;
- seguidores;
- curtidas;
- visualizações.

---

# 49. Arquitetura da consulta

Não adicionar motores externos de busca.

PostgreSQL/Supabase é suficiente para o MVP.

Evitar N+1.

Preferir consultas em lote.

---

# 50. Service layer

Criar:

```text
src/services/networks.ts
```

Responsabilidades:

- validar filtros;
- consultar perfis;
- aplicar paginação;
- montar DTOs;
- carregar labels;
- gerar signed URLs de avatar;
- evitar campos privados.

---

# 51. Tipos

Criar:

```text
src/types/networks.ts
```

DTO público interno da comunidade deve conter apenas dados necessários.

Nunca incluir:

```text
email
telefone
data de nascimento
cpf
cpf_fingerprint
auth_user_id
```

---

# 52. Validação

Criar:

```text
src/lib/validations/networks.ts
```

Validar:

- busca;
- curso;
- semestre;
- habilidade;
- interesse;
- página.

Não confiar diretamente em `searchParams`.

---

# 53. Componentes sugeridos

```text
src/components/networks/network-search.tsx
src/components/networks/network-filters.tsx
src/components/networks/student-card.tsx
src/components/networks/network-results.tsx
src/components/networks/pagination.tsx
```

Criar apenas os componentes realmente necessários.

---

# 54. Segurança

Garantir:

- somente membros ativos acessam;
- bloqueados não acessam;
- administrador sem vínculo estudantil não recebe acesso social automaticamente;
- RLS permanece ativa;
- nenhuma chave privada vai ao cliente;
- buckets continuam privados;
- não utilizar `SELECT *`.

---

# 55. Privacidade

Networks é um diretório interno.

Manter:

```text
noindex
nofollow
private
no-store
```

Não criar perfis indexáveis publicamente.

---

# 56. Responsividade

Desktop:

```text
3 cards
```

Tablet:

```text
2 cards
```

Mobile:

```text
1 card
filtros empilhados
sem rolagem horizontal
```

---

# 57. Testes Networks

Cobrir:

- acesso de membro ativo;
- bloqueio;
- busca por nome;
- busca por username;
- busca por habilidade;
- curso;
- semestre;
- skill;
- interesse;
- combinação;
- paginação;
- exclusão do próprio usuário;
- perfil sem username;
- ausência de dados sensíveis.

---

# 58. E2E

Fluxo:

```text
login
↓
Networks
↓
buscar
↓
filtrar curso
↓
filtrar habilidade
↓
abrir perfil
↓
voltar
↓
validar mobile
```

Usar apenas usuários fictícios de teste.

---

# 59. GitHub Actions

Executar:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Confirmar também GitHub Actions verde após push.

---

# 60. Documentação

Criar/atualizar:

```text
markdown/NETWORKS_IMPLEMENTACAO.md
markdown/DESENVOLVIMENTO.md
README.md
```

Registrar também:

- catálogo de cursos;
- modelo Excel;
- validação institucional;
- decisões de segurança;
- dificuldades;
- testes.

---

# 61. Ordem de implementação

Executar preferencialmente nesta sequência:

## Etapa 3.1

Catálogo de cursos:

```text
courses
/admin/cursos
criação
edição
ativação/inativação
```

## Etapa 3.2

Migração da referência de curso:

```text
alunos
perfis
curso
```

## Etapa 3.3

Modelo oficial Excel:

```text
download
formatação
teste de compatibilidade
```

## Etapa 3.4

Importação + catálogo:

```text
resolver curso
validar curso
erros de prévia
```

## Etapa 3.5

Networks:

```text
consulta
busca
filtros
cards
paginação
```

## Etapa 3.6

Testes integrados, E2E, CI e documentação.

---

# 62. Fora do escopo

Não implementar nesta fase:

- conexões;
- seguidores;
- chat;
- mensagens;
- feed;
- curtidas;
- comentários;
- avaliações;
- ranking;
- recomendação automática;
- IA;
- matching;
- Marketplace funcional;
- vagas;
- empresas;
- eventos;
- localização em tempo real.

---

# 63. Critérios de conclusão — Administração

- [ ] existir catálogo de cursos;
- [ ] administrador cadastrar curso sem alterar código;
- [ ] administrador editar curso;
- [ ] administrador ativar/inativar curso;
- [ ] duplicidades equivalentes serem impedidas;
- [ ] alunos estarem associados ao catálogo;
- [ ] renomear curso refletir nos usuários associados;
- [ ] curso inativo não aceitar novos alunos;
- [ ] página de importação possuir botão de modelo;
- [ ] modelo `.xlsx` ser gerado corretamente;
- [ ] RA estar preparado como texto;
- [ ] CPF estar preparado como texto;
- [ ] data possuir formato adequado;
- [ ] planilha não conter aluno fictício;
- [ ] importação validar o curso;
- [ ] curso inexistente gerar erro claro;
- [ ] curso não ser criado automaticamente pela planilha.

---

# 64. Critérios de conclusão — Networks

- [ ] `/networks` funcional;
- [ ] somente membros ativos acessarem;
- [ ] próprio usuário não aparecer;
- [ ] perfis sem username não aparecerem;
- [ ] busca por nome funcionar;
- [ ] busca por username funcionar;
- [ ] busca por habilidade funcionar;
- [ ] filtro por curso usar o catálogo institucional;
- [ ] filtro por semestre funcionar;
- [ ] filtro por habilidade funcionar;
- [ ] filtro por interesse funcionar;
- [ ] filtros combinados funcionarem;
- [ ] paginação funcionar;
- [ ] cards responsivos;
- [ ] avatar privado funcionar;
- [ ] dados institucionais e sociais permanecerem distintos;
- [ ] perfil abrir em `/users/[username]`;
- [ ] nenhum dado sensível ser retornado;
- [ ] testes passarem;
- [ ] build passar;
- [ ] E2E passar;
- [ ] GitHub Actions passar;
- [ ] documentação estar atualizada.

---

# 65. Resultado esperado

A administração deverá poder realizar:

```text
Novo curso criado pela FATECE
↓
Admin acessa /admin/cursos
↓
Cadastra "Engenharia de Software"
↓
curso já está disponível ao sistema
↓
nenhuma alteração de código
```

Para importação:

```text
Admin acessa Importar alunos
↓
Baixa modelo
↓
Preenche alunos
↓
Envia
↓
Sistema valida dados e cursos
↓
Admin confirma
```

Para Networks:

```text
Aluno acessa Networks
↓
Pesquisa "React"
↓
Filtra Ciência da Computação
↓
Encontra estudantes relevantes
↓
Abre /users/[username]
```

---

# 66. Direção final

O SABENÇA deve reduzir dependência do desenvolvedor para tarefas administrativas rotineiras.

Cadastrar um novo curso ou importar uma nova turma deve ser uma operação da instituição, não uma alteração de software.

Ao mesmo tempo, Networks deve utilizar esses dados institucionais de maneira estruturada para facilitar a descoberta de pessoas dentro da comunidade acadêmica.

Esse conjunto fortalece os três pilares do projeto:

```text
Perfil
Networks
Marketplace
```

e prepara a próxima etapa:

```text
Fase 4 — Conexões
```
