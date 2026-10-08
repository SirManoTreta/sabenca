# Relatório de implantação

Data: 29/09/2026. **Registro anterior ao primeiro push de staging; aplicação ainda não publicada neste registro.**

Continuação autorizada: revisar, repetir lint/tipos/testes/build, commitar a preparação,
integrar localmente em `develop` e publicar somente essa branch. Não alterar `main`,
não publicar Production e não alterar `NEXT_PUBLIC_APP_URL` automaticamente.

## Alterações realizadas

- Next.js 16.3.5, React 19.3.0 e npm preservados; Node fixado em 24.x.
- Build Vercel interrompido se faltarem variáveis, HMACs forem curtos/iguais ou URLs de banco divergirem.
- Callback Preview usa o domínio validado da requisição para preservar cookies PKCE/ativação.
- Imagens limitadas a 4 MiB no cliente e servidor; certificado TLS incluído nas funções.
- CI cobre `develop` e executa testes de navegador contra build de produção local.
- Seeds automáticos desabilitados: havia referência a `seed.sql` inexistente.

## Arquivos criados

`.nvmrc`, `src/lib/deployment.ts`, `tests/deployment-environment.test.ts`,
`tests/deployment-origin.test.ts`, `docs/DEPLOYMENT.md` e este relatório.

## Arquivos modificados

`.env.example`, `.gitignore`, `.github/workflows/ci.yml`, `package.json`, `package-lock.json`,
`next.config.ts`, `supabase/config.toml`, `README.md`, `src/lib/institution/config.ts`,
`src/lib/validations/image.ts`, `src/services/institution-auth.ts`, `src/app/auth/actions.ts`,
`src/components/profile/avatar-upload.tsx` e `src/components/profile/project-form.tsx`.
O npm atualizou também metadados de dependências opcionais do lockfile. O markdown original foi preservado.

## Problemas encontrados

- Vercel aceita requisições de até 4,5 MB; os formulários aceitavam imagens de 5 MiB.
- URL única de callback não atendia os hosts de Preview e seus cookies.
- Certificado lido por caminho de variável podia ficar fora do pacote da função.
- Conector Vercel: deploy indisponível e consulta individual de projeto com incompatibilidade de argumentos.
- CLI Supabase sem login. Usado conector Supabase autenticado para a estrutura PROD.
- DEV: advisor alerta que proteção contra senhas vazadas está desativada.
  [Detalhes](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Dois logs `The destination stream closed early.` apareceram durante testes de perfil; todos os testes
  passaram. Confirmar comportamento/logs no smoke test hospedado; ausência de erros remotos não foi comprovada.

## Problemas corrigidos

Limite de upload, configuração de callbacks, inclusão do certificado e CI de staging corrigidos.
Erro de tipagem no novo validador corrigido; build passou após correção.
Primeira tentativa E2E bloqueada por rede (`EACCES`); reexecução autorizada passou.

## Ambiente DEV

Projeto **SABENÇA**, ref `fidndjlresfxvmerkbhs`, confirmado pelo usuário como DEV.
`.env.local` usa esse projeto. Preservados secrets, dados existentes e estrutura.
Testes integrados usaram apenas fixtures fictícias próprias, com limpeza ao concluir.

## Ambiente PROD

Projeto **SABENCA-PROD**, ref `qybcbxrxghykkchnvmhy`, organização **SirManoTreta's**,
região `us-east-1`, criado após confirmação de custo informado de US$ 0/mês.
Sete migrations aplicadas. Verificação: zero usuários Auth e zero arquivos Storage.
Não houve cópia de dados pessoais, usuários, senhas ou arquivos DEV.
Auth/SMTP, credenciais de conexão e primeiro administrador ainda precisam de configuração.

## Build

- `npm install`: passou.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: **204 testes / 15 arquivos passaram**.
- `npm run build`: passou, sem `ignoreBuildErrors`.
- Playwright: **18 testes desktop/mobile passaram**, build local com Supabase DEV, em 7,6 minutos.
- Certificado presente nos 26 manifests de rotas examinados.
- Validação online de SMTP, callbacks Vercel e aplicação hospedada ainda pendente.

## Segurança

Varredura por padrões comuns: 152 arquivos rastreados e seis commits locais, sem candidatos a secret real.
Nenhum `.env` real encontrado entre arquivos rastreados/histórico de nomes.
Comparação dos quatro secrets locais contra 25 arquivos do bundle de navegador: nenhuma ocorrência.
Essas verificações são limitadas aos padrões/valores examinados, não uma garantia sobre qualquer segredo possível.
`.env*` ignorados, `.env.example` preservado e `.vercel/` adicionado ao ignore.
`SUPABASE_SECRET_KEY` e acesso PostgreSQL permanecem em módulos `server-only`.

## Supabase

Comparação DEV/PROD: iguais tabelas, colunas/defaults, constraints, índices, triggers, policies,
funções de aplicação e configuração dos buckets. 19 tabelas com RLS em cada ambiente.
Histórico PROD alinhado aos identificadores originais após aplicação via conector.
Buckets `avatars`, `project-images`, `listing-images` privados, independentes e com mesmos limites.
Advisor PROD retornou somente seis avisos informativos de tabelas privadas sem policies;
mantido acesso exclusivo de backend, sem flexibilizar RLS.
Configuração Auth hospedada não é aplicada por migrations nem pelo `config.toml` local.

## Vercel

Projeto **sabenca**, plano Hobby, equipe **sirmanotreta's projects**,
ID `prj_Oln1yY6vWjAmcRXpmyn7gqn76GBq`, criado pelo navegador como projeto vazio.
Next.js, Node 24.x, raiz do repositório, instalação `npm ci`, build `npm run build`.
GitHub `SirManoTreta/sabenca` conectado. Responsável informou cadastro das variáveis Production e Preview (DEV).
`NEXT_PUBLIC_APP_URL` ainda ausente em Preview por decisão explícita; o código permite essa ausência.
Nenhum deploy/URL pública validado antes deste primeiro push.
Production acompanha `main`; acesso às variáveis de sistema habilitado. Zero deployments confirmado pelo conector.
Domínio automático reservado pela criação vazia: `project-q1u7y.vercel.app`, ainda sem aplicação publicada.

## Git/GitHub

Branch de trabalho: `codex/preparacao-hospedagem`. `develop` criada localmente a partir de `main`.
`main` não recebeu commits desta preparação. Alterações continuam locais, sem commit/push/PR.
Proteção da `main` documentada; não aplicada remotamente.

## Ações manuais restantes

1. Revisar/commitar alterações, integrar localmente em `develop` e publicar essa branch, conforme autorização.
2. Confirmar GitHub Actions e Preview automático; devolver a URL real ao responsável sem editar `NEXT_PUBLIC_APP_URL`.
3. Definir senha do banco PROD diretamente no painel, configurar Auth/SMTP e URLs permitidas;
   preparar primeiro admin PROD.
4. Validar fluxo completo no Preview de `develop`. Production fica para uma etapa futura, mediante nova autorização.
5. Configurar proteção da `main` quando checks já estiverem presentes no GitHub.

Passos, caminhos dos painéis e matriz completa: [DEPLOYMENT.md](DEPLOYMENT.md).
Nunca enviar credenciais pelo chat.

## Próximo passo recomendado

Publicar código revisado em `develop` após as quatro verificações locais. Variáveis informadas como
cadastradas pelo responsável; resultado dos serviços remotos será confirmado após o push.
