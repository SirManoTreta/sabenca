# SABENÇA — Guia Inicial de Desenvolvimento

> Atualização: o modelo de acesso e o layout deste guia foram revisados em `SABENCA_Acesso_Institucional_Importacao_Layout.md`. A especificação mais recente prevalece. Configuração atual em `ACESSO_INSTITUCIONAL_IMPLEMENTACAO.md`.

## 1. Visão do projeto

O **SABENÇA** é uma plataforma digital universitária fechada criada para aproximar estudantes de uma mesma comunidade acadêmica.

A aplicação possui três pilares principais:

1. **Marketplace universitário**
2. **Networks**
3. **Perfil acadêmico/profissional**

O objetivo é permitir que estudantes descubram produtos, serviços, pessoas, habilidades, projetos e oportunidades de colaboração dentro da própria universidade.

O vínculo acadêmico funciona como uma camada de **identidade, contexto e confiança**.

---

## 2. Objetivo do MVP

O MVP deve permitir que um estudante:

- crie uma conta;
- faça login;
- crie e edite seu perfil;
- adicione habilidades e interesses;
- publique projetos;
- publique anúncios;
- pesquise produtos e serviços;
- encontre outros estudantes;
- filtre estudantes por curso, habilidade ou interesse;
- visualize perfis;
- envie solicitações de conexão;
- aceite ou recuse conexões.

O foco inicial será exclusivamente em:

- Marketplace
- Networks
- Perfil
- Conexões

---

## 3. Tecnologias

### Front-end

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

### Back-end

O próprio Next.js será utilizado para as funcionalidades do servidor.

- Server Components
- Server Actions
- Route Handlers / API

Não será criado inicialmente um back-end separado com Express ou NestJS.

### Banco de dados

- PostgreSQL
- Supabase

### Autenticação

- Supabase Auth

Responsável por:

- cadastro;
- login;
- logout;
- recuperação de senha;
- sessão do usuário.

### Armazenamento

- Supabase Storage

Utilizado inicialmente para:

- foto de perfil;
- imagens dos anúncios;
- imagens dos projetos.

### Validação

- Zod

Utilizado para validar dados enviados por formulários e requisições.

### Desenvolvimento

- Git
- GitHub
- VS Code
- Figma

### Deploy

- Vercel

---

## 4. Por que essas tecnologias foram escolhidas?

A stack foi escolhida considerando principalmente o prazo curto do TCC e a necessidade de entregar uma aplicação funcional, organizada e apresentável.

### Next.js + React + TypeScript

Permitem desenvolver interface e funcionalidades de servidor dentro do mesmo projeto, reduzindo a quantidade de serviços separados para manter.

O TypeScript também ajuda a reduzir erros durante o desenvolvimento e melhora a manutenção do código.

### Supabase

Foi escolhido por reunir em uma única plataforma:

- PostgreSQL;
- autenticação;
- armazenamento de arquivos;
- controle de acesso;
- integração simples com Next.js.

Isso reduz o tempo de configuração e evita a necessidade de desenvolver serviços separados para autenticação e armazenamento.

### Tailwind CSS + shadcn/ui

Foram escolhidos para acelerar o desenvolvimento da interface mantendo consistência visual e responsividade.

### Vercel

Possui integração direta com Next.js e simplifica o processo de publicação da aplicação.

---

## 5. Decisões de arquitetura

### Back-end dentro do Next.js

Neste primeiro momento, não será utilizado um back-end separado.

A arquitetura será aproximadamente:

```text
Usuário
   |
   v
Next.js
   |
   +-- Interface React
   +-- Server Components
   +-- Server Actions
   +-- Route Handlers
   |
   v
Supabase
   |
   +-- PostgreSQL
   +-- Auth
   +-- Storage
```

### Motivo

Separar front-end e back-end em projetos diferentes aumentaria o tempo de desenvolvimento, configuração, deploy e manutenção sem trazer um benefício relevante para o escopo atual.

Caso o projeto cresça futuramente, essa arquitetura poderá ser revista.

---

## 6. Estrutura inicial

