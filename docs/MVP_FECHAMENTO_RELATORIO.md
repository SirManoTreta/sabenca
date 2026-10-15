# SABENÇA — relatório de fechamento do MVP

Data: 15/10/2026. Escopo: fechamento em DEV e preparação de PR. **Nenhuma promoção ou migration deste fechamento foi executada no PROD.**

## Estado inicial

`develop` estava em `a8e8387`, um commit de merge atrás de `main` (`b4235f7900b36a01d011e23244b487f870d77f43`), sem diferença de conteúdo. Foi sincronizada por fast-forward, sem force push. Havia somente o novo markdown de requisitos não versionado.

Auth institucional, importação, cursos, Perfil, projetos, Networks, Conexões e Marketplace já existiam. Foram preservados. Faltavam gestão de administradores, certificados, denúncias, bloqueio entre estudantes e privacidade opcional do Perfil. README e deploy descreviam uma situação anterior à promoção #3.

O Supabase DEV `fidndjlresfxvmerkbhs` estava INACTIVE. A restauração foi aceita pelo conector e o projeto voltou a ACTIVE_HEALTHY. A base inicial tinha 4 usuários Auth, 3 perfis e 2 objetos de Storage. `.env.local` e Preview foram conferidos como DEV; Production, como PROD `qybcbxrxghykkchnvmhy`.

## Implementado

| Área | Entrega |
| --- | --- |
| Administradores | Lista protegida, inclusão por e-mail normalizado, convite/reenvio e revogação. Contas existentes preservam senha e vínculo. Provisionamento parcial fica rastreável e pode ser repetido. Autorrevogação e remoção do último admin confirmado são impedidas. |
| Certificados | Cadastro, edição, exclusão confirmada, metadados progressivos e documento privado. Estados pendente/verificado/rejeitado, motivo de rejeição, análise por URL/código/documento e selo com linguagem limitada à análise da plataforma. |
| Revisão | Fila administrativa, download assinado de 60 s e controle de versão para impedir analisar um documento alterado após carregar a tela. Editar conteúdo ou documento devolve o registro para pendente. |
| Denúncias | Perfil e anúncio, validação do alvo, proibição de denúncia própria, unicidade por denunciante/alvo, limite de 10 por hora no banco e análise administrativa. O tratamento não suspende usuários automaticamente. |
| Bloqueio | Bloqueio direcionado na gestão e bilateral na comunidade. Remove conexões existentes/pendentes, impede novas solicitações e oculta descoberta, perfis, anúncios e arquivos sociais. Desbloquear não restaura relações. |
| Privacidade | Controles de semestre, bio, habilidades/tecnologias, interesses, projetos/links e anúncios/serviços. Proteção no banco e nos DTOs; os dados ocultos não são apenas escondidos no JSX. |
| Comunidade | Política de Privacidade, Termos de Uso, Regras da Comunidade e links públicos no rodapé. Contato institucional permanece como placeholder explícito, conforme o escopo autorizado. |
| UX | Formulários com labels e feedback, estados vazios/erro/loading, confirmação de exclusão/bloqueio e navegação integrada ao Perfil/admin. |

Experiências/formação separadas foram mantidas como melhoria futura: identidade acadêmica, projetos, habilidades, certificados e ofertas atendem ao recorte sem um currículo obrigatório. Feed, chat, pagamentos, eventos, vagas e seguidores permanecem fora do escopo.

## Correções encontradas

- A URL opcional vazia do certificado provocava exceção na validação. Agora aceita vazio e rejeita URLs malformadas/protocolos inadequados sem lançar erro fora do resultado de validação.
- O desbloqueio funcionava no banco, mas o formulário desmontava antes de mostrar a confirmação. O aviso agora persiste no destino da navegação.
- Documentos substituídos e uploads interrompidos são registrados em fila privada de limpeza; uploads em andamento têm janela de 15 minutos antes de poderem ser removidos por repetição.
- Um trigger BEFORE RLS podia produzir erros diferentes ao sondar bloqueio de um par de terceiros. A autorização de participante agora antecede a consulta de bloqueio.
- UUIDs Auth de revisores foram removidos dos grants de leitura da Data API.
- Fixture antiga que excluía o único admin foi adaptada para manter outro admin confirmado; o teste de revogação foi preservado.
- O placeholder `ModuleFoundation` e uma seleção de Perfil sem uso foram removidos. Instruções antigas de HMAC/deploy foram separadas da documentação operacional atual.

## Banco

Aplicadas **somente no DEV**, por CLI oficial, após execução das migrations em PGlite e dry-run:

1. `20261015144754_mvp_administration.sql`
2. `20261015145244_mvp_certificates.sql`
3. `20261015145544_mvp_moderation_privacy.sql`
4. `20261015153929_mvp_security_hardening.sql`

DEV tem 12 migrations; a base anterior tinha 8. Não houve clone de banco, sobrescrita de Auth ou mudança de IDs existentes.

