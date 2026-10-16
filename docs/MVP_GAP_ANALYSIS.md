# Fechamento do MVP — auditoria inicial

Data: 15/10/2026. Base: `b4235f7`. Trabalho em `develop`; Production preservada.

## Estado confirmado

- `origin/main` estava um merge à frente de `origin/develop`, sem diferença de conteúdo. Sincronização local por fast-forward.
- `.env.local`: URL Supabase e conexão PostgreSQL correspondem exclusivamente ao DEV `fidndjlresfxvmerkbhs`.
- DEV estava INACTIVE; restauração solicitada pelo conector oficial. PROD continua ACTIVE_HEALTHY.
- Há oito migrations versionadas, 18 arquivos Vitest e cinco arquivos Playwright. Quantidades de testes serão confirmadas por execução.

## Inventário de escopo

| Área | Classificação inicial | Evidência / trabalho necessário |
| --- | --- | --- |
| Auth institucional, primeiro acesso, recuperação | Já implementado | `auth/actions.ts`, guard de inscrição, vínculo privado, testes de integração. Revalidar após restauração. |
| Administração e importação | Já implementado | Alunos, cursos, prévia XLSX e histórico protegidos por `requireAdmin` e autorização transacional. |
| Gestão de administradores | Faltando | Bootstrap manual existente; criar interface, proteção de revogação e recuperação de provisionamento parcial. |
| Perfil, habilidades, interesses, projetos | Já implementado | DTO explícito, uploads privados, ownership e testes existentes. |
| Certificados e revisão administrativa | Faltando | Criar metadados, bucket privado, fluxo de análise e testes. |
| Marketplace | Já implementado | CRUD, serviços, status, pesquisa, imagens e proprietário. Revisar erros/limpeza e integrar denúncia. |
| Networks e conexões | Já implementado | Filtros, paginação e transições com RLS. Integrar bloqueio bilateral. |
| Denúncias | Faltando | Criar envio e fila administrativa, proteção contra duplicatas. |
| Bloqueio entre estudantes | Faltando | Bloqueio institucional existente não substitui bloqueio social. |
| Privacidade opcional do perfil | Faltando | Dados institucionais já separados; visibilidade de campos sociais ainda não configurável. |
| Documentos comunitários | Faltando | Páginas públicas e links de acesso. |
| UX, acessibilidade, responsividade | Parcialmente implementado | Padrões de formulário, estados vazios/erros existentes. Ampliar validação para cinco larguras e novas áreas. |
| CI e testes | Parcialmente implementado | Pipeline existente; ampliar cobertura dos novos fluxos, preservar regressões. |
| Documentação | Parcialmente implementado | README contém estado anterior à promoção #3; corrigir e criar documentos de TCC, demo e promoção. |
| Experiências/formação separadas | Melhoria futura | Curso, instituição, projetos e certificados atendem ao recorte; evitar currículo obrigatório. |
| Feed, chat, pagamentos, eventos, vagas, seguidores | Fora do escopo | Não serão implementados. |

## Observações de auditoria

- Busca por TODO/FIXME não encontrou marcadores de implementação pendente em `src` ou `tests`.
- Arquivos institucionais permanecem em `private`; páginas sociais selecionam campos explicitamente. Revisar novos caminhos e acesso direto pela Data API.
- Uso privilegiado do banco deve sempre revalidar o ator no servidor; novas tabelas expostas exigem RLS e grants mínimos.
- PDFs de certificados devem respeitar o limite real de requests da Vercel. Limite de upload escolhido: 4 MiB, dentro do body limit atual.
- Nenhuma migration nova será aplicada ao PROD antes da autorização final de promoção.

## Sequência de execução

1. Restaurar/validar DEV, conferir ambientes hospedados e executar baseline.
2. Gestão de administradores e testes.
3. Certificados privados e revisão administrativa.
4. Denúncias, bloqueio bilateral e privacidade efetiva.
5. Acabamento, documentos comunitários e testes completos.
6. Aplicar migrations somente no DEV, validar Preview e preparar PR `develop → main` sem merge.

Este arquivo registra a auditoria inicial. Resultados finais e limitações serão registrados separadamente, com evidências dos testes executados.

## Resultado da execução

As cinco lacunas funcionais foram implementadas: gestão de administradores, certificados com análise manual, denúncias, bloqueio bilateral e privacidade por seção. Documentos comunitários, operação, TCC e roteiro de demonstração foram adicionados. O DEV foi restaurado e recebeu migrations incrementais; Production foi preservada. O placeholder de módulos da fundação, sem referências, foi removido.

A revisão final também acrescentou proteção contra sondagem do estado de bloqueio de terceiros em um trigger BEFORE RLS e retirou a leitura de UUIDs administrativos de revisão pela API. A confirmação de desbloqueio foi movida para um aviso persistente após a navegação. A validação de URL opcional do certificado aceita o campo vazio sem lançar exceção.

Consulte `MVP_FECHAMENTO_RELATORIO.md` para resultados medidos, CI, Preview, riscos e situação da promoção. A classificação acima permanece como registro do estado encontrado, não como lista de funcionalidades ainda ausentes.
