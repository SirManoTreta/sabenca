# SABENÇA — Fechamento completo do MVP

Quero finalizar o SABENÇA para apresentação e entrega como TCC.

Você deve assumir o papel de responsável técnico pelo fechamento do MVP.

Não quero apenas uma análise ou uma lista de sugestões.

Quero que você:

1. audite o estado atual do projeto;
2. identifique o que realmente está faltando;
3. implemente as funcionalidades faltantes que pertencem ao escopo;
4. corrija bugs encontrados;
5. complete testes;
6. revise segurança e privacidade;
7. atualize a documentação;
8. deixe o ambiente DEV funcional;
9. prepare tudo para uma nova promoção DEV → PROD;
10. entregue um relatório final claro.

Continue trabalhando até concluir tudo que puder autonomamente.

Só interrompa com:

`AÇÃO MANUAL NECESSÁRIA`

quando realmente depender de:
- login;
- MFA;
- senha;
- Secret Key;
- configuração manual de painel externo;
- autorização para merge em Production;
- alguma decisão de produto que não possa ser inferida com segurança.

Não pare apenas para informar progresso.

---

# 1. Contexto do produto

O SABENÇA é uma plataforma universitária fechada.

Os três pilares são:

1. Marketplace universitário;
2. Networks;
3. Perfil acadêmico/profissional com características sociais.

O diferencial não é ser uma cópia de OLX, LinkedIn, Instagram ou Facebook.

A proposta é integrar:

Marketplace ↔ Perfil ↔ Networks

Exemplos:

- encontrar alguém no Networks, acessar seu perfil e descobrir que oferece um serviço;
- encontrar um serviço no Marketplace, acessar o perfil do vendedor, visualizar projetos e habilidades e criar uma conexão;
- descobrir alunos por habilidades, interesses e curso;
- usar o vínculo acadêmico como camada de identidade e confiança.

Sempre avalie uma funcionalidade perguntando:

> Por que um estudante usaria o SABENÇA em vez de OLX, LinkedIn, Instagram ou grupos de WhatsApp?

---

# 2. Fora do escopo

NÃO implemente agora:

- feed geral;
- mural acadêmico;
- notícias;
- calendário acadêmico;
- calendário de provas;
- sistema completo de eventos;
- vagas de emprego;
- páginas de empresas;
- comunicação institucional;
- chat completo;
- seguidores;
- curtidas;
- ranking de popularidade;
- gamificação;
- recursos que não fortaleçam Marketplace, Networks ou Perfil.

Não transforme o projeto em uma rede social genérica.

Não aumente desnecessariamente o escopo do TCC.

---

# 3. Stack atual

Preserve a arquitetura e tecnologias atuais.

O projeto utiliza aproximadamente:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Vercel
- Playwright
- Vitest
- GitHub Actions

Não faça troca de framework.

Não introduza ORM ou arquitetura complexa sem necessidade.

Não faça grandes upgrades de dependências apenas porque versões novas existem.

Reutilize os padrões existentes no projeto.

---

# 4. Estado conhecido

Repositório:

`SirManoTreta/sabenca`

Branches:

- `main` = Production
- `develop` = desenvolvimento / Preview

A promoção anterior foi feita através da PR #3.

O commit de merge em `main` é:

`b4235f7900b36a01d011e23244b487f870d77f43`

O `develop` estava no commit:

`a8e8387ad81f87e70ac0fdd0cc6570c68d7d7bcb`

No último estado conhecido:

`develop` estava 1 commit atrás de `main`, apenas por causa do merge da PR.

Supabase:

DEV:
`fidndjlresfxvmerkbhs`

PROD:
`qybcbxrxghykkchnvmhy`

Vercel Production:

`https://project-q1u7y.vercel.app`

Vercel Preview/develop:

`https://sabenca-git-develop-sirmanotretas-projects.vercel.app`

IMPORTANTE:

Antes de confiar nesses dados, confirme o estado atual.

---

# 5. Regra de segurança

Production já está funcionando.

Portanto:

## NÃO desenvolver diretamente em `main`.

