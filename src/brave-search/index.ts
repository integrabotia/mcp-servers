#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Esquemas Zod para validação de parâmetros
const webSearchSchema = z.object({
  query: z.string()
    .describe("Search query (max 400 chars, 50 words)"),
  count: z.number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe("Number of results (1-20, default 10)"),
  offset: z.number()
    .int()
    .min(0)
    .max(9)
    .default(0)
    .describe("Pagination offset (max 9, default 0)")
});

const localSearchSchema = z.object({
  query: z.string()
    .describe("Local search query (e.g. 'pizza near Central Park')"),
  count: z.number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Number of results (1-20, default 5)")
});

// Create server instance
const mcpServer = new McpServer({
  name: "brave-search",
  version: "0.0.7",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY!;
if (!BRAVE_API_KEY) {
  console.error("Error: BRAVE_API_KEY environment variable is required");
  process.exit(1);
}

const RATE_LIMIT = {
  perSecond: 1,
  perMonth: 15000
};

let requestCount = {
  second: 0,
  month: 0,
  lastReset: Date.now()
};

function checkRateLimit() {
  const now = Date.now();
  if (now - requestCount.lastReset > 1000) {
    requestCount.second = 0;
    requestCount.lastReset = now;
  }
  if (requestCount.second >= RATE_LIMIT.perSecond ||
    requestCount.month >= RATE_LIMIT.perMonth) {
    throw new Error('Rate limit exceeded');
  }
  requestCount.second++;
  requestCount.month++;
}

// Definir timeout para as requisições à API
async function fetchWithTimeout(url: URL | string, options: RequestInit = {}, timeout = 15000) {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  
  try {
    const response = await fetch(url.toString(), { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

interface BraveWeb {
  web?: {
    results?: Array<{
      title: string;
      description: string;
      url: string;
      language?: string;
      published?: string;
      rank?: number;
    }>;
  };
  locations?: {
    results?: Array<{
      id: string; // Required by API
      title?: string;
    }>;
  };
}

interface BraveLocation {
  id: string;
  name: string;
  address: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  rating?: {
    ratingValue?: number;
    ratingCount?: number;
  };
  openingHours?: string[];
  priceRange?: string;
}

interface BravePoiResponse {
  results: BraveLocation[];
}

interface BraveDescription {
  descriptions: {[id: string]: string};
}

async function performWebSearch(query: string, count: number = 10, offset: number = 0): Promise<string> {
  checkRateLimit();
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', Math.min(count, 20).toString()); // API limit
  url.searchParams.set('offset', offset.toString());

  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const data = await response.json() as BraveWeb;

  // Extract just web results
  const results = (data.web?.results || []).map(result => ({
    title: result.title || '',
    description: result.description || '',
    url: result.url || ''
  }));

  return results.map(r =>
    `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}`
  ).join('\n\n');
}

async function performLocalSearch(query: string, count: number = 5): Promise<string> {
  checkRateLimit();
  // Initial search to get location IDs
  const webUrl = new URL('https://api.search.brave.com/res/v1/web/search');
  webUrl.searchParams.set('q', query);
  webUrl.searchParams.set('search_lang', 'en');
  webUrl.searchParams.set('result_filter', 'locations');
  webUrl.searchParams.set('count', Math.min(count, 20).toString());

  const webResponse = await fetchWithTimeout(webUrl, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!webResponse.ok) {
    throw new Error(`Brave API error: ${webResponse.status} ${webResponse.statusText}\n${await webResponse.text()}`);
  }

  const webData = await webResponse.json() as BraveWeb;
  const locationIds = webData.locations?.results?.filter((r): r is {id: string; title?: string} => r.id != null).map(r => r.id) || [];

  if (locationIds.length === 0) {
    return performWebSearch(query, count); // Fallback to web search
  }

  // Get POI details and descriptions in parallel
  const [poisData, descriptionsData] = await Promise.all([
    getPoisData(locationIds),
    getDescriptionsData(locationIds)
  ]);

  return formatLocalResults(poisData, descriptionsData);
}

async function getPoisData(ids: string[]): Promise<BravePoiResponse> {
  checkRateLimit();
  const url = new URL('https://api.search.brave.com/res/v1/local/pois');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const poisResponse = await response.json() as BravePoiResponse;
  return poisResponse;
}

async function getDescriptionsData(ids: string[]): Promise<BraveDescription> {
  checkRateLimit();
  const url = new URL('https://api.search.brave.com/res/v1/local/descriptions');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const descriptionsData = await response.json() as BraveDescription;
  return descriptionsData;
}

function formatLocalResults(poisData: BravePoiResponse, descData: BraveDescription): string {
  const formattedResults = (poisData.results || []).map(poi => {
    const address = [
      poi.address?.streetAddress ?? '',
      poi.address?.addressLocality ?? '',
      poi.address?.addressRegion ?? '',
      poi.address?.postalCode ?? ''
    ].filter(part => part !== '').join(', ') || 'N/A';

    return `Name: ${poi.name}
Address: ${address}
Phone: ${poi.phone || 'N/A'}
Rating: ${poi.rating?.ratingValue ?? 'N/A'} (${poi.rating?.ratingCount ?? 0} reviews)
Price Range: ${poi.priceRange || 'N/A'}
Hours: ${(poi.openingHours || []).join(', ') || 'N/A'}
Description: ${descData.descriptions[poi.id] || 'No description available'}
`;
  }).join('\n---\n');
  
  return formattedResults || 'No local results found';
}

// Registrar as ferramentas com o servidor
mcpServer.tool(
  "brave_web_search",
  "Performs a web search using the Brave Search API, ideal for general queries, news, articles, and online content. " +
  "Use this for broad information gathering, recent events, or when you need diverse web sources. " +
  "Supports pagination, content filtering, and freshness controls. " +
  "Maximum 20 results per request, with offset for pagination. ",
  webSearchSchema.shape,
  async ({ query, count, offset }) => {
    try {
      const result = await performWebSearch(query, count, offset);
      return {
        content: [{ type: "text", text: result }]
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
  "brave_local_search",
  "Searches for local businesses and places using Brave's Local Search API. " +
  "Best for queries related to physical locations, businesses, restaurants, services, etc. " +
  "Returns detailed information including:\n" +
  "- Business names and addresses\n" +
  "- Ratings and review counts\n" +
  "- Phone numbers and opening hours\n" +
  "Use this when the query implies 'near me' or mentions specific locations. " +
  "Automatically falls back to web search if no local results are found.",
  localSearchSchema.shape,
  async ({ query, count }) => {
    try {
      const result = await performLocalSearch(query, count);
      return {
        content: [{ type: "text", text: result }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true
      };
    }
  }
);

async function main() {
  try {
    // Configure signal handling for graceful shutdown
    process.on('SIGINT', () => {
      console.error('Brave Search MCP Server received SIGINT, shutting down...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Brave Search MCP Server received SIGTERM, shutting down...');
      process.exit(0);
    });
    
    // Ensure errors don't crash the process
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Run the server
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("Brave Search MCP Server running on stdio");
    
    // Keep the process alive
    setInterval(() => {
      // Heartbeat to keep the process active
    }, 10000);
  } catch (error) {
    console.error("Error starting server:", error);
    // Don't terminate the process here to allow reconnections
  }
}

main().catch((error) => {
  console.error("Error starting server:", error);
  // Don't exit process to allow recovery
  process.exit(1);
});