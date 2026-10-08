# SABENÇA — Hospedagem, Staging e Produção

## Objetivo

Preparar o projeto **SABENÇA** para trabalhar corretamente com ambientes separados de:

1. Desenvolvimento local;
2. Staging / desenvolvimento compartilhado;
3. Produção.

A infraestrutura planejada será:

- GitHub para versionamento;
- Vercel para hospedagem do Next.js;
- Supabase para banco de dados, autenticação e storage;
- Supabase DEV para desenvolvimento e staging;
- Supabase PROD para produção.

A aplicação não deve depender de configurações manuais dentro do código para alternar entre ambientes.

---

# 1. Estrutura desejada

A estrutura final deverá seguir aproximadamente:

```text
GitHub
│
├── feature/*
│      │
│      └── desenvolvimento de funcionalidades
│
├── develop
│      │
│      ├── Vercel Preview / Staging
│      └── Supabase DEV
│
└── main
       │
       ├── Vercel Production
       └── Supabase PROD
```

Fluxo de desenvolvimento:

```text
feature/*
    ↓
develop
    ↓
testes em staging
    ↓
main
    ↓
produção
```

---

# 2. Regras importantes

Antes de realizar alterações:

- Analise todo o projeto atual.
- Preserve a arquitetura existente sempre que possível.
- Não faça alterações destrutivas sem necessidade.
- Não apague funcionalidades existentes.
- Não altere dados de produção.
- Não coloque credenciais reais no código.
- Não versione arquivos `.env` contendo secrets.
- Não exponha chaves privadas no frontend.
- Não utilize o banco de produção para testes.
- Não faça alterações diretamente em produção sem necessidade.

Se alguma etapa depender de autenticação externa ou acesso administrativo, interrompa somente aquela etapa e informe claramente o que preciso fazer manualmente.

---

# 3. Análise inicial

Antes de modificar o projeto, faça uma análise da estrutura atual e identifique:

- versão do Next.js;
- versão do React;
- versão do Node utilizada/recomendada;
- gerenciador de pacotes;
- estrutura atual do Supabase;
- variáveis de ambiente existentes;
- utilização do Supabase no frontend;
- utilização do Supabase no backend;
- utilização de `service_role`;
- rotas de API;
- Server Actions;
- middleware;
- autenticação;
- Storage;
- RLS;
- migrations;
- scripts existentes;
- configuração atual de build;
- configuração atual para deploy.

Verifique também:

```bash
npm install
npm run build
```

E, caso existam:

```bash
npm run lint
npm test
```

Não prossiga ignorando erros de build.

---

# 4. Branches

O projeto deverá utilizar:

```text
main
develop
feature/*
```

## main

Representa exclusivamente:

> Produção

A branch `main` deve conter somente código considerado estável.

Ela deverá ser usada pelo ambiente Production da Vercel.

---

## develop

Representa:

> Staging / ambiente compartilhado de desenvolvimento

A branch `develop` será utilizada para integrar funcionalidades antes de enviá-las para produção.

Ela utilizará o Supabase DEV.

---

## feature/*

Funcionalidades devem ser preferencialmente desenvolvidas em branches específicas.

Exemplos:

```text
feature/marketplace
feature/network-filters
feature/profile-projects
feature/connections
fix/login-error
fix/profile-upload
```

Fluxo:

```text
feature/*
↓
Pull Request
↓
develop
↓
testes
↓
Pull Request
↓
main
```

Caso `develop` ainda não exista, prepare sua criação.

Não realize alterações perigosas diretamente em `main`.

---

# 5. Ambientes Supabase

Serão utilizados dois projetos independentes.

## SABENCA-DEV

Utilizado por:

- desenvolvimento local;
- branch `develop`;
- previews;
- testes;
- desenvolvimento de funcionalidades.

Pode possuir:

- usuários fictícios;
- anúncios fictícios;
- conexões fictícias;
- dados de teste;
- arquivos de teste.

---

## SABENCA-PROD

Utilizado exclusivamente por:

- branch `main`;
- aplicação apresentada ao orientador;
- versão estável do SABENÇA.

