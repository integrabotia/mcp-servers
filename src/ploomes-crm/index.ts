#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Schemas for parameter validation
const listCustomersSchema = z.object({
  filter: z.string().optional()
    .describe("Filter for specific search"),
  page: z.number().optional()
    .describe("Page number for pagination"),
  page_size: z.number().optional()
    .describe("Page size for pagination")
});

const getCustomerSchema = z.object({
  id: z.number()
    .describe("Customer ID")
});

const createCustomerSchema = z.object({
  name: z.string()
    .describe("Customer name"),
  email: z.string().optional()
    .describe("Customer email"),
  phone: z.string().optional()
    .describe("Customer phone"),
  notes: z.string().optional()
    .describe("Notes about the customer")
});

const updateCustomerSchema = z.object({
  id: z.number()
    .describe("Customer ID"),
  name: z.string().optional()
    .describe("New customer name"),
  email: z.string().optional()
    .describe("New customer email"),
  phone: z.string().optional()
    .describe("New customer phone"),
  notes: z.string().optional()
    .describe("New notes about the customer")
});

const listDealsSchema = z.object({
  filter: z.string().optional()
    .describe("Filter for specific search"),
  customer_id: z.number().optional()
    .describe("Filter by specific customer"),
  page: z.number().optional()
    .describe("Page number for pagination"),
  page_size: z.number().optional()
    .describe("Page size for pagination")
});

const getDealSchema = z.object({
  id: z.number()
    .describe("Deal ID")
});

const createDealSchema = z.object({
  title: z.string()
    .describe("Deal title"),
  customer_id: z.number()
    .describe("Associated customer ID"),
  amount: z.number().optional()
    .describe("Deal value"),
  stage_id: z.number().optional()
    .describe("Stage ID in the sales funnel")
});

const updateDealSchema = z.object({
  id: z.number()
    .describe("Deal ID"),
  title: z.string().optional()
    .describe("New title"),
  amount: z.number().optional()
    .describe("New value"),
  stage_id: z.number().optional()
    .describe("New stage in the sales funnel")
});

const listContactsSchema = z.object({
  customer_id: z.number()
    .describe("Customer ID"),
  page: z.number().optional()
    .describe("Page number for pagination"),
  page_size: z.number().optional()
    .describe("Page size for pagination")
});

const getContactSchema = z.object({
  id: z.number()
    .describe("Contact ID")
});

const createContactSchema = z.object({
  customer_id: z.number()
    .describe("Customer ID"),
  name: z.string()
    .describe("Contact name"),
  email: z.string().optional()
    .describe("Contact email"),
  phone: z.string().optional()
    .describe("Contact phone"),
  role: z.string().optional()
    .describe("Contact role")
});

const listActivitiesSchema = z.object({
  customer_id: z.number().optional()
    .describe("Filter by specific customer"),
  deal_id: z.number().optional()
    .describe("Filter by specific deal"),
  page: z.number().optional()
    .describe("Page number for pagination"),
  page_size: z.number().optional()
    .describe("Page size for pagination")
});

const createActivitySchema = z.object({
  title: z.string()
    .describe("Activity title"),
  description: z.string().optional()
    .describe("Activity description"),
  start_date: z.string()
    .describe("Start date (ISO format)"),
  end_date: z.string().optional()
    .describe("End date (ISO format)"),
  customer_id: z.number().optional()
    .describe("Associated customer ID"),
  deal_id: z.number().optional()
    .describe("Associated deal ID"),
  type_id: z.number()
    .describe("Activity type ID")
});

// Define types for the parameters
type ListCustomersParams = z.infer<typeof listCustomersSchema>;
type GetCustomerParams = z.infer<typeof getCustomerSchema>;
type CreateCustomerParams = z.infer<typeof createCustomerSchema>;
type UpdateCustomerParams = z.infer<typeof updateCustomerSchema>;
type ListDealsParams = z.infer<typeof listDealsSchema>;
type GetDealParams = z.infer<typeof getDealSchema>;
type CreateDealParams = z.infer<typeof createDealSchema>;
type UpdateDealParams = z.infer<typeof updateDealSchema>;
type ListContactsParams = z.infer<typeof listContactsSchema>;
type GetContactParams = z.infer<typeof getContactSchema>;
type CreateContactParams = z.infer<typeof createContactSchema>;
type ListActivitiesParams = z.infer<typeof listActivitiesSchema>;
type CreateActivityParams = z.infer<typeof createActivitySchema>;

