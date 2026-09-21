# SABENÇA · Comunidade FATECE

Plataforma universitária em Next.js, React, TypeScript e Supabase. A etapa atual implementa **acesso institucional pré-autorizado**, importação administrativa de alunos e identidade visual azul/branco.

## O que funciona no código

- Login por RA/senha, primeiro acesso com RA/nascimento, confirmação de e-mail e criação de senha própria.
- Administração protegida, importação .xlsx com validação e prévia, histórico, bloqueio e restauração de acesso.
- Registro institucional privado; CPF armazenado como HMAC. RLS exige vínculo ativo, além da sessão Auth.
- Página pública e autenticação adaptadas à comunidade FATECE, com marca SABENÇA.
- Perfil mínimo na ativação. Edição completa do Perfil, Marketplace, Networks e Conexões continuam para as próximas fases.

Não existe cadastro público. A rota antiga redireciona para Primeiro acesso.

## Executar localmente

Requisito: Node.js 22 ou superior; desenvolvido com Node.js 24.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Não sobrescreva um `.env.local` já configurado. Acesse [localhost:3000](http://localhost:3000). Sem a configuração do servidor, as telas públicas funcionam e informam que o acesso institucional está em preparação.

## Configuração e validação

Consulte [Acesso institucional: implementação](markdown/ACESSO_INSTITUCIONAL_IMPLEMENTACAO.md) para:

- variáveis privadas e públicas;
- migrações e configuração Supabase Auth/SMTP;
- criação do primeiro administrador;
- formato da planilha, limites e decisões de duplicidade;
- fluxo de primeiro acesso, regras de acesso e roteiro de validação integrada.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Testes de importação e ativação executam PostgreSQL real em PGlite, inclusive conexões TCP e transações do cliente Postgres.js. As respostas Supabase Auth e a entrega de e-mail são simuladas nos testes; a integração hospedada/SMTP exige credenciais e validação própria.

## Documentação

Os guias e registros ficam em `markdown/`. README, AGENTS e CLAUDE permanecem na raiz por convenção das ferramentas.

- [Guia inicial](markdown/SABENCA_Guia_Inicial_Desenvolvimento.md)
- [Resumo do desenvolvimento do TCC](markdown/RESUMO_DESENVOLVIMENTO_TCC.md)
- [Requisitos da etapa institucional](markdown/SABENCA_Acesso_Institucional_Importacao_Layout.md)
- [Implementação e configuração](markdown/ACESSO_INSTITUCIONAL_IMPLEMENTACAO.md)
- [Histórico de desenvolvimento](markdown/DESENVOLVIMENTO.md)

O código é versionado em [SirManoTreta/sabenca](https://github.com/SirManoTreta/sabenca), sem deploy da aplicação. O Supabase já está conectado: quatro migrações aplicadas, 18 tabelas com RLS, três buckets privados, primeiro administrador autorizado e um aluno fictício importado para teste. O titular confirmou recebimento do e-mail, ativação e login por RA/senha. Consulte o estado atualizado e as pendências de produção no documento de implementação.
