# SABENÇA — Próxima etapa: acesso institucional, importação de alunos e identidade visual

**Data do registro:** 13/09/2026  
**Objetivo deste documento:** registrar a alteração do modelo de acesso do SABENÇA, definir o próximo passo técnico e orientar a adaptação visual da aplicação à instituição utilizada no TCC.

---

## 1. Estado atual do projeto

A fundação técnica já está bem encaminhada.

Atualmente o projeto possui:

- Next.js + React + TypeScript;
- Tailwind CSS;
- Supabase SSR;
- autenticação por e-mail e senha;
- confirmação de e-mail;
- recuperação de senha;
- rotas protegidas;
- banco inicial do MVP;
- RLS nas tabelas;
- testes unitários, de banco e E2E;
- páginas-base para Marketplace, Networks, Perfil e Conexões.

Os módulos principais ainda são apenas fundações visuais. Isso é positivo neste momento, pois permite alterar o modelo de acesso antes de iniciar Perfil, Marketplace e Networks.

### Problema identificado

O fluxo atual permite que qualquer pessoa acesse a tela de cadastro e tente criar uma conta usando um e-mail.

Isso não representa mais a regra de negócio do SABENÇA.

O SABENÇA deve ser uma **comunidade universitária fechada**, na qual a instituição determina previamente quem pode ter acesso.

---

# 2. Nova regra de acesso

Não haverá cadastro público tradicional.

A instituição será responsável por cadastrar ou autorizar previamente os estudantes que poderão utilizar o SABENÇA.

A forma inicial de alimentação será por uma planilha `.xlsx`.

Exemplo:

```text
ra | nome | email | telefone | data_nascimento | cpf | curso | semestre
```

Campos mínimos:

```text
RA
Nome
E-mail
Telefone
Data de nascimento
CPF
```

Campos recomendados:

```text
Curso
Semestre
```

A instituição será definida pelo ambiente da aplicação e não precisará ser repetida em todas as linhas caso exista apenas uma instituição na instalação.

---

# 3. Decisão importante: registro institucional ≠ perfil público

Os dados enviados pela faculdade não devem ser colocados diretamente no perfil público do estudante.

Devem existir duas áreas diferentes:

```text
REGISTRO INSTITUCIONAL
        |
        | controla acesso
        v
CONTA DO USUÁRIO
        |
        | possui
        v
PERFIL SABENÇA
```

## Registro institucional

Contém os dados utilizados para identificar o estudante e autorizar sua entrada.

Exemplos:

```text
RA
nome oficial
e-mail
telefone
data de nascimento
CPF
curso
semestre
situação do acesso
```

Essas informações são privadas.

## Perfil SABENÇA

Contém somente as informações que fazem sentido socialmente dentro da plataforma.

Exemplos:

```text
foto
nome de exibição
curso
semestre
bio
habilidades
interesses
projetos
portfólio
serviços
anúncios
links
```

CPF e data de nascimento **nunca devem aparecer no perfil**.

O telefone também não deve ser público automaticamente. Caso futuramente seja utilizado como forma de contato, a exposição deverá depender de escolha explícita do estudante.

---

# 4. Como a faculdade cadastrará os estudantes

Será criada uma área administrativa.

Rota sugerida:

```text
/admin/alunos
```

Dentro dela:

```text
Alunos cadastrados
Importar planilha
Histórico de importações
```

A importação deverá seguir este fluxo:

```text
Selecionar planilha
        |
        v
Ler arquivo
        |
        v
Validar colunas
        |
        v
Validar alunos
        |
        v
Exibir prévia
        |
        +--> linhas válidas
        |
        +--> linhas com erro
        |
        v
Confirmar importação
        |
        v
Registrar alunos autorizados
```

Não salvar os dados antes da tela de pré-visualização.

---

# 5. Formato inicial da planilha

Modelo:

```text
| ra     | nome            | email                  | telefone        | data_nascimento | cpf            | curso                  | semestre |
|--------|-----------------|------------------------|-----------------|-----------------|----------------|------------------------|----------|
| 123456 | João da Silva   | joao@email.com         | 19999999999     | 14/05/2003      | 123.456.789-00 | Ciência da Computação  | 8        |
| 123457 | Maria Oliveira  | maria@email.com        | 19888888888     | 22/11/2004      | 987.654.321-00 | Administração          | 6        |
```

### Regras de validação

#### RA

