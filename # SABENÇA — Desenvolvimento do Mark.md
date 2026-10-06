# SABENÇA — Desenvolvimento do Marketplace MVP

## Contexto

O SABENÇA é uma plataforma universitária fechada baseada em três pilares:

1. Marketplace universitário;
2. Networks;
3. Perfil acadêmico/profissional com características de rede social.

Perfil, Networks e Conexões já estão em estágio avançado.

O Marketplace é agora a próxima grande fase do MVP.

O objetivo NÃO é criar uma cópia da OLX.

O Marketplace deve aproveitar o contexto universitário e a integração existente entre:

Marketplace → Perfil → Networks → Conexões.

Exemplo:

Um estudante publica que oferece desenvolvimento de sites.

Outro estudante encontra o anúncio no Marketplace, abre o perfil do vendedor, verifica suas habilidades e projetos e pode criar uma conexão.

---

# 1. Regras antes de desenvolver

Antes de modificar qualquer arquivo:

1. Analise a branch `develop` atual.
2. Analise a implementação existente de:
   - Perfil;
   - Networks;
   - Conexões;
   - autenticação;
   - Storage;
   - Server Actions;
   - validações;
   - componentes reutilizáveis;
   - tratamento de erros.
3. Preserve os padrões arquiteturais já utilizados pelo projeto.
4. Não introduza bibliotecas sem necessidade.
5. Não faça alterações em `main`.
6. Não alterar Production.
7. Não alterar dados do Supabase PROD.
8. Todo desenvolvimento e teste deve ocorrer usando o Supabase DEV.

Preferencialmente crie uma branch:

`feature/marketplace-mvp`

a partir de:

`develop`

---

# 2. Estado atual do banco

O banco já possui estrutura inicial para Marketplace.

Analise antes de criar qualquer migration.

Já existem:

- `public.listings`;
- `public.listing_images`;
- `public.categories`;
- bucket privado `listing-images`;
- índices;
- grants;
- RLS;
- policies de proprietário;
- policies de leitura para membros.

A tabela `listings` já contém aproximadamente:

- id;
- seller_id;
- title;
- description;
- price;
- category_id;
- condition;
- status;
- created_at;
- updated_at.

Estados existentes:

`active`
`sold`
`inactive`

Condições existentes:

`new`
`like_new`
`used`
`not_applicable`

Categorias iniciais existentes:

- Livros;
- Materiais acadêmicos;
- Eletrônicos;
- Informática;
- Serviços;
- Aulas particulares;
- Freelance;
- Outros.

A tabela `listing_images` já possui:

- id;
- listing_id;
- image_url;
- position.

O bucket:

`listing-images`

já existe e é privado.

NÃO recriar essas estruturas.

Caso alguma alteração realmente seja necessária:

1. explique o motivo;
2. crie uma nova migration;
3. nunca edite migrations antigas já aplicadas;
4. aplique somente no DEV durante o desenvolvimento.

---

# 3. Objetivo do Marketplace MVP

O Marketplace deve permitir:

- visualizar anúncios;
- pesquisar anúncios;
- filtrar anúncios;
- visualizar detalhes;
- criar anúncio;
- editar anúncio;
- remover anúncio;
- alterar status;
- adicionar imagens;
- remover imagens;
- identificar o vendedor;
- acessar o perfil do vendedor;
- visualizar anúncios publicados por um estudante.

Produtos e serviços devem utilizar a mesma base de anúncios.

Não criar dois Marketplaces separados.

---

# 4. Página principal

Substituir o placeholder atual de:

`/marketplace`

por uma página funcional.

A página deve possuir:

## Cabeçalho

- título "Marketplace";
- campo de pesquisa;
- botão "Criar anúncio".

Exemplo conceitual:

Marketplace

[ Buscar livros, serviços, eletrônicos... ]

[ Criar anúncio ]

---

## Filtros

Permitir inicialmente:

- categoria;
- condição;
- faixa de preço;
- status quando estiver visualizando os próprios anúncios.

Categorias devem vir do banco.

Não manter categorias duplicadas hardcoded no frontend.

---

# 5. Cards dos anúncios

Cada anúncio deve possuir um card simples.