## NÃO usar o Supabase PROD para desenvolvimento.

## NÃO apagar ou substituir dados PROD.

## NÃO fazer novamente um clone completo DEV → PROD.

A partir de agora mudanças de banco devem acontecer por migrations versionadas.

Fluxo esperado:

`develop`
↓
Supabase DEV
↓
Preview
↓
testes
↓
PR
↓
`main`
↓
Production
↓
Supabase PROD

Nunca imprima:

- DATABASE_URL;
- Secret Keys;
- service_role;
- HMAC secrets;
- senhas;
- tokens;
- SMTP password.

Credenciais locais existentes podem ser utilizadas, mas nunca versionadas.

---

# 6. Etapa zero — restaurar o ambiente DEV

Antes de desenvolver:

1. execute `git status`;
2. confirme que não existem alterações importantes não commitadas;
3. faça `git fetch`;
4. compare `main` e `develop`;
5. sincronize `develop` com o estado atual de `main`.

Como a diferença conhecida é apenas o merge da PR #3, prefira uma sincronização limpa.

Não use force push desnecessariamente.

Depois:

- confirme que `.env.local` aponta SOMENTE para Supabase DEV;
- confirme que Preview aponta para DEV;
- confirme que Production continua apontando para PROD.

O Supabase DEV estava pausado/inativo no último estado conhecido.

Se puder restaurá-lo com segurança, restaure.

Caso dependa de ação do usuário:

`AÇÃO MANUAL NECESSÁRIA: reativar Supabase DEV`

Não continue desenvolvimento usando PROD como substituto.

---

# 7. Auditoria inicial obrigatória

Antes de implementar novas funcionalidades, examine o projeto inteiro.

Verifique:

- rotas;
- Server Actions;
- services;
- migrations;
- schemas;
- policies;
- RLS;
- Storage;
- Auth;
- componentes;
- validações;
- testes;
- Playwright;
- documentação;
- GitHub Actions;
- páginas administrativas.

Procure também:

- TODO;
- FIXME;
- código morto;
- rotas quebradas;
- funcionalidades parciais;
- validações duplicadas;
- comportamento inconsistente;
- páginas sem estado vazio;
- páginas sem tratamento de erro.

Crie:

`docs/MVP_GAP_ANALYSIS.md`

Esse documento deve classificar itens como:

- já implementado;
- parcialmente implementado;
- faltando;
- fora do escopo.

IMPORTANTE:

Depois da auditoria, continue imediatamente com a implementação.

Não pare para pedir autorização para cada item.

---

# 8. Funcionalidades que já devem existir

Antes de recriar qualquer coisa, confirme se já existe.

O projeto já deveria possuir:

- autenticação institucional fechada;
- primeiro acesso;
- recuperação de senha;
- administrador;
- importação de alunos;
- perfis;
- edição de perfil;
- cursos;
- habilidades;
- interesses;
- projetos;
- Networks;
- filtros do Networks;
- conexões;
- Marketplace;
- criação de anúncios;
- edição de anúncios;
- remoção de anúncios;
- imagens privadas;
- categorias;
- busca/filtros;
- perfil do vendedor.

Se algo já funciona corretamente:

NÃO reescreva.

Apenas teste e preserve.

---

# 9. Gestão de administradores

Existe atualmente um processo trabalhoso para criar novos administradores utilizando:

- `private.admin_invitations`;
- `auth.users`;
- `private.admin_users`.

Quero transformar isso em um fluxo administrável pelo próprio SABENÇA.

Criar uma área administrativa como:

`/admin/administradores`

ou equivalente adequado à arquitetura atual.

Somente admins autenticados podem acessar.

Permitir:

- visualizar administradores;
- adicionar novo administrador;
- revogar outro administrador;
- visualizar estado básico da conta.

O fluxo deve continuar compatível com o bloqueio institucional existente.

Requisitos:

- normalizar e-mail com trim/lowercase;
- impedir duplicatas;
- nunca expor service_role ao browser;
- operações privilegiadas somente server-side;
- não permitir que um administrador remova a si próprio acidentalmente;
- idealmente impedir remoção do último administrador;
- tratar usuário Auth criado parcialmente;
- tratar erros sem deixar registros órfãos.

