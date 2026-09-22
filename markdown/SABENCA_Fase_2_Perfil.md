# SABENÇA — Fase 2: Perfil acadêmico/social

## 1. Objetivo da etapa

Implementar o **Perfil acadêmico/social** do SABENÇA.

O perfil será a identidade principal do estudante dentro da plataforma e servirá de base para os próximos módulos:

- Networks;
- Conexões;
- Marketplace.

Ao final desta etapa, um aluno autenticado deverá conseguir visualizar e editar seu próprio perfil, adicionar habilidades, interesses e projetos, enviar uma foto de perfil e possuir uma página pública acessível apenas por membros ativos da comunidade.

Esta etapa **não deve alterar o fluxo de acesso institucional já implementado**, salvo ajustes mínimos e indispensáveis para integração com o perfil.

---

## 2. Estado atual que deve ser preservado

O projeto já possui:

- autenticação institucional por RA e senha;
- primeiro acesso com RA + data de nascimento;
- recuperação de senha;
- importação administrativa de alunos por `.xlsx`;
- bloqueio e restauração de acesso;
- Supabase Auth;
- RLS;
- tabela `public.profiles`;
- tabelas `skills`, `interests`, `profile_skills`, `profile_interests`;
- tabela `projects`;
- bucket privado `avatars`;
- bucket privado `project-images`;
- estrutura inicial de Marketplace e Connections no banco;
- testes unitários, integração e E2E;
- documentação em `markdown/`.

Não recriar estas estruturas sem necessidade.

Antes de alterar banco, verificar as migrações existentes.

---

## 3. Escopo da Fase 2

Implementar:

1. visualização do próprio perfil;
2. edição de dados sociais do perfil;
3. username único;
4. biografia;
5. habilidades;
6. interesses;
7. avatar;
8. projetos;
9. perfil público de outro estudante;
10. regras de privacidade compatíveis com o SABENÇA;
11. testes;
12. atualização da documentação.

---

# 4. Perfil próprio

## 4.1 Rota

Utilizar:

```text
/profile
```

A página atual é apenas um placeholder e deverá ser substituída por uma implementação real.

A página deve consultar `public.profiles` usando o usuário autenticado.

Não utilizar `user_metadata` como fonte principal dos dados sociais.

O Supabase Auth deve continuar responsável apenas por autenticação.

`public.profiles` deve ser a fonte principal da identidade social/acadêmica.

---

## 4.2 Informações exibidas

O perfil deve conseguir apresentar:

- avatar;
- nome;
- username;
- curso;
- semestre;
- instituição;
- biografia;
- habilidades;
- interesses;
- projetos.

Quando algum campo estiver vazio, a interface deve apresentar um estado amigável, sem dados fictícios.

Exemplo:

```text
Nenhuma habilidade adicionada ainda.
```

ou:

```text
Conte um pouco sobre você.
```

---

# 5. Edição do perfil

## 5.1 Rota

Criar:

```text
/profile/edit
```

Somente o proprietário do perfil poderá editar os dados.

A página deve exigir usuário autenticado e vínculo institucional ativo utilizando a infraestrutura atual (`requireUser()` ou mecanismo equivalente já existente).

---

## 5.2 Campos editáveis

Permitir edição de:

- username;
- biografia;
- habilidades;
- interesses.

Avaliar também nome, curso e semestre conforme as regras abaixo.

### Nome

O nome inicialmente vem do cadastro institucional.

Para esta fase, preservar o nome institucional como nome principal.

Não permitir alteração livre do nome completo sem necessidade.

Caso seja desejável futuramente, poderá existir um `display_name`, mas **não implementar agora**.

### Curso

O curso vem da importação institucional.

Nesta fase, o aluno não deverá alterar livremente o curso.

### Semestre

O semestre também vem da instituição.

Não permitir alteração livre nesta fase.

O objetivo é evitar inconsistência entre o perfil social e o cadastro institucional.

