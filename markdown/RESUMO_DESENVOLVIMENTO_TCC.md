# SABENÇA — Resumo do desenvolvimento do TCC

**Data do resumo:** 17/09/2026.  
**Base:** código disponível no projeto e registros de desenvolvimento e integração.

## 1. Apresentação e objetivo

O **SABENÇA** é uma plataforma web destinada à comunidade universitária da **FATECE**. Sua proposta é aproximar estudantes por meio de perfis acadêmicos e profissionais, divulgação de produtos e serviços, descoberta de habilidades e interesses e formação de conexões.

O desenvolvimento foi organizado em etapas, começando pela estrutura técnica, autenticação e autorização institucional. Até o momento, foram implementados o acesso dos estudantes e a administração dos cadastros. As funcionalidades sociais do produto mínimo viável (MVP) ainda estão em desenvolvimento.

## 2. Planejamento e decisões do projeto

Foram definidos os requisitos, os módulos do MVP, a arquitetura, a estrutura de dados e a sequência de implementação. As principais decisões foram:

- Concentrar interface e operações de servidor no Next.js, reduzindo a necessidade de manter um backend separado.
- Utilizar Supabase para banco de dados, autenticação e armazenamento de imagens.
- Substituir o cadastro público por **acesso institucional pré-autorizado**, pois confirmar um e-mail não comprova vínculo acadêmico.
- Usar RA e data de nascimento apenas na identificação inicial; o estudante cria uma senha própria após confirmar o e-mail cadastrado pela instituição.
- Priorizar a base de acesso antes de implementar Perfil, Marketplace, Networks e Conexões.

Essas decisões foram registradas em guias de requisitos, implementação e histórico de desenvolvimento.

## 3. Tecnologias e organização

| Área | Tecnologias utilizadas |
| --- | --- |
| Aplicação web | Next.js 16, React 19 e TypeScript |
| Interface | Tailwind CSS 4, componentes base shadcn/ui/Radix e ícones Lucide |
| Banco e autenticação | PostgreSQL, Supabase Auth e integração de sessão com cookies |
| Armazenamento | Supabase Storage com espaços privados para imagens |
| Importação e validação | ExcelJS, Zod e Postgres.js |
| Qualidade | ESLint, verificação TypeScript, Vitest, PGlite e Playwright |

O código foi separado em páginas e rotas (`src/app`), componentes reutilizáveis (`src/components`), serviços (`src/services`), integrações e validações (`src/lib`) e tipos (`src/types`). As migrações ficam em `supabase/migrations`, os testes em `tests` e a documentação em `markdown`.

## 4. Funcionalidades implementadas

### Acesso institucional e autenticação

O estudante precisa constar previamente no cadastro importado pela instituição. No primeiro acesso, informa **RA e data de nascimento**, recebe um link no e-mail já registrado e define sua senha. Após a ativação, entra com **RA e senha**. Também foram implementados encerramento de sessão, recuperação e alteração de senha, além das páginas de acesso negado e tratamento de erros.

A ativação utiliza uma comprovação temporária, válida por 20 minutos e vinculada ao navegador que iniciou o processo. Ao concluir o fluxo, o sistema ativa o vínculo e cria um perfil mínimo com nome, curso, semestre e instituição. A antiga rota de cadastro público redireciona para o primeiro acesso.

### Administração de alunos

Foi criada uma área administrativa com login por e-mail e senha, autorização verificada no servidor e script para preparar o primeiro administrador. A interface permite pesquisar alunos por RA ou nome, consultar listas paginadas e alterar a situação do acesso.

Os registros podem estar **pendentes, ativos, bloqueados ou inativos**. O administrador pode bloquear, inativar e restaurar acessos, com registro das alterações no banco. A permissão administrativa é independente do perfil estudantil.

### Importação de planilhas

Foi implementada a importação de arquivos `.xlsx` com RA, nome, e-mail, telefone, data de nascimento e CPF; curso e semestre são opcionais. O processo inclui:

- Validação dos campos, dos dígitos do CPF, das datas e de duplicidades de RA, CPF e e-mail.
- Normalização dos dados e preservação de zeros iniciais do RA quando corretamente formatado.
- Prévia com linhas válidas e erros, sem gravação de alunos ou histórico nessa etapa.
- Confirmação vinculada ao administrador e ao arquivo analisado, válida por 15 minutos.
- Gravação das linhas válidas em transação, preservando cadastros existentes e evitando duplicação ao repetir a confirmação.
- Histórico das importações, sem armazenar o arquivo original nem enviar convites automaticamente.

