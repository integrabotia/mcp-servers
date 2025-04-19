#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { google, calendar_v3 } from "googleapis";

const listCalendarsSchema = z.object({
  maxResults: z.number().optional().default(100)
    .describe("Maximum number of calendars to return (default 100)"),
  pageToken: z.string().optional()
    .describe("Token for retrieving the next page of results")
});

const getCalendarSchema = z.object({
  calendarId: z.string()
    .describe("The ID of the calendar to retrieve")
});

const listEventsSchema = z.object({
  calendarId: z.string()
    .describe("The ID of the calendar to retrieve events from"),
  timeMin: z.string().optional()
    .describe("Start time in ISO format (e.g., '2023-05-01T00:00:00Z')"),
  timeMax: z.string().optional()
    .describe("End time in ISO format"),
  maxResults: z.number().optional().default(10)
    .describe("Maximum number of events to return (default 10)"),
  pageToken: z.string().optional()
    .describe("Token for retrieving the next page of results"),
  q: z.string().optional()
    .describe("Free text search terms")
});

const getEventSchema = z.object({
  calendarId: z.string()
    .describe("The ID of the calendar containing the event"),
  eventId: z.string()
    .describe("The ID of the event to retrieve")
});

const createEventSchema = z.object({
  calendarId: z.string()
    .describe("The ID of the calendar to create the event in"),
  summary: z.string()
    .describe("The title of the event"),
  description: z.string().optional()
    .describe("Description of the event"),
  start: z.union([
    z.string(),
    z.object({
      date: z.string().optional(),
      dateTime: z.string().optional(),
      timeZone: z.string().optional()
    })
  ]).transform(value => {
    // Converter string para objeto com dateTime
    if (typeof value === 'string') {
      return { dateTime: value };
    }
    return value;
  }).describe("Start time information with either date or dateTime"),
  end: z.union([
    z.string(),
    z.object({
      date: z.string().optional(),
      dateTime: z.string().optional(),
      timeZone: z.string().optional()
    })
  ]).transform(value => {
    // Converter string para objeto com dateTime
    if (typeof value === 'string') {
      return { dateTime: value };
    }
    return value;
  }).describe("End time information with either date or dateTime"),
  location: z.string().optional()
    .describe("Location of the event"),
  attendees: z.union([
    z.array(z.string()),
    z.array(z.object({
      email: z.string(),
      responseStatus: z.string().optional()
    }))
  ]).transform(value => {
    // Converter array de strings para array de objetos com email
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      return value.map(email => ({ email }));
    }
    return value;
  }).optional().describe("List of attendees with email and optional response status"),
  recurrence: z.array(z.string()).optional().nullable()
    .transform(value => value === null ? undefined : value)
    .describe("Recurrence rules for recurring events"),
  reminders: z.object({
    useDefault: z.boolean().optional(),
    overrides: z.array(z.object({
      method: z.string(),
      minutes: z.number()
    })).optional()
  }).optional().describe("Reminder settings for the event")
});

const updateEventSchema = z.object({
  calendarId: z.string()
    .describe("The ID of the calendar containing the event"),
  eventId: z.string()
    .describe("The ID of the event to update"),
  summary: z.string().optional()
    .describe("The updated title of the event"),
  description: z.string().optional()
    .describe("Updated description"),
  start: z.object({
    date: z.string().optional(),
    dateTime: z.string().optional(),
    timeZone: z.string().optional()
  }).optional().describe("Updated start time information"),
  end: z.object({
    date: z.string().optional(),
    dateTime: z.string().optional(),
    timeZone: z.string().optional()
  }).optional().describe("Updated end time information"),
  location: z.string().optional()
    .describe("Updated location"),
  attendees: z.array(z.object({
    email: z.string(),
    responseStatus: z.string().optional()
  })).optional().describe("Updated list of attendees"),
  recurrence: z.array(z.string()).optional()
    .describe("Updated recurrence rules"),
  reminders: z.object({
    useDefault: z.boolean().optional(),
    overrides: z.array(z.object({
      method: z.string(),
      minutes: z.number()
    })).optional()
  }).optional().describe("Updated reminder settings")
});