---

# 6. Username

O `username` deverá ser utilizado futuramente para identificação pública do perfil.

Regras:

- mínimo de 3 caracteres;
- máximo de 30 caracteres;
- somente letras minúsculas, números e `_`;
- único;
- normalizado para lowercase;
- sem espaços;
- não permitir alteração para um username já utilizado.

Exemplos válidos:

```text
samuel
samuel_silva
samuel123
```

Exemplos inválidos:

```text
Samuel Silva
samuel@
sa
```

Tratar adequadamente conflitos de unicidade retornados pelo banco.

Não retornar mensagens internas do PostgreSQL ao usuário.

---

# 7. Biografia

A bio deve permitir que o estudante se apresente de maneira informal.

Exemplo:

```text
Estudante de Ciência da Computação, gosto de desenvolvimento web,
infraestrutura e criação de projetos com React e Python.
```

Limite sugerido:

```text
500 caracteres
```

Caso a tabela atual permita valor maior, pode ser criada validação da aplicação mais restritiva sem necessidade de alterar o banco imediatamente.

---

# 8. Habilidades

## 8.1 Objetivo

Habilidades representam conhecimentos e competências do aluno.

Exemplos:

- React;
- Java;
- Python;
- Redes;
- Docker;
- Photoshop;
- Edição de vídeo;
- Arduino.

---

## 8.2 Comportamento desejado

O usuário deverá poder:

- pesquisar habilidades existentes;
- selecionar habilidades;
- remover habilidades;
- criar uma nova habilidade quando ela ainda não existir.

Fluxo:

```text
Usuário digita "Docker"
        ↓
Sistema procura uma skill normalizada
        ↓
Existe?
    ├── sim → associa ao perfil
    └── não → cria a skill e associa ao perfil
```

A criação de skills deve ocorrer **no servidor**.

Não conceder permissões genéricas ao cliente para inserir livremente em `skills`.

Utilizar Server Action ou serviço server-side.

---

## 8.3 Normalização

Evitar duplicidades como:

```text
React
react
 REACT
```

Implementar normalização apropriada.

Preferencialmente preservar uma versão de exibição legível, mas impedir duplicidades equivalentes.

Se for necessária alteração no banco para suportar isso corretamente, criar nova migration.

Nunca alterar migrations antigas já aplicadas.

---

# 9. Interesses

Interesses funcionam de forma semelhante às habilidades.

Exemplos:

- Desenvolvimento Web;
- Inteligência Artificial;
- Jogos;
- Cibersegurança;
- Empreendedorismo;
- Design.

O usuário deverá poder:

- pesquisar;
- selecionar;
- remover;
- criar novos interesses.

Aplicar regras de normalização semelhantes às habilidades.

---

# 10. Avatar

## 10.1 Storage

Utilizar o bucket existente:

```text
avatars
```

O bucket deve permanecer privado.

Não transformar o bucket em público.

---

## 10.2 Regras

Aceitar:

- JPEG;
- PNG;
- WEBP.

Respeitar o limite de tamanho já definido no bucket.

O caminho deve permanecer associado ao usuário autenticado.

Exemplo:

```text
<auth-user-id>/<arquivo>
```

ou estrutura equivalente compatível com as policies existentes.

---

## 10.3 Exibição

Gerar signed URL somente após autorização.

Não armazenar signed URL no banco.

`profiles.avatar_url` deve continuar armazenando apenas o caminho do objeto.

Quando não houver avatar, usar um fallback visual com iniciais ou ícone.

---

# 11. Projetos

Projetos são uma parte importante do perfil e ajudam o Networks a funcionar futuramente.

O aluno poderá mostrar projetos acadêmicos ou pessoais.

---

## 11.1 Dados

Utilizar a tabela já existente:

```text
projects
```

Campos:

- título;
- descrição;
- imagem;
- URL do projeto;
- URL do repositório.

