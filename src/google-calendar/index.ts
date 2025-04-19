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
  start: z.object({
    date: z.string().optional(),
    dateTime: z.string().optional(),
    timeZone: z.string().optional()
  }).describe("Start time information with either date or dateTime"),
  end: z.object({
    date: z.string().optional(),
    dateTime: z.string().optional(),
    timeZone: z.string().optional()
  }).describe("End time information with either date or dateTime"),
  location: z.string().optional()
    .describe("Location of the event"),
  attendees: z.array(z.object({
    email: z.string(),
    responseStatus: z.string().optional()
  })).optional().describe("List of attendees with email and optional response status"),
  recurrence: z.array(z.string()).optional()
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
  calendarIds: z.array(z.string())
    .describe("List of calendar IDs to check"),
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
  expiry_date: number;
}

class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;

  constructor() {
    if (process.env.CREDENTIALS) {
      try {
        const credentials: Credentials = JSON.parse(process.env.CREDENTIALS);
        
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token,
          token_type: credentials.token_type,
          expiry_date: credentials.expiry_date
        });
        
        this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      } catch (error) {
        console.error('Error parsing CREDENTIALS environment variable:', error);
        throw new Error('Invalid CREDENTIALS format');
      }
    } else {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
      
      this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    }
  }

  async listCalendars(maxResults: number = 100, pageToken?: string): Promise<calendar_v3.Schema$CalendarList> {
    try {
      const response = await this.calendar.calendarList.list({
        maxResults,
        pageToken: pageToken || undefined
      });
      
      return response.data;
    } catch (error) {
      console.error('Error listing calendars:', error);
      throw error;
    }
  }

  async getCalendar(calendarId: string): Promise<calendar_v3.Schema$Calendar> {
    try {
      const response = await this.calendar.calendars.get({
        calendarId
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error getting calendar ${calendarId}:`, error);
      throw error;
    }
  }

  async listEvents(params: ListEventsParams): Promise<calendar_v3.Schema$Events> {
    try {
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
      console.error('Error listing events:', error);
      throw error;
    }
  }

  async getEvent(calendarId: string, eventId: string): Promise<calendar_v3.Schema$Event> {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error getting event ${eventId}:`, error);
      throw error;
    }
  }

  async createEvent(params: CreateEventParams): Promise<calendar_v3.Schema$Event> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: params.calendarId,
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
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(params: UpdateEventParams): Promise<calendar_v3.Schema$Event> {
    try {
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
      console.error('Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId
      });
    } catch (error) {
      console.error(`Error deleting event ${eventId}:`, error);
      throw error;
    }
  }

  async findAvailability(params: FindAvailabilityParams): Promise<any> {
    try {
      if (!Array.isArray(params.calendarIds)) {
        throw new Error('O parâmetro calendarIds deve ser um array de strings. Exemplo: ["calendar_id_1", "calendar_id_2"]');
      }
      
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
}

function getGoogleCalendarClient(): GoogleCalendarClient {
  if (!process.env.CREDENTIALS && 
      (!process.env.GOOGLE_CLIENT_ID || 
       !process.env.GOOGLE_CLIENT_SECRET || 
       !process.env.GOOGLE_REFRESH_TOKEN)) {
    throw new Error(
      'Missing required environment variables. Either set CREDENTIALS ' +
      'or set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.'
    );
  }
  
  return new GoogleCalendarClient();
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
  version: "0.0.1",
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