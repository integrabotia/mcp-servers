#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Esquemas Zod para validação de parâmetros
const listarClientesSchema = z.object({
  filtro: z.string().optional()
    .describe("Filtro para pesquisa específica"),
  pagina: z.number().optional()
    .describe("Número da página para paginação"),
  tamanho_pagina: z.number().optional()
    .describe("Tamanho da página para paginação")
});

const obterClienteSchema = z.object({
  id: z.number()
    .describe("ID do cliente")
});

const criarClienteSchema = z.object({
  nome: z.string()
    .describe("Nome do cliente"),
  email: z.string().optional()
    .describe("Email do cliente"),
  telefone: z.string().optional()
    .describe("Telefone do cliente"),
  observacoes: z.string().optional()
    .describe("Observações sobre o cliente")
});

const atualizarClienteSchema = z.object({
  id: z.number()
    .describe("ID do cliente"),
  nome: z.string().optional()
    .describe("Novo nome do cliente"),
  email: z.string().optional()
    .describe("Novo email do cliente"),
  telefone: z.string().optional()
    .describe("Novo telefone do cliente"),
  observacoes: z.string().optional()
    .describe("Novas observações sobre o cliente")
});

const listarNegociosSchema = z.object({
  filtro: z.string().optional()
    .describe("Filtro para pesquisa específica"),
  cliente_id: z.number().optional()
    .describe("Filtrar por cliente específico"),
  pagina: z.number().optional()
    .describe("Número da página para paginação"),
  tamanho_pagina: z.number().optional()
    .describe("Tamanho da página para paginação")
});

const obterNegocioSchema = z.object({
  id: z.number()
    .describe("ID do negócio")
});

const criarNegocioSchema = z.object({
  titulo: z.string()
    .describe("Título do negócio"),
  cliente_id: z.number()
    .describe("ID do cliente associado"),
  valor: z.number().optional()
    .describe("Valor do negócio"),
  estagio_id: z.number().optional()
    .describe("ID do estágio no funil de vendas")
});

const atualizarNegocioSchema = z.object({
  id: z.number()
    .describe("ID do negócio"),
  titulo: z.string().optional()
    .describe("Novo título"),
  valor: z.number().optional()
    .describe("Novo valor"),
  estagio_id: z.number().optional()
    .describe("Novo estágio no funil de vendas")
});

const listarContatosSchema = z.object({
  cliente_id: z.number()
    .describe("ID do cliente"),
  pagina: z.number().optional()
    .describe("Número da página para paginação"),
  tamanho_pagina: z.number().optional()
    .describe("Tamanho da página para paginação")
});

const obterContatoSchema = z.object({
  id: z.number()
    .describe("ID do contato")
});

const criarContatoSchema = z.object({
  cliente_id: z.number()
    .describe("ID do cliente"),
  nome: z.string()
    .describe("Nome do contato"),
  email: z.string().optional()
    .describe("Email do contato"),
  telefone: z.string().optional()
    .describe("Telefone do contato"),
  cargo: z.string().optional()
    .describe("Cargo do contato")
});

const listarAtividadesSchema = z.object({
  cliente_id: z.number().optional()
    .describe("Filtrar por cliente específico"),
  negocio_id: z.number().optional()
    .describe("Filtrar por negócio específico"),
  pagina: z.number().optional()
    .describe("Número da página para paginação"),
  tamanho_pagina: z.number().optional()
    .describe("Tamanho da página para paginação")
});

const criarAtividadeSchema = z.object({
  titulo: z.string()
    .describe("Título da atividade"),
  descricao: z.string().optional()
    .describe("Descrição da atividade"),
  data_inicio: z.string()
    .describe("Data de início (formato ISO)"),
  data_fim: z.string().optional()
    .describe("Data de término (formato ISO)"),
  cliente_id: z.number().optional()
    .describe("ID do cliente associado"),
  negocio_id: z.number().optional()
    .describe("ID do negócio associado"),
  tipo_id: z.number()
    .describe("ID do tipo de atividade")
});

