# Site Institucional para Advogado

Este projeto reúne:

- um frontend institucional em React + Vite
- uma página de cadastro de leads em HTML
- um backend em Node.js + Express
- um painel administrativo para consultar leads
- integração com banco de dados MySQL

O objetivo do sistema é apresentar o escritório, captar contatos pelo formulário e permitir a consulta dos leads cadastrados sem acessar diretamente o banco.

## Visão Geral

O projeto é dividido em duas partes principais:

1. Frontend institucional
   Arquivo principal: `src/app/App.tsx`

2. Backend e painel administrativo
   Arquivo principal: `server.cjs`

Além disso, existe uma página separada de cadastro:

- `cadastro_cliente.html`

## Tecnologias Utilizadas

### Frontend

- React
- Vite
- TypeScript/TSX
- Tailwind CSS
- Motion
- Lucide React

### Backend

- Node.js
- Express
- body-parser
- cors
- dotenv
- mysql2/promise
- crypto nativo do Node.js

### Banco de Dados

- MySQL

## Estrutura Principal

```text
Site institucional para advogado/
├─ src/
│  ├─ app/
│  │  └─ App.tsx
│  ├─ imports/
│  │  └─ image.png
│  ├─ styles/
│  └─ main.tsx
├─ cadastro_cliente.html
├─ index.html
├─ server.cjs
├─ package.json
├─ .env
└─ .env.example
```

## Frontend Institucional

O site principal é renderizado pelo React.

Arquivos principais:

- `src/main.tsx`
  ponto de entrada do frontend

- `src/app/App.tsx`
  página institucional principal

### O que existe no frontend

O arquivo `App.tsx` contém:

- header fixo com logo, navegação e botão de CTA
- hero principal
- seção `Sobre`
- seção `Áreas de Atuação`
- CTA intermediário
- seção `Contato`
- rodapé com informações legais

### Navegação por âncoras

As seções usam IDs para navegação:

- `#sobre`
- `#atuacao`
- `#contato`

Foi aplicado `scroll-margin-top` para compensar o header fixo e evitar que o topo da seção fique escondido atrás da navegação.

### Logo

A logo principal do site é importada em:

- `src/app/App.tsx`

Imagem usada:

- `src/imports/image.png`

O tamanho da logo é controlado pela `className` do `<img>`, por exemplo:

```tsx
className="h-28 md:h-32 lg:h-36 w-auto"
```

## Página de Cadastro

Arquivo:

- `cadastro_cliente.html`

Essa página funciona como landing/formulário para captação de leads.

### Campos principais

- nome
- telefone
- descrição do caso

### Finalidade

Quando o usuário envia o formulário, os dados são encaminhados ao backend para serem gravados na tabela `leads`.

## Backend

Arquivo principal:

- `server.cjs`

O backend é responsável por:

- carregar variáveis de ambiente
- conectar no MySQL
- garantir a estrutura mínima da tabela de leads
- receber cadastros
- servir a API administrativa
- renderizar a página do painel de leads

## Banco de Dados

O backend usa MySQL com conexão configurada por `.env`.

### Variáveis de ambiente do banco

Definidas em:

- `.env`
- `.env.example`

Campos usados:

```env
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=
```

### Tabela principal

Tabela:

- `leads`

Colunas esperadas:

- `id`
- `nome`
- `telefone`
- `descricao`
- `dt_cadastro`

### Migração automática

Ao subir o servidor, a função `ensureLeadsSchema()`:

- cria a tabela `leads` se ela não existir
- cria a coluna `dt_cadastro` se ela não existir
- copia dados antigos de `created_at` para `dt_cadastro`, quando necessário
- preenche `dt_cadastro` com `NOW()` em registros antigos sem data

Isso foi feito para manter compatibilidade com versões anteriores do banco.

## Cadastro de Leads

Rota:

- `POST /cadastrar`

### O que a rota faz

- valida os dados enviados
- insere o lead no banco
- grava `dt_cadastro` com `NOW()`
- retorna uma resposta JSON de sucesso ou erro