// Create server instance
const mcpServer = new McpServer({
  name: "ploomes-crm",
  version: "0.0.2",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Rate limit control
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
    throw new Error('Rate limit exceeded. Please try again in a moment.');
  }
  
  requestCount.second++;
  requestCount.minute++;
}

// Define timeout for API requests
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

// Get the Ploomes API key
function getApiKey() {
  // First, check environment variable
  const envApiKey = process.env.PLOOMES_API_KEY;
  if (envApiKey) return envApiKey;
  
  // Then, check command line arguments
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--api-key=')) {
      return arg.split('=')[1];
    }
  }
  
  throw new Error('Ploomes API key not found. Set the PLOOMES_API_KEY environment variable or pass the --api-key=your_api_key argument');
}

// API request implementations
async function listCustomers(filter?: string, page?: number, page_size?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams();
  
  if (filter) queryParams.append('$filter', filter);
  if (page) queryParams.append('$skip', ((page - 1) * (page_size || 10)).toString());
  if (page_size) queryParams.append('$top', page_size.toString());
  
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

async function getCustomer(id: number) {
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
      return { error: "Customer not found" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function createCustomer(name: string, email?: string, phone?: string, notes?: string) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Contacts`;
  
  const payload: any = {
    Name: name
  };
  
  if (email) payload.Email = email;
  if (phone) payload.Phone = phone;
  if (notes) payload.Notes = notes;
  
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

async function updateCustomer(id: number, name?: string, email?: string, phone?: string, notes?: string) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Contacts(${id})`;
  
  const payload: any = {};
  
  if (name) payload.Name = name;
  if (email) payload.Email = email;
  if (phone) payload.Phone = phone;
  if (notes) payload.Notes = notes;
  
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
      return { error: "Customer not found" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return { message: "Customer updated successfully" };
}

async function listDeals(filter?: string, customer_id?: number, page?: number, page_size?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams();
  
  if (filter) queryParams.append('$filter', filter);
  if (customer_id) queryParams.append('$filter', `ContactId eq ${customer_id}`);
  if (page) queryParams.append('$skip', ((page - 1) * (page_size || 10)).toString());
  if (page_size) queryParams.append('$top', page_size.toString());
  
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

async function getDeal(id: number) {
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
      return { error: "Deal not found" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function createDeal(title: string, customer_id: number, amount?: number, stage_id?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Deals`;
  
  const payload: any = {
    Title: title,
    ContactId: customer_id
  };
  
  if (amount) payload.Amount = amount;
  if (stage_id) payload.StageId = stage_id;
  
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

async function updateDeal(id: number, title?: string, amount?: number, stage_id?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Deals(${id})`;
  
  const payload: any = {};
  
  if (title) payload.Title = title;
  if (amount) payload.Amount = amount;
  if (stage_id) payload.StageId = stage_id;
  
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
      return { error: "Deal not found" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return { message: "Deal updated successfully" };
}

async function listContacts(customer_id: number, page?: number, page_size?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams();
  
  queryParams.append('$filter', `ContactId eq ${customer_id}`);
  if (page) queryParams.append('$skip', ((page - 1) * (page_size || 10)).toString());
  if (page_size) queryParams.append('$top', page_size.toString());
  
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

async function getContact(id: number) {
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
      return { error: "Contact not found" };
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function createContact(customer_id: number, name: string, email?: string, phone?: string, role?: string) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/ContactInfos`;
  
  const payload: any = {
    ContactId: customer_id,
    Name: name
  };
  
  if (email) payload.Email = email;
  if (phone) payload.Phone = phone;
  if (role) payload.Role = role;
  
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

async function listActivities(customer_id?: number, deal_id?: number, page?: number, page_size?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams();
  
  let filters = [];
  if (customer_id) filters.push(`ContactId eq ${customer_id}`);
  if (deal_id) filters.push(`DealId eq ${deal_id}`);
  
  if (filters.length > 0) {
    queryParams.append('$filter', filters.join(' and '));
  }
  
  if (page) queryParams.append('$skip', ((page - 1) * (page_size || 10)).toString());
  if (page_size) queryParams.append('$top', page_size.toString());
  
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

async function createActivity(title: string, start_date: string, type_id: number, description?: string, end_date?: string, customer_id?: number, deal_id?: number) {
  checkRateLimit();
  
  const apiKey = getApiKey();
  const url = `https://public-api2.ploomes.com/Activities`;
  
  const payload: any = {
    Title: title,
    StartDate: start_date,
    ActivityTypeId: type_id
  };
  
  if (description) payload.Description = description;
  if (end_date) payload.EndDate = end_date;
  if (customer_id) payload.ContactId = customer_id;
  if (deal_id) payload.DealId = deal_id;
  
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

// Register tools with the server
mcpServer.tool(
  "ploomes_list_customers",
  "Lists all customers registered in Ploomes CRM, allowing filtering and pagination of results.",
  listCustomersSchema.shape,
  async ({ filter, page, page_size }: ListCustomersParams) => {
    try {
      const result = await listCustomers(filter, page, page_size);
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
  "ploomes_get_customer",
  "Gets details of a specific customer from Ploomes CRM using their ID.",
  getCustomerSchema.shape,
  async ({ id }: GetCustomerParams) => {
    try {
      const result = await getCustomer(id);
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
  "ploomes_create_customer",
  "Creates a new customer in Ploomes CRM with the provided information.",
  createCustomerSchema.shape,
  async ({ name, email, phone, notes }: CreateCustomerParams) => {
    try {
      const result = await createCustomer(name, email, phone, notes);
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
  "ploomes_update_customer",
  "Updates information of an existing customer in Ploomes CRM.",
  updateCustomerSchema.shape,
  async ({ id, name, email, phone, notes }: UpdateCustomerParams) => {
    try {
      const result = await updateCustomer(id, name, email, phone, notes);
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
  "ploomes_list_deals",
  "Lists all deals/opportunities in Ploomes CRM, allowing filtering and pagination of results.",
  listDealsSchema.shape,
  async ({ filter, customer_id, page, page_size }: ListDealsParams) => {
    try {
      const result = await listDeals(filter, customer_id, page, page_size);
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
  "ploomes_get_deal",
  "Gets details of a specific deal from Ploomes CRM using its ID.",
  getDealSchema.shape,
  async ({ id }: GetDealParams) => {
    try {
      const result = await getDeal(id);
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
  "ploomes_create_deal",
  "Creates a new deal/opportunity in Ploomes CRM with the provided information.",
  createDealSchema.shape,
  async ({ title, customer_id, amount, stage_id }: CreateDealParams) => {
    try {
      const result = await createDeal(title, customer_id, amount, stage_id);
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
  "ploomes_update_deal",
  "Updates information of an existing deal in Ploomes CRM.",
  updateDealSchema.shape,
  async ({ id, title, amount, stage_id }: UpdateDealParams) => {
    try {
      const result = await updateDeal(id, title, amount, stage_id);
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
  "ploomes_list_contacts",
  "Lists all contacts of a customer in Ploomes CRM, allowing pagination of results.",
  listContactsSchema.shape,
  async ({ customer_id, page, page_size }: ListContactsParams) => {
    try {
      const result = await listContacts(customer_id, page, page_size);
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
  "ploomes_get_contact",
  "Gets details of a specific contact from Ploomes CRM using its ID.",
  getContactSchema.shape,
  async ({ id }: GetContactParams) => {
    try {
      const result = await getContact(id);
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
  "ploomes_create_contact",
  "Creates a new contact for a customer in Ploomes CRM with the provided information.",
  createContactSchema.shape,
  async ({ customer_id, name, email, phone, role }: CreateContactParams) => {
    try {
      const result = await createContact(customer_id, name, email, phone, role);
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
  "ploomes_list_activities",
  "Lists all activities in Ploomes CRM, allowing filtering by customer or deal and pagination of results.",
  listActivitiesSchema.shape,
  async ({ customer_id, deal_id, page, page_size }: ListActivitiesParams) => {
    try {
      const result = await listActivities(customer_id, deal_id, page, page_size);
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
  "ploomes_create_activity",
  "Creates a new activity in Ploomes CRM with the provided information.",
  createActivitySchema.shape,
  async ({ title, description, start_date, end_date, customer_id, deal_id, type_id }: CreateActivityParams) => {
    try {
      const result = await createActivity(title, start_date, type_id, description, end_date, customer_id, deal_id);
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

// Main function
async function main() {
  try {
    // Try to get the API key to validate configuration
    getApiKey();
    
    // Configure signal handling for proper shutdown
    process.on('SIGINT', () => {
      console.error('Ploomes CRM Server received SIGINT, shutting down...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Ploomes CRM Server received SIGTERM, shutting down...');
      process.exit(0);
    });
    
    // Ensure errors don't terminate the process
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Run the server
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("Ploomes CRM MCP Server running through stdio");
    
    // Keep the process alive
    setInterval(() => {
      // Heartbeat to keep the process active
    }, 10000);
  } catch (error) {
    console.error("Error starting MCP server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
    console.error("Error starting server:", error);
    // Don't exit process to allow recovery
    process.exit(1);
});