Escolha o fluxo mais seguro e simples compatível com o sistema atual.

Pode ser:

admin atual
→ adiciona e-mail
→ backend prepara conta
→ Supabase envia convite/definição de senha
→ usuário passa a ser admin

Não abra cadastro público.

Criar testes para esse fluxo.

---

# 10. Certificados acadêmicos/profissionais

Implementar certificados no Perfil.

Essa é uma funcionalidade importante do SABENÇA.

Criar estrutura equivalente a:

`profile_certificates`

Campos recomendados:

- id;
- user_id;
- title;
- issuer;
- issue_date;
- expiration_date opcional;
- credential_id opcional;
- verification_url opcional;
- file_path opcional;
- status;
- rejection_reason opcional;
- verified_at;
- verified_by;
- created_at;
- updated_at.

Status:

- `pending`
- `verified`
- `rejected`

O aluno deve poder:

- cadastrar certificado;
- editar;
- remover;
- anexar documento;
- informar URL de validação;
- informar código/ID da credencial;
- visualizar status.

Storage:

Criar bucket privado para certificados.

Exemplo:

`certificates`

NÃO tornar os PDFs públicos.

Permitir formatos adequados:

- PDF;
- JPG;
- JPEG;
- PNG.

Definir limite razoável de tamanho, aproximadamente 5 MB ou compatível com os limites atuais.

Validar:

- MIME type;
- extensão;
- tamanho;
- ownership.

Nunca confiar apenas no nome do arquivo.

---

# 11. Validação dos certificados

Para o MVP/TCC, NÃO tente construir um sistema mágico de detecção automática de certificado verdadeiro.

Implementar:

### Verificação por URL/código

Quando houver URL ou código verificável, o administrador pode consultar a fonte informada.

### Verificação manual

Criar no painel administrativo uma área:

`Certificados pendentes`

Admin pode:

- visualizar metadados;
- acessar documento por URL assinada;
- verificar;
- rejeitar;
- informar motivo da rejeição.

Badge no perfil:

`Documento verificado pelo SABENÇA`

Evite afirmar:

`Certificado verdadeiro`

A verificação significa que o documento foi analisado segundo o processo da plataforma.

Pendentes e rejeitados não devem aparecer como certificados verificados para terceiros.

---

# 12. Privacidade dos certificados

O arquivo original deve permanecer privado.

Outros estudantes não devem receber:

- caminho cru do Storage;
- bucket path;
- informações internas;
- URLs permanentes.

Se houver necessidade de download/visualização:

usar Signed URL com duração limitada.

Owner e administrador podem acessar o arquivo.

No perfil de terceiros, priorizar exibição dos metadados verificados.

---

# 13. Denúncias

Implementar sistema simples de denúncias compatível com TCC.

Não fazer um sistema enorme de moderação.

Permitir denúncia de pelo menos:

- perfil;
- anúncio do Marketplace.

Dados recomendados:

- reporter_id;
- target_type;
- target_id;
- reason;
- details opcional;
- status;
- reviewed_by;
- reviewed_at;
- created_at.

Status:

- `pending`;
- `reviewed`;
- `dismissed`;
- `actioned`.

Criar interface administrativa para denúncias.

Admin deve poder:

- visualizar;
- analisar;
- dispensar;
- marcar como resolvida;
- acessar perfil/anúncio relacionado.

Não permitir denúncia do próprio conteúdo quando não fizer sentido.

Evitar denúncias duplicadas abusivas.

---

# 14. Bloqueio entre usuários

Implementar bloqueio de usuário de forma simples.

Um estudante deve poder bloquear outro.

Quando A bloqueia B:

- B não pode enviar conexão para A;
- conexões pendentes incompatíveis devem ser tratadas;
- ambos deixam de aparecer um para o outro no Networks ou o comportamento equivalente deve ser claramente definido;
- evitar acesso social desnecessário entre eles.

Se for simples integrar ao Marketplace:

- ocultar anúncios do usuário bloqueado.