---

## 11.2 Funcionalidades

Implementar:

- criar projeto;
- editar projeto;
- excluir projeto;
- listar projetos no perfil.

Rotas podem ser organizadas como:

```text
/profile/projects/new
/profile/projects/[id]/edit
```

ou por modal/formulário dentro do perfil, desde que o código permaneça simples e organizado.

Evitar arquitetura excessivamente complexa.

---

## 11.3 Imagens de projeto

Utilizar:

```text
project-images
```

O bucket permanece privado.

Gerar signed URLs para exibição.

Validar propriedade do projeto antes de qualquer alteração.

---

# 12. Perfil público

## 12.1 Rota

Criar preferencialmente:

```text
/users/[username]
```

Evitar utilizar `/profile/[username]`, pois `/profile` representa o perfil do usuário autenticado.

---

## 12.2 Acesso

O perfil público **não é público para a internet**.

Somente estudantes autenticados e com vínculo institucional ativo poderão visualizar outros perfis.

Visitantes sem autenticação não devem acessar informações dos estudantes.

---

## 12.3 Informações disponíveis

Exibir:

- avatar;
- nome;
- username;
- curso;
- semestre;
- instituição;
- bio;
- habilidades;
- interesses;
- projetos.

Não exibir:

- CPF;
- fingerprint do CPF;
- data de nascimento;
- telefone;
- e-mail;
- `auth_user_id`;
- dados administrativos;
- histórico de importação;
- qualquer dado da tabela institucional privada.

Esses dados nunca devem ser enviados ao cliente.

---

# 13. Privacidade

Nesta fase, utilizar uma regra simples:

> Perfis sociais são visíveis somente para membros ativos da comunidade SABENÇA.

Não implementar um sistema complexo de privacidade nesta etapa.

Dados institucionais sensíveis permanecem privados.

Se for necessário adicionar um campo de configuração de visibilidade futuramente, deixar a arquitetura preparada, mas não aumentar o escopo atual sem necessidade.

---

# 14. Segurança e RLS

Preservar a filosofia atual:

```text
Frontend não é segurança.
RLS e validação server-side são segurança.
```

Revisar as policies existentes antes de adicionar novas.

Garantir:

- usuário só altera seu próprio perfil;
- usuário só altera seus próprios projetos;
- usuário só altera suas próprias relações de skills/interesses;
- somente membros ativos visualizam perfis;
- usuário bloqueado perde acesso;
- acesso administrativo não implica automaticamente perfil social;
- nenhum campo privado da instituição é retornado.

Não utilizar `service_role` no navegador.

Nunca usar `SUPABASE_SECRET_KEY` em Client Components.

---

# 15. Organização de código

Manter separação entre:

```text
src/app
src/components
src/lib
src/services
src/types
```

Criar componentes reutilizáveis quando fizer sentido.

Possíveis componentes:

```text
src/components/profile/profile-header.tsx
src/components/profile/profile-form.tsx
src/components/profile/skill-selector.tsx
src/components/profile/interest-selector.tsx
src/components/profile/project-card.tsx
src/components/profile/project-form.tsx
src/components/profile/avatar-upload.tsx
```

Não criar abstrações genéricas sem uso real.

Priorizar código legível para apresentação e manutenção do TCC.

---

# 16. Validações

Criar validações Zod específicas para perfil.

Sugestão:

```text
src/lib/validations/profile.ts
src/lib/validations/project.ts
```

Validar no servidor:

- username;
- bio;
- IDs;
- títulos;
- descrição;
- URLs;
- arquivos enviados quando aplicável.

Validação de frontend pode melhorar UX, mas não substitui validação server-side.

---

# 17. Server Actions / Services

Operações que alterem dados devem passar por ações ou serviços server-side.

Exemplos:

```text
updateProfile
addSkill
removeSkill
addInterest
removeInterest
createProject
updateProject
deleteProject
uploadAvatar
```

