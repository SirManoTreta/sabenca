# Transição das credenciais de serviço

Este procedimento promove somente a coleção de até três credenciais e sua correção de compatibilidade. `listing_certificates` continua autoritativa. O banco mantém `listings.certificate_id` como projeção do primeiro vínculo histórico por `position`, em transação; os serviços novos não fazem dupla gravação.

## Compatibilidade e rollback

O deployment anterior pode criar, trocar e remover uma seleção de zero ou uma credencial elegível. A troca/remoção deve ser feita separadamente de alterações nos demais campos: uma requisição legada que muda a seleção e outros campos falha inteira, pois não possui token de versão capaz de distinguir uma escolha nova de um formulário antigo.

Qualquer UPDATE legado que envie `certificate_id` em um anúncio com duas ou três associações é recusado explicitamente. Isso inclui um formulário antigo que tenta salvar somente o título, pois ele também envia essa coluna. Nenhum campo nem vínculo é alterado quando a operação falha. Um vínculo histórico inelegível, oculto do formulário antigo, também exige a aplicação atual para troca ou remoção.

O deployment anterior continua permitindo leitura, contato e os demais fluxos já disponíveis. Em anúncios com várias credenciais, sua interface apresenta somente o primeiro documento elegível e não gerencia a coleção. O usuário deve acessar o deployment atual para essas edições; a proteção efetiva permanece no banco, inclusive para clientes antigos, chamadas diretas e requisições em andamento. Atualizar a página não é o mecanismo de integridade.

Antes de aplicar, registrar o deployment que está atendendo Production. Esse é o destino de rollback da aplicação, sujeito às restrições acima. Não escolher automaticamente um deployment mais antigo do MVP. Em falha grave, retornar o tráfego ao deployment registrado, preservar a coleção e priorizar correção aditiva. Não apagar tabelas, não restaurar dados por cima dos novos nem sincronizar manualmente a coluna legada.

## Aplicação atômica

Arquivos, nesta ordem:

1. `20261027191347_listing_multiple_certificates.sql`, sem alterações em relação ao arquivo já aplicado em DEV.
2. `20261028225717_listing_credentials_legacy_compatibility.sql`.

**PROD parte de 14 e chega a 16 migrations em uma única transação.** O executor executa o SQL integral do primeiro arquivo, registra sua versão e SQL reais, executa o segundo arquivo e registra sua versão e SQL reais antes de um único commit. A aplicação antiga jamais observa o guard intermediário da primeira migration.

**DEV parte de 15 e chega a 16**, executando somente a correção. Não repetir a migration original. Um histórico já completo é validado sem repetir SQL. Um estado parcial de 15 em PROD é rejeitado para investigação.

O executor versionado é `scripts/release-credentials.mjs`. Ele valida o project ref pela conexão, o HEAD revisado, os arquivos contra esse commit e o inventário de exatamente 16 versões. Mantém locks no histórico e nas tabelas envolvidas, confere novamente o histórico dentro da transação e verifica preservação antes do commit. Falha em qualquer arquivo, registro de histórico ou invariante desfaz ambos os arquivos e os registros de histórico. Não são duas chamadas consecutivas de migration.

O ensaio isolado em `tests/release-credentials.test.ts` injeta uma falha SQL na segunda migration e confirma que o banco continua com 14 registros de histórico, sem a tabela nova e com os dados antigos intactos; a tentativa posterior executa ambos os arquivos de verdade.

## Validação em DEV

Executar a partir do checkout revisado em `develop`, com a correção commitada. O arquivo privado existente fornece somente configuração ao processo; seu conteúdo não deve aparecer em logs.

```powershell
$releaseSha = (git rev-parse HEAD).Trim()
$devEvidence = '.local/release-credentials-compatibility-20261028/dev'
node --env-file=.migration.env scripts/release-credentials.mjs --environment DEV --expected-sha $releaseSha --evidence-dir $devEvidence --mode prepare
node --env-file=.migration.env scripts/release-credentials.mjs --environment DEV --expected-sha $releaseSha --evidence-dir $devEvidence --mode apply
node --env-file=.migration.env scripts/release-credentials.mjs --environment DEV --expected-sha $releaseSha --evidence-dir $devEvidence --mode validate
```