Exibir:

- imagem principal;
- título;
- preço;
- categoria;
- condição quando aplicável;
- nome do vendedor;
- curso do vendedor, quando disponível;
- data ou indicação relativa de publicação.

Exemplo:

┌─────────────────────────────┐
│          imagem             │
├─────────────────────────────┤
│ Livro de Cálculo            │
│                             │
│ R$ 45,00                    │
│ Livros • Usado              │
│                             │
│ João Silva                  │
│ Ciência da Computação       │
└─────────────────────────────┘

Para serviços:

┌─────────────────────────────┐
│          imagem             │
├─────────────────────────────┤
│ Desenvolvimento de sites    │
│                             │
│ R$ 300,00                   │
│ Serviços                    │
│                             │
│ Maria Oliveira              │
│ Ciência da Computação       │
└─────────────────────────────┘

Não mostrar "condição" para serviços quando `condition = not_applicable`.

---

# 6. Pesquisa

Implementar pesquisa por texto.

Pesquisar inicialmente por:

- título;
- descrição.

Se possível sem aumentar excessivamente a complexidade, também considerar:

- nome do vendedor.

Não implementar ElasticSearch ou serviço externo.

Utilizar PostgreSQL/Supabase.

A solução deve ser compatível com o tamanho esperado do MVP.

---

# 7. Filtros

Implementar filtros combináveis.

Inicialmente:

## Categoria

Exemplo:

- Todas;
- Livros;
- Eletrônicos;
- Serviços;
- Freelance.

## Condição

- Novo;
- Como novo;
- Usado.

Não aplicar esse filtro a serviços quando não fizer sentido.

## Preço

Inicialmente pode utilizar:

- mínimo;
- máximo.

Não é necessário desenvolver slider complexo.

---

# 8. Ordenação

Permitir:

- mais recentes;
- menor preço;
- maior preço.

O padrão deve ser:

`Mais recentes`

---

# 9. Paginação

Não carregar todos os anúncios de uma vez.

Implementar paginação.

Pode utilizar:

- páginas tradicionais;
ou
- "Carregar mais".

Escolha a alternativa que melhor se encaixar na arquitetura atual.

Evitar infinite scroll complexo no MVP.

---

# 10. Detalhes do anúncio

Criar rota adequada para visualização de anúncio.

Exemplo conceitual:

`/marketplace/[id]`

A página deverá mostrar:

- galeria de imagens;
- título;
- preço;
- descrição;
- categoria;
- condição;
- status;
- data de publicação;
- vendedor.

---

# 11. Vendedor

A integração com Perfil é parte fundamental do SABENÇA.

Na página do anúncio mostrar:

"Vendido/oferecido por"

- avatar;
- nome;
- curso;
- semestre quando disponível;
- instituição quando adequado.

Adicionar:

`Ver perfil`

O botão deve levar ao perfil público existente daquele estudante.

Não duplicar dados do Perfil dentro da tabela `listings`.

O anúncio deve referenciar o perfil através de `seller_id`.

---

# 12. Contato

NÃO implementar chat interno nesta fase.

O contato inicial deverá aproveitar funcionalidades existentes.

Prioridade:

1. acessar perfil do vendedor;
2. verificar habilidades/projetos;
3. usar o sistema de conexão existente.

Se houver forma segura e já existente de contato no perfil, reutilizá-la.

Não expor:

- CPF;
- RA;
- e-mail privado;
- telefone privado;
- outros dados institucionais.

---

# 13. Criação de anúncio

Criar rota/interface como:

`/marketplace/novo`

ou equivalente conforme o padrão atual.

Campos:

## Obrigatórios

- título;
- descrição;
- preço;
- categoria;
- condição.

## Imagens

Permitir múltiplas imagens.

Usar o bucket:

`listing-images`

Não criar novo bucket.

---

# 14. Produtos e serviços

Produtos e serviços devem usar `listings`.

Para produtos:

`condition` deve permitir:

- new;
- like_new;
- used.

Para categorias de serviço:

`condition = not_applicable`

Categorias como:

- Serviços;
- Aulas particulares;
- Freelance;

não precisam apresentar seleção de condição para o usuário.