Foram definidos limites de 2 MiB, 1.000 alunos e uma aba preenchida por arquivo, além de restrições contra fórmulas, macros e formatos incompatíveis.

## 5. Banco de dados e proteção das informações

Foram criadas **quatro migrações**, que estruturam **18 tabelas da aplicação**. Elas abrangem perfis, habilidades, interesses, categorias, projetos, anúncios, imagens e conexões, além dos registros privados de instituições, alunos, administradores, importações e controle de acesso.

Todas as tabelas possuem RLS, mecanismo que restringe o acesso às linhas conforme a autorização. A consulta aos dados da comunidade exige conta confirmada e vínculo institucional ativo. O bloqueio impede novas consultas mesmo quando o usuário ainda possui uma sessão de autenticação válida.

O CPF é persistido somente como uma identificação derivada com **HMAC-SHA256**, usada para comparação e detecção de duplicidades. Os registros institucionais ficam em área privada, e as respostas de listagem e prévia limitam a exposição de dados pessoais. Também foram implementados limites de tentativas de autenticação, mensagens que evitam revelar a existência de cadastros e conexão PostgreSQL com verificação TLS.

Foram preparados três espaços privados de armazenamento: `avatars`, `listing-images` e `project-images`. A estrutura de dados e armazenamento dos módulos sociais já existe; seus formulários e fluxos completos ainda precisam ser implementados.

## 6. Interface e identidade visual

Foram desenvolvidos a página pública de apresentação, os formulários de autenticação, a navegação interna e as telas administrativas. A identidade inicial em verde e creme foi substituída por **azul e branco, com detalhes laranja**, aproximando a aplicação da linguagem visual da FATECE e mantendo SABENÇA como marca principal.

A interface utiliza componentes reutilizáveis e adaptação para computador e celular. Os registros documentam revisão visual das páginas públicas e de autenticação em larguras de 1440 px e 390 px.

## 7. Testes e integração realizados

Foram criados testes de credenciais, autenticação, importação de planilhas reais, transações, permissões e isolamento de dados. Os testes de banco utilizam PostgreSQL em PGlite; os testes de navegador utilizam Playwright.

Segundo a atualização registrada em **15/09/2026**, passaram **75 testes automatizados**, a análise do ESLint, a verificação TypeScript e o build de produção. Uma execução anterior registrou **seis testes de navegador** em computador e celular. Foi preparado também um fluxo de verificações para GitHub Actions.

Os registros de integração com o Supabase documentam aplicação das migrações, criação de um administrador e importação de um aluno fictício. O titular confirmou recebimento do e-mail, ativação e novo login por RA e senha. Também foram registrados testes de acesso administrativo e das regras de bloqueio e restauração no banco remoto.

**Esses resultados são históricos:** este resumo foi elaborado por leitura do projeto, sem nova execução dos testes ou consulta ao ambiente remoto. Nos testes automatizados, as respostas do Supabase Auth e o envio de e-mail são simulados; a validação de entrega foi feita separadamente com a conta de teste.

## 8. Estado atual e próximas etapas

| Parte do projeto | Situação |
| --- | --- |
| Estrutura técnica, identidade visual e páginas de acesso | Implementadas |
| Acesso institucional e administração de alunos | Implementados, com validação integrada registrada e pendências abaixo |
| Perfil | Registro mínimo criado na ativação; edição completa pendente |
| Marketplace | Banco preparado e página inicial do módulo; anúncios e buscas pendentes |
| Networks | Estrutura de dados e página inicial; descoberta e filtros pendentes |
| Conexões | Tabela, regras de acesso e página inicial; solicitações e respostas pela interface pendentes |
| Publicação | Aplicação sem deploy; Git local sem commits e sem repositório remoto configurado na data da revisão |

As próximas entregas são concluir a validação manual de recuperação de senha por e-mail e de bloqueio/restauração pela interface, configurar SMTP próprio para atender alunos reais e desenvolver os módulos na ordem **Perfil → Marketplace → Networks → Conexões**. Também permanecem a publicação do código em repositório remoto e o deploy da aplicação.

## Documentação de apoio

- [Guia inicial e objetivos do MVP](SABENCA_Guia_Inicial_Desenvolvimento.md)
- [Requisitos de acesso institucional e layout](SABENCA_Acesso_Institucional_Importacao_Layout.md)
- [Implementação, configuração e registros de validação](ACESSO_INSTITUCIONAL_IMPLEMENTACAO.md)
- [Histórico de desenvolvimento](DESENVOLVIMENTO.md)