```text
sabenca/
|
├── public/
|
├── src/
│   |
│   ├── app/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   └── register/
│   │   │
│   │   ├── marketplace/
│   │   │   ├── page.tsx
│   │   │   ├── create/
│   │   │   └── [id]/
│   │   │
│   │   ├── networks/
│   │   │   └── page.tsx
│   │   │
│   │   ├── profile/
│   │   │   ├── page.tsx
│   │   │   ├── edit/
│   │   │   └── [id]/
│   │   │
│   │   ├── connections/
│   │   │   └── page.tsx
│   │   │
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── marketplace/
│   │   ├── networks/
│   │   ├── profile/
│   │   └── connections/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   ├── validations/
│   │   └── utils/
│   │
│   ├── services/
│   ├── types/
│   └── hooks/
|
├── .env.local
├── package.json
├── README.md
└── tsconfig.json
```

---

## 7. Banco de dados inicial

### profiles

Representa o perfil do estudante.

```text
id
user_id
username
name
bio
course
semester
institution
avatar_url
created_at
updated_at
```

### skills

```text
id
name
```

Exemplos:

- React
- Java
- Python
- Photoshop
- Edição de vídeo
- Redes
- Banco de dados

### profile_skills

```text
id
profile_id
skill_id
```

### interests

```text
id
name
```

Exemplos:

- Desenvolvimento Web
- Jogos
- Inteligência Artificial
- Cibersegurança
- Design
- Empreendedorismo

### profile_interests

```text
id
profile_id
interest_id
```

---

## 8. Projetos

### projects

```text
id
profile_id
title
description
image_url
project_url
repository_url
created_at
```

O estudante poderá utilizar essa área para mostrar trabalhos pessoais ou acadêmicos.

---

## 9. Marketplace

### listings

```text
id
seller_id
title
description
price
category_id
condition
status
created_at
updated_at
```

### listing_images

```text
id
listing_id
image_url
position
```

### categories

```text
id
name
```

Categorias iniciais:

- Livros
- Materiais acadêmicos
- Eletrônicos
- Informática
- Serviços
- Aulas particulares
- Freelance
- Outros

### Status do anúncio

```text
active
sold
inactive
```

---

## 10. Networks

Networks não será uma rede baseada em seguidores ou popularidade.

Seu objetivo é permitir descoberta de estudantes através de:

- nome;
- curso;
- semestre;
- habilidades;
- interesses;
- tecnologias.

Exemplo:

```text
Pesquisa: React

Lucas Ferreira
Ciência da Computação
7º semestre

React
TypeScript
Next.js

Interesses:
Desenvolvimento Web
Desenvolvimento de Jogos
```

---

## 11. Conexões

### connections

```text
id
requester_id
receiver_id
status
created_at
updated_at
```

Status:

```text
pending
accepted
rejected
```

Fluxo:

```text
Usuário A
   |
   | solicitar conexão
   v
Usuário B
   |
   | aceitar
   v
Conectados
```

Não haverá inicialmente sistema de seguidores.

---

## 12. Integração entre os módulos

A integração entre as funcionalidades é uma parte central do SABENÇA.

```text
Marketplace --> Perfil
Networks ----> Perfil
Perfil ------> Marketplace
Perfil ------> Conexões
```

Exemplo:

Um estudante encontra um serviço no Marketplace, acessa o perfil do vendedor, visualiza suas habilidades e projetos e decide criar uma conexão.

Também pode acontecer o contrário: um estudante encontra alguém pelo Networks, acessa seu perfil e descobre que essa pessoa oferece um serviço.

---

## 13. Navegação principal

A navegação inicial deverá permitir acesso rápido a:

- Marketplace;
- Networks;
- pesquisa;
- criação de anúncio;
- conexões;
- perfil.

O perfil deverá permanecer facilmente acessível, mas não deverá dominar a interface.

---

## 14. Perfil

O perfil deve transmitir personalidade e identidade, sem parecer apenas um currículo tradicional.

Estrutura inicial:

```text
Foto
Nome
Curso
Semestre
Bio

Habilidades
Interesses
Projetos
Serviços / anúncios
Conexões
Links externos
```

O preenchimento deverá ser progressivo.

Poucos campos serão obrigatórios.

---

## 15. Privacidade

O estudante deverá possuir controle sobre as informações exibidas publicamente.

Não devem ser expostos por padrão dados pessoais desnecessários, como:

- telefone;
- e-mail pessoal;
- documentos;
- endereço.

---

## 16. Segurança

Utilizar:

- Supabase Auth;
- PostgreSQL Row Level Security (RLS);
- Zod;
- validação no servidor.

Um usuário poderá alterar somente os próprios dados.

Exemplo conceitual:

```text
auth.uid() == profile.user_id
```

Um estudante não poderá:

- editar o perfil de outro usuário;
- editar o anúncio de outro usuário;
- excluir o projeto de outro usuário.

---

## 17. Funcionalidades fora do MVP

Não desenvolver inicialmente:

- feed geral;
- chat interno;
- sistema complexo de notificações;
- empresas;
- vagas;
- eventos;
- calendário acadêmico;
- gamificação;
- sistema de seguidores;
- IA;
- recomendações avançadas;
- aplicativo mobile.

Essas funcionalidades poderão ser avaliadas após o MVP estar funcional.

---

## 18. Ordem de desenvolvimento

### Fase 1 — Fundação

- criar projeto Next.js;
- configurar TypeScript;
- configurar Tailwind;
- configurar shadcn/ui;
- criar projeto Supabase;
- configurar GitHub;
- criar variáveis de ambiente;
- montar estrutura inicial.

### Fase 2 — Autenticação

- cadastro;
- login;
- logout;
- sessão;
- recuperação de senha;
- proteção de rotas.

### Fase 3 — Perfil

- criação do perfil;
- edição;
- foto;
- bio;
- curso;
- semestre;
- habilidades;
- interesses;
- projetos.

### Fase 4 — Marketplace

- listagem de anúncios;
- criação;
- visualização;
- edição;
- exclusão;
- imagens;
- categorias;
- busca;
- filtros;
- acesso ao perfil do vendedor.

### Fase 5 — Networks

- listagem de estudantes;
- pesquisa;
- filtro por curso;
- filtro por semestre;
- filtro por habilidade;
- filtro por interesse;
- visualização de perfil.

### Fase 6 — Conexões

- solicitar conexão;
- listar solicitações;
- aceitar;
- recusar;
- listar conexões.

### Fase 7 — Integração

Garantir o funcionamento dos fluxos:

```text
Marketplace -> Perfil
Networks -> Perfil
Perfil -> Marketplace
Perfil -> Conexões
```

### Fase 8 — Acabamento

- responsividade;
- loading states;
- empty states;
- tratamento de erros;
- mensagens de sucesso;
- confirmação de exclusão;
- validações;
- segurança;
- correção de bugs.

---

## 19. Dificuldades e riscos previstos

### Prazo curto

O principal risco do projeto é tentar implementar funcionalidades demais.

**Decisão:** priorizar somente o que fortalece Marketplace, Networks, Perfil e Conexões.

### Integração entre os módulos

Marketplace, Networks e Perfil dependem uns dos outros.

**Decisão:** desenvolver primeiro o Perfil e utilizá-lo como base para os outros módulos.

### Busca de estudantes

Uma busca avançada poderia exigir tecnologias adicionais.

**Decisão:** no MVP, utilizar os próprios recursos do PostgreSQL para filtros e pesquisas simples.

### Segurança dos dados

Perfis, anúncios e arquivos pertencem a usuários específicos.

**Decisão:** utilizar autenticação do Supabase e políticas RLS no banco.

### Upload de imagens

Imagens aumentam a complexidade de armazenamento e permissões.

**Decisão:** centralizar uploads no Supabase Storage.

### Crescimento de escopo

Durante o desenvolvimento podem surgir ideias de chat, feed, notificações ou IA.

**Decisão:** novas funcionalidades só entram depois que o fluxo principal estiver estável.

---

## 20. Registro de decisões