Não criar chat.

Criar opção:

`Bloquear usuário`

e:

`Desbloquear usuário`

Confirmar a ação antes de bloquear.

Adicionar testes.

---

# 15. Privacidade e LGPD

Realizar auditoria específica de exposição de dados.

Dados institucionais sensíveis NÃO podem aparecer para outros estudantes:

- CPF;
- fingerprint do CPF;
- data de nascimento;
- telefone institucional/importado;
- RA;
- dados de autenticação;
- informações administrativas;
- tokens;
- IDs internos desnecessários.

Revisar:

- server components;
- JSON retornado;
- APIs;
- Server Actions;
- queries;
- props enviados a componentes client-side.

Criar controles razoáveis de visibilidade do Perfil.

O preenchimento deve continuar progressivo e flexível.

O aluno deve ter algum controle sobre quais informações opcionais aparecem para outros usuários.

Não prejudique o funcionamento do Networks sem necessidade.

Uma solução simples é aceitável.

Por exemplo, configurações para exibir ou ocultar:

- semestre;
- bio;
- interesses;
- habilidades;
- projetos;
- links externos;
- anúncios.

A escolha final deve respeitar a arquitetura atual.

Criar uma seção:

`Privacidade do perfil`

Não expor o valor de campos ocultos nas páginas públicas.

---

# 16. Documentos legais/comunitários

Criar páginas simples e adequadas para TCC:

- Política de Privacidade;
- Termos de Uso;
- Regras da Comunidade.

Podem ser páginas estáticas.

Devem explicar de maneira objetiva:

- finalidade do SABENÇA;
- acesso restrito à comunidade acadêmica;
- uso de dados;
- conteúdo enviado pelos alunos;
- comportamento esperado;
- denúncias;
- bloqueios;
- Marketplace;
- responsabilidade dos usuários;
- contato com a instituição/administração.

Não inventar razão social, CNPJ, DPO ou dados jurídicos que não existam.

Marcar claramente placeholders institucionais quando necessário.

Adicionar links adequados no rodapé ou área de acesso.

---

# 17. Perfil — auditoria de completude

O Perfil é um dos três pilares.

Verificar se o usuário consegue representar adequadamente:

- foto;
- nome;
- curso;
- semestre;
- instituição;
- biografia;
- interesses;
- habilidades;
- tecnologias;
- experiências;
- formação;
- certificados;
- projetos;
- portfólio;
- links externos;
- serviços oferecidos;
- anúncios;
- conexões.

IMPORTANTE:

Nem todos precisam virar campos separados.

Evite formulário gigantesco.

Preserve preenchimento progressivo.

Se experiências/formação ainda não existirem, avalie se realmente são necessárias para fechar o MVP.

Prioridade:

1. identidade;
2. habilidades;
3. interesses;
4. projetos;
5. certificados;
6. serviços/anúncios;
7. links/portfólio.

Não transforme o perfil em um currículo burocrático.

---

# 18. Marketplace — revisão completa

O Marketplace já existe.

Não recriá-lo.

Auditar todo o fluxo:

- listagem;
- pesquisa;
- filtros;
- categorias;
- criação;
- edição;
- exclusão;
- imagens;
- condição;
- preço;
- serviços;
- status;
- vendedor;
- perfil do vendedor;
- autorização;
- ownership.

Verificar principalmente:

- anúncio vendido;
- anúncio inativo;
- exclusão;
- imagens órfãs;
- upload interrompido;
- exclusão de imagem;
- acesso por usuário não proprietário;
- anúncio inexistente;
- erros de Storage;
- anúncio de serviço sem condição física.

Integrar denúncia.

Adicionar confirmação antes de ações destrutivas.

Não implementar:

- pagamento;
- checkout;
- carteira;
- entrega;
- comissão.

Isso está fora do escopo.

---

# 19. Networks — revisão completa

Auditar:

- busca por estudante;
- curso;
- semestre;
- habilidade;
- interesse;
- tecnologias;
- afinidade;
- visualização de perfil;
- conexões.

Networks deve priorizar descoberta e colaboração.

Não criar ranking de seguidores.