Definir isso de maneira clara na camada de domínio/validação.

Não depender apenas do frontend para garantir a consistência.

---

# 15. Preço

Salvar o valor de acordo com o tipo já existente no PostgreSQL.

No frontend:

Exemplo:

`45,00`

deve ser exibido como:

`R$ 45,00`

Utilizar formatação brasileira:

`pt-BR`

Evitar problemas clássicos envolvendo vírgula e ponto decimal.

O servidor deve validar o valor novamente.

---

# 16. Validação

Utilizar o padrão atual do projeto, preferencialmente Zod onde já for utilizado.

Validar no servidor:

## Título

- obrigatório;
- entre 3 e 120 caracteres.

## Descrição

- obrigatória;
- até o limite existente no banco.

## Preço

- número válido;
- >= 0;
- dentro do limite do banco.

## Categoria

- precisa existir.

## Condição

Somente:

- new;
- like_new;
- used;
- not_applicable.

Não confiar exclusivamente nos valores recebidos pelo navegador.

---

# 17. Upload de imagens

Reutilizar a arquitetura utilizada por:

- avatar;
- imagens de projetos.

Bucket:

`listing-images`

Estrutura esperada:

`<auth-user-uuid>/<listing-uuid>/<arquivo>`

Respeitar as policies já existentes.

Limitar uploads conforme a validação atual do SABENÇA.

A aplicação atualmente trabalha com limite de aproximadamente 4 MiB por imagem para compatibilidade com a Vercel.

Aceitar somente:

- image/jpeg;
- image/png;
- image/webp.

Não confiar somente na extensão do arquivo.

---

# 18. Quantidade de imagens

A estrutura atual suporta posições de 0 a 9.

Para o MVP, limitar a:

`até 5 imagens por anúncio`

salvo se houver motivo técnico claro para utilizar outro limite.

A primeira imagem deve funcionar como capa.

---

# 19. Imagens privadas

O bucket é privado.

Não transformar `listing-images` em bucket público.

Para visualização:

- utilizar signed URLs;
- seguir os padrões existentes do projeto;
- respeitar autorização da aplicação.

Evitar URLs públicas permanentes.

---

# 20. Exclusão de imagem

Quando uma imagem for removida:

1. remover referência da tabela quando necessário;
2. remover objeto do Storage;
3. reorganizar posições.

Evitar arquivos órfãos.

---

# 21. Criação segura do anúncio

A criação precisa garantir que:

`seller_id`

corresponda ao perfil autenticado.

O cliente NÃO pode escolher arbitrariamente outro `seller_id`.

Mesmo que RLS já impeça isso, validar corretamente na aplicação.

---

# 22. Meus anúncios

Criar uma área acessível ao usuário.

Pode ser:

`/marketplace/meus-anuncios`

ou integrar ao Perfil, de acordo com a arquitetura atual.

Mostrar:

- ativos;
- vendidos;
- inativos.

Permitir:

- editar;
- marcar como vendido;
- desativar;
- reativar quando aplicável;
- excluir.

---

# 23. Edição

Criar rota adequada:

`/marketplace/[id]/editar`

Somente o proprietário pode editar.

Permitir alterar:

- título;
- descrição;
- preço;
- categoria;
- condição;
- imagens.

`seller_id` nunca pode ser alterado.

---

# 24. Status

Usar os valores existentes:

`active`
`sold`
`inactive`

Comportamento:

## active

Aparece normalmente no Marketplace.

## sold

Não aparece como disponível nas buscas comuns.

No próprio anúncio mostrar:

`Vendido`

## inactive

Oculto do Marketplace para outros usuários.

Continua disponível para o proprietário em "Meus anúncios".

---

# 25. Exclusão

Permitir exclusão somente pelo proprietário.

Antes da exclusão:

- confirmar ação.

Após exclusão:

- remover imagens do Storage;
- garantir que registros relacionados sejam tratados;
- evitar arquivos órfãos.

Não permitir que outro usuário exclua anúncios.

---

# 26. Perfil → Marketplace

Integrar os anúncios ao Perfil.

No perfil público de um estudante, criar uma seção como:

`Anúncios`