// Define o tipo para os parâmetros
type ListarClientesParams = z.infer<typeof listarClientesSchema>;
type ObterClienteParams = z.infer<typeof obterClienteSchema>;
type CriarClienteParams = z.infer<typeof criarClienteSchema>;
type AtualizarClienteParams = z.infer<typeof atualizarClienteSchema>;
type ListarNegociosParams = z.infer<typeof listarNegociosSchema>;
type ObterNegocioParams = z.infer<typeof obterNegocioSchema>;
type CriarNegocioParams = z.infer<typeof criarNegocioSchema>;
type AtualizarNegocioParams = z.infer<typeof atualizarNegocioSchema>;
type ListarContatosParams = z.infer<typeof listarContatosSchema>;
type ObterContatoParams = z.infer<typeof obterContatoSchema>;
type CriarContatoParams = z.infer<typeof criarContatoSchema>;
type ListarAtividadesParams = z.infer<typeof listarAtividadesSchema>;
type CriarAtividadeParams = z.infer<typeof criarAtividadeSchema>;

// Criar instância do servidor
const mcpServer = new McpServer({
  name: "ploomes-crm",
  version: "0.0.1",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Controle de taxa de requisições
const RATE_LIMIT = {
  perSecond: 5,
  perMinute: 300,
};

let requestCount = {
  second: 0,
  minute: 0,
  lastSecondReset: Date.now(),
  lastMinuteReset: Date.now(),
};

function checkRateLimit() {
  const now = Date.now();
  
  // Reset contador por segundo
  if (now - requestCount.lastSecondReset > 1000) {
    requestCount.second = 0;
    requestCount.lastSecondReset = now;
  }
  
  // Reset contador por minuto
  if (now - requestCount.lastMinuteReset > 60000) {
    requestCount.minute = 0;
    requestCount.lastMinuteReset = now;
  }
  
  if (
    requestCount.second >= RATE_LIMIT.perSecond ||
    requestCount.minute >= RATE_LIMIT.perMinute
  ) {
    throw new Error('Taxa limite de requisições excedida. Tente novamente em alguns instantes.');
  }
  
  requestCount.second++;
  requestCount.minute++;
}

// Definir timeout para as requisições à API
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 30000) {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Obter a chave da API do Ploomes
function getApiKey() {
  // Primeiro, verificar como variável de ambiente
  const envApiKey = process.env.PLOOMES_API_KEY;
  if (envApiKey) return envApiKey;
  
  // Depois, verificar como argumento de linha de comando
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--api-key=')) {
      return arg.split('=')[1];
    }
  }
  
  throw new Error('Chave de API do Ploomes não encontrada. Defina a variável de ambiente PLOOMES_API_KEY ou passe o argumento --api-key=sua_chave_api');
}