const deleteEventSchema = z.object({
  calendarId: z.string()
    .describe("The ID of the calendar containing the event"),
  eventId: z.string()
    .describe("The ID of the event to delete")
});

const findAvailabilitySchema = z.object({
  timeMin: z.string()
    .describe("Start of the time range in ISO format"),
  timeMax: z.string()
    .describe("End of the time range in ISO format"),
  durationMinutes: z.number()
    .describe("Desired duration of the event in minutes"),
  calendarIds: z.union([
    z.string(),
    z.array(z.string())
  ]).transform(value => {
    // Converter string para array
    if (typeof value === 'string') {
      if (value === '') return [];
      return [value];
    }
    return value;
  })
    .describe("List of calendar IDs to check (string or array)"),
  timeZone: z.string().optional().default('UTC')
    .describe("Time zone for the search (default UTC)")
});

type ListCalendarsParams = z.infer<typeof listCalendarsSchema>;
type GetCalendarParams = z.infer<typeof getCalendarSchema>;
type ListEventsParams = z.infer<typeof listEventsSchema>;
type GetEventParams = z.infer<typeof getEventSchema>;
type CreateEventParams = z.infer<typeof createEventSchema>;
type UpdateEventParams = z.infer<typeof updateEventSchema>;
type DeleteEventParams = z.infer<typeof deleteEventSchema>;
type FindAvailabilityParams = z.infer<typeof findAvailabilitySchema>;

interface Credentials {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string | number;
  additional_data?: {
    id_token?: string;
    email?: string;
    credentials_id?: string;
  };
}

