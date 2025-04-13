# Brasil API - MCP Server

**Category: Government**

Este servidor MCP fornece acesso a diversos dados públicos do Brasil através da [Brasil API](https://brasilapi.com.br/).

## Ferramentas disponíveis

Este servidor MCP disponibiliza as seguintes ferramentas:

### Endereços
- `brasil_cep`
  - Consulta informações de um CEP
  - Inputs:
    - `cep` (string): CEP a ser consultado, apenas números ou no formato 00000-000

### Empresas e Negócios
- `brasil_cnpj`
  - Busca dados de um CNPJ
  - Inputs:
    - `cnpj` (string): CNPJ a ser consultado, apenas números ou no formato 00.000.000/0000-00

### Telecomunicações
- `brasil_ddd`
  - Retorna cidades a partir de um DDD
  - Inputs:
    - `ddd` (string): DDD a ser consultado, apenas números (ex: 11, 21, 31)

### Calendário
- `brasil_feriados`
  - Lista feriados nacionais de um ano específico
  - Inputs:
    - `ano` (string): Ano a ser consultado no formato YYYY (ex: 2023, 2024)

### Sistema Financeiro
- `brasil_banco`
  - Busca informações de bancos brasileiros
  - Inputs:
    - `codigo` (string): Código do banco, por exemplo: 001, 237, 341
- `brasil_bancos`
  - Lista todos os bancos brasileiros
  - Inputs: (sem parâmetros)
- `brasil_pix_participantes`
  - Lista participantes do PIX
  - Inputs: (sem parâmetros)
- `brasil_cotacao`
  - Obtém cotação do dólar, euro e outras moedas
  - Inputs:
    - `moeda` (string): Código da moeda (USD, EUR, etc)

### Geografia e Localização
- `brasil_ibge_municipio`
  - Busca municípios brasileiros
  - Inputs:
    - `codigoIbge` (string): Código IBGE do município
    - `provedores` (string, opcional): Provedores de dados (IBGE)

## Instalação

```bash
npm install @integrabot/brasil-api
```

## Uso

### Como servidor MCP (para integração com LLMs)

```bash
npx brasil-api
```

### Como biblioteca

```typescript
import { BrasilAPI } from '@integrabot/brasil-api';

// Exemplos de uso
const cep = await BrasilAPI.consultarCEP('01001000');
const cnpj = await BrasilAPI.consultarCNPJ('00000000000191');
const ddd = await BrasilAPI.consultarDDD('11');
```

## Configuração

A Brasil API é um serviço gratuito que não requer configuração de chave de API, mas possui limites de uso.

## Limites de Uso

Este servidor implementa rate limiting para respeitar os limites da Brasil API:
- 2 requisições por segundo
- 60 requisições por minuto

## Timeouts

Este servidor implementa timeout de 15 segundos em todas as requisições à API para evitar bloqueios. 