Não criar popularidade.

Adicionar integração com bloqueio.

Estados de conexão devem estar claros:

- sem conexão;
- solicitação enviada;
- solicitação recebida;
- conectado.

Testar todas as transições.

---

# 20. Conexões

Auditar:

- criar solicitação;
- aceitar;
- rejeitar;
- cancelar;
- remover conexão;
- duplicatas;
- solicitações cruzadas;
- usuários bloqueados;
- usuários inativos;
- usuário tentando conectar consigo mesmo.

Garantir consistência no banco.

---

# 21. UX

Fazer uma rodada completa de acabamento.

Adicionar onde faltar:

- loading states;
- empty states;
- mensagens de erro;
- mensagens de sucesso;
- confirmação de exclusão;
- confirmação de bloqueio;
- feedback após formulário;
- tratamento de 404;
- tratamento de acesso negado.

Não utilizar alerts ruins se o projeto já tiver padrão melhor.

Preservar identidade visual existente.

---

# 22. Responsividade

Testar no mínimo:

- 360 px;
- 390 px;
- 768 px;
- 1024 px;
- desktop comum.

Verificar:

- navegação;
- tabelas admin;
- cards;
- formulários;
- filtros;
- Perfil;
- Marketplace;
- Networks;
- certificados.

Não considerar "funciona no desktop" como suficiente.

---

# 23. Acessibilidade

Fazer uma revisão razoável:

- labels;
- `aria-label` quando necessário;
- foco;
- navegação por teclado;
- contraste;
- botões;
- links;
- modais;
- formulários;
- mensagens de erro;
- headings.

Não buscar certificação completa WCAG.

Mas não introduzir regressões óbvias.

---

# 24. Segurança

Executar auditoria de segurança.

Verificar:

- RLS;
- grants;
- funções SECURITY DEFINER;
- search_path;
- Storage policies;
- ownership;
- Supabase Auth;
- service role;
- Server Actions;
- CSRF/origin;
- redirects;
- upload;
- MIME;
- tamanho;
- SQL injection;
- XSS;
- validação de URLs;
- autorização de admin;
- autorização de member.

Regras:

- Service Key nunca no browser.
- Dados privados nunca em componente client desnecessariamente.
- Bucket privado por padrão.
- Signed URLs com expiração.
- Validar entrada no servidor.
- Não confiar apenas na UI.

Executar Supabase Security Advisors quando possível.

Tratar vulnerabilidades relevantes.

Não atualizar major version apenas para silenciar audit.

---

# 25. Banco

Toda alteração estrutural deve virar migration Supabase.

Não executar alterações importantes apenas manualmente no Dashboard.

As migrations devem ser:

- determinísticas;
- idempotentes quando apropriado;
- revisáveis;
- seguras;
- documentadas.

Não usar IDs gerados hardcoded.

Preservar dados existentes.

Testar migration no DEV.

---

# 26. Testes

Manter todos os testes existentes.

Adicionar testes para tudo que for novo.

Cobrir no mínimo:

### Admin
- somente admin acessa;
- criar administrador;
- duplicata;
- remover;
- proteção do último admin.

### Certificados
- criar;
- editar;
- remover;
- upload;
- ownership;
- pending;
- verify;
- reject;
- acesso privado.

### Denúncia
- criação;
- duplicidade;
- admin review.

### Bloqueio
- bloquear;
- desbloquear;
- conexão impedida;
- Networks respeitando bloqueio.

### Privacidade
- owner vê;
- terceiros respeitam configuração;
- dados institucionais nunca expostos.

### Marketplace
- regressão completa.

### Networks
- regressão completa.

### Auth
- regressão completa.

Executar:

`npm ci`

`npm run lint`

`npm run typecheck`

testes unitários/integração

`npm run build`

Playwright

Não reduzir cobertura simplesmente removendo testes.

Não marcar testes como skip para obter CI verde sem justificativa.

---

# 27. E2E

Criar ou ampliar cenários Playwright para um fluxo real de demonstração.

Exemplo:

## Fluxo aluno