- obrigatório;
- único dentro da instituição;
- tratado como texto para evitar perda de zeros à esquerda.

#### Nome

- obrigatório;
- entre 2 e 100 caracteres.

#### E-mail

- obrigatório;
- formato válido;
- não deve existir em outro registro ativo da mesma instituição.

#### Telefone

- normalizar antes do armazenamento;
- não deve ser exibido publicamente por padrão.

#### Data de nascimento

Aceitar inicialmente:

```text
DD/MM/AAAA
```

Também deve ser possível interpretar uma célula de data real do Excel.

#### CPF

- remover pontos e traço antes da validação;
- validar os dígitos verificadores;
- impedir duplicidade;
- nunca enviar o CPF ao navegador depois da importação sem necessidade.

#### Curso e semestre

Não são obrigatórios para autenticação, mas são recomendados porque posteriormente alimentarão o perfil e os filtros do Networks.

---

# 6. Tecnologia para leitura da planilha

Sugestão inicial:

```text
ExcelJS
+
Zod
```

### ExcelJS

Responsável pela leitura do arquivo `.xlsx`.

### Zod

Responsável pela validação e normalização de cada linha.

A planilha deverá ser processada **no servidor**.

Evitar processar o conjunto completo de CPF, data de nascimento e telefone no front-end.

### Formatos iniciais

Aceitar:

```text
.xlsx
.csv (opcional)
```

Não é necessário suportar inicialmente:

```text
.xls
.xlsm
```

---

# 7. Primeiro acesso do estudante

A aplicação não exibirá mais:

```text
Criar conta
```

como um cadastro livre.

Ela exibirá:

```text
Entrar
Primeiro acesso
```

## Fluxo recomendado

```text
Instituição importa aluno
        |
        v
Aluno fica como PENDENTE
        |
        v
Aluno acessa "Primeiro acesso"
        |
        v
Informa RA
        |
        v
Confirma dados de identificação
        |
        v
Confirma acesso ao e-mail cadastrado
        |
        v
Cria sua própria senha
        |
        v
Conta ATIVA
        |
        v
Criação/ativação do Perfil SABENÇA
```

---

# 8. Sobre usar a data de nascimento como senha

A ideia inicial previa gerar a senha a partir da data de nascimento.

Exemplo:

```text
14052003
```

Isso **não deve ser usado como senha permanente**.

Data de nascimento é uma informação previsível e frequentemente conhecida por terceiros.

## Decisão recomendada

Usar a data de nascimento somente como parte da validação do **primeiro acesso**.

Depois da validação, o estudante deverá criar uma senha própria.

Exemplo:

```text
RA
+
data de nascimento
+
confirmação pelo e-mail cadastrado
        |
        v
Criar senha
```

### Caso seja obrigatório utilizar a data de nascimento como senha inicial

Se a instituição exigir esse comportamento para o protótipo:

```text
Senha inicial = data de nascimento
```

ela deverá ser considerada uma **senha temporária**.

No primeiro login:

```text
Login com senha temporária
        |
        v
Troca obrigatória de senha
        |
        v
Acesso ao SABENÇA
```

O usuário não poderá continuar utilizando a senha baseada na data de nascimento.

---

# 9. Login

Depois da ativação, o estudante poderá entrar utilizando:

```text
RA
Senha
```

Isso reforça o vínculo com a instituição e evita transformar o e-mail pessoal em identidade principal da plataforma.

Fluxo técnico:

```text
RA informado
        |
        v
Servidor localiza o registro institucional
        |
        v
Obtém internamente a conta associada
        |
        v
Supabase Auth valida a senha
        |
        v
Sessão criada
```

A associação `RA -> conta/e-mail` nunca deve ser entregue como uma lista pública ao navegador.

Erros de login também não devem revelar se determinado RA existe.

Exemplo:

```text
"RA ou senha inválidos."
```

em vez de:

```text
"Este RA não existe."
```

---

# 10. Alteração no banco de dados

A tabela `profiles` deve continuar representando o perfil social do estudante.

Criar um registro institucional separado.

Sugestão conceitual:

```text
private.institution_students
```

Campos:

```text
id
institution_id
auth_user_id
ra
name
email
phone
birth_date
cpf_fingerprint
course
semester
status
import_batch_id
created_at
activated_at
updated_at
```

Status:

```text
pending
active
blocked
inactive
```

## CPF

Evitar armazenar CPF em texto puro caso o sistema não precise recuperá-lo posteriormente.

