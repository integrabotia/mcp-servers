#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Esquemas Zod para validação de parâmetros
const cepSchema = z.object({
  cep: z.string().or(z.number()).transform(val => String(val))
    .describe("CEP a ser consultado, apenas números ou no formato 00000-000")
});

const cnpjSchema = z.object({
  cnpj: z.string().or(z.number()).transform(val => String(val))
    .describe("CNPJ a ser consultado, apenas números ou no formato 00.000.000/0000-00")
});

const dddSchema = z.object({
  ddd: z.string().or(z.number()).transform(val => String(val))
    .describe("DDD a ser consultado, apenas números (ex: 11, 21, 31)")
});

const feriadosSchema = z.object({
  ano: z.string().or(z.number()).transform(val => String(val))
    .describe("Ano a ser consultado no formato YYYY (ex: 2023, 2024)")
});

const bancoSchema = z.object({
  codigo: z.string().or(z.number()).transform(val => String(val))
    .describe("Código do banco, por exemplo: 001, 237, 341")
});

const bancosSchema = z.object({});

const pixParticipantesSchema = z.object({});

const cotacaoSchema = z.object({
  moeda: z.string()
    .describe("Código da moeda (USD, EUR, etc)")
});

const ibgeMunicipioSchema = z.object({
  codigoIbge: z.string().or(z.number()).transform(val => String(val))
    .describe("Código IBGE do município"),
  provedores: z.string().default("IBGE")
    .describe("Provedores de dados (IBGE)")
});

// Create server instance
const mcpServer = new McpServer({
  name: "brasil-api",
  version: "0.0.8",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Controle de taxa de requisições
const RATE_LIMIT = {
  perSecond: 2,
  perMinute: 60,
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
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 15000) {
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

// Implementações de requisições à API
async function consultarCEP(cep: string) {
  checkRateLimit();
  // Remover caracteres não numéricos e garantir que é string
  const cepLimpo = cep.replace(/\D/g, '');
  
  const url = `https://brasilapi.com.br/api/cep/v2/${cepLimpo}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "CEP não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function consultarCNPJ(cnpj: string) {
  checkRateLimit();
  // Remover caracteres não numéricos
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  
  const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "CNPJ não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function consultarDDD(ddd: string) {
  checkRateLimit();
  const url = `https://brasilapi.com.br/api/ddd/v1/${ddd}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "DDD não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function consultarFeriados(ano: string) {
  checkRateLimit();
  const url = `https://brasilapi.com.br/api/feriados/v1/${ano}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function consultarBanco(codigo: string) {
  checkRateLimit();
  const url = `https://brasilapi.com.br/api/banks/v1/${codigo}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "Banco não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function listarBancos() {
  checkRateLimit();
  const url = `https://brasilapi.com.br/api/banks/v1`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function listarPixParticipantes() {
  checkRateLimit();
  const url = `https://brasilapi.com.br/api/pix/v1/participants`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function consultarCotacao(moeda: string) {
  checkRateLimit();
  const url = `https://brasilapi.com.br/api/taxas/v1/${moeda}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "Moeda não encontrada" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function consultarMunicipio(codigoIbge: string, provedores: string = "IBGE") {
  checkRateLimit();
  const url = `https://brasilapi.com.br/api/ibge/municipios/v1/${codigoIbge}?providers=${provedores}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    if (response.status === 404) {
      return { erro: "Município não encontrado" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Registrar as ferramentas com o servidor
mcpServer.tool(
  "brasil_cep",
  "Consulta informações de endereço a partir de um CEP (Código de Endereçamento Postal) brasileiro. Retorna dados como logradouro, bairro, cidade, estado e outras informações relacionadas ao CEP.",
  cepSchema.shape,
  async ({ cep }) => {
    try {
      const result = await consultarCEP(cep);
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
  "brasil_cnpj",
  "Busca dados cadastrais de empresas brasileiras a partir de um número de CNPJ. Retorna informações como razão social, nome fantasia, situação cadastral, data de abertura, endereço, etc.",
  cnpjSchema.shape,
  async ({ cnpj }) => {
    try {
      const result = await consultarCNPJ(cnpj);
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
  "brasil_ddd",
  "Retorna todas as cidades brasileiras que possuem o DDD informado.",
  dddSchema.shape,
  async ({ ddd }) => {
    try {
      const result = await consultarDDD(ddd);
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
  "brasil_feriados",
  "Lista todos os feriados nacionais do Brasil para o ano especificado.",
  feriadosSchema.shape,
  async ({ ano }) => {
    try {
      const result = await consultarFeriados(ano);
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
  "brasil_banco",
  "Retorna informações de um banco brasileiro a partir do código, nome ou parte do nome do banco.",
  bancoSchema.shape,
  async ({ codigo }) => {
    try {
      const result = await consultarBanco(codigo);
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
  "brasil_bancos",
  "Lista todos os bancos brasileiros e suas informações.",
  bancosSchema.shape,
  async () => {
    try {
      const result = await listarBancos();
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
  "brasil_pix_participantes",
  "Lista as instituições participantes do arranjo de pagamentos PIX no Brasil.",
  pixParticipantesSchema.shape,
  async () => {
    try {
      const result = await listarPixParticipantes();
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
  "brasil_cotacao",
  "Obtém a cotação do dia para moedas como dólar, euro e outras em relação ao real brasileiro.",
  cotacaoSchema.shape,
  async ({ moeda }) => {
    try {
      const result = await consultarCotacao(moeda);
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
  "brasil_ibge_municipio",
  "Busca municípios brasileiros utilizando o código do IBGE ou filtros de busca.",
  ibgeMunicipioSchema.shape,
  async ({ codigoIbge, provedores }) => {
    try {
      const result = await consultarMunicipio(codigoIbge, provedores);
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

// Exportar diretamente para uso como biblioteca
export const BrasilAPI = {
  consultarCEP,
  consultarCNPJ,
  consultarDDD,
  consultarFeriados,
  consultarBanco,
  listarBancos,
  listarPixParticipantes,
  consultarCotacao,
  consultarMunicipio,
};

// Iniciar o servidor
async function main() {
  try {
    // Configurar tratamento de sinais para lidar com encerramento adequado
    process.on('SIGINT', () => {
      console.error('Servidor Brasil API recebeu SIGINT, encerrando...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Servidor Brasil API recebeu SIGTERM, encerrando...');
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
    console.error("Brasil API MCP Server executando através de stdio");
    
    // Manter o processo vivo
    setInterval(() => {
      // Heartbeat para manter o processo ativo
    }, 10000);
  } catch (error) {
    console.error("Erro ao iniciar o servidor:", error);
    // Não encerra o processo aqui para permitir reconexões
  }
}

main().catch((error) => {
  console.error("Error starting server:", error);
  // Don't exit process to allow recovery
  process.exit(1);
});