aluno autorizado
→ login
→ editar perfil
→ adicionar habilidade
→ adicionar projeto
→ cadastrar certificado
→ encontrar outro aluno no Networks
→ enviar conexão
→ visualizar Marketplace
→ criar anúncio
→ editar anúncio
→ abrir perfil do vendedor

## Fluxo admin

login admin
→ visualizar alunos
→ criar outro admin
→ analisar certificado
→ verificar certificado
→ analisar denúncia

Utilize fixtures isoladas.

Não poluir PROD.

---

# 28. Documentação técnica

Atualizar documentação para refletir o estado REAL.

Criar/atualizar:

`README.md`

e documentos adequados dentro de `docs/`.

Documentar:

- objetivo do SABENÇA;
- arquitetura;
- stack;
- estrutura de pastas;
- autenticação;
- acesso institucional;
- Perfil;
- Marketplace;
- Networks;
- conexões;
- certificados;
- denúncias;
- bloqueios;
- privacidade;
- banco;
- RLS;
- Storage;
- DEV/PROD;
- Vercel;
- Supabase;
- CI/CD;
- testes;
- deploy;
- rollback;
- variáveis de ambiente.

Não documentar tecnologia que o projeto não utiliza.

---

# 29. Documento para TCC

Criar:

`docs/TCC_IMPLEMENTACAO_TECNICA.md`

Não precisa ser uma monografia.

Quero um registro técnico claro para quem escreverá o TCC.

Incluir:

## Tecnologias

O que foi utilizado e por quê.

## Arquitetura

Como frontend, backend, Auth, banco e Storage se relacionam.

## Segurança

- RLS;
- autenticação;
- comunidade fechada;
- privacidade;
- buckets privados;
- HMAC;
- autorização.

## Principais dificuldades

Registrar brevemente:

- cadastro institucional fechado;
- importação de alunos;
- primeiro acesso;
- gerenciamento de Auth;
- ambientes DEV/PROD;
- migração;
- Marketplace;
- uploads privados;
- conexões;
- certificados.

## Decisões técnicas

Explicar resumidamente por que determinadas decisões foram tomadas.

Evitar texto exageradamente longo.

---

# 30. Documento de demonstração

Criar:

`docs/DEMO_TCC.md`

Criar roteiro curto de demonstração.

Idealmente:

1. página inicial;
2. login de aluno;
3. perfil;
4. projetos/habilidades;
5. certificado;
6. Networks;
7. conexão;
8. Marketplace;
9. perfil do vendedor;
10. painel administrativo;
11. moderação/verificação.

O roteiro deve conseguir demonstrar o diferencial do SABENÇA em poucos minutos.

---

# 31. Não quebrar Production

Enquanto desenvolver:

PROD deve permanecer intacto.

Não aplique migrations novas diretamente no PROD antes da conclusão no DEV.

Não utilize usuários reais de Production para E2E.

Não execute testes destrutivos no PROD.

---

# 32. Validação DEV

Depois de terminar:

1. aplicar migrations no Supabase DEV;
2. validar migrations;
3. validar RLS;
4. validar Storage;
5. validar Auth;
6. validar Preview Vercel;
7. executar smoke test;
8. executar toda suite.

Verificar manualmente/automaticamente:

- home;
- login;
- primeiro acesso;
- recuperação;
- admin;
- perfil;
- Networks;
- conexões;
- Marketplace;
- certificados;
- denúncias;
- bloqueio;
- privacidade.

---

# 33. Git

Trabalhar em:

`develop`

Não fazer commit direto em `main`.

Preferir commits lógicos.

Exemplos:

`feat(certificates): add private academic credentials`

`feat(moderation): add reports and blocks`

`feat(admin): add administrator management`

`feat(privacy): add profile visibility controls`

`docs: finalize SABENCA MVP documentation`

Evitar um commit gigante se puder dividir com segurança.

---

# 34. Pré-promoção para PROD

Depois que TODO o DEV estiver verde:

comparar:

`main...develop`

Gerar relatório contendo:

- migrations novas;
- tabelas novas;
- buckets novos;
- policies novas;
- arquivos alterados;
- testes;
- riscos;
- rollback.