Para identificação e detecção de duplicidade, utilizar uma impressão criptográfica protegida por segredo da aplicação.

Conceitualmente:

```text
cpf normalizado
      |
      v
HMAC
      |
      v
cpf_fingerprint
```

Caso futuramente exista necessidade real de recuperar o CPF original, deverá ser adotado armazenamento criptografado e acesso administrativo restrito.

---

# 11. Importações

Criar também uma estrutura simples para registrar importações.

```text
private.import_batches
```

Campos sugeridos:

```text
id
file_name
uploaded_by
total_rows
valid_rows
invalid_rows
created_at
```

Isso permite documentar de onde vieram os registros sem transformar o projeto em um sistema acadêmico completo.

---

# 12. Autorização de acesso

A atual função de associação não deve considerar apenas:

```text
usuário autenticado
+
e-mail confirmado
```

Ela deverá considerar também o vínculo institucional.

Conceitualmente:

```text
auth.uid()
        |
        v
institution_students
        |
        +--> status = active
        |
        v
acesso permitido
```

Logo:

```text
Conta Supabase válida
```

não significa automaticamente:

```text
Membro SABENÇA válido
```

Essa separação é importante para permitir que a faculdade bloqueie ou desative um estudante sem precisar apagar todo o histórico imediatamente.

---

# 13. Administração

A área de importação deve ser acessível apenas por usuários administrativos.

Não utilizar um campo editável do perfil para decidir se alguém é administrador.

A autorização administrativa deve estar em uma estrutura controlada pelo servidor/banco.

Exemplo:

```text
private.admin_users
```

ou outra política equivalente.

A chave `service_role` do Supabase, caso seja necessária para criação administrativa de contas, deve existir **somente no servidor**.

Nunca:

```text
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
```

---

# 14. Alterações necessárias no código atual

O cadastro público atual deverá ser substituído.

## Remover do fluxo público

```text
/auth/register
"Fazer parte"
"Crie sua conta"
cadastro livre por nome + e-mail + senha
```

A rota poderá ser removida ou redirecionada.

## Criar

```text
/auth/login
/auth/primeiro-acesso

/admin/alunos
/admin/alunos/importar
```

## Tela de login

Campos:

```text
RA
Senha
```

Links:

```text
Primeiro acesso
Esqueci minha senha
```

## Primeiro acesso

Etapas:

```text
1. Identificar aluno
2. Validar vínculo
3. Confirmar e-mail
4. Criar senha
5. Ativar conta
```

---

# 15. Próximo passo do desenvolvimento

**Não iniciar o Perfil ainda.**

A alteração no modelo de acesso modifica uma parte estrutural do sistema.

O próximo passo deve ser transformar a autenticação atual em **acesso institucional fechado**.

Ordem recomendada:

```text
1. Criar migration do registro institucional
2. Criar papel/controle administrativo
3. Criar importador de .xlsx
4. Criar validação e prévia da importação
5. Implementar primeiro acesso
6. Alterar login para RA + senha
7. Remover cadastro público
8. Atualizar RLS / private.is_member()
9. Atualizar testes
10. Validar fluxo completo
11. Somente então iniciar o Perfil
```

---

# 16. Fluxo que deve funcionar antes da próxima fase

```text
ADMINISTRADOR
     |
     v
Importa planilha
     |
     v
Aluno registrado como pendente
     |
     v
-------------------------------
     |
     v
ESTUDANTE
     |
     v
Primeiro acesso
     |
     v
RA + validação
     |
     v
Confirma e-mail
     |
     v
Cria senha
     |
     v
Conta ativa
     |
     v
Login por RA
     |
     v
SABENÇA
```

Quando esse fluxo estiver funcional e testado, iniciar a construção completa do Perfil.

---

# 17. Alteração da identidade visual

O layout atual utiliza:

```text
verde
creme
tipografia serifada
estética editorial
```

O resultado é visualmente agradável, porém não cria uma relação clara com a identidade visual da FATECE.

A próxima revisão deverá aproximar o SABENÇA da linguagem visual institucional **sem transformar a aplicação em uma cópia do site da faculdade**.

O SABENÇA continuará sendo um produto com identidade própria.

---

# 18. Referência visual da FATECE

Elementos observados no site institucional:

- fundo predominantemente branco;
- uso forte de azul;
- azul escuro em materiais institucionais;
- laranja como cor complementar;
- cinza como apoio;
- logotipo com azul, laranja e cinza;
- linguagem visual mais institucional;
- destaque para o acesso do aluno;
- banners com grandes áreas azuis;
- navegação superior clara.

## Paleta sugerida para o SABENÇA

Os valores abaixo são uma aproximação para a interface do projeto e não uma declaração de cores oficiais.

```text
Azul SABENÇA / institucional:
#0796D2

Azul escuro:
#063B73

Laranja de destaque:
#F7943D

Cinza:
#6B7280

Cinza claro:
#F3F5F7

Branco:
#FFFFFF

Texto:
#172033
```

### Uso

```text
Azul       -> ações principais, links, navegação ativa
Azul escuro -> títulos, cabeçalhos e áreas institucionais
Laranja    -> detalhes, estados de destaque e pequenas chamadas
Branco     -> fundo predominante
Cinza      -> textos secundários e divisórias
```

Evitar grandes superfícies laranjas.

---

# 19. Tipografia

Reduzir o uso da grande tipografia serifada da landing page atual.

Priorizar uma fonte sem serifa moderna para aproximar o sistema de uma aplicação acadêmica/digital.

Sugestão:

```text
Inter
```

Fallback:

```text
Arial
Helvetica
sans-serif
```

A identidade do SABENÇA poderá continuar aparecendo no logotipo e em pequenos detalhes próprios.

---

# 20. Nova página pública

Como não existe mais cadastro aberto, a página inicial pública deve ter foco em **acesso**, e não em aquisição de novos usuários.

Wireframe:

```text
┌─────────────────────────────────────────────────────────────┐
│ SABENÇA                                  Comunidade FATECE  │
│                                                             │
│ Marketplace   Networks   Sobre                 [ Entrar ]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   SUA COMUNIDADE UNIVERSITÁRIA                              │
│                                                             │
│   Conheça. Troque.                                          │
│   Colabore.                                                 │
│                                                             │
│   Encontre estudantes, habilidades, produtos e serviços     │
│   dentro da sua própria comunidade acadêmica.               │
│                                                             │
│   [ Acessar SABENÇA ]    [ Primeiro acesso ]                │
│                                                             │
│                                    elemento visual azul/     │
│                                    laranja inspirado na      │
│                                    identidade institucional │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Marketplace        Networks             Perfil              │
│ ...                ...                  ...                 │
└─────────────────────────────────────────────────────────────┘
```

Remover:

```text
Fazer parte
Crie sua conta
```

Substituir por:

```text
Entrar
Primeiro acesso
```

---

# 21. Tela de login

A tela de autenticação deverá parecer integrada ao ambiente acadêmico.

Sugestão:

```text
┌──────────────────────────┬───────────────────────────────┐
│                          │                               │
│ SABENÇA                  │ Acesse sua comunidade        │
│                          │                               │
│ Comunidade universitária │ RA                            │
│ FATECE                   │ [________________________]    │
│                          │                               │
│ Marketplace              │ Senha                         │
│ Networks                 │ [________________________]    │
│ Projetos                 │                               │
│ Conexões                 │ [ Entrar ]                    │
│                          │                               │
│ detalhe azul/laranja     │ Primeiro acesso              │
│                          │ Esqueci minha senha           │
└──────────────────────────┴───────────────────────────────┘
```

A lateral pode utilizar:

- fundo azul escuro;
- formas abstratas derivadas das curvas presentes na identidade visual da FATECE;
- pequenos detalhes em laranja;
- logotipo SABENÇA em branco.

Não é necessário copiar banners ou a estrutura de notícias da página institucional.

---

# 22. Layout interno do SABENÇA

Depois do login:

```text
┌─────────────────────────────────────────────────────────────┐
│ SABENÇA       Pesquisar no SABENÇA...      Nome / Perfil   │
├─────────────────────────────────────────────────────────────┤
│ Marketplace | Networks | Conexões | Meu perfil             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ conteúdo                                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Página inicial autenticada

O usuário não precisa encontrar uma grande landing page depois de entrar.

Priorizar conteúdo útil:

```text
Pesquisa geral

Marketplace
- anúncios recentes
- categorias
- botão criar anúncio

Networks
- pessoas sugeridas
- busca por habilidades
- busca por interesses