Antes de executar alterações:

1. obter usuário autenticado;
2. confirmar vínculo ativo;
3. localizar o perfil pertencente ao usuário;
4. validar os dados;
5. executar a operação;
6. revalidar a página necessária.

Evitar confiar em `profile_id` enviado pelo cliente sem verificar propriedade.

---

# 18. Interface

Manter identidade atual do SABENÇA:

- azul escuro;
- azul claro;
- branco;
- pequenos detalhes laranja;
- visual universitário moderno;
- componentes simples;
- boa responsividade.

O perfil deve parecer uma mistura de:

```text
identidade social
+
perfil acadêmico
+
portfólio
```

Não deve parecer um currículo tradicional.

Também não deve copiar o LinkedIn.

A ideia é transmitir personalidade e conhecimento do estudante.

---

# 19. Layout sugerido

Desktop:

```text
┌─────────────────────────────────────────────────────┐
│ Avatar   Samuel Silva                               │
│          @samuel                                    │
│          Ciência da Computação · 8º semestre       │
│          FATECE                                     │
│                                    [Editar perfil]  │
├─────────────────────────────────────────────────────┤
│ Sobre mim                                           │
│ Bio...                                              │
├─────────────────────────────────────────────────────┤
│ Habilidades                                         │
│ React · Python · Redes · Docker                     │
├─────────────────────────────────────────────────────┤
│ Interesses                                          │
│ Jogos · IA · Desenvolvimento Web                    │
├─────────────────────────────────────────────────────┤
│ Projetos                                            │
│                                                     │
│ [Projeto]   [Projeto]   [Projeto]                   │
└─────────────────────────────────────────────────────┘
```

Mobile:

- conteúdo em coluna;
- avatar e identificação no topo;
- botão editar facilmente acessível;
- cards de projeto em uma coluna;
- nenhuma rolagem horizontal.

---

# 20. Estados de interface

Implementar estados para:

- carregamento;
- perfil vazio;
- erro;
- usuário sem username;
- nenhuma habilidade;
- nenhum interesse;
- nenhum projeto;
- imagem ausente;
- username em uso;
- upload inválido.

Evitar telas quebradas por dados incompletos.

---

# 21. Testes

A nova etapa deve manter os testes existentes funcionando.

Executar ao final:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Adicionar testes para pelo menos:

### Perfil

- usuário autenticado acessa próprio perfil;
- usuário não autenticado é redirecionado;
- usuário bloqueado não acessa;
- atualização do próprio perfil funciona;
- não é possível alterar perfil de outro usuário;
- username duplicado é recusado;
- username inválido é recusado.

### Habilidades/interesses

- adicionar existente;
- criar nova;
- impedir duplicidade;
- remover associação;
- não alterar associações de outro usuário.

### Projetos

- criar;
- editar;
- excluir;
- impedir alteração de projeto de outro usuário;
- validar URLs;
- validar campos obrigatórios.

### Perfil público

- membro ativo consegue visualizar;
- visitante não autenticado não consegue;
- usuário bloqueado não consegue;
- dados sensíveis nunca aparecem na resposta.

---

# 22. Documentação

Atualizar:

```text
markdown/DESENVOLVIMENTO.md
```

Registrar resumidamente:

- início da Fase 2;
- decisões tomadas;
- alterações no banco;
- dificuldades encontradas;
- testes executados;
- motivo das principais decisões.

Criar também:

```text
markdown/PERFIL_IMPLEMENTACAO.md
```

Este documento deve conter apenas informações úteis para manutenção e apresentação do TCC.

Evitar documentação excessiva.

Registrar especialmente:

- estrutura do perfil;
- funcionamento de skills/interesses;
- storage de imagens;
- perfil público;
- decisões de privacidade;
- RLS;
- principais dificuldades.

---

# 23. Migrações

Nunca editar migrations já aplicadas.

Caso seja necessário alterar banco:

```text
supabase/migrations/<timestamp>_profile_phase.sql
```

Possíveis alterações aceitáveis:

- normalização/índice de skills;
- normalização/índice de interesses;
- ajustes necessários para username;
- alguma configuração simples de perfil.

Qualquer alteração deve preservar dados existentes.

---

# 24. Fora do escopo

Não implementar nesta fase:

- Marketplace funcional;
- Connections funcional;
- sistema de mensagens;
- chat;
- notificações;
- seguidores;
- curtidas;
- feed;
- avaliações;
- vagas de emprego;
- empresas;
- eventos;
- comentários;
- sistema complexo de privacidade;
- recomendações automáticas;
- IA;
- ranking de usuários;
- gamificação.

Caso alguma dessas funcionalidades pareça necessária durante o desenvolvimento, apenas preparar integração futura.

Não implementá-la agora.

---

# 25. Ordem de implementação

Executar preferencialmente nesta sequência:

## Etapa 2.1

Perfil básico:

- consulta real de `profiles`;
- `/profile`;
- `/profile/edit`;
- username;
- bio.

## Etapa 2.2

Habilidades e interesses:

- busca;
- criação controlada;
- associação;
- remoção;
- normalização.

## Etapa 2.3

Avatar:

- upload;
- substituição;
- signed URL;
- fallback.

## Etapa 2.4

Projetos:

- criação;
- edição;
- exclusão;
- imagens;
- links.

## Etapa 2.5

Perfil público:

```text
/users/[username]
```

## Etapa 2.6

Testes, revisão responsiva e documentação.

Não tentar implementar toda a fase em um único bloco se isso comprometer qualidade ou dificultar validação.

---

# 26. Critérios de conclusão

A Fase 2 será considerada concluída quando:

- [ ] `/profile` utilizar dados reais do banco;
- [ ] aluno conseguir editar username e bio;
- [ ] curso e semestre institucionais permanecerem protegidos;
- [ ] aluno conseguir adicionar/remover habilidades;
- [ ] novas habilidades puderem ser cadastradas de forma controlada;
- [ ] aluno conseguir adicionar/remover interesses;
- [ ] novos interesses puderem ser cadastrados de forma controlada;
- [ ] avatar puder ser enviado e exibido;
- [ ] bucket continuar privado;
- [ ] aluno puder criar projeto;
- [ ] aluno puder editar projeto;
- [ ] aluno puder excluir projeto;
- [ ] imagens de projetos funcionarem;
- [ ] `/users/[username]` estiver disponível;
- [ ] somente membros ativos puderem visualizar outros perfis;
- [ ] nenhum dado institucional sensível for exposto;
- [ ] RLS impedir alterações indevidas;
- [ ] layout funcionar em desktop e celular;
- [ ] lint passar;
- [ ] TypeScript passar;
- [ ] testes passarem;
- [ ] build de produção passar;
- [ ] documentação ser atualizada.

---

# 27. Resultado esperado

Ao final desta fase, o SABENÇA deverá deixar de possuir apenas uma infraestrutura de acesso institucional e passar a ter sua primeira funcionalidade social real.

Um estudante deverá conseguir entrar na plataforma e possuir uma identidade semelhante a:

```text
Samuel Silva
@samuel

Ciência da Computação · 8º semestre
FATECE

Estudante interessado em desenvolvimento web,
infraestrutura e criação de projetos.

Habilidades:
React · TypeScript · Python · Docker · Redes

Interesses:
Desenvolvimento Web · Jogos · Cibersegurança

Projetos:
SABENÇA
Sistema Digestório Interativo
Projeto Arduino
```

Esse perfil será utilizado posteriormente pelo **Networks** para descoberta de estudantes e pelo **Marketplace** para identificar quem está oferecendo um produto ou serviço.

A implementação desta fase deve, portanto, priorizar uma base reutilizável para esses dois módulos futuros.