Criar PR:

`develop → main`

Título sugerido:

`Finalizar MVP do SABENÇA`

Descrição deve explicar as funcionalidades incluídas.

Não realizar merge imediatamente.

Parar em:

`AÇÃO MANUAL NECESSÁRIA: MVP validado no DEV e PR pronta. Autorize o merge develop → main.`

---

# 35. Depois da autorização de merge

Quando eu explicitamente autorizar:

1. criar backup PROD antes de migrations;
2. validar conexão PROD;
3. aplicar SOMENTE migrations novas;
4. criar/configurar buckets/policies via migration quando possível;
5. não sobrescrever banco inteiro;
6. validar Auth;
7. validar Storage;
8. fazer merge da PR;
9. aguardar Vercel Production;
10. executar smoke test não destrutivo.

Verificar especialmente que Production utiliza:

Supabase PROD:

`qybcbxrxghykkchnvmhy`

e nunca DEV:

`fidndjlresfxvmerkbhs`

---

# 36. Critério de conclusão

O MVP só está concluído quando:

- Auth institucional funciona;
- primeiro acesso funciona;
- recuperação funciona;
- admins funcionam;
- gestão de admins funciona;
- Perfil funciona;
- habilidades/interesses funcionam;
- projetos funcionam;
- certificados funcionam;
- validação de certificados funciona;
- Marketplace funciona;
- Networks funciona;
- conexões funcionam;
- denúncias funcionam;
- bloqueio funciona;
- privacidade básica funciona;
- dados sensíveis não vazam;
- Storage privado funciona;
- mobile funciona;
- testes passam;
- build passa;
- documentação está atualizada;
- Preview DEV funciona;
- PR está pronta.

---

# 37. O que NÃO fazer

Não:

- recriar o projeto;
- trocar de framework;
- adicionar ORM sem necessidade;
- usar Prisma apenas porque é comum;
- transformar tudo em microservices;
- adicionar Redis sem necessidade;
- adicionar Docker à Production sem motivo;
- criar chat;
- criar feed;
- criar vagas;
- criar empresas;
- criar eventos;
- adicionar pagamento;
- adicionar IA apenas por marketing;
- adicionar seguidores;
- adicionar curtidas;
- adicionar complexidade sem benefício claro para o TCC.

---

# 38. Princípio de implementação

Prioridade:

1. corretude;
2. segurança;
3. escopo do TCC;
4. simplicidade;
5. manutenção;
6. experiência do usuário;
7. quantidade de funcionalidades.

Não faça engenharia exagerada.

Esse projeto precisa:

- funcionar;
- ser defensável academicamente;
- ser demonstrável;
- ser compreensível;
- servir como portfólio.

---

# 39. Relatório final

Ao terminar o DEV, entregue um relatório contendo:

## Estado inicial

O que já existia.

## Implementado

Tudo que foi criado.

## Corrigido

Bugs encontrados e correções.

## Banco

Migrations adicionadas.

## Storage

Buckets/policies.

## Auth

Alterações.

## Segurança

Revisão e resultados.

## Testes

Quantidade total:

- unitários;
- integração;
- Playwright.

Resultados:

- lint;
- typecheck;
- build;
- CI.

## Documentação

Arquivos criados/atualizados.

## Git

- commits;
- branch;
- PR;
- comparação main/develop.

## DEV

- Supabase;
- Preview;
- smoke test.

## Pendências

Idealmente nenhuma dentro do MVP.

Diferencie claramente:

- pendência real;
- melhoria futura;
- item fora do escopo.

## Production

Explique exatamente o que será alterado quando houver autorização para merge.

---

# REGRA FINAL

Não confunda:

"poderia melhorar"

com

"está faltando para o MVP".

O objetivo desta execução é FECHAR o SABENÇA.

Não continue inventando funcionalidades indefinidamente.

Se Marketplace, Networks e Perfil cumprirem sua função, estiverem integrados, seguros e testados, considere o MVP concluído.

Termine o que estiver realmente faltando, documente melhorias futuras e prepare a PR final.