Novas tabelas: `private.admin_access_events`, `private.certificate_file_cleanup`, `public.profile_certificates`, `public.user_blocks`, `public.profile_privacy`, `public.reports`. `private.admin_invitations` ganhou rastreamento de provisionamento. Foram adicionadas 20 policies e índices de ownership, filas e chaves estrangeiras.

Bio e semestre crus deixaram de ter SELECT para `authenticated`; o Perfil usa `social_profile`, e consultas de Networks/Marketplace/Conexões usam `private.visible_semester`. Relações sociais e Storage têm policies restritivas de bloqueio/visibilidade. As migrations preservam os dados anteriores.

## Storage

Bucket novo `certificates`: privado, 4 MiB, PDF/JPEG/PNG. Validação do servidor compara MIME, extensão e assinatura dos bytes; PDF exige cabeçalho e marcador de encerramento. A aplicação não promete antivírus ou detecção automática de fraude documental.

Dono e administrador podem baixar o original por URL assinada de 60 segundos, com disposição de download. Terceiros recebem somente metadados verificados, sem caminho do Storage, reviewer, motivo de rejeição ou URL permanente. Imagens existentes continuam privadas com URLs de até 300 segundos. Links já emitidos expiram naturalmente após bloqueio/alteração de visibilidade.

A fila de limpeza permite repetir remoção de documentos substituídos/interrompidos pela tela do dono. Não foi introduzido cron, novo serviço ou script de armazenamento de credenciais.

## Auth e segurança

O cadastro permanece fechado. Permissões vêm das tabelas institucionais e administrativas, nunca de `user_metadata`. Chaves privilegiadas e conexão SQL permanecem no servidor. Server Actions obtêm o ator da sessão e validam entradas; consultas usam parâmetros.

Verificações no DEV: nenhuma tabela de aplicação sem RLS; nenhum bucket público; dez funções privadas novas inspecionadas com `search_path` vazio e sem EXECUTE de `anon`. Wrappers públicos são invoker e delegam a funções que verificam o acesso. Dados institucionais sensíveis e IDs de revisores não integram os DTOs sociais.

