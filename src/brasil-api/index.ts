#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Definição das ferramentas
const CEP_TOOL: Tool = {
  name: "brasil_cep",
  description:
    "Consulta informações de endereço a partir de um CEP (Código de Endereçamento Postal) brasileiro. " +
    "Retorna dados como logradouro, bairro, cidade, estado e outras informações relacionadas ao CEP.",
  inputSchema: {
    type: "object",
    properties: {
      cep: {
        type: "string",
        description: "CEP a ser consultado, apenas números ou no formato 00000-000",
      },
    },
    required: ["cep"],
  },
};

const CNPJ_TOOL: Tool = {
  name: "brasil_cnpj",
  description:
    "Busca dados cadastrais de empresas brasileiras a partir de um número de CNPJ. " +
    "Retorna informações como razão social, nome fantasia, situação cadastral, data de abertura, endereço, etc.",
  inputSchema: {
    type: "object",
    properties: {
      cnpj: {
        type: "string",
        description: "CNPJ a ser consultado, apenas números ou no formato 00.000.000/0000-00",
      },
    },
    required: ["cnpj"],
  },
};

const DDD_TOOL: Tool = {
  name: "brasil_ddd",
  description:
    "Retorna todas as cidades brasileiras que possuem o DDD informado.",
  inputSchema: {
    type: "object",
    properties: {
      ddd: {
        type: "string",
        description: "DDD a ser consultado, apenas números (ex: 11, 21, 31)",
      },
    },
    required: ["ddd"],
  },
};

const FERIADOS_TOOL: Tool = {
  name: "brasil_feriados",
  description:
    "Lista todos os feriados nacionais do Brasil para o ano especificado.",
  inputSchema: {
    type: "object",
    properties: {
      ano: {
        type: "string",
        description: "Ano a ser consultado no formato YYYY (ex: 2023, 2024)",
      },
    },
    required: ["ano"],
  },
};

const BANCO_TOOL: Tool = {
  name: "brasil_banco",
  description:
    "Retorna informações de um banco brasileiro a partir do código, nome ou parte do nome do banco.",
  inputSchema: {
    type: "object",
    properties: {
      codigo: {
        type: "string",
        description: "Código do banco, por exemplo: 001, 237, 341",
      },
    },
    required: ["codigo"],
  },
};

const BANCOS_TOOL: Tool = {
  name: "brasil_bancos",
  description:
    "Lista todos os bancos brasileiros e suas informações.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const PIX_PARTICIPANTES_TOOL: Tool = {
  name: "brasil_pix_participantes",
  description:
    "Lista as instituições participantes do arranjo de pagamentos PIX no Brasil.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const COTACAO_TOOL: Tool = {
  name: "brasil_cotacao",
  description:
    "Obtém a cotação do dia para moedas como dólar, euro e outras em relação ao real brasileiro.",
  inputSchema: {
    type: "object",
    properties: {
      moeda: {
        type: "string",
        description: "Código da moeda (USD, EUR, etc)",
      },
    },
    required: ["moeda"],
  },
};

const IBGE_MUNICIPIO_TOOL: Tool = {
  name: "brasil_ibge_municipio",
  description:
    "Busca municípios brasileiros utilizando o código do IBGE ou filtros de busca.",
  inputSchema: {
    type: "object",
    properties: {
      codigoIbge: {
        type: "string",
        description: "Código IBGE do município",
      },
      provedores: {
        type: "string",
        description: "Provedores de dados (IBGE)",
        default: "IBGE",
      },
    },
    required: ["codigoIbge"],
  },
};

// Servidor MCP
const server = new Server(
  {
    name: "brasil-api",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: { listChanged: true }
    },
  },
);

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

// Funções de tipo para validação
function isCepArgs(args: unknown): args is { cep: string } {
  return (
    typeof args === "object" &&
    args !== null &&
    "cep" in args &&
    typeof (args as { cep: string }).cep === "string"
  );
}

function isCnpjArgs(args: unknown): args is { cnpj: string } {
  return (
    typeof args === "object" &&
    args !== null &&
    "cnpj" in args &&
    typeof (args as { cnpj: string }).cnpj === "string"
  );
}

function isDddArgs(args: unknown): args is { ddd: string } {
  return (
    typeof args === "object" &&
    args !== null &&
    "ddd" in args &&
    typeof (args as { ddd: string }).ddd === "string"
  );
}

