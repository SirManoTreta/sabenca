# Fase 3 — Catálogo institucional, importação e Networks

## Estado da implementação

Implementados no código: `/admin/cursos`, referências institucionais de curso, modelo Excel, validação de cursos na importação, relatório CSV de erros e `/networks` com busca, filtros, cards e paginação. As migrations anteriores foram preservadas.

A migration `20260927030010_courses_networks.sql` foi aplicada ao Supabase em 27/09/2026, após autorização explícita do titular. A primeira tentativa havia sido bloqueada pela revisão automática por alterar schema, triggers e RLS do banco compartilhado. O arquivo local usa a versão registrada pelo Supabase.

## Catálogo e migração

- `public.courses` contém UUID, instituição, nome, nome normalizado, situação e datas. Apenas serviços de servidor, após verificação administrativa, podem criar e alterar cursos. A API do navegador recebe somente leitura protegida por RLS.
- A normalização considera caixa, espaços e Unicode NFC. Acentos, abreviações e nomes parecidos não são presumidos equivalentes. O índice único vale por instituição e inclui cursos inativos.
- `private.institution_students.course_id` e `public.profiles.course_id` referenciam o catálogo. A chave estrangeira composta impede vínculos entre instituições diferentes. Perfis recebem `institution_id` protegido contra edição social.
- Os textos antigos de `course` permanecem para auditoria. A aplicação consulta `courses.name`; renomear um curso não regrava os nomes em alunos ou perfis.
- A migration bloqueia as tabelas de origem durante a associação, verifica conflitos entre aluno e perfil e interrompe a transação diante de ambiguidade. Não exclui nem funde alunos/perfis. Valores de curso equivalentes pela regra documentada compartilham a mesma referência.
- Alunos associados impedem exclusão do curso por chave estrangeira. A interface oferece inativação. Um trigger exige curso ativo para novas associações e mantém cursos históricos intactos. Alterações institucionais de referência, nome ou semestre sincronizam as respectivas colunas protegidas do perfil.
- Cursos inativos continuam legíveis para exibir registros antigos. Os filtros padrão do Networks listam apenas ativos.

A auditoria remota anterior à migração encontrou um curso (`Computação (teste)`), um aluno e um perfil associados, sem divergências de curso nem perfil sem matrícula. Após a aplicação, os mesmos registros permaneceram presentes, com curso resolvido, referências consistentes, RLS ativa e sem escrita para o navegador. A auditoria após os E2E confirmou novamente um aluno, um perfil e um curso, zero divergências e nenhuma conta, imagem de Networks ou label temporária dos testes.

## Modelo e importação

`GET /admin/alunos/modelo` verifica o administrador antes de gerar `modelo-importacao-alunos-sabenca.xlsx`, usando o ExcelJS já instalado. A resposta usa `private, no-store`, anexo e `noindex, nofollow`.

O arquivo tem uma aba `Alunos`, apenas os cabeçalhos `ra`, `nome`, `email`, `telefone`, `data_nascimento`, `cpf`, `curso`, `semestre` e nenhum exemplo preenchido. RA, CPF e telefone usam formato Texto; a data usa `dd/mm/yyyy`; semestre usa `0`. Há cabeçalho azul, notas de preenchimento, autofiltro, larguras ajustadas e primeira linha congelada.

Curso e semestre continuam opcionais no MVP. Curso preenchido deve corresponder a um curso ativo da instituição; não há criação automática. Semestre permanece inteiro de 1 a 30.

A prévia continua sem gravar alunos ou histórico. A confirmação relê o arquivo, verifica o recibo, consulta novamente os cursos e segura os registros do catálogo até o commit. Mudança relevante desde a prévia exige nova análise. A identidade resolvida do curso integra o recibo para detectar substituições. O arquivo original não é armazenado.

O relatório de erros contém linha, RA, nome e erro, em CSV com BOM UTF-8 e separador `;`. Apenas linhas inválidas são incluídas; aspas são escapadas e textos que poderiam virar fórmulas recebem proteção. CPF, e-mail, telefone e nascimento não entram no relatório.

## Networks

`src/services/networks.ts` valida os parâmetros com Zod e executa consultas parametrizadas sob `SET LOCAL ROLE authenticated`, com identidade restrita à transação. RLS permanece aplicada mesmo usando a conexão de servidor. Uma conta administrativa sem vínculo estudantil não recebe acesso ao módulo.

Busca geral por nome, username ou habilidade; curso, semestre, habilidade e interesse combinam com AND. `%`, `_` e barras de escape na busca são tratados literalmente. Filtros estruturados usam UUIDs na URL. Busca tem até 100 caracteres, semestre 1–30 e página 1–10.000; parâmetros inválidos produzem mensagem visível, sem executar uma busca ampliada silenciosamente.

