# Ploomes CRM - MCP Server

**Category: CRM**

An MCP server that provides access to Ploomes CRM, allowing AI agents to interact with customer information, deals, contacts, and more.

## Features

- **Customer Management**: Query and manipulate customer data
- **Deal Management**: Manage opportunities and sales pipeline
- **Contacts**: Manage contacts associated with customers
- **Documents**: Access and manipulate documents and proposals
- **Activities**: Manage tasks and appointments

## Tools

### Customers
- **ploomes_list_customers**
  - List all customers registered in Ploomes
  - Inputs:
    - `filtro` (string, optional): Filter for specific search
    - `pagina` (number, optional): Page number for pagination
    - `tamanho_pagina` (number, optional): Page size for pagination
    
- **ploomes_get_customer**
  - Get details of a specific customer
  - Inputs:
    - `id` (number): Customer ID

- **ploomes_create_customer**
  - Create a new customer in Ploomes
  - Inputs:
    - `nome` (string): Customer name
    - `email` (string, optional): Customer email
    - `telefone` (string, optional): Customer phone
    - `observacoes` (string, optional): Notes about the customer

- **ploomes_update_customer**
  - Update information of an existing customer
  - Inputs:
    - `id` (number): Customer ID
    - `nome` (string, optional): New customer name
    - `email` (string, optional): New customer email
    - `telefone` (string, optional): New customer phone
    - `observacoes` (string, optional): New notes about the customer

### Deals
- **ploomes_list_deals**
  - List all deals/opportunities
  - Inputs:
    - `filtro` (string, optional): Filter for specific search
    - `cliente_id` (number, optional): Filter by specific customer
    - `pagina` (number, optional): Page number for pagination
    - `tamanho_pagina` (number, optional): Page size for pagination

- **ploomes_get_deal**
  - Get details of a specific deal
  - Inputs:
    - `id` (number): Deal ID

- **ploomes_create_deal**
  - Create a new deal/opportunity
  - Inputs:
    - `titulo` (string): Deal title
    - `cliente_id` (number): Associated customer ID
    - `valor` (number, optional): Deal value
    - `estagio_id` (number, optional): Stage ID in the sales funnel

- **ploomes_update_deal**
  - Update an existing deal
  - Inputs:
    - `id` (number): Deal ID
    - `titulo` (string, optional): New title
    - `valor` (number, optional): New value
    - `estagio_id` (number, optional): New stage in the sales funnel

### Contacts
- **ploomes_list_contacts**
  - List all contacts of a customer
  - Inputs:
    - `cliente_id` (number): Customer ID
    - `pagina` (number, optional): Page number for pagination
    - `tamanho_pagina` (number, optional): Page size for pagination

- **ploomes_get_contact**
  - Get details of a specific contact
  - Inputs:
    - `id` (number): Contact ID

- **ploomes_create_contact**
  - Create a new contact for a customer
  - Inputs:
    - `cliente_id` (number): Customer ID
    - `nome` (string): Contact name
    - `email` (string, optional): Contact email
    - `telefone` (string, optional): Contact phone
    - `cargo` (string, optional): Contact role

### Activities
- **ploomes_list_activities**
  - List all activities
  - Inputs:
    - `cliente_id` (number, optional): Filter by specific customer
    - `negocio_id` (number, optional): Filter by specific deal
    - `pagina` (number, optional): Page number for pagination
    - `tamanho_pagina` (number, optional): Page size for pagination
    
- **ploomes_create_activity**
  - Create a new activity
  - Inputs:
    - `titulo` (string): Activity title
    - `descricao` (string, optional): Activity description
    - `data_inicio` (string): Start date (ISO format)
    - `data_fim` (string, optional): End date (ISO format)
    - `cliente_id` (number, optional): Associated customer ID
    - `negocio_id` (number, optional): Associated deal ID
    - `tipo_id` (number): Activity type ID

## Installation

```bash
npm install @integrabot/ploomes-crm
```

## Usage

### As an MCP Server (for LLM integration)

```bash
npx ploomes-crm
```

## Configuration

The server requires a Ploomes API key to function. The key can be provided in two ways:

1. As an environment variable:
   ```
   PLOOMES_API_KEY=your_api_key
   ```

2. As a command line argument:
   ```
   npx ploomes-crm --api-key=your_api_key
   ```

## Rate Limits

This server implements rate limiting to respect Ploomes API usage limits:
- 5 requests per second
- 300 requests per minute

## Timeouts

The server implements a 30-second timeout on all API requests to prevent blocking. 