Mostrar preferencialmente anúncios ativos.

Exemplo:

Perfil de Maria

Projetos
Habilidades
Interesses
Anúncios

[ Desenvolvimento de sites ]
[ Livro de Java ]

Isso fortalece o diferencial do SABENÇA.

---

# 27. Marketplace → Perfil

Da mesma forma:

Anúncio
↓
Vendedor
↓
Perfil
↓
Habilidades
Projetos
Interesses
Conexão

Essa integração é obrigatória para o MVP.

Não tratar Marketplace como módulo isolado.

---

# 28. Empty states

Criar estados vazios adequados.

Exemplo:

"Nenhum anúncio encontrado."

e:

"Você ainda não publicou nenhum anúncio."

Adicionar ação:

`Criar primeiro anúncio`

quando apropriado.

---

# 29. Loading e erros

Utilizar os padrões já existentes do projeto.

Tratar:

- carregamento;
- anúncio inexistente;
- anúncio indisponível;
- erro de upload;
- erro de criação;
- erro de edição;
- erro de exclusão;
- conexão indisponível.

Não exibir stack traces ou mensagens internas de banco ao usuário.

---

# 30. Responsividade

O Marketplace deve funcionar em:

- desktop;
- notebook;
- tablet;
- celular.

Cards devem adaptar o grid.

Exemplo conceitual:

Desktop:
4 ou 3 colunas

Tablet:
2 colunas

Mobile:
1 coluna

Não usar larguras fixas que causem scroll horizontal.

---

# 31. Acessibilidade

Garantir:

- labels nos campos;
- navegação por teclado;
- alt nas imagens;
- estados de foco;
- botões semanticamente corretos;
- mensagens de erro associadas aos campos.

Reutilizar Radix UI quando fizer sentido.

---

# 32. Segurança / RLS

Revisar as policies atuais antes de alterá-las.

Comportamento esperado:

Membro autenticado:

- pode visualizar anúncios ativos;
- pode visualizar imagens permitidas;
- não pode alterar anúncio de outro usuário.

Proprietário:

- pode criar;
- editar;
- alterar status;
- excluir;
- gerenciar imagens.

Não desativar RLS.

Não utilizar `service_role` no navegador.

Não contornar RLS apenas para facilitar desenvolvimento.

---

# 33. Queries

Evitar N+1.

Ao listar anúncios, buscar de forma eficiente:

- anúncio;
- categoria;
- vendedor;
- perfil;
- imagem principal.

Não executar uma query separada para cada card se isso puder ser evitado.

---

# 34. Banco

Avaliar se os índices atuais são suficientes para:

- categoria;
- status;
- seller;
- data.

Somente criar índices adicionais se houver justificativa real.

Não fazer otimizações prematuras.

---

# 35. Testes

Adicionar testes automatizados.

## Unitários

Testar:

- validação de título;
- descrição;
- preço;
- categoria;
- condição;
- status;
- transformação/formatação de preço;
- regras produto x serviço.

## Integração

Testar:

- criação;
- edição;
- exclusão;
- propriedade;
- RLS;
- mudança de status.

## Playwright

Criar pelo menos um fluxo E2E:

Login
↓
Marketplace
↓
Criar anúncio
↓
Upload de imagem
↓
Publicar
↓
Visualizar anúncio
↓
Editar
↓
Marcar como vendido

Utilizar somente dados fictícios no DEV.

Limpar fixtures após os testes quando possível.

---

# 36. Testes de autorização

Testar explicitamente:

Usuário A cria anúncio.

Usuário B:

- consegue visualizar;
- NÃO consegue editar;
- NÃO consegue excluir;
- NÃO consegue substituir imagens.

Também verificar acesso sem autenticação conforme as regras atuais da aplicação.

---

# 37. Não implementar agora

Fora do escopo desta fase:

- chat;
- pagamentos;
- Pix integrado;
- checkout;
- carrinho;
- entrega;
- reserva financeira;
- intermediação do pagamento;
- reputação complexa;
- avaliações;
- recomendação por IA;
- anúncios patrocinados;
- geolocalização;
- leilões;
- certificado acadêmico;
- denúncias avançadas;
- notificações em tempo real.

