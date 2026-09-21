# Registro de desenvolvimento — 13/09/2026

## Etapa atual: acesso institucional

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
- Implementar perfil após a validação de autenticação.

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
