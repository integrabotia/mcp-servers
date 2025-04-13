# Brasil API - MCP Server

**Category: Government**

An MCP server that provides access to various public data from Brazil through the [Brasil API](https://brasilapi.com.br/).

## Features

- **Address Lookup**: Query complete address information using postal codes (CEP)
- **Business Data**: Retrieve detailed company information using CNPJ registration numbers
- **Geolocation**: Access municipality data and area codes (DDD) coverage
- **Financial System**: Information about banks, PIX payment system participants, and currency exchange rates
- **Calendar**: National holidays for specific years

## Tools

### Address
- **brasil_cep**
  - Query address information from a Brazilian postal code
  - Inputs:
    - `cep` (string): Postal code in numeric format or 00000-000 pattern

### Business
- **brasil_cnpj**
  - Retrieve company registration data from a CNPJ number
  - Inputs:
    - `cnpj` (string): CNPJ in numeric format or 00.000.000/0000-00 pattern

### Telecommunications
- **brasil_ddd**
  - List cities that use a specific area code
  - Inputs:
    - `ddd` (string): Area code (examples: 11, 21, 31)

### Calendar
- **brasil_feriados**
  - List national holidays for a specific year
  - Inputs:
    - `ano` (string): Year in YYYY format (examples: 2023, 2024)

### Financial System
- **brasil_banco**
  - Get information about a specific Brazilian bank
  - Inputs:
    - `codigo` (string): Bank code (examples: 001, 237, 341)
- **brasil_bancos**
  - List all Brazilian banks and their information
  - Inputs: (no parameters)
- **brasil_pix_participantes**
  - List all institutions participating in the PIX payment system
  - Inputs: (no parameters)
- **brasil_cotacao**
  - Get exchange rates for currencies against the Brazilian Real
  - Inputs:
    - `moeda` (string): Currency code (USD, EUR, etc.)

### Geography
- **brasil_ibge_municipio**
  - Search for Brazilian municipalities using IBGE code
  - Inputs:
    - `codigoIbge` (string): IBGE municipality code
    - `provedores` (string, optional): Data providers (IBGE)

## Installation

```bash
npm install @integrabot/brasil-api
```

## Usage

### As an MCP Server (for LLM integration)

```bash
npx brasil-api
```

### As a Library

```typescript
import { BrasilAPI } from '@integrabot/brasil-api';

// Example usage
const cep = await BrasilAPI.consultarCEP('01001000');
const cnpj = await BrasilAPI.consultarCNPJ('00000000000191');
const ddd = await BrasilAPI.consultarDDD('11');
```

## Configuration

Brasil API is a free service that doesn't require an API key, but it has usage limits.

## Rate Limits

This server implements rate limiting to respect Brasil API's usage limits:
- 2 requests per second
- 60 requests per minute

## Timeouts

This server implements a 15-second timeout on all API requests to prevent blocking. 