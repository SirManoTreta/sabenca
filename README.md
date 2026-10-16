# SABENÇA · Comunidade FATECE

Plataforma universitária fechada em Next.js, React, TypeScript e Supabase. Integra **Marketplace ↔ Perfil ↔ Networks**, apoiada por vínculo acadêmico, portfólio e conexões entre estudantes.

## O que funciona no código

- Login por RA/senha, primeiro acesso com RA/nascimento, confirmação de e-mail e criação de senha própria.
- Administração protegida, importação .xlsx com validação e prévia, histórico, bloqueio e restauração de acesso.
- Registro institucional privado; CPF armazenado como HMAC. RLS exige vínculo ativo, além da sessão Auth.
- Página pública e autenticação adaptadas à comunidade FATECE, com marca SABENÇA.
- Perfil real, username único, bio, habilidades/interesses, avatar privado e projetos com imagem e links.
- Perfil da comunidade em `/users/[username]`, acessível somente a membros ativos. Nome, curso e semestre são protegidos pela instituição.
- Catálogo de cursos em `/admin/cursos`, modelo oficial Excel, importação com validação institucional e relatório de erros.
- Networks com busca por nome, username e habilidade; filtros combinados, paginação e cards com avatar privado.
- Conexões mútuas: solicitações, aceite, recusa, cancelamento e remoção, integradas ao Networks e ao perfil.
- Marketplace com pesquisa, filtros, paginação, produtos e serviços, imagens privadas, gestão dos anúncios e integração com Perfil/Conexões.
- Gestão de administradores com convite, reenvio, recuperação de provisionamento parcial e revogação protegida contra autorremoção e perda do último admin confirmado.
- Certificados com metadados, upload privado, revisão administrativa e selo de documento analisado; alterações devolvem o certificado para pendente.
- Denúncias de perfil/anúncio, revisão administrativa, bloqueio bilateral e controles de privacidade do perfil aplicados também no banco.
- Política de Privacidade, Termos de Uso e Regras da Comunidade, com placeholders institucionais explícitos.

Não existe cadastro público. A rota antiga redireciona para Primeiro acesso.

## Executar localmente

Requisito: Node.js 24, conforme `.nvmrc` e `package.json`.

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

## Ambientes

| Ambiente        | Branch                  | Hospedagem planejada | Banco         |
| --------------- | ----------------------- | -------------------- | ------------- |
| Desenvolvimento | `feature/*` / `codex/*` | Local/Preview        | Supabase DEV  |
| Staging         | `develop`               | Vercel Preview       | Supabase DEV  |
| Produção        | `main`                  | Vercel Production    | Supabase PROD |

DEV e PROD possuem projetos separados. A promoção anterior foi realizada pela PR #3; o fechamento atual do MVP acontece em `develop`, com migrations incrementais somente no DEV e nova PR sem merge automático.

- [DEV/Preview](https://sabenca-git-develop-sirmanotretas-projects.vercel.app) — Supabase `fidndjlresfxvmerkbhs`.
- [Production](https://project-q1u7y.vercel.app) — Supabase `qybcbxrxghykkchnvmhy`.

O DEV pode ser pausado pelo provedor por inatividade. Não usar PROD como substituto. Consulte [Hospedagem e ambientes](docs/DEPLOYMENT.md) e [Operação atual do MVP](docs/MVP_ARQUITETURA_E_OPERACAO.md).

## Documentação

Documentos atuais ficam em `docs/`; registros das etapas anteriores permanecem em `markdown/` e nos relatórios históricos.

- [Auditoria de escopo](docs/MVP_GAP_ANALYSIS.md)
- [Relatório de fechamento e validações](docs/MVP_FECHAMENTO_RELATORIO.md)
- [Pré-promoção e rollback](docs/MVP_PRE_PROMOCAO.md)
- [Arquitetura e operação](docs/MVP_ARQUITETURA_E_OPERACAO.md)
- [Implementação técnica para o TCC](docs/TCC_IMPLEMENTACAO_TECNICA.md)
- [Roteiro de demonstração](docs/DEMO_TCC.md)

- [Guia inicial](markdown/SABENCA_Guia_Inicial_Desenvolvimento.md)
- [Resumo do desenvolvimento do TCC](markdown/RESUMO_DESENVOLVIMENTO_TCC.md)
- [Requisitos da etapa institucional](markdown/SABENCA_Acesso_Institucional_Importacao_Layout.md)
- [Implementação e configuração](markdown/ACESSO_INSTITUCIONAL_IMPLEMENTACAO.md)
- [Histórico de desenvolvimento](markdown/DESENVOLVIMENTO.md)
- [Perfil: implementação e testes](markdown/PERFIL_IMPLEMENTACAO.md)
- [Networks, cursos e modelo Excel](markdown/NETWORKS_IMPLEMENTACAO.md)
- [Conexões: arquitetura, segurança e testes](markdown/CONEXOES_IMPLEMENTACAO.md)
- [Marketplace: arquitetura, segurança e testes](markdown/MARKETPLACE_IMPLEMENTACAO.md)

O código é versionado em [SirManoTreta/sabenca](https://github.com/SirManoTreta/sabenca). Production já contém Marketplace e as oito migrations da promoção anterior. O fechamento do MVP acrescenta migrations incrementais; nenhuma delas deve ser aplicada ao PROD antes da autorização de promoção. Não repetir o clone DEV → PROD.