Não utilizar para desenvolvimento comum.

---

# 6. Banco de dados

Analise a estrutura atual do banco.

Precisamos garantir que os dois ambientes possuam a mesma estrutura de:

- tabelas;
- constraints;
- índices;
- triggers;
- functions;
- RLS;
- policies;
- buckets;
- configurações necessárias.

Porém:

```text
Estrutura DEV = Estrutura PROD

Dados DEV != Dados PROD
```

Não copie automaticamente usuários ou dados sensíveis entre os ambientes.

---

# 7. Migrations

Caso o projeto ainda não utilize adequadamente migrations do Supabase, preparar uma estratégia para isso.

Mudanças futuras de banco deverão ser reproduzíveis.

Preferencialmente:

```text
migration
↓
DEV
↓
testes
↓
PROD
```

Evitar:

```text
alteração manual no DEV
+
alteração manual diferente no PROD
```

O objetivo é reduzir divergências entre os bancos.

Não execute migration destrutiva em produção sem solicitar autorização.

---

# 8. Seeds

Caso seja útil, criar ou preparar um sistema de seed para o ambiente DEV.

O seed poderá gerar dados fictícios como:

- usuários;
- perfis;
- cursos;
- habilidades;
- interesses;
- projetos;
- anúncios;
- conexões.

Não criar seeds contendo:

- CPF real;
- telefone real;
- dados reais de estudantes;
- credenciais reais.

Não executar seeds no ambiente PROD automaticamente.

---

# 9. Variáveis de ambiente

Analise todas as variáveis utilizadas atualmente.

Preparar:

```text
.env.example
```

Sem nenhuma credencial verdadeira.

Exemplo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=
```

Inclua apenas as variáveis realmente utilizadas pelo projeto.

---

# 10. Segurança das variáveis

Revise o projeto procurando:

- chaves hardcoded;
- URLs privadas;
- tokens;
- service role keys;
- senhas;
- secrets;
- arquivos `.env` versionados acidentalmente.

Verifique também o histórico/configuração atual sempre que possível.

A seguinte regra deve ser respeitada:

```text
NEXT_PUBLIC_*
```

Pode ser disponibilizado ao navegador somente quando realmente for uma informação pública.

Credenciais administrativas nunca devem receber prefixo:

```text
NEXT_PUBLIC_
```

Especial atenção para:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Essa chave nunca deve estar disponível no browser.

---

# 11. .gitignore

Verifique e corrija o `.gitignore`.

Garantir pelo menos proteção contra arquivos como:

```gitignore
.env
.env.local
.env.development.local
.env.production.local
.env*.local
```

Preserve arquivos de exemplo:

```text
.env.example
```

---

# 12. Configuração do Next.js

Verifique se a aplicação está preparada para produção.

Analise:

- `next.config.*`;
- rotas;
- middleware;
- Server Components;
- Client Components;
- Server Actions;
- APIs;
- imagens;
- URLs absolutas;
- redirects;
- callbacks de autenticação;
- utilização de cookies;
- utilização de headers.

Corrija somente problemas reais encontrados.

Não altere arquitetura apenas por preferência.

---

# 13. Build de produção

A aplicação deverá concluir:

```bash
npm run build
```

Sem erros.

Caso existam erros:

1. identifique;
2. explique;
3. corrija;
4. execute novamente;
5. registre resumidamente o que foi alterado.

Não utilize soluções como:

```javascript
ignoreBuildErrors: true
```

apenas para esconder problemas.

---

# 14. Vercel

Preparar o projeto para hospedagem na Vercel.

A configuração planejada será:

## Production

```text
Git branch:
main

Banco:
SABENCA-PROD
```

---

## Preview / Staging

```text
Git branch:
develop