### Exemplo de resposta de sucesso

```json
{
  "sucesso": true,
  "mensagem": "Cadastro realizado com sucesso!",
  "leadId": 123
}
```

## Painel de Leads

Rota de acesso:

- `GET /painel-leads`

O painel é gerado diretamente pelo backend e não depende de um arquivo HTML separado.

### O que o painel mostra

- total de leads
- data do último cadastro
- tabela com:
  - ID
  - nome
  - telefone
  - descrição
  - data de cadastro

### Recursos do painel

- busca por texto
- layout administrativo simples
- exibição formatada da data em `pt-BR`
- sessão administrativa com expiração

## Autenticação do Painel

O painel usa login administrativo próprio.

### Variáveis de ambiente

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=defina_uma_senha_forte
ADMIN_SESSION_HOURS=3
```

### Como funciona

- o usuário acessa `/painel-leads`
- faz login com usuário e senha
- o backend gera um token administrativo temporário
- o token fica salvo no navegador
- o acesso expira automaticamente após o tempo configurado em `ADMIN_SESSION_HOURS`

### Rotas relacionadas

- `POST /admin/login`
- `POST /admin/logout`
- `GET /api/leads`

## API Administrativa

Rota:

- `GET /api/leads`

Retorna a lista de leads em JSON para uso administrativo.

Exemplo de estrutura:

```json
{
  "sucesso": true,
  "total": 10,
  "leads": [
    {
      "id": 1,
      "nome": "Cliente Exemplo",
      "telefone": "(11) 99999-9999",
      "descricao": "Texto do caso",
      "dt_cadastro": "2026-04-20 10:15:00"
    }
  ]
}
```

## Como Rodar o Projeto

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie ou ajuste o arquivo `.env` com base no `.env.example`.

### 3. Rodar o frontend

```bash
npm run dev
```

Normalmente o Vite sobe em:

- `http://localhost:5173`

### 4. Rodar o backend

```bash
npm run start:api
```

Normalmente a API sobe em:

- `http://localhost:3000`

### 5. Rodar tudo com um único comando

Se quiser subir frontend e backend ao mesmo tempo, use:

```bash
npm run dev:all
```

Esse comando inicia:

- o frontend Vite
- a API Express

É a forma mais prática para desenvolvimento local.

## URLs Importantes

### Frontend principal

- `http://localhost:5173`

### Página de cadastro

- `http://localhost:3000/cadastro_cliente.html`
  ou, dependendo do fluxo local, via frontend/servidor que estiver servindo o arquivo

### Painel de leads

- `http://localhost:3000/painel-leads`

### API de leads

- `http://localhost:3000/api/leads`

## Scripts Disponíveis

No `package.json`:

- `npm run dev`
  inicia o frontend com Vite

- `npm run build`
  gera build de produção do frontend

- `npm run start:api`
  inicia o backend Express

- `npm run dev:all`
  inicia frontend e backend juntos em ambiente de desenvolvimento

## Ajustes Implementados no Projeto

Durante a evolução deste projeto, foram feitos ajustes importantes:

- remoção da integração com a API da Meta/WhatsApp
- criação do painel administrativo de leads
- criação de login administrativo com expiração de sessão
- adição da coluna `dt_cadastro`
- compatibilidade com bases antigas que ainda tinham `created_at`
- formatação de datas em português do Brasil
- compensação do menu fixo para navegação por âncoras
- ajustes de exibição da logo e das informações de OAB

## Observações Importantes

- o backend gera a página do painel via string HTML dentro do `server.cjs`
- o projeto ainda contém arquivos legados fora deste diretório, como outros `server.js` na raiz do repositório
- o fluxo principal atual deste projeto está concentrado em:
  - `src/app/App.tsx`
  - `cadastro_cliente.html`
  - `server.cjs`

## Melhorias Futuras Sugeridas