### 13/09/2026 — Início da implementação

- Fundação criada na raiz: Next.js, React, TypeScript, Tailwind CSS e componentes shadcn/ui.
- Por orientação do usuário, o cadastro aceita e-mail pessoal nesta etapa. Confirmação de e-mail obrigatória; comprovação de vínculo acadêmico fica para uma fase posterior.
- Autenticação implementada com Supabase SSR, cookies e PKCE. Banco inicial com RLS, permissões por proprietário e Storage privado.
- O desenvolvimento completo do perfil permanece condicionado à validação real do cadastro e login. As rotas dos módulos exibem seu estado de desenvolvimento.
- Detalhes de execução, testes e integração estão em `README.md` e `docs/DESENVOLVIMENTO.md`.

Esta seção deve ser atualizada sempre que uma decisão técnica ou funcional importante for tomada.

O objetivo não é criar uma documentação extensa, mas registrar o contexto necessário para entender por que algo foi feito.

### Modelo

```text
Data:
Decisão:
Motivo:
Alternativas consideradas:
Impacto:
```

### Exemplo

```text
Data: início do projeto

Decisão:
Utilizar Supabase como plataforma de banco, autenticação e armazenamento.

Motivo:
Reduzir o tempo de implementação e a quantidade de serviços separados.

Alternativas consideradas:
PostgreSQL próprio + API Node.js + serviço separado de autenticação.

Impacto:
Arquitetura mais simples e desenvolvimento mais rápido para o MVP.
```

---

## 21. Registro de dificuldades

### 13/09/2026 — Validação local do banco

O Docker instalado estava sem daemon em execução. A migração e as regras RLS foram testadas em PostgreSQL via PGlite, com uma estrutura mínima de Auth e Storage. Essa validação não substitui os testes de cadastro, envio de e-mail e sessão em um projeto Supabase integrado.

Quando surgir um problema que tenha impacto relevante no desenvolvimento, registrar de forma resumida.

### Modelo

```text
Data:
Problema:
Causa:
Solução adotada:
Resultado:
```

Não é necessário documentar pequenos erros de programação. O registro deve ser usado para dificuldades que expliquem mudanças de arquitetura, biblioteca, fluxo ou escopo.

---

## 22. Critério de conclusão do MVP

O SABENÇA será considerado funcional quando for possível completar os seguintes fluxos:

### Fluxo Marketplace

```text
Criar conta
   |
   v
Criar perfil
   |
   v
Adicionar habilidades e interesses
   |
   v
Criar anúncio
   |
   v
Outro estudante encontra o anúncio
   |
   v
Visualiza o vendedor
   |
   v
Acessa o perfil
   |
   v
Solicita conexão
```

### Fluxo Networks

```text
Networks
   |
   v
Pesquisar habilidade ou interesse
   |
   v
Encontrar estudante
   |
   v
Visualizar perfil
   |
   v
Ver habilidades e projetos
   |
   v
Ver serviços ou anúncios
   |
   v
Criar conexão
```

Esses fluxos representam o núcleo do SABENÇA.

---

## 23. Regra de desenvolvimento

Antes de adicionar qualquer funcionalidade, perguntar:

> Esta funcionalidade fortalece diretamente Marketplace, Networks ou Perfil?

Se a resposta for não, ela não deverá ser prioridade no MVP.

---

## 24. Primeira tarefa

Checklist inicial:

```text
[x] Criar projeto Next.js com TypeScript
[x] Configurar Tailwind CSS
[x] Configurar shadcn/ui
[ ] Criar repositório GitHub
[ ] Criar projeto Supabase
[ ] Configurar variáveis de ambiente (modelo pronto; faltam valores do projeto remoto)
[x] Configurar cliente Supabase
[x] Criar layout principal
[x] Criar banco inicial (migração local testada; aplicação remota pendente)
[x] Criar autenticação (implementação pronta; validação integrada pendente)
[ ] Testar cadastro
[ ] Testar login
```

Somente após cadastro e login estarem funcionando iniciar o desenvolvimento completo do perfil.
