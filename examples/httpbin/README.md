# httpbin Example

This example demonstrates how to use `@hsblabs/http-command` with the httpbin.org API, a simple HTTP request & response service useful for testing HTTP libraries.

## Features

- **HTTP Methods**: GET, POST, PUT, PATCH, DELETE examples
- **JSON Handling**: Manual JSON serialization/deserialization with proper headers
- **Form Data**: URL-encoded form submissions
- **Authentication**: Bearer token authentication example
- **Query Parameters**: Dynamic query string handling
- **Headers**: Inspect and send custom headers
- **Delays**: Test timeout and retry behavior with delayed responses
- **Status Codes**: Error handling for different HTTP status codes
- **Middleware**: Built-in retry and logging middleware

## Installation

```bash
pnpm install
```

## Usage

```bash
pnpm start
```

## Code Structure

- `src/commands.ts` - Command definitions for httpbin endpoints
- `src/client.ts` - Configured client instances (basic and authenticated)
- `src/index.ts` - Example usage demonstrating all features

## What is httpbin?

[httpbin](https://httpbin.org/) is a simple HTTP request & response service that echoes back information about the requests you make. It's perfect for:

- Testing HTTP clients
- Learning about HTTP
- Debugging API calls
- Demonstrating HTTP library features

## Examples Covered

1. **Simple GET**: Query parameters and response inspection
2. **Headers**: Viewing request headers
3. **UUID Generation**: Simple GET endpoint
4. **POST JSON**: Sending JSON data with automatic serialization
5. **POST Form**: URL-encoded form data
6. **PUT Request**: Updating resources
7. **PATCH Request**: Partial updates
8. **DELETE Request**: Resource deletion
9. **Bearer Auth**: Authentication middleware
10. **Delayed Response**: Testing timeouts and retries
11. **Status Codes**: Error handling for different HTTP status codes

## Key Concepts Demonstrated

### Command Definition

```typescript
// Using defineCommand for GET requests
export const getRequest = defineCommand({
  build: (input: GetWithQueryInput) => ({
    method: 'GET',
    url: '/get',
    query: input.params,
  }),
  parseData: (response): Promise<HttpBinResponse> => response.json(),
});

// Using defineCommand for POST with JSON body
export const postJson = defineCommand({
  build: (input: PostJsonInput) => ({
    method: 'POST',
    url: '/post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input.data),
  }),
  parseData: (response): Promise<HttpBinPostResponse> => response.json(),
});
```

### Client Configuration

```typescript
export const httpbinClient = createClient({
  baseUrl: 'https://httpbin.org',
  middleware: [
    retry({ maxAttempts: 3 }),
    logger((event) => {
      if (event.phase === 'response') {
        console.log(`[httpbin] ${event.method} ${event.url} - ${event.status} (${event.durationMs}ms)`);
      }
    }),
  ],
});
```

### Middleware Composition

```typescript
// Client with bearer authentication
export const httpbinAuthClient = createClient({
  baseUrl: 'https://httpbin.org',
  middleware: [
    bearerAuth('my-secret-token'),
    retry({ maxAttempts: 3 }),
    logger((event) => {
      if (event.phase === 'response') {
        console.log(`[httpbin-auth] ${event.method} ${event.url} - ${event.status}`);
      }
    }),
  ],
});
```

## API Documentation

This example uses [httpbin.org](https://httpbin.org/), a free HTTP request & response service.

Available endpoints:
- `/get` - Returns GET request data
- `/post` - Returns POST request data
- `/put` - Returns PUT request data
- `/patch` - Returns PATCH request data
- `/delete` - Returns DELETE request data
- `/headers` - Returns request headers
- `/uuid` - Returns a UUID
- `/delay/{n}` - Delays response for n seconds
- `/status/{code}` - Returns given HTTP status code
- `/bearer` - Tests bearer authentication
