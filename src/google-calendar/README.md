# Google Calendar MCP Server

**Category: Productivity**

An MCP server that enables Claude to interact with Google Calendar, providing capabilities to manage events, view calendars, and handle scheduling through a standardized interface.

## Features

- **Calendar Management**: List calendars and view calendar details
- **Event Management**: Create, read, update, delete, and list calendar events
- **Scheduling**: Find available time slots and schedule meetings
- **Attendee Management**: Add, remove, and check attendee status for events
- **Dual Authentication**: Support for both OAuth2 and API token-based authentication

## Tools

### Calendar Management
- **google_calendar_list_calendars**
  - List all calendars available to the user
  - Inputs:
    - `maxResults` (number, optional): Maximum number of calendars to return (default 100)
    - `pageToken` (string, optional): Token for retrieving the next page of results

- **google_calendar_get_calendar**
  - Get information about a specific calendar
  - Inputs:
    - `calendarId` (string): The ID of the calendar to retrieve

### Event Management
- **google_calendar_list_events**
  - List events from a calendar with filtering options
  - Inputs:
    - `calendarId` (string): The ID of the calendar to retrieve events from
    - `timeMin` (string, optional): Start time in ISO format (e.g., "2023-05-01T00:00:00Z")
    - `timeMax` (string, optional): End time in ISO format
    - `maxResults` (number, optional): Maximum number of events to return (default 10)
    - `pageToken` (string, optional): Token for retrieving the next page of results
    - `q` (string, optional): Free text search terms

- **google_calendar_get_event**
  - Get details of a specific event
  - Inputs:
    - `calendarId` (string): The ID of the calendar containing the event
    - `eventId` (string): The ID of the event to retrieve

- **google_calendar_create_event**
  - Create a new event in a calendar
  - Inputs:
    - `calendarId` (string): The ID of the calendar to create the event in
    - `summary` (string): The title of the event
    - `description` (string, optional): Description of the event
    - `start` (object): Start time information with either date or dateTime
    - `end` (object): End time information with either date or dateTime
    - `location` (string, optional): Location of the event
    - `attendees` (array, optional): List of attendees with email and optional response status
    - `recurrence` (array, optional): Recurrence rules for recurring events
    - `reminders` (object, optional): Reminder settings for the event

- **google_calendar_update_event**
  - Update an existing event in a calendar
  - Inputs:
    - `calendarId` (string): The ID of the calendar containing the event
    - `eventId` (string): The ID of the event to update
    - `summary` (string, optional): The updated title of the event
    - `description` (string, optional): Updated description
    - `start` (object, optional): Updated start time information
    - `end` (object, optional): Updated end time information
    - `location` (string, optional): Updated location
    - `attendees` (array, optional): Updated list of attendees
    - `recurrence` (array, optional): Updated recurrence rules
    - `reminders` (object, optional): Updated reminder settings

- **google_calendar_delete_event**
  - Delete an event from a calendar
  - Inputs:
    - `calendarId` (string): The ID of the calendar containing the event
    - `eventId` (string): The ID of the event to delete

### Scheduling Assistance
- **google_calendar_find_availability**
  - Find available time slots across calendars
  - Inputs:
    - `timeMin` (string): Start of the time range in ISO format
    - `timeMax` (string): End of the time range in ISO format
    - `durationMinutes` (number): Desired duration of the event in minutes
    - `calendarIds` (array): List of calendar IDs to check
    - `timeZone` (string, optional): Time zone for the search (default UTC)

## Installation

```bash
npm install -g @integrabot/google-calendar
```

## Usage

### Environment Setup

You can use this MCP server with either OAuth2 credentials or direct API token authentication.

#### Option 1: OAuth2 Authentication (Default)

```bash
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-client-secret
export GOOGLE_REDIRECT_URI=your-redirect-uri
export GOOGLE_REFRESH_TOKEN=your-refresh-token
```

#### Option 2: API Token Authentication

```bash
export CREDENTIALS='{"access_token":"your-access-token","refresh_token":"your-refresh-token","token_type":"Bearer","expiry_date":1234567890000}'
```

### Start the Server

```bash
google-calendar
```

## Configuration

### Setting up Google Calendar API

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Calendar API
3. Create OAuth 2.0 credentials or service account credentials
4. For OAuth 2.0:
   - Set up authorized redirect URIs
   - Complete OAuth consent screen configuration
   - Obtain refresh token through authorization flow

## Rate Limits

This server implements rate limiting to respect Google Calendar API's usage limits:
- Up to 1,000,000 queries per day
- Up to 500 queries per 100 seconds per user

## Timeouts

All API requests have a 15-second timeout to prevent blocking operations.

## License

MIT 