Preparar evidências em diretório novo; o executor não sobrescreve o baseline. `prepare` e `validate` usam transações de leitura. Os hashes de preservação excluem somente `certificate_id` e `updated_at` de `listings`, pois a projeção pode normalizá-los. Os vínculos e sua ordem são verificados separadamente, e a projeção deve coincidir com o primeiro vínculo bruto. Conteúdo dos demais campos e tabelas anteriores deve permanecer preservado.

Executar lint, typecheck, testes, build e E2E autenticados relevantes em DEV, incluindo concorrência real entre sessões antigas e novas. Validar o Preview do mesmo commit. Separar as contagens de E2E executados e ignorados na CI pública das execuções autenticadas em DEV/Preview.

## Retomada em Production

1. Reconfirmar SHAs, diff completo, CI, Preview, identidade/saúde de PROD, histórico, Advisors, contagens e vínculos. Interromper se houver conteúdo adicional fora do escopo.
2. Registrar deployment ativo e aliases como baseline de rollback. Conferir as limitações da aplicação antiga acima com o schema corrigido.
3. Executar `prepare` em PROD e criar um backup novo pelo procedimento do projeto: snapshot lógico consistente, roles sem senhas, arquivos físicos Storage, checksums e leitura integral do arquivo por `pg_restore`, sem restaurar sobre PROD. Preservar backups anteriores e usar um diretório/estado novo do helper revisado. Integridade de arquivo não equivale a ensaio de restauração; registrar as flags de ambos separadamente.
4. Aplicar o conjunto pelo comando atômico abaixo, conferir 16 migrations, catálogo, associações, projeção, dados e Advisors. Validar também a versão antiga ainda ativa antes do merge.
5. Integrar somente o conteúdo revisado por PR normal de `develop` para `main`, respeitando checks e sem bypass. Aguardar a CI e o deployment Git de Production originado do SHA final de `main`.
6. Confirmar `READY`, branch `main`, ambiente Production, domínio canônico e conexão efetiva com Supabase PROD. Não promover o artefato Preview nem copiar suas variáveis.
7. Executar smoke autenticado com contas fictícias, incluindo leitura do anúncio preexistente sem editá-lo, seleções/remoções reais, apresentação para outro aluno, privacidade dos originais e rejeições explícitas. Remover apenas dados criados pelo smoke, preservar auditoria e comparar novamente as contagens e hashes estáveis. Consultar logs Vercel/Functions e Supabase/Postgres, distinguindo rejeições intencionais de regressões.

```powershell
$releaseSha = (git rev-parse HEAD).Trim()
$prodEvidence = '.local/release-credentials-compatibility-20261028/prod'
node --env-file=.migration.env scripts/release-credentials.mjs --environment PROD --expected-sha $releaseSha --evidence-dir $prodEvidence --mode prepare
# Criar e verificar o backup novo pelo helper revisado do procedimento existente.
$backupState = '.local/release-credentials-compatibility-20261028/backup-state.json'
node --env-file=.migration.env scripts/release-credentials.mjs --environment PROD --expected-sha $releaseSha --evidence-dir $prodEvidence --mode apply --backup-state $backupState
node --env-file=.migration.env scripts/release-credentials.mjs --environment PROD --expected-sha $releaseSha --evidence-dir $prodEvidence --mode validate
```

`apply` exige que o backup seja de PROD, concluído depois desse baseline e há menos de duas horas. Reconfere SHA-256 do manifest e de cada artefato, flags de leitura integral e consistência Storage, além dos fingerprints atuais de perfis, anúncios, certificados, administradores, alunos institucionais e objetos Storage. Mudanças nesses dados desde o backup exigem novo backup. Sessões e contadores operacionais normais de autenticação não são confundidos com registros de negócio.

Nunca aplicar a migration original isoladamente em PROD, usar um push de migrations genérico que inclua outro conteúdo ou marcar uma versão como executada sem aplicar seu SQL. Se a transação falhar, investigar e repetir a sequência validada; não prosseguir para merge sobre estado parcial.