- separar `server.cjs` em módulos menores
- mover o painel administrativo para um frontend separado em React
- adicionar paginação e filtros avançados no painel
- adicionar exportação CSV dos leads
- adicionar validações mais fortes no formulário
- adicionar proteção extra com sessão persistida em banco ou Redis

## Arquivos Mais Importantes

- `src/app/App.tsx`
  frontend institucional

- `cadastro_cliente.html`
  formulário de captação

- `server.cjs`
  backend, painel e API administrativa

- `.env`
  configuração local

- `.env.example`
  modelo de configuração

---

Se este projeto continuar crescendo, a recomendação é separar claramente:

- frontend institucional
- backend/API
- painel administrativo

Isso facilita manutenção, deploy e evolução futura.

## Informações Gerenciais de Instalação

Esta seção resume o que é necessário para instalar, publicar e operar o sistema.

### Requisitos mínimos

Antes da instalação, o ambiente deve possuir:

- Node.js instalado
- npm instalado
- acesso a um banco MySQL
- credenciais válidas do banco
- porta disponível para o backend
- ambiente capaz de servir o frontend

### Checklist de instalação

1. Copiar o projeto para o servidor ou máquina local
2. Instalar as dependências com `npm install`
3. Criar o arquivo `.env` com base no `.env.example`
4. Configurar o acesso ao banco MySQL
5. Definir usuário, senha e tempo de sessão do painel
6. Iniciar o backend com `npm run start:api`
7. Iniciar o frontend com `npm run dev` ou gerar a build com `npm run build`
8. Testar o formulário de cadastro
9. Testar o painel de leads
10. Confirmar que os registros estão sendo gravados na tabela `leads`

### Configuração obrigatória do `.env`

Exemplo mínimo:

```env
PORT=3000

DB_HOST=seu_host_mysql
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=seu_banco

ADMIN_USERNAME=admin
ADMIN_PASSWORD=uma_senha_forte
ADMIN_SESSION_HOURS=3
```

### Procedimento de subida em ambiente local

#### Backend

```bash
npm run start:api
```

Resultado esperado:

- API ativa
- painel de leads acessível
- estrutura da tabela conferida automaticamente

#### Frontend

```bash
npm run dev
```

Resultado esperado:

- site institucional ativo em ambiente de desenvolvimento

### Procedimento de publicação

Em ambiente de produção, a recomendação operacional é:

1. gerar a build do frontend
2. publicar os arquivos do frontend em hospedagem estática ou servidor web
3. manter o backend Node.js rodando em processo gerenciado
4. proteger o arquivo `.env`
5. validar o acesso ao painel administrativo

### Validações após a instalação

Após subir o sistema, validar:

- home abrindo corretamente
- navegação do menu funcionando
- página de cadastro carregando
- formulário salvando no banco
- painel de leads abrindo com login
- sessão do painel expirando conforme `ADMIN_SESSION_HOURS`
- data de cadastro sendo preenchida em `dt_cadastro`

### Itens de segurança recomendados

- usar senha forte em `ADMIN_PASSWORD`
- restringir o acesso ao painel apenas a usuários autorizados
- não versionar o arquivo `.env`
- manter backup periódico do banco
- usar HTTPS em produção
- limitar o acesso ao banco por IP sempre que possível

### Responsabilidades operacionais

Para manter o sistema funcionando corretamente, é importante acompanhar:

- disponibilidade do banco de dados
- consumo de espaço da tabela de leads
- validade das credenciais de acesso
- disponibilidade do processo Node.js
- atualização das dependências quando necessário

### Rotina recomendada de manutenção

- testar o formulário periodicamente
- revisar os leads salvos no painel
- trocar senhas administrativas quando necessário
- validar backups do banco
- revisar logs do backend em caso de falhas

### Observação gerencial

Hoje o sistema está funcional e atende bem a operação de captação e consulta de leads. Se o volume crescer, o ideal é evoluir para uma arquitetura com:

- frontend separado
- API separada
- painel administrativo dedicado
- autenticação persistente
- logs e monitoramento estruturados