A consulta retorna 24 estudantes por página, em ordem de nome e UUID para desempate estável. Exclui o usuário atual e perfis sem username. A RLS de perfis também exige que o estudante consultado esteja ativo, com conta confirmada e sem banimento. Assim, bloqueados não acessam nem aparecem no diretório.

Contagem e página usam a mesma consulta. Habilidades e interesses são carregados em duas consultas em lote, restritas aos perfis da página. Avatares são assinados em uma única chamada de Storage, com validade de cinco minutos; falhas usam iniciais como alternativa. Nenhuma URL assinada entra no cache compartilhado de imagens.

O DTO contém apenas UUID do perfil, username, nome, curso, semestre, instituição, avatar e labels sociais. Não retorna RA, e-mail, telefone, nascimento, CPF, fingerprint ou identidade Auth. Os cards mostram até três habilidades e três interesses, com indicador dos restantes. Dados acadêmicos ficam separados dos dados sociais, sem certificação de habilidades.

`/networks` e `/users/[username]` permanecem internos, dinâmicos, com `noindex, nofollow` e `private, no-store`. A grade usa uma, duas ou três colunas conforme a largura. Busca e filtros são enviados por formulário GET; paginação mantém todos os parâmetros e nova busca reinicia a página.

## Verificações

Validação em 27/09/2026: **lint, TypeScript, 153 testes de aplicação/banco e build de produção passaram**. Os **12 cenários E2E foram aprovados** contra o build de produção em desktop e celular: seis públicos, dois de perfil e quatro de Networks/administração. A execução completa aprovou oito; após ajustar a espera pelo carregamento do avatar e os seletores de texto com semestre, os quatro cenários afetados foram repetidos e passaram. Os testes autenticados usaram o Supabase real com autorização e dados fictícios temporários. O workflow do GitHub Actions valida o commit enviado por push.

Comandos:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

A suíte de aplicação/banco cobre migração preservando referências e abortando conflitos, criação administrativa, rejeição de escrita pelo navegador, normalização, renomeação, inativação, chave estrangeira restritiva, revalidação de importação, modelo preenchido em memória passando pelo parser, CSV, filtros, interseção, paginação, exclusões, RLS e privacidade.

Os E2E públicos verificam também proteção de `/admin/cursos` e `/admin/alunos/modelo`. Os E2E autenticados são opt-in e criam somente contas, cursos, imagens e matrículas fictícias temporárias. Conferem catálogo, download, importação, busca, filtros, perfil, retorno à URL anterior, imagens assinadas e ausência de rolagem horizontal em desktop e celular. A limpeza é restrita aos IDs gerados pelos fixtures.

Para executar contra um ambiente de integração autorizado e com as migrations aplicadas:

```powershell
npm run build
$env:SABENCA_E2E_INTEGRATION = '1'
$env:SABENCA_E2E_PRODUCTION = '1'
node --env-file=.env.local node_modules/@playwright/test/cli.js test --workers=1
Remove-Item Env:SABENCA_E2E_INTEGRATION
Remove-Item Env:SABENCA_E2E_PRODUCTION
```

O GitHub Actions existente executa lint, TypeScript, testes, build e E2E públicos. Os E2E autenticados exigem ambiente autorizado e credenciais privadas; não são apresentados como executados quando ignorados por falta do opt-in.

## Limites e operação

- Aplicar a nova migration antes de executar os novos fluxos contra qualquer banco existente. A aplicação usa as novas colunas; não existe fallback que volte a gravar cursos livres.
- A estrutura do catálogo separa instituições, mas o acesso permanece limitado à FATECE conforme as fases anteriores. Não há multi-tenant completo.
- Busca parcial usa PostgreSQL `ILIKE`, sem motor externo ou ranking. Avaliar índices de trigramas somente se o volume e medições exigirem.
- Marketplace, conexões, seguidores, chat e recomendações não fazem parte desta entrega.
- A CLI do Supabase precisou de acesso à sua telemetria fora do workspace. Não foram alteradas credenciais ou dependências.
- A primeira execução de Playwright no sandbox passou nos seis cenários, mas ficou presa ao encerrar o servidor de desenvolvimento. Foi interrompida e repetida fora do sandbox contra o build de produção, concluindo com código de saída zero.
- O advisor de segurança não identificou novos problemas nesta fase. Permanecem as tabelas privadas sem policies de API, deliberadamente isoladas, e o aviso anterior de [proteção contra senhas vazadas desabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