Esses itens poderão ser avaliados futuramente.

O foco é concluir o Marketplace MVP.

---

# 38. Visual

Manter identidade visual atual do SABENÇA.

Não criar interface semelhante demais a:

- OLX;
- Mercado Livre;
- Facebook Marketplace.

O Marketplace deve parecer parte do SABENÇA.

Usar:

- componentes existentes;
- espaçamentos existentes;
- tipografia existente;
- padrões de cards existentes;
- navegação existente.

---

# 39. Fluxo Git

Não trabalhar diretamente na `main`.

Fluxo desejado:

`develop`
↓
`feature/marketplace-mvp`
↓
desenvolvimento
↓
testes
↓
commit
↓
push
↓
Pull Request
↓
`develop`
↓
Vercel Preview
↓
validação manual

NÃO promover para `main` automaticamente.

---

# 40. Verificações antes do PR

Executar obrigatoriamente:

`npm run lint`

`npm run typecheck`

`npm test`

`npm run build`

Executar também testes Playwright relevantes.

Nenhum erro deve ser ignorado utilizando configurações como:

`ignoreBuildErrors`

---

# 41. Teste no Staging

Após integração em `develop`, validar em:

`https://sabenca-git-develop-sirmanotretas-projects.vercel.app`

Testar manualmente:

- abrir Marketplace;
- pesquisar;
- filtrar;
- criar anúncio;
- upload;
- visualizar;
- abrir vendedor;
- abrir perfil;
- editar;
- alterar status;
- excluir.

Não alterar Production durante essa validação.

---

# 42. Documentação

Atualizar a documentação técnica de forma objetiva.

Registrar:

## Marketplace

- tabelas utilizadas;
- Storage;
- RLS;
- arquitetura;
- upload de imagens;
- integração com Perfil;
- principais decisões.

Não escrever documentação excessivamente longa.

Registrar principalmente:

"O que foi feito?"
"Por que foi feito dessa forma?"
"Quais limitações permaneceram?"

---

# 43. Não desenvolver certificados ainda

A funcionalidade de certificados acadêmicos/profissionais será desenvolvida após o Marketplace.

Não criar nesta fase:

- tabela de certificados;
- upload de certificados;
- validação de certificados;
- moderação de certificados.

Pode apenas evitar decisões arquiteturais que dificultem sua inclusão futura no Perfil.

---

# 44. Critérios de conclusão

O Marketplace MVP só deve ser considerado concluído quando:

- [ ] listagem funciona;
- [ ] pesquisa funciona;
- [ ] categorias funcionam;
- [ ] filtros funcionam;
- [ ] ordenação funciona;
- [ ] detalhes funcionam;
- [ ] vendedor aparece;
- [ ] perfil do vendedor é acessível;
- [ ] criação funciona;
- [ ] edição funciona;
- [ ] exclusão funciona;
- [ ] status funciona;
- [ ] imagens funcionam;
- [ ] Storage continua privado;
- [ ] usuário não consegue editar anúncio alheio;
- [ ] "Meus anúncios" funciona;
- [ ] anúncios aparecem no Perfil;
- [ ] responsividade funciona;
- [ ] testes passam;
- [ ] Preview funciona.

---

# 45. Relatório final

Ao concluir, apresente:

# Relatório — Marketplace MVP

## Branch utilizada

## Arquitetura encontrada

## Estrutura do banco reutilizada

## Migration criada
Se nenhuma migration foi necessária, informar explicitamente.

## Funcionalidades implementadas

## Rotas criadas

## Componentes criados

## Server Actions / Services criados

## Integração com Perfil

## Storage

## RLS

## Segurança

## Testes criados

## Resultado de lint

## Resultado de typecheck

## Resultado dos testes

## Resultado do build

## Resultado E2E

## Problemas encontrados

## Problemas corrigidos

## Pendências

## Limitações conhecidas

## Ações manuais necessárias

## Próximo passo recomendado

Não realizar merge em `main`.

Não alterar Production.

Ao encontrar qualquer decisão arquitetural relevante não prevista neste documento, preserve a arquitetura existente e explique a decisão tomada.