Banco:
SABENCA-DEV
```

---

# 15. Variáveis na Vercel

A configuração deverá permitir separar variáveis de ambiente.

## Production

Utilizar:

```text
Supabase PROD
```

Exemplo conceitual:

```env
NEXT_PUBLIC_SUPABASE_URL=<PROD>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<PROD>
SUPABASE_SERVICE_ROLE_KEY=<PROD>
```

---

## Preview / develop

Utilizar:

```text
Supabase DEV
```

Exemplo conceitual:

```env
NEXT_PUBLIC_SUPABASE_URL=<DEV>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<DEV>
SUPABASE_SERVICE_ROLE_KEY=<DEV>
```

Não adicionar os valores reais ao repositório.

---

# 16. URLs

Inicialmente podem ser utilizadas as URLs gratuitas da Vercel.

Exemplo conceitual:

```text
Produção:
sabenca.vercel.app

Staging:
sabenca-git-develop-*.vercel.app
```

Não presuma os endereços reais antes da criação do projeto.

Posteriormente poderemos adicionar:

```text
sabenca.com.br
dev.sabenca.com.br
```

Domínio próprio não é prioridade neste momento.

---

# 17. Supabase Auth

Analise as configurações necessárias para autenticação em múltiplos ambientes.

Verifique:

- Site URL;
- Redirect URLs;
- callback URLs;
- autenticação após login;
- recuperação de senha;
- confirmação de e-mail, caso utilizada;
- redirecionamentos utilizados pelo Next.js.

Precisamos permitir:

```text
localhost
staging
produção
```

Cada Supabase deverá apontar para os ambientes adequados.

Não altere regras de autenticação sem necessidade.

---

# 18. Supabase Storage

Verifique se a aplicação utiliza Supabase Storage.

Caso utilize, documente os buckets existentes e verifique:

- bucket público ou privado;
- policies;
- upload;
- leitura;
- exclusão;
- identificação do proprietário.

O ambiente DEV deverá possuir seus próprios buckets.

O ambiente PROD deverá possuir seus próprios buckets.

Não compartilhar arquivos entre os ambientes automaticamente.

---

# 19. RLS

Revise as políticas de Row Level Security existentes.

Especial atenção para:

- profiles;
- users;
- marketplace;
- projects;
- connections;
- academic data;
- uploads.

Não desative RLS para facilitar testes.

Caso alguma policy esteja incorreta, documente antes de modificar.

---

# 20. Deploy Preview

O projeto deverá aproveitar deploys de preview sempre que possível.

Fluxo desejado:

```text
feature/*
↓
Pull Request
↓
Preview Deploy
↓
teste
↓
merge develop
```

Isso permitirá que os desenvolvedores testem funcionalidades antes de integrá-las.

---

# 21. Proteção da main

Recomendar configuração do GitHub para impedir alterações acidentais em produção.

Preferencialmente:

```text
main
↓
Pull Request obrigatório
↓
aprovação/testes
↓
merge
```

Não configure regras que impossibilitem o desenvolvimento em dupla.

Caso a proteção exija ação manual no GitHub, apenas documente os passos.

---

# 22. Documentação

Criar ou atualizar documentação explicando a infraestrutura.

Criar, preferencialmente:

```text
docs/DEPLOYMENT.md
```

O documento deverá registrar de maneira objetiva:

## Ambientes

```text
Local
Staging
Production
```

## Git

```text
feature/* → develop → main
```

## Serviços

```text
Frontend:
Vercel

Backend:
Supabase

Versionamento:
GitHub
```

## Banco

```text
DEV → desenvolvimento
PROD → produção
```

Também registrar as principais decisões tomadas e o motivo.

Não criar documentação excessivamente longa.

---

# 23. README

Atualizar o README apenas quando necessário.

Adicionar uma seção pequena como:

```markdown
## Ambientes

| Ambiente | Branch | Hospedagem | Banco |
|---|---|---|---|
| Desenvolvimento | feature/* | Local/Preview | Supabase DEV |
| Staging | develop | Vercel Preview | Supabase DEV |
| Produção | main | Vercel | Supabase PROD |
```

Não transformar o README em documentação completa de infraestrutura.

---

# 24. Checklist antes do primeiro deploy

Verificar:

- [ ] `npm install` funcionando;
- [ ] `npm run build` funcionando;
- [ ] lint funcionando, caso configurado;
- [ ] `.env.example` criado;
- [ ] `.env` protegido pelo `.gitignore`;
- [ ] nenhum secret presente no código;
- [ ] Supabase DEV separado do PROD;
- [ ] migrations verificadas;
- [ ] RLS verificado;
- [ ] Storage verificado;
- [ ] autenticação verificada;
- [ ] branch `develop` preparada;
- [ ] `main` preservada como produção;
- [ ] documentação criada.

---

# 25. Testes após deploy

Após o ambiente estar online, testar pelo menos:

## Autenticação

- login;
- logout;
- sessão;
- recuperação de sessão;
- acesso não autorizado.

## Perfil

- abrir perfil;
- editar perfil;
- salvar alterações;
- imagem;
- habilidades;
- interesses;
- projetos.

## Networks

- listar estudantes;
- pesquisa;
- filtros;
- abrir perfil;
- conexões.

## Conexões

- enviar solicitação;
- aceitar;
- recusar, caso exista;
- remover conexão, caso exista;
- verificar estado da conexão.

## Marketplace

Quando disponível:

- criar anúncio;
- editar;
- visualizar;
- pesquisar;
- excluir.

---

# 26. Ações que NÃO devem ser realizadas automaticamente

Não executar sem autorização explícita:

- excluir projeto Supabase;
- excluir banco;
- resetar produção;
- excluir usuários de produção;
- limpar Storage de produção;
- alterar DNS;
- comprar domínio;
- contratar plano pago;
- tornar repository público;
- expor secrets;
- substituir `main` de forma destrutiva;
- realizar `force push` em `main`;
- alterar políticas de segurança apenas para facilitar desenvolvimento.

---

# 27. Intervenção manual

Ao chegar em uma etapa que dependa de mim, informe exatamente:

```text
AÇÃO MANUAL NECESSÁRIA
```

E forneça:

1. Onde preciso acessar;
2. O que preciso criar;
3. Qual opção selecionar;
4. Qual informação preciso copiar;
5. Onde essa informação deverá ser inserida;
6. Como verificar se funcionou.

Exemplo:

```text
AÇÃO MANUAL NECESSÁRIA

Vercel → Project Settings → Environment Variables

Adicione:

NEXT_PUBLIC_SUPABASE_URL

Environment:
Production

Valor:
URL do projeto SABENCA-PROD
```

Não solicitar que eu envie secrets pelo chat ou coloque secrets dentro do repositório.

---

# 28. Ordem de execução

Siga preferencialmente esta ordem:

```text
1. Analisar projeto atual
       ↓
2. Verificar secrets
       ↓
3. Verificar .gitignore
       ↓
4. Preparar .env.example
       ↓
5. Executar build
       ↓
6. Corrigir problemas
       ↓
7. Analisar Supabase
       ↓
8. Preparar migrations
       ↓
9. Preparar ambiente DEV/PROD
       ↓
10. Preparar branch develop
       ↓
11. Preparar configuração Vercel
       ↓
12. Solicitar ações manuais necessárias
       ↓
13. Deploy Staging
       ↓
14. Testes
       ↓
15. Deploy Production
       ↓
16. Testes
       ↓
17. Documentação final
```

---

# 29. Resultado esperado

Ao final, o projeto deverá possuir:

```text
SABENÇA
│
├── Desenvolvimento local
│
├── Staging
│   ├── develop
│   ├── Vercel
│   └── Supabase DEV
│
└── Produção
    ├── main
    ├── Vercel
    └── Supabase PROD
```

O orientador deverá conseguir acessar uma versão estável sem interferir no desenvolvimento.

Os desenvolvedores deverão conseguir continuar trabalhando normalmente sem utilizar o banco de produção.

---

# 30. Relatório final

Quando concluir tudo que puder fazer automaticamente, apresente:

```markdown
# Relatório de implantação

## Alterações realizadas

## Arquivos criados

## Arquivos modificados

## Problemas encontrados

## Problemas corrigidos

## Ambiente DEV

## Ambiente PROD

## Build

## Segurança

## Supabase

## Vercel

## Git/GitHub

## Ações manuais restantes

## Próximo passo recomendado
```

Se ainda houver alguma ação manual necessária, não presuma que ela foi concluída.

Informe claramente em qual ponto o processo está parado.