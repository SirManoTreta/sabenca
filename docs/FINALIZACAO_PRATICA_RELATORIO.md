# SABENÇA — finalização prática do TCC

Data: 22/10/2026. Trabalho na branch `develop`, com banco Supabase DEV `fidndjlresfxvmerkbhs`. Nenhuma alteração em PROD, merge em `main` ou deploy de produção. Publicação autorizada somente no [Preview de develop](https://sabenca-git-develop-sirmanotretas-projects.vercel.app), por commit e push nessa branch.

## Resumo

O Marketplace passou a integrar os certificados analisados pela plataforma aos anúncios de serviço. O aluno pode publicar com ou sem credencial, e o comprador visualiza a documentação elegível junto ao vínculo acadêmico do vendedor. O contato utiliza um link fornecido e autorizado pelo próprio aluno.

A administração também pode desativar efetivamente um anúncio denunciado e atualizar individualmente curso e semestre. Foram preservados os módulos existentes, sem novas dependências, chat, pagamentos ou mudanças de arquitetura.

## Banco de dados

Migrations novas, aplicadas somente ao DEV depois de testes com a cadeia completa em PGlite e conferência das dependências no banco hospedado:

1. `20261022191939_marketplace_credentials_contact_moderation.sql`:
   - `public.listings.certificate_id`: FK opcional para `profile_certificates`, com `ON DELETE SET NULL` e índice parcial. O vínculo direto atende à relação de uma credencial por anúncio sem tabela intermediária.
   - Trigger `listing_certificate`: permite apenas serviços e certificados do vendedor, verificados, com evidência e validade atual. Protege também requests diretos à Data API.
   - Trigger `certificates_evidence`: impede aprovação sem arquivo realmente presente no bucket privado ou URL HTTPS válida. Executa depois do trigger anterior, que devolve edições para `pending`.
   - Lookup `listing_credential`: deriva os metadados do certificado real em cada consulta. O wrapper público é invoker; a função privada verifica vínculo, status, data, evidência e privacidade.
   - `visible_certificates`: mantém documentos expirados como histórico, mas exige evidência e respeita bloqueios/vínculo ativo. A interface diferencia a expiração.
   - `public.marketplace_contacts`: link HTTPS e consentimento `enabled`, inicialmente desativado. RLS permite leitura e manutenção direta apenas ao titular. O lookup público retorna somente o contato autorizado e visível para aquele estudante.
   - `private.listing_moderation`: relaciona anúncio, denúncia, administrador e data da desativação. Sem grants para clientes. A RPC administrativa desativa o anúncio e registra a denúncia como `actioned` na mesma transação.
   - Trigger `listing_moderation_hold`: impede republicação do mesmo anúncio pelo vendedor após desativação administrativa.
   - Funções auxiliares usam `search_path=''` e grants explícitos. Funções privilegiadas permanecem em `private`.
2. `20261022192513_protect_reviewed_certificate_files.sql`:
   - Policy restritiva de INSERT no Storage impede substituir um original verificado por outros bytes no mesmo caminho, após excluir o objeto.
   - Uma edição do certificado deve devolvê-lo para análise antes de reutilizar o caminho. A ausência de policies de UPDATE para certificados já impede sobrescrita direta.

Os nomes locais foram alinhados às versões registradas pelo Supabase ao aplicar as migrations. Nenhuma migration anterior foi editada. O DEV passou de 12 para 14 migrations.

## Certificados

Uma credencial de anúncio é elegível quando pertence ao vendedor, tem status `verified`, possui evidência documental, já foi emitida e não expirou. O vendedor e o comprador também precisam atender às regras institucionais e de visibilidade existentes.

A evidência mínima é um arquivo presente em `storage.objects`, no bucket `certificates`, ou uma URL HTTPS sintaticamente válida, sem credenciais na autoridade. A aplicação não verifica automaticamente o conteúdo remoto da URL. O administrador deve abrir o arquivo e/ou consultar a fonte, analisar os dados e registrar sua decisão.

O código da credencial, isoladamente, não permite aprovação. A rejeição continua exigindo motivo. Data e administrador responsável continuam registrados pelo mecanismo existente; o controle por `updated_at` rejeita análise de uma versão desatualizada.

Editar título, emissor, datas, código, URL ou caminho do arquivo devolve o certificado para `pending` e limpa a aprovação anterior. A associação pode permanecer no banco, mas deixa de produzir credencial visível até nova aprovação. A rejeição também interrompe sua exibição. Ao editar o anúncio, o formulário oferece apenas credenciais atualmente elegíveis; nenhuma credencial é obrigatória.

A expiração considera o dia civil de `America/Sao_Paulo`: o documento é válido durante toda a data de vencimento e expira quando `expiration_date` é anterior ao dia atual. SQL e interface usam o mesmo calendário. Não há cópia de status ou datas de validação no anúncio, cron ou necessidade de atualizar anúncios à meia-noite.

Um documento expirado pode continuar no perfil como **“Credencial expirada · documento anteriormente verificado”**. Ele não aparece no seletor nem no anúncio como credencial válida. A administração pode registrar análise de documentação histórica, sem renovar sua validade temporal.

Excluir o certificado deixa `certificate_id` nulo e preserva o anúncio. Se o arquivo original desaparecer e não houver URL válida como evidência alternativa, o lookup também deixa de apresentar a credencial. A saída da comunidade ou bloqueio bilateral segue impedindo a leitura.

## Marketplace

O aluno cria ou edita um anúncio, escolhe uma categoria de serviço e pode selecionar **“Credencial relacionada ao serviço”**. A opção **“Nenhuma credencial”** mantém o experimento com anúncios sem documentação associada. Categorias de produtos não apresentam o seletor e o servidor/banco rejeitam vínculos indevidos.

Na página do anúncio, o comprador encontra vendedor, instituição, curso, semestre quando autorizado, credencial elegível e contato autorizado. A apresentação informa **“Credencial verificada pelo SABENÇA”** e **“Documento analisado e validado pela plataforma”**, sem garantir capacidade profissional ou autenticidade absoluta.

Os metadados do anúncio incluem somente identificador, título, emissor, emissão e expiração da credencial. Não incluem original, caminho privado, UUID do revisor ou motivo da rejeição.

## Contato e consentimento

Em **Perfil > Privacidade > Forma de contato para Marketplace**, o aluno informa um link HTTPS, como um endereço `wa.me` ou sua página de contato. Para exibi-lo, precisa marcar a autorização explícita. O formulário começa vazio e sem consentimento; não consulta ou preenche dados institucionais.

O botão **“Entrar em contato”** aparece no anúncio somente quando esse link foi configurado, autorizado e está visível ao comprador. Ocultar anúncios, bloquear o usuário em qualquer direção ou perder o vínculo ativo impede sua obtenção pela plataforma. Desmarcar a autorização retira o contato das próximas leituras. Um link já copiado por outro usuário não pode ser recolhido pela aplicação.

Links usam HTTPS, limite de tamanho e rejeição de credenciais embutidas. Não são aceitos `javascript:`, `mailto:`, HTTP ou URLs relativas. Foi escolhida uma única modalidade de contato por link para manter o escopo pequeno. Não há chat nem publicação automática de telefone, e-mail institucional, CPF ou nascimento.

## Moderação

Na fila de denúncias, o administrador abre **“Consultar conteúdo denunciado”**, lê o anúncio e pode confirmar **“Desativar anúncio denunciado”**. A operação registra `actioned`, responsável e data, preservando o conteúdo inativo e o vínculo com a denúncia enquanto o anúncio existir.

O vendedor continua podendo consultar/editar ou excluir o próprio conteúdo, mas não reativar aquele anúncio. A denúncia mantém o tratamento registrado se o conteúdo for posteriormente excluído. Não foram adicionadas penalidades, strikes, suspensão progressiva ou reconhecimento de recriação do mesmo conteúdo em outro anúncio. A reversão de uma desativação administrativa não ganhou uma nova interface nesta entrega.

## Atualização acadêmica

A opção escolhida foi edição administrativa individual, em **Alunos cadastrados > Atualizar curso e semestre**. Aceita curso do catálogo institucional e semestre entre 1 e 30, ou semestre não informado. Novas associações exigem curso ativo; o curso atual pode ser mantido se tiver sido inativado no catálogo. Um curso já definido pode ser trocado, mas não removido por esse formulário, preservando também a integridade dos registros migrados do campo legado. Alunos ainda sem curso podem manter essa ausência.

O serviço revalida o administrador na transação, restringe a instituição e utiliza o trigger existente `students_sync_profile`. Somente `course_id` e `semester` são escritos na ficha institucional. Identidade, autenticação, situação de acesso, biografia, projetos, anúncios e certificados permanecem preservados.

A reimportação continua preservando registros encontrados por RA/e-mail/CPF. Não foi introduzido um modo de sobrescrita em lote.

## Segurança

- O ator das Server Actions vem de `requireUser()` ou `requireAdmin()`, nunca de campos enviados pelo navegador.
- O serviço valida a credencial e o trigger repete a proteção no banco. Manipular `certificate_id`, perfil do vendedor, categoria ou status não contorna ownership e elegibilidade.
- A leitura pública usa metadados explícitos e considera instituição, membro autenticado, bloqueios e privacidade de anúncios. O contato cru só pode ser lido pelo titular; wrappers não expõem dados administrativos.
- As tabelas novas têm RLS e grants mínimos. O registro privado de moderação não pode ser alterado por estudantes. A RPC verifica o administrador e a instituição do anúncio.
- Os originais continuam privados, com download autorizado e links assinados temporários. Fingerprints HMAC de CPF e dados institucionais sensíveis não foram alterados ou publicados.

Security Advisors do DEV: nenhum ERROR. O WARN preexistente de proteção contra senhas vazadas continua presente. Os INFO de RLS sem policies em tabelas privadas representam negação deliberada de acesso de cliente, agora incluindo `listing_moderation`. Não houve alteração de configuração Auth ou recurso pago para eliminar avisos. O advisor de performance apresentou apenas índices ainda sem uso, incluindo o novo índice de certificado; os índices foram preservados.

## Testes

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 287 testes passaram, em 23 arquivos, sem skips. Inclui validações unitárias e integração SQL com todas as migrations, constraints, triggers, RLS e serviços reais em PGlite.
- `npm run build`: passou após a implementação de P0, P1 e P2.
- Build final: passou após os ajustes de compatibilidade e apresentação. Inspeção dos 34 chunks do cliente confirmou Supabase DEV, ausência da URL de PROD e ausência dos valores de `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `CPF_HMAC_SECRET` e `AUTH_HMAC_SECRET`.
- E2E novo de credencial/contato/moderação: 2/2 passaram, desktop e mobile, em 4,5 min.
- Playwright completo: 32/32 passaram em desktop/mobile, sem skips, em 27,8 min. Inclui os 28 cenários anteriores e quatro execuções dos dois cenários novos.
- Conferência final após os ajustes de compatibilidade do curso legado, texto de privacidade e espaçamento dos botões: build aprovado e 12/12 E2E dos percursos afetados passaram, sem skips, em 5,4 min.

Foram acrescentados nove testes unitários de calendário/contato, sete integrações de credenciais/contato/moderação e duas integrações de atualização acadêmica. Os testes existentes foram mantidos, sem redução de asserções para obter aprovação.

Os cenários cobrem certificado próprio, terceiro, inexistente, pendente, rejeitado, expirado, produto indevido, serviço opcional, edição, reanálise, exclusão, falta de evidência, motivo obrigatório, troca de arquivo, consentimento, privacidade, bloqueios e desativação administrativa com tentativa de republicação. A atualização acadêmica verifica também a preservação de identidade, Auth e conteúdo social.

Foram adicionados dois cenários Playwright, executados em desktop e mobile: jornada completa da credencial até moderação e edição administrativa do semestre com leitura no perfil. A suíte utiliza build local de produção com Supabase **DEV**, fixtures sintéticas e limpeza ao final; `SABENCA_E2E_PRODUCTION=1` seleciona `next start`, não o projeto PROD.

As capturas finais em 360 e 1440 px foram inspecionadas: credencial junto ao vendedor, leitura clara, botões com espaçamento e ausência de transbordamento horizontal. Os retestes são verificações adicionais dos mesmos cenários e não aumentam a contagem de cobertura.

Integridade do DEV após todas as rodadas: 14 migrations, 4 usuários Auth, 3 alunos institucionais, 3 perfis, 1 anúncio, 2 cursos, 1 administrador e 2 objetos de Storage. As fixtures não deixaram certificados, contatos, denúncias, desativações administrativas, bloqueios, preferências, convites ou itens de limpeza.

O servidor Next.js voltou a emitir `The destination stream closed early` em algumas navegações, aviso também registrado na rodada anterior do projeto. Não foi suprimido nem atribuído a uma causa sem evidência. Não houve falha de asserção nas rodadas concluídas.

Para reproduzir a rodada completa, com `.env.local` exclusivamente DEV:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
$env:SABENCA_E2E_PRODUCTION = '1'
$env:SABENCA_E2E_INTEGRATION = '1'
node --env-file=.env.local node_modules/@playwright/test/cli.js test --workers=1
```

## Rollback lógico

Preferir correção aditiva para frente. Reverter apenas o código não exige apagar tabelas ou certificados: as novas colunas são opcionais e os dados podem permanecer. A proteção de evidência e os bloqueios de moderação continuam importantes mesmo sem interface nova. Não remover policies, liberar originais ou restaurar o banco inteiro para reverter a interface.

Um build anterior pode não distinguir certificados expirados ou oferecer o controle de revogação do contato. Antes de retornar a esse build, preservar esses controles no código ou criar migration compensatória que suprima as credenciais expiradas do lookup e suspenda a leitura de contatos, mantendo os dados armazenados. Não devolver o selo antigo a um documento vencido.

Uma mudança futura nas regras deve ser registrada em nova migration. A promoção para PROD continua separada desta entrega e requer procedimento próprio, revisão e autorização; nenhuma operação de produção foi executada nesta rodada.

## Pendências

**Bloqueador técnico de entrega:** nenhum identificado. Regressão completa, build final, retestes dos percursos afetados e revisão visual concluídos.

**Antes de promover:** validar o Preview de `develop`, concluir a revisão humana em DEV e obter aprovação da promoção. Uma atualização futura de PROD deverá coordenar banco e aplicação separadamente desta entrega.

**Melhorias futuras:** chat interno relacionado a Marketplace/Networks, verificação por integração com emissores, reavaliação administrativa de anúncios desativados e atualização acadêmica em lote. A proteção de senhas vazadas permanece recomendação operacional anterior, fora das alterações funcionais solicitadas.

Os documentos públicos ainda mantêm o placeholder anterior de canal institucional oficial e responsável pelas solicitações. Seu preenchimento depende da instituição antes do uso definitivo; o contato voluntário do Marketplace não substitui esse canal.

## Informações para documentação do TCC

1. **Validação dos certificados.** A validação é manual e documental. O estudante fornece metadados e um arquivo ou URL HTTPS; o administrador consulta a evidência e aprova ou rejeita, com motivo obrigatório na rejeição. O sistema registra a análise e impede aprovação sem evidência mínima. Essa decisão confirma uma análise da documentação, sem comprovação automática de autenticidade ou competência profissional.
2. **Armazenamento.** Os arquivos ficam no bucket privado `certificates`, enquanto título, emissor, datas e estado de revisão ficam em `profile_certificates`. O caminho do objeto é utilizado somente pelos serviços autorizados. Não há cópia do original no anúncio nem dependência nova de armazenamento.
3. **Privacidade.** Autenticação, vínculo institucional, RLS, grants e funções de leitura delimitam o acesso. Apenas o titular e a administração acessam o documento original. Outros estudantes recebem metadados verificados autorizados; contatos pessoais dependem de preenchimento e consentimento separados. Bloqueios e privacidade também são considerados pelo banco.
4. **Associação com o anúncio.** A FK opcional `listings.certificate_id` relaciona um serviço ao certificado do próprio vendedor. O banco rejeita associações de terceiros ou documentos inelegíveis. O comprador encontra a credencial junto às informações acadêmicas e ao contato autorizado, integrando Marketplace e Perfil sem obrigar credencial em todo anúncio.
5. **Invalidação da análise.** A alteração dos metadados ou a substituição do arquivo pelo formulário, com novo caminho, devolve o certificado para `pending` e remove os dados da aprovação anterior. A leitura do anúncio deriva sua validade do certificado real, sem armazenar um selo independente. Rejeição, expiração ou perda de evidência interrompem sua apresentação como válido. A exclusão elimina somente o vínculo, preservando o anúncio.
6. **Tecnologias envolvidas.** Next.js 16, React 19, TypeScript, Zod, Tailwind CSS, Supabase Auth/Storage, PostgreSQL, Postgres.js, Vitest/PGlite e Playwright. Foram aproveitados Server Components, Server Actions, transações, constraints, triggers e RLS. As versões exatas permanecem em `package.json` e no lockfile; não houve instalação de nova dependência.
7. **Limitações atuais.** Não há OCR, IA, assinatura digital, consulta automática ao emissor ou comprovação automática do conteúdo da URL. O contato ocorre em serviço externo escolhido pelo aluno, e não há pagamento/entrega dentro do sistema. A validação humana e a preservação dos acessos administrativos continuam necessárias. A implementação possibilita o experimento de confiança, mas não constitui evidência de aumento de confiança: essa conclusão depende dos resultados da pesquisa.
8. **Trabalho futuro.** Um chat interno poderá integrar Marketplace e Networks em outra etapa. Esta entrega não cria tabelas, Realtime, notificações ou código antecipado para mensagens.