// Implementações de requisições à API
async function listarClientes(filtro?: string, pagina?: number, tamanho_pagina?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams();
  
  if (filtro) queryParams.append('$filter', filtro);
  if (pagina) queryParams.append('$skip', ((pagina - 1) * (tamanho_pagina || 10)).toString());
  if (tamanho_pagina) queryParams.append('$top', tamanho_pagina.toString());
  
  const url = `https://public-api2.ploomes.com/Contacts?${queryParams.toString()}`;
  
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function obterCliente(id: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Contacts(${id})`;
  
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "Cliente não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function criarCliente(nome: string, email?: string, telefone?: string, observacoes?: string) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Contacts`;
  
  const payload: any = {
    Name: nome
  };
  
  if (email) payload.Email = email;
  if (telefone) payload.Phone = telefone;
  if (observacoes) payload.Notes = observacoes;
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function atualizarCliente(id: number, nome?: string, email?: string, telefone?: string, observacoes?: string) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Contacts(${id})`;
  
  const payload: any = {};
  
  if (nome) payload.Name = nome;
  if (email) payload.Email = email;
  if (telefone) payload.Phone = telefone;
  if (observacoes) payload.Notes = observacoes;
  
  const response = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "Cliente não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return { mensagem: "Cliente atualizado com sucesso" };
}

async function listarNegocios(filtro?: string, cliente_id?: number, pagina?: number, tamanho_pagina?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams();
  
  if (filtro) queryParams.append('$filter', filtro);
  if (cliente_id) queryParams.append('$filter', `ContactId eq ${cliente_id}`);
  if (pagina) queryParams.append('$skip', ((pagina - 1) * (tamanho_pagina || 10)).toString());
  if (tamanho_pagina) queryParams.append('$top', tamanho_pagina.toString());
  
  const url = `https://public-api2.ploomes.com/Deals?${queryParams.toString()}`;
  
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function obterNegocio(id: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Deals(${id})`;
  
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "Negócio não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function criarNegocio(titulo: string, cliente_id: number, valor?: number, estagio_id?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Deals`;
  
  const payload: any = {
    Title: titulo,
    ContactId: cliente_id
  };
  
  if (valor) payload.Amount = valor;
  if (estagio_id) payload.StageId = estagio_id;
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function atualizarNegocio(id: number, titulo?: string, valor?: number, estagio_id?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Deals(${id})`;
  
  const payload: any = {};
  
  if (titulo) payload.Title = titulo;
  if (valor) payload.Amount = valor;
  if (estagio_id) payload.StageId = estagio_id;
  
  const response = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "Negócio não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return { mensagem: "Negócio atualizado com sucesso" };
}

async function listarContatos(cliente_id: number, pagina?: number, tamanho_pagina?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams();
  
  queryParams.append('$filter', `ContactId eq ${cliente_id}`);
  if (pagina) queryParams.append('$skip', ((pagina - 1) * (tamanho_pagina || 10)).toString());
  if (tamanho_pagina) queryParams.append('$top', tamanho_pagina.toString());
  
  const url = `https://public-api2.ploomes.com/ContactInfos?${queryParams.toString()}`;
  
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function obterContato(id: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/ContactInfos(${id})`;
  
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "Contato não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function criarContato(cliente_id: number, nome: string, email?: string, telefone?: string, cargo?: string) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/ContactInfos`;
  
  const payload: any = {
    ContactId: cliente_id,
    Name: nome
  };
  
  if (email) payload.Email = email;
  if (telefone) payload.Phone = telefone;
  if (cargo) payload.Role = cargo;
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function listarAtividades(cliente_id?: number, negocio_id?: number, pagina?: number, tamanho_pagina?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams();
  
  let filters = [];
  if (cliente_id) filters.push(`ContactId eq ${cliente_id}`);
  if (negocio_id) filters.push(`DealId eq ${negocio_id}`);
  
  if (filters.length > 0) {
    queryParams.append('$filter', filters.join(' and '));
  }
  
  if (pagina) queryParams.append('$skip', ((pagina - 1) * (tamanho_pagina || 10)).toString());
  if (tamanho_pagina) queryParams.append('$top', tamanho_pagina.toString());
  
  const url = `https://public-api2.ploomes.com/Activities?${queryParams.toString()}`;
  
  const response = await fetchWithTimeout(url, {
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function criarAtividade(titulo: string, data_inicio: string, tipo_id: number, descricao?: string, data_fim?: string, cliente_id?: number, negocio_id?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Activities`;
  
  const payload: any = {
    Title: titulo,
    StartDate: data_inicio,
    ActivityTypeId: tipo_id
  };
  
  if (descricao) payload.Description = descricao;
  if (data_fim) payload.EndDate = data_fim;
  if (cliente_id) payload.ContactId = cliente_id;
  if (negocio_id) payload.DealId = negocio_id;
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'user-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Registrar as ferramentas com o servidor
mcpServer.tool(
  "ploomes_listar_clientes",
  "Lista todos os clientes cadastrados no Ploomes CRM, permitindo filtrar e paginar os resultados.",
  listarClientesSchema.shape,
  async ({ filtro, pagina, tamanho_pagina }: ListarClientesParams) => {
    try {
      const result = await listarClientes(filtro, pagina, tamanho_pagina);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_obter_cliente",
  "Obtém detalhes de um cliente específico do Ploomes CRM a partir do seu ID.",
  obterClienteSchema.shape,
  async ({ id }: ObterClienteParams) => {
    try {
      const result = await obterCliente(id);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_criar_cliente",
  "Cria um novo cliente no Ploomes CRM com as informações fornecidas.",
  criarClienteSchema.shape,
  async ({ nome, email, telefone, observacoes }: CriarClienteParams) => {
    try {
      const result = await criarCliente(nome, email, telefone, observacoes);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_atualizar_cliente",
  "Atualiza informações de um cliente existente no Ploomes CRM.",
  atualizarClienteSchema.shape,
  async ({ id, nome, email, telefone, observacoes }: AtualizarClienteParams) => {
    try {
      const result = await atualizarCliente(id, nome, email, telefone, observacoes);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_listar_negocios",
  "Lista todos os negócios/oportunidades no Ploomes CRM, permitindo filtrar e paginar os resultados.",
  listarNegociosSchema.shape,
  async ({ filtro, cliente_id, pagina, tamanho_pagina }: ListarNegociosParams) => {
    try {
      const result = await listarNegocios(filtro, cliente_id, pagina, tamanho_pagina);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_obter_negocio",
  "Obtém detalhes de um negócio específico do Ploomes CRM a partir do seu ID.",
  obterNegocioSchema.shape,
  async ({ id }: ObterNegocioParams) => {
    try {
      const result = await obterNegocio(id);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_criar_negocio",
  "Cria um novo negócio/oportunidade no Ploomes CRM com as informações fornecidas.",
  criarNegocioSchema.shape,
  async ({ titulo, cliente_id, valor, estagio_id }: CriarNegocioParams) => {
    try {
      const result = await criarNegocio(titulo, cliente_id, valor, estagio_id);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_atualizar_negocio",
  "Atualiza informações de um negócio existente no Ploomes CRM.",
  atualizarNegocioSchema.shape,
  async ({ id, titulo, valor, estagio_id }: AtualizarNegocioParams) => {
    try {
      const result = await atualizarNegocio(id, titulo, valor, estagio_id);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_listar_contatos",
  "Lista todos os contatos de um cliente no Ploomes CRM, permitindo paginar os resultados.",
  listarContatosSchema.shape,
  async ({ cliente_id, pagina, tamanho_pagina }: ListarContatosParams) => {
    try {
      const result = await listarContatos(cliente_id, pagina, tamanho_pagina);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_obter_contato",
  "Obtém detalhes de um contato específico do Ploomes CRM a partir do seu ID.",
  obterContatoSchema.shape,
  async ({ id }: ObterContatoParams) => {
    try {
      const result = await obterContato(id);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_criar_contato",
  "Cria um novo contato para um cliente no Ploomes CRM com as informações fornecidas.",
  criarContatoSchema.shape,
  async ({ cliente_id, nome, email, telefone, cargo }: CriarContatoParams) => {
    try {
      const result = await criarContato(cliente_id, nome, email, telefone, cargo);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_listar_atividades",
  "Lista todas as atividades no Ploomes CRM, permitindo filtrar por cliente ou negócio e paginar os resultados.",
  listarAtividadesSchema.shape,
  async ({ cliente_id, negocio_id, pagina, tamanho_pagina }: ListarAtividadesParams) => {
    try {
      const result = await listarAtividades(cliente_id, negocio_id, pagina, tamanho_pagina);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

mcpServer.tool(
  "ploomes_criar_atividade",
  "Cria uma nova atividade no Ploomes CRM com as informações fornecidas.",
  criarAtividadeSchema.shape,
  async ({ titulo, descricao, data_inicio, data_fim, cliente_id, negocio_id, tipo_id }: CriarAtividadeParams) => {
    try {
      const result = await criarAtividade(titulo, data_inicio, tipo_id, descricao, data_fim, cliente_id, negocio_id);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

// Função principal
async function main() {
  try {
    // Tentar obter chave da API para validar configuração
    getApiKey();
    
    // Configurar tratamento de sinais para lidar com encerramento adequado
    process.on('SIGINT', () => {
      console.error('Servidor Ploomes CRM recebeu SIGINT, encerrando...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Servidor Ploomes CRM recebeu SIGTERM, encerrando...');
      process.exit(0);
    });
    
    // Garantir que os erros não encerrem o processo
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Run the server
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("Ploomes CRM MCP Server executando através de stdio");
    
    // Manter o processo vivo
    setInterval(() => {
      // Heartbeat para manter o processo ativo
    }, 10000);
  } catch (error) {
    console.error("Erro ao iniciar o servidor MCP:", error);
    process.exit(1);
  }
}

// Iniciar o servidor
main().catch((error) => {
    console.error("Error starting server:", error);
    // Don't exit process to allow recovery
    process.exit(1);
});