function isFeriadosArgs(args: unknown): args is { ano: string } {
  return (
    typeof args === "object" &&
    args !== null &&
    "ano" in args &&
    typeof (args as { ano: string }).ano === "string"
  );
}

function isBancoArgs(args: unknown): args is { codigo: string } {
  return (
    typeof args === "object" &&
    args !== null &&
    "codigo" in args &&
    typeof (args as { codigo: string }).codigo === "string"
  );
}

function isCotacaoArgs(args: unknown): args is { moeda: string } {
  return (
    typeof args === "object" &&
    args !== null &&
    "moeda" in args &&
    typeof (args as { moeda: string }).moeda === "string"
  );
}

function isIbgeMunicipioArgs(args: unknown): args is { codigoIbge: string; provedores?: string } {
  return (
    typeof args === "object" &&
    args !== null &&
    "codigoIbge" in args &&
    typeof (args as { codigoIbge: string }).codigoIbge === "string"
  );
}

// Implementações de requisições à API
async function consultarCEP(cep: string) {
  checkRateLimit();
  // Remover caracteres não numéricos
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

// Registrar as ferramentas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      CEP_TOOL,
      CNPJ_TOOL,
      DDD_TOOL,
      FERIADOS_TOOL,
      BANCO_TOOL,
      BANCOS_TOOL,
      PIX_PARTICIPANTES_TOOL,
      COTACAO_TOOL,
      IBGE_MUNICIPIO_TOOL,
    ],
  };
});

// Manipulador de chamadas de ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("Nenhum argumento fornecido");
    }

    let result: string = "";

    switch (name) {
      case "brasil_cep": {
        if (!isCepArgs(args)) {
          throw new Error("Formato de argumento inválido para brasil_cep");
        }
        const data = await consultarCEP(args.cep);
        result = JSON.stringify(data, null, 2);
        break;
      }

      case "brasil_cnpj": {
        if (!isCnpjArgs(args)) {
          throw new Error("Formato de argumento inválido para brasil_cnpj");
        }
        const data = await consultarCNPJ(args.cnpj);
        result = JSON.stringify(data, null, 2);
        break;
      }

      case "brasil_ddd": {
        if (!isDddArgs(args)) {
          throw new Error("Formato de argumento inválido para brasil_ddd");
        }
        const data = await consultarDDD(args.ddd);
        result = JSON.stringify(data, null, 2);
        break;
      }

      case "brasil_feriados": {
        if (!isFeriadosArgs(args)) {
          throw new Error("Formato de argumento inválido para brasil_feriados");
        }
        const data = await consultarFeriados(args.ano);
        result = JSON.stringify(data, null, 2);
        break;
      }

      case "brasil_banco": {
        if (!isBancoArgs(args)) {
          throw new Error("Formato de argumento inválido para brasil_banco");
        }
        const data = await consultarBanco(args.codigo);
        result = JSON.stringify(data, null, 2);
        break;
      }

      case "brasil_bancos": {
        const data = await listarBancos();
        result = JSON.stringify(data, null, 2);
        break;
      }

      case "brasil_pix_participantes": {
        const data = await listarPixParticipantes();
        result = JSON.stringify(data, null, 2);
        break;
      }

      case "brasil_cotacao": {
        if (!isCotacaoArgs(args)) {
          throw new Error("Formato de argumento inválido para brasil_cotacao");
        }
        const data = await consultarCotacao(args.moeda);
        result = JSON.stringify(data, null, 2);
        break;
      }

      case "brasil_ibge_municipio": {
        if (!isIbgeMunicipioArgs(args)) {
          throw new Error("Formato de argumento inválido para brasil_ibge_municipio");
        }
        const data = await consultarMunicipio(args.codigoIbge, args.provedores);
        result = JSON.stringify(data, null, 2);
        break;
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }

    return {
      result: result
    };
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return {
      error: {
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
});

// Iniciar o servidor
async function runServer() {
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
    
    const transport = new StdioServerTransport();
    
    // Usar connect() de acordo com o exemplo fornecido
    await server.connect(transport);
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

runServer().catch((error) => {
  console.error("Error starting server:", error);
  // Don't exit process to allow recovery
  process.exit(1);
});