Perfil
- progresso do perfil
```

Marketplace e Networks continuam sendo os principais destaques.

---

# 23. Relação com a identidade da instituição

O SABENÇA deve parecer:

> uma plataforma que pertence ao ecossistema universitário da instituição.

Mas não deve parecer:

> uma nova página do site institucional.

Portanto:

```text
FATECE
    |
    +--> identidade institucional / confiança
    |
SABENÇA
    |
    +--> produto social universitário
```

A marca SABENÇA continua sendo a marca principal da aplicação.

Caso o logotipo oficial da instituição seja utilizado no produto final, confirmar previamente a autorização de uso.

---

# 24. Registro da alteração

## Decisão

Alterar o modelo de cadastro aberto para um modelo de acesso institucional pré-autorizado.

## Motivo

O SABENÇA deve funcionar como uma comunidade universitária fechada. Permitir que qualquer pessoa crie uma conta enfraqueceria um dos principais diferenciais do projeto: o vínculo acadêmico como mecanismo de contexto e confiança.

## Solução

A instituição importa previamente os estudantes autorizados através de planilha. O estudante realiza um processo de primeiro acesso e cria sua senha.

## Alternativa descartada

Cadastro público com confirmação de e-mail.

## Motivo do descarte

Confirmar que um e-mail existe não comprova vínculo com a instituição.

---

# 25. Registro sobre senha inicial

## Decisão

Não utilizar data de nascimento como senha permanente.

## Motivo

É uma credencial previsível e baseada em dado pessoal.

## Solução

Utilizar a data de nascimento apenas como um dos fatores do primeiro acesso, seguida da criação obrigatória de uma senha pelo estudante.

## Alternativa

Caso necessário para demonstração institucional, permitir senha temporária derivada da data de nascimento com troca obrigatória no primeiro login.

---

# 26. Registro sobre planilhas

## Decisão

Adicionar importação administrativa de alunos via `.xlsx`.

## Motivo

A faculdade normalmente já possui os dados dos estudantes em sistemas acadêmicos ou planilhas. A importação reduz trabalho manual e mantém a instituição como responsável pela autorização de acesso.

## Tecnologia prevista

```text
ExcelJS + Zod
```

## Dificuldades previstas

- células em formatos diferentes;
- datas armazenadas pelo Excel de formas diferentes;
- CPF com e sem pontuação;
- telefones com formatos diferentes;
- duplicidade de RA;
- duplicidade de CPF;
- duplicidade de e-mail;
- linhas parcialmente preenchidas;
- reimportação de alunos existentes.

## Solução prevista

Normalização, validação linha a linha, tela de prévia e relatório de erros antes da confirmação.

---

# 27. Registro sobre o layout

## Decisão

Aproximar a identidade visual do SABENÇA da linguagem institucional da FATECE.

## Motivo

O SABENÇA é uma comunidade vinculada à instituição. A identidade atual é visualmente independente demais e não comunica esse vínculo imediatamente.

## Alterações principais

```text
verde/creme       -> azul/branco
verde de destaque -> azul institucional
detalhes verdes   -> laranja
serifas grandes   -> sans-serif mais digital
cadastro público  -> login / primeiro acesso
```

## Limite

A aplicação não deverá copiar o site institucional. O objetivo é criar continuidade visual, mantendo o SABENÇA como produto próprio.

---

# 28. Critério de conclusão desta etapa

Esta etapa será considerada concluída quando:

```text
[ ] cadastro público estiver desativado
[ ] registro institucional existir no banco
[ ] administrador puder importar .xlsx
[ ] planilha possuir validação antes da gravação
[ ] registros duplicados forem tratados
[ ] estudante puder realizar primeiro acesso
[ ] estudante puder definir senha própria
[ ] estudante puder entrar utilizando RA + senha
[ ] usuário não autorizado não conseguir entrar
[ ] aluno bloqueado não conseguir acessar módulos internos
[ ] CPF não aparecer em nenhuma resposta pública
[ ] telefone não for público por padrão
[ ] RLS/autorização considerar vínculo ativo
[ ] testes de autenticação forem atualizados
[ ] layout público estiver adaptado à nova identidade
[ ] desktop e mobile forem validados
```

---

# 29. O que vem depois

Somente depois desta etapa:

```text
Perfil
   |
   v
Marketplace
   |
   v
Networks
   |
   v
Conexões
```

O **Perfil** continua sendo a próxima funcionalidade de negócio.

Porém, antes dele, o sistema precisa saber com segurança:

> quem realmente é membro da comunidade.