Security Advisors: nenhum ERROR. Oito INFO de tabelas privadas sem policy são intencionais: sem grants de cliente, o padrão é negar acesso. Resta um WARN anterior sobre [proteção de senhas vazadas desabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Não houve ativação automática de recursos pagos. [Explicação do aviso de RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

`npm audit --omit=dev`: zero vulnerabilidades. `npm audit` completo: cinco HIGH na mesma cadeia de desenvolvimento `eslint-config-next → fast-glob → micromatch → braces`. O registry ainda informa `braces@3.0.3`, afetado por [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); a correção automática sugerida envolve downgrade incompatível de Next ESLint. Não foi aplicado `audit fix --force` nem upgrade major para ocultar o aviso.

A plataforma informou PostgreSQL 17.6 nos projetos. O [changelog de manutenção 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) requer avaliação de atualização da infraestrutura pelo responsável, incluindo compatibilidade de extensões. Não foi realizada manutenção do engine ou alteração no PROD durante o fechamento da aplicação.

## Testes e evidências

| Verificação | Resultado |
| --- | --- |
| `npm ci` | Passou; lockfile preservado. |
| `npm run lint` | Passou. |
| `npm run typecheck` | Passou. |
| Vitest | 269/269 passaram, em 22 arquivos: 163 unitários e 106 de integração SQL/PGlite; zero skips. |
| `npm run build` | Passou novamente após os testes completos. |
| Playwright completo | 26/26 cenários desktop/mobile passaram, sem skips, em 20,6 min. |
| Auth administrativo adicional | 2/2 cenários desktop/mobile passaram: recuperação nativa sem envio de e-mail, sessão, troca de senha, logout e novo login. Redirect de `/auth/convite` no develop aceito pelo Supabase. |
| Reteste pós-hardening | 4/4 passaram: API de Conexões e ciclo de certificados em desktop/mobile. |
| Preview hospedado | 2/2 cenários passaram: Perfil/portfólio com uploads privados e Auth administrativo. |

A suíte mantida tem 28 cenários Playwright distintos. A rodada completa começou antes da inclusão do cenário adicional de Auth, executado separadamente nos dois projetos. Retestes não são contados como funcionalidades ou cobertura adicionais. Larguras verificadas: 360, 390, 768, 1024 e 1440 px; formulários, navegação, Perfil, Marketplace, Networks, certificados e áreas administrativas novas. Revisão de labels, headings, controles nativos, confirmações e feedback; sem alegação de certificação WCAG.

Classificação Vitest feita pela execução SQL real, não pelo sufixo do arquivo: `database.test.ts` contém 17 testes de integração com PGlite e foi incluído nessa categoria. São oito arquivos de integração SQL e 14 de testes unitários.

Os testes hospedados criam fixtures sintéticas somente no DEV e removem seus registros/arquivos. Não enviam e-mails para endereços fictícios. Primeiro acesso e entrega SMTP mantêm a implementação anterior, testes de integração com entrega simulada e histórico de validação humana; não se afirma uma nova entrega real de e-mail nesta rodada.

Integridade final do DEV conferida após todas as rodadas: 4 usuários Auth, 3 perfis, 1 anúncio, 2 objetos de Storage, 2 cursos e 1 admin original. Zero certificados, denúncias, bloqueios, preferências, convites, eventos administrativos ou itens de limpeza deixados pelas fixtures. Os registros e arquivos originais foram preservados.

O Next.js emitiu `The destination stream closed early` em algumas navegações, sem falha de asserções na suíte concluída. O aviso não foi suprimido e sua causa não foi atribuída sem evidência.

## DEV, CI e Preview

Preview estável: [develop](https://sabenca-git-develop-sirmanotretas-projects.vercel.app). Deployment funcional validado: `dpl_2sJpAQLYsjZUbyZf2ZqNqKymmBvs`, [URL gerada](https://sabenca-kaw0vxze0-sirmanotretas-projects.vercel.app), READY, branch `develop`, SHA `da36694713f1a4d9346a619585ed6474df2ef222`.

O Preview exige autenticação Vercel. O conector oficial forneceu acesso temporário para os testes; a proteção permaneceu ativada. Doze chunks do cliente foram conferidos: Supabase DEV presente, PROD ausente. O acesso temporário e seus cookies não foram publicados nem versionados.

[CI de funcionalidades](https://github.com/SirManoTreta/sabenca/actions/runs/38760653748) e [CI da entrega completa](https://github.com/SirManoTreta/sabenca/actions/runs/38763575958): success. O Preview do SHA `aa590049475045a9e42e8ed89f244bbabfe4bc0b` também está READY: `dpl_4Qws8ghAdZ1V3WG7xH22SLxkTak1`, [URL gerada](https://sabenca-j8y1chvy3-sirmanotretas-projects.vercel.app). Não há diferença em `src/` entre o deployment funcional testado acima e esse SHA; a evolução foi de migration, testes e documentação.

## Documentação

- `docs/MVP_GAP_ANALYSIS.md`: auditoria inicial e classificação de escopo.
- `docs/MVP_ARQUITETURA_E_OPERACAO.md`: rotas, banco, permissões, arquivos, variáveis e operação.
- `docs/TCC_IMPLEMENTACAO_TECNICA.md`: tecnologias, decisões, dificuldades e segurança para a redação do TCC.
- `docs/DEMO_TCC.md`: roteiro de demonstração de 6–8 minutos.
- `README.md` e `docs/DEPLOYMENT.md`: estado atual e promoção incremental.
- `docs/DEPLOYMENT_PREPARACAO_2026_09_29.md`: preservação identificada do guia histórico.
- `.env.example`: orientação corrigida para preservar o HMAC dos fingerprints migrados, sem valores reais.

## Git e pré-promoção

Branch de trabalho: `develop`. Commits funcionais: `49621cd` (admin), `d4f784f` (certificados), `baa083f` (moderação/privacidade), `21c1b28` (documentos comunitários), `5977044` e `da36694` (testes), `76e54ed` (hardening) e `aa59004` (documentação de entrega). A atualização deste relatório registra a abertura da PR e os gates concluídos.

Comparação: `main...develop`, 70 caminhos alterados. Lista integral em `MVP_PRE_PROMOCAO.md`. [PR #4 — Finalizar MVP do SABENÇA](https://github.com/SirManoTreta/sabenca/pull/4), aberta com base `main` e head `develop`, pronta para revisão, sem merge ou auto-merge. A PR permanece aguardando autorização explícita de promoção.

## Production e rollback

`main` permanece em `b4235f7900b36a01d011e23244b487f870d77f43`. [Production](https://project-q1u7y.vercel.app) respondeu HTTP 200 na verificação pública, sem mutações ou uso de usuários reais para testes.

Após autorização explícita: validar conexão PROD, criar e validar backup, aplicar somente as quatro migrations novas, conferir RLS/Storage/Auth, fazer merge e aguardar build Production. Não copiar tabelas, Auth ou Storage do DEV novamente. Preservar HMAC dos fingerprints existentes e variáveis específicas de PROD.

**Compatibilidade:** o código anterior lê bio/semestre diretamente e não é compatível com os novos grants. Coordenar migration e deployment em janela curta; algumas páginas sociais antigas podem falhar de maneira fechada até o novo build assumir. Rollback de código requer migration compensatória revisada dos grants ou correção para frente. Não apagar tabelas novas com dados nem restaurar backup integral automaticamente, pois isso pode perder registros posteriores.

## Pendências e limites

O fechamento funcional foi concluído no DEV e a PR #4 está aberta. A promoção depende de autorização do responsável. Os avisos de dependência de desenvolvimento, proteção de senhas e manutenção do engine são riscos operacionais registrados, sem falso resultado de “audit total zero”. Preenchimento do contato institucional é necessário antes de adoção institucional definitiva; o placeholder é permitido para o TCC.

Não foram incluídas funcionalidades fora do recorte. Melhorias futuras não impedem demonstrar o percurso Marketplace ↔ Perfil ↔ Networks.