class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;
  private oauth2Client: any;
  private userEmail: string | undefined;

  constructor() {
    if (process.env.CREDENTIALS) {
      try {
        const credentials: Credentials = JSON.parse(process.env.CREDENTIALS);
        
        // Validar as credenciais para evitar erro "invalid_request"
        if (!credentials.refresh_token && !credentials.additional_data?.id_token) {
          throw new Error('refresh_token ou id_token ausente nas credenciais');
        }
        
        this.oauth2Client = new google.auth.OAuth2();
        
        // Salvar o email do usuário se disponível
        if (credentials.additional_data?.email) {
          this.userEmail = credentials.additional_data.email;
        }
        
        // Configurar credenciais usando refresh_token ou id_token
        const authCredentials: any = {
          token_type: credentials.token_type
        };
        
        // Converter expires_at para expiry_date (timestamp em milissegundos)
        if (credentials.expires_at) {
          // Se expires_at for uma string ISO, converta para timestamp
          if (typeof credentials.expires_at === 'string') {
            authCredentials.expiry_date = new Date(credentials.expires_at).getTime();
          } else {
            authCredentials.expiry_date = credentials.expires_at;
          }
        }
        
        if (credentials.access_token) {
          authCredentials.access_token = credentials.access_token;
        }
        
        if (credentials.refresh_token) {
          authCredentials.refresh_token = credentials.refresh_token;
        }
        
        // Usar id_token se disponível
        if (credentials.additional_data?.id_token) {
          authCredentials.id_token = credentials.additional_data.id_token;
        }
        
        this.oauth2Client.setCredentials(authCredentials);
        
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      } catch (error) {
        console.error('Erro ao analisar variável de ambiente CREDENTIALS:', error);
        throw new Error('Formato de CREDENTIALS inválido ou incompleto');
      }
    } else {
      // Validar as credenciais para evitar erro "invalid_request"
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error(
          'Variáveis de ambiente necessárias não definidas. Configure CREDENTIALS ' +
          'ou configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.'
        );
      }
      
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
      );
      
      // Definir credenciais sem depender de GOOGLE_REFRESH_TOKEN
      if (process.env.GOOGLE_REFRESH_TOKEN) {
        this.oauth2Client.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });
      }
      
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    }
  }

  // Função para tentar renovar o token se estiver expirado
  private async ensureValidToken(): Promise<void> {
    try {
      // Verificar se o token está próximo de expirar (ou já expirou)
      const credentials = this.oauth2Client.credentials || {};
      const now = Date.now();
      const expiryDate = credentials.expiry_date || 0;
      
      // Se não houver data de expiração, ou se o token expirar em menos de 5 minutos
      if (!expiryDate || expiryDate - now < 5 * 60 * 1000) {
        console.log('Token está expirado ou próximo de expirar, renovando...');
        await this.oauth2Client.refreshAccessToken();
        console.log('Token renovado com sucesso');
      }
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      throw new Error(`Erro ao renovar o token de acesso: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Função para forçar renovação do token em caso de erro
  private async forceTokenRefresh(): Promise<void> {
    try {
      console.log('Forçando renovação do token...');
      await this.oauth2Client.refreshAccessToken();
      console.log('Token renovado com sucesso após forçar renovação');
    } catch (error) {
      console.error('Erro ao forçar renovação do token:', error);
      throw new Error(`Não foi possível renovar o token mesmo após tentativa forçada: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listCalendars(maxResults: number = 100, pageToken?: string): Promise<calendar_v3.Schema$CalendarList> {
    try {
      await this.ensureValidToken();
      
      const response = await this.calendar.calendarList.list({
        maxResults,
        pageToken: pageToken || undefined
      });
      
      return response.data;
    } catch (error) {
      console.error('Erro ao listar calendários:', error);
      
      // Tentar renovar o token forçadamente em caso de erro de autenticação
      if (error instanceof Error) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('Invalid Credentials') || 
            errorMessage.includes('invalid_token')) {
          
          try {
            console.log('Detectado erro de credenciais inválidas, tentando renovar token...');
            await this.forceTokenRefresh();
            
            // Tentar novamente após renovar o token
            const response = await this.calendar.calendarList.list({
              maxResults,
              pageToken: pageToken || undefined
            });
            
            return response.data;
          } catch (refreshError) {
            throw new Error(`Token inválido e não foi possível renová-lo: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
          }
        }
        
        if (errorMessage.includes('invalid_request') || 
            errorMessage.includes('invalid_client') || 
            errorMessage.includes('invalid_grant')) {
          throw new Error(`Erro de autenticação com Google Calendar: ${errorMessage}. Verifique se as credenciais estão corretas e válidas.`);
        }
      }
      
      throw error;
    }
  }

  async getCalendar(calendarId: string): Promise<calendar_v3.Schema$Calendar> {
    try {
      await this.ensureValidToken();
      
      const response = await this.calendar.calendars.get({
        calendarId
      });
      
      return response.data;
    } catch (error) {
      console.error(`Erro ao obter calendário ${calendarId}:`, error);
      throw error;
    }
  }

  async listEvents(params: ListEventsParams): Promise<calendar_v3.Schema$Events> {
    try {
      await this.ensureValidToken();
      
      const response = await this.calendar.events.list({
        calendarId: params.calendarId,
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        maxResults: params.maxResults,
        pageToken: params.pageToken,
        q: params.q
      });
      
      return response.data;
    } catch (error) {
      console.error('Erro ao listar eventos:', error);
      throw error;
    }
  }

  async getEvent(calendarId: string, eventId: string): Promise<calendar_v3.Schema$Event> {
    try {
      await this.ensureValidToken();
      
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });
      
      return response.data;
    } catch (error) {
      console.error(`Erro ao obter evento ${eventId}:`, error);
      throw error;
    }
  }

  async createEvent(params: CreateEventParams): Promise<calendar_v3.Schema$Event> {
    try {
      await this.ensureValidToken();
      
      // Garantir que temos objetos válidos para start e end
      const requestBody: any = {
        summary: params.summary,
        description: params.description,
        location: params.location,
        recurrence: params.recurrence,
        reminders: params.reminders
      };
      
      // Usar os valores de start e end já transformados pelo schema Zod
      if (params.start) {
        requestBody.start = params.start;
      }
      
      if (params.end) {
        requestBody.end = params.end;
      }
      
      // Usar os valores de attendees já transformados pelo schema Zod
      if (params.attendees) {
        requestBody.attendees = params.attendees;
      }
      
      const response = await this.calendar.events.insert({
        calendarId: params.calendarId,
        requestBody
      });
      
      return response.data;
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      
      // Tentar renovar o token forçadamente em caso de erro de autenticação
      if (error instanceof Error) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('Invalid Credentials') || 
            errorMessage.includes('invalid_token')) {
          
          try {
            console.log('Detectado erro de credenciais inválidas, tentando renovar token...');
            await this.forceTokenRefresh();
            
            // Preparar o corpo da requisição novamente
            const requestBody: any = {
              summary: params.summary,
              description: params.description,
              location: params.location,
              start: params.start,
              end: params.end,
              attendees: params.attendees,
              recurrence: params.recurrence,
              reminders: params.reminders
            };
            
            // Tentar novamente após renovar o token
            const response = await this.calendar.events.insert({
              calendarId: params.calendarId,
              requestBody
            });
            
            return response.data;
          } catch (refreshError) {
            throw new Error(`Token inválido e não foi possível renová-lo: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
          }
        }
      }
      
      throw error;
    }
  }

  async updateEvent(params: UpdateEventParams): Promise<calendar_v3.Schema$Event> {
    try {
      await this.ensureValidToken();
      
      const response = await this.calendar.events.update({
        calendarId: params.calendarId,
        eventId: params.eventId,
        requestBody: {
          summary: params.summary,
          description: params.description,
          location: params.location,
          start: params.start,
          end: params.end,
          attendees: params.attendees,
          recurrence: params.recurrence,
          reminders: params.reminders
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
      throw error;
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.ensureValidToken();
      
      await this.calendar.events.delete({
        calendarId,
        eventId
      });
    } catch (error) {
      console.error(`Erro ao excluir evento ${eventId}:`, error);
      throw error;
    }
  }

  async findAvailability(params: FindAvailabilityParams): Promise<any> {
    try {
      await this.ensureValidToken();
      
      const durationMs = params.durationMinutes * 60 * 1000;
      
      const allEvents: calendar_v3.Schema$Event[] = [];
      
      for (const calendarId of params.calendarIds) {
        const events = await this.listEvents({
          calendarId,
          timeMin: params.timeMin,
          timeMax: params.timeMax,
          maxResults: 2500
        });
        
        if (events.items && events.items.length > 0) {
          allEvents.push(...events.items);
        }
      }
      
      const busyTimes: { start: Date; end: Date }[] = allEvents
        .filter(event => {
          return event.start && event.end && !event.transparency;
        })
        .map(event => ({
          start: new Date(event.start?.dateTime || event.start?.date || ''),
          end: new Date(event.end?.dateTime || event.end?.date || '')
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      
      const startTime = new Date(params.timeMin);
      const endTime = new Date(params.timeMax);
      
      const availableSlots: { start: string; end: string }[] = [];
      let currentTime = new Date(startTime);
      
      for (const busy of busyTimes) {
        if (busy.start.getTime() - currentTime.getTime() >= durationMs) {
          availableSlots.push({
            start: currentTime.toISOString(),
            end: new Date(currentTime.getTime() + durationMs).toISOString()
          });
        }
        
        if (busy.end > currentTime) {
          currentTime = new Date(busy.end);
        }
      }
      
      if (endTime.getTime() - currentTime.getTime() >= durationMs) {
        availableSlots.push({
          start: currentTime.toISOString(),
          end: new Date(currentTime.getTime() + durationMs).toISOString()
        });
      }
      
      return {
        timeZone: params.timeZone,
        availableSlots
      };
    } catch (error) {
      console.error('Error finding availability:', error);
      throw error;
    }
  }

  // Função para obter o ID do calendário padrão (normalmente é o email do usuário)
  async getDefaultCalendarId(): Promise<string> {
    // Se já temos o email do usuário, use-o
    if (this.userEmail) {
      return this.userEmail;
    }
    
    // Caso contrário, tente obter da lista de calendários
    try {
      const calendars = await this.listCalendars(10);
      if (calendars.items && calendars.items.length > 0) {
        // Procurar por calendário principal (geralmente tem primary = true)
        const primaryCalendar = calendars.items.find(cal => cal.primary);
        if (primaryCalendar && primaryCalendar.id) {
          return primaryCalendar.id;
        }
        
        // Se não encontrar um calendário marcado como principal, use o primeiro
        if (calendars.items[0].id) {
          return calendars.items[0].id;
        }
      }
      
      throw new Error('Não foi possível determinar o ID do calendário padrão');
    } catch (error) {
      console.error('Erro ao determinar calendário padrão:', error);
      throw new Error('Não foi possível obter o ID do calendário padrão');
    }
  }
}

function getGoogleCalendarClient(): GoogleCalendarClient {
  try {
    if (!process.env.CREDENTIALS && 
        (!process.env.GOOGLE_CLIENT_ID || 
         !process.env.GOOGLE_CLIENT_SECRET)) {
      throw new Error(
        'Variáveis de ambiente necessárias não encontradas. Configure CREDENTIALS ' +
        'ou configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.'
      );
    }
    
    return new GoogleCalendarClient();
  } catch (error) {
    console.error('Erro ao criar cliente do Google Calendar:', error);
    throw error;
  }
}

const requestCounts: { [key: string]: number } = {};
const requestTimestamps: { [key: string]: number[] } = {};

function checkRateLimit(operationType: string): boolean {
  const now = Date.now();
  const windowMs = 100 * 1000;
  const maxRequestsPerWindow = 500;
  
  if (!requestTimestamps[operationType]) {
    requestTimestamps[operationType] = [];
  }
  
  requestTimestamps[operationType] = requestTimestamps[operationType].filter(
    timestamp => now - timestamp < windowMs
  );
  
  if (requestTimestamps[operationType].length >= maxRequestsPerWindow) {
    return false;
  }
  
  requestTimestamps[operationType].push(now);
  return true;
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 15000
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([operation(), timeoutPromise]);
    clearTimeout(timeoutId!);
    return result as T;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// Criar instância do servidor
const mcpServer = new McpServer({
  name: "Google Calendar",
  version: "0.0.7",
  description: "MCP server for Google Calendar integration",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Registrar as ferramentas
mcpServer.tool(
  "google_calendar_list_calendars",
  "List all calendars available to the user",
  listCalendarsSchema.shape,
  async (params: ListCalendarsParams) => {
    try {
      if (!checkRateLimit('list_calendars')) {
        throw new Error('Rate limit exceeded for list_calendars');
      }
      
      const client = getGoogleCalendarClient();
      const result = await withTimeout(
        () => client.listCalendars(params.maxResults, params.pageToken)
      );
      
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
  "google_calendar_get_calendar",
  "Get information about a specific calendar",
  getCalendarSchema.shape,
  async (params: GetCalendarParams) => {
    try {
      if (!checkRateLimit('get_calendar')) {
        throw new Error('Rate limit exceeded for get_calendar');
      }
      
      const client = getGoogleCalendarClient();
      const result = await withTimeout(
        () => client.getCalendar(params.calendarId)
      );
      
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
  "google_calendar_list_events",
  "List events from a calendar with filtering options",
  listEventsSchema.shape,
  async (params: ListEventsParams) => {
    try {
      if (!checkRateLimit('list_events')) {
        throw new Error('Rate limit exceeded for list_events');
      }
      
      const client = getGoogleCalendarClient();
      const result = await withTimeout(
        () => client.listEvents(params)
      );
      
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
  "google_calendar_get_event",
  "Get details of a specific event",
  getEventSchema.shape,
  async (params: GetEventParams) => {
    try {
      if (!checkRateLimit('get_event')) {
        throw new Error('Rate limit exceeded for get_event');
      }
      
      const client = getGoogleCalendarClient();
      const result = await withTimeout(
        () => client.getEvent(params.calendarId, params.eventId)
      );
      
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
  "google_calendar_create_event",
  "Create a new event in a calendar",
  createEventSchema.shape,
  async (params: CreateEventParams) => {
    try {
      if (!checkRateLimit('create_event')) {
        throw new Error('Rate limit exceeded for create_event');
      }
      
      const client = getGoogleCalendarClient();
      const result = await withTimeout(
        () => client.createEvent(params)
      );
      
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
  "google_calendar_update_event",
  "Update an existing event in a calendar",
  updateEventSchema.shape,
  async (params: UpdateEventParams) => {
    try {
      if (!checkRateLimit('update_event')) {
        throw new Error('Rate limit exceeded for update_event');
      }
      
      const client = getGoogleCalendarClient();
      const result = await withTimeout(
        () => client.updateEvent(params)
      );
      
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

// Adicionar nova ferramenta para listar eventos do calendário padrão
mcpServer.tool(
  "google_calendar_list_my_events",
  "List events from the user's default calendar",
  z.object({
    timeMin: z.string().optional()
      .describe("Start time in ISO format (e.g., '2023-05-01T00:00:00Z')"),
    timeMax: z.string().optional()
      .describe("End time in ISO format"),
    maxResults: z.number().optional().default(10)
      .describe("Maximum number of events to return (default 10)"),
    pageToken: z.string().optional()
      .describe("Token for retrieving the next page of results"),
    q: z.string().optional()
      .describe("Free text search terms")
  }).shape,
  async (params: Omit<ListEventsParams, 'calendarId'>) => {
    try {
      if (!checkRateLimit('list_my_events')) {
        throw new Error('Rate limit exceeded for list_my_events');
      }
      
      const client = getGoogleCalendarClient();
      
      // Obter ID do calendário padrão do usuário
      const calendarId = await withTimeout(
        () => client.getDefaultCalendarId()
      );
      
      const result = await withTimeout(
        () => client.listEvents({
          ...params,
          calendarId
        })
      );
      
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

// Adicionar ferramenta para criar evento no calendário padrão
mcpServer.tool(
  "google_calendar_create_my_event",
  "Create a new event in the user's default calendar",
  z.object({
    summary: z.string()
      .describe("The title of the event"),
    description: z.string().optional()
      .describe("Description of the event"),
    start: z.union([
      z.string(),
      z.object({
        date: z.string().optional(),
        dateTime: z.string().optional(),
        timeZone: z.string().optional()
      })
    ]).transform(value => {
      // Converter string para objeto com dateTime
      if (typeof value === 'string') {
        return { dateTime: value };
      }
      return value;
    }).describe("Start time information with either date or dateTime"),
    end: z.union([
      z.string(),
      z.object({
        date: z.string().optional(),
        dateTime: z.string().optional(),
        timeZone: z.string().optional()
      })
    ]).transform(value => {
      // Converter string para objeto com dateTime
      if (typeof value === 'string') {
        return { dateTime: value };
      }
      return value;
    }).describe("End time information with either date or dateTime"),
    location: z.string().optional()
      .describe("Location of the event"),
    attendees: z.union([
      z.array(z.string()),
      z.array(z.object({
        email: z.string(),
        responseStatus: z.string().optional()
      }))
    ]).transform(value => {
      // Converter array de strings para array de objetos com email
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return value.map(email => ({ email }));
      }
      return value;
    }).optional().describe("List of attendees with email and optional response status"),
    recurrence: z.array(z.string()).optional().nullable()
      .transform(value => value === null ? undefined : value)
      .describe("Recurrence rules for recurring events"),
    reminders: z.object({
      useDefault: z.boolean().optional(),
      overrides: z.array(z.object({
        method: z.string(),
        minutes: z.number()
      })).optional()
    }).optional().describe("Reminder settings for the event")
  }).shape,
  async (params: Omit<CreateEventParams, 'calendarId'>) => {
    try {
      if (!checkRateLimit('create_my_event')) {
        throw new Error('Rate limit exceeded for create_my_event');
      }
      
      const client = getGoogleCalendarClient();
      
      // Obter ID do calendário padrão do usuário
      const calendarId = await withTimeout(
        () => client.getDefaultCalendarId()
      );
      
      const result = await withTimeout(
        () => client.createEvent({
          ...params,
          calendarId
        })
      );
      
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
  "google_calendar_delete_event",
  "Delete an event from a calendar",
  deleteEventSchema.shape,
  async (params: DeleteEventParams) => {
    try {
      if (!checkRateLimit('delete_event')) {
        throw new Error('Rate limit exceeded for delete_event');
      }
      
      const client = getGoogleCalendarClient();
      await withTimeout(
        () => client.deleteEvent(params.calendarId, params.eventId)
      );
      
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }]
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
  "google_calendar_find_availability",
  "Find available time slots across calendars",
  findAvailabilitySchema.shape,
  async (params: FindAvailabilityParams) => {
    try {
      if (!checkRateLimit('find_availability')) {
        throw new Error('Rate limit exceeded for find_availability');
      }
      
      // Verificar se há pelo menos um calendário depois da transformação
      if (!Array.isArray(params.calendarIds) || params.calendarIds.length === 0) {
        throw new Error('É necessário fornecer pelo menos um ID de calendário no parâmetro calendarIds');
      }
      
      const client = getGoogleCalendarClient();
      const result = await withTimeout(
        () => client.findAvailability(params)
      );
      
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
export const GoogleCalendarAPI = {
  listCalendars: (client: GoogleCalendarClient, maxResults?: number, pageToken?: string) => 
    client.listCalendars(maxResults, pageToken),
  getCalendar: (client: GoogleCalendarClient, calendarId: string) => 
    client.getCalendar(calendarId),
  listEvents: (client: GoogleCalendarClient, params: ListEventsParams) => 
    client.listEvents(params),
  getEvent: (client: GoogleCalendarClient, calendarId: string, eventId: string) => 
    client.getEvent(calendarId, eventId),
  createEvent: (client: GoogleCalendarClient, params: CreateEventParams) => 
    client.createEvent(params),
  updateEvent: (client: GoogleCalendarClient, params: UpdateEventParams) => 
    client.updateEvent(params),
  deleteEvent: (client: GoogleCalendarClient, calendarId: string, eventId: string) => 
    client.deleteEvent(calendarId, eventId),
  findAvailability: (client: GoogleCalendarClient, params: FindAvailabilityParams) => 
    client.findAvailability(params),
  createClient: () => getGoogleCalendarClient(),
  getDefaultCalendarId: (client: GoogleCalendarClient) => client.getDefaultCalendarId(),
};

// Iniciar o servidor
async function main() {
  try {
    // Configurar tratamento de sinais para lidar com encerramento adequado
    process.on('SIGINT', () => {
      console.error('Google Calendar MCP Server received SIGINT, shutting down...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Google Calendar MCP Server received SIGTERM, shutting down...');
      process.exit(0);
    });
    
    // Garantir que os erros não encerrem o processo
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Iniciar o servidor
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("Google Calendar MCP Server running through stdio");
    
    // Manter o processo vivo
    setInterval(() => {
      // Heartbeat para manter o processo ativo
    }, 10000);
  } catch (error) {
    console.error("Error starting server:", error);
    // Não encerra o processo aqui para permitir reconexões
  }
}

main().catch((error) => {
  console.error("Error starting server:", error);
  process.exit(1);
}); 