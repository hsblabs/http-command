import { defineCommand } from '@hsblabs/http-command';

// Types for httpbin responses
export interface HttpBinResponse {
  args: Record<string, string>;
  headers: Record<string, string>;
  origin: string;
  url: string;
}

export interface HttpBinPostResponse extends HttpBinResponse {
  data: string;
  files: Record<string, string>;
  form: Record<string, string>;
  json: unknown;
}

export interface HttpBinHeadersResponse {
  headers: Record<string, string>;
}

export interface HttpBinUuidResponse {
  uuid: string;
}

export interface HttpBinDelayResponse extends HttpBinResponse {
  // Same as HttpBinResponse, but with delayed response
}

export interface HttpBinStatusResponse {
  // Empty body for status code tests
}

// Input types
export interface GetWithQueryInput {
  params?: Record<string, string | number>;
}

export interface PostJsonInput {
  data: Record<string, unknown>;
}

export interface PostFormInput {
  formData: Record<string, string>;
}

export interface DelayInput {
  seconds: number;
}

export interface StatusInput {
  code: number;
}

export interface BasicAuthInput {
  user: string;
  passwd: string;
}

export interface BearerAuthInput {
  token: string;
}

// GET commands
export const getRequest = defineCommand({
  build: (input: GetWithQueryInput) => ({
    method: 'GET',
    url: '/get',
    query: input.params,
  }),
  parseData: (response): Promise<HttpBinResponse> => response.json(),
});

export const getHeaders = defineCommand({
  build: (_input: {}) => ({
    method: 'GET',
    url: '/headers',
  }),
  parseData: (response): Promise<HttpBinHeadersResponse> => response.json(),
});

export const getUuid = defineCommand({
  build: (_input: {}) => ({
    method: 'GET',
    url: '/uuid',
  }),
  parseData: (response): Promise<HttpBinUuidResponse> => response.json(),
});

// POST commands - send JSON and receive JSON response
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

export const postForm = defineCommand({
  build: (input: PostFormInput) => ({
    method: 'POST',
    url: '/post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(input.formData).toString(),
  }),
  parseData: (response): Promise<HttpBinPostResponse> => response.json(),
});

// PUT/PATCH/DELETE commands
export const putJson = defineCommand({
  build: (input: PostJsonInput) => ({
    method: 'PUT',
    url: '/put',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input.data),
  }),
  parseData: (response): Promise<HttpBinPostResponse> => response.json(),
});

export const patchJson = defineCommand({
  build: (input: PostJsonInput) => ({
    method: 'PATCH',
    url: '/patch',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input.data),
  }),
  parseData: (response): Promise<HttpBinPostResponse> => response.json(),
});

export const deleteRequest = defineCommand({
  build: (_input: {}) => ({
    method: 'DELETE',
    url: '/delete',
  }),
  parseData: (response): Promise<HttpBinResponse> => response.json(),
});

// Delay command - tests timeout and retry behavior
export const delayRequest = defineCommand({
  build: (input: DelayInput) => ({
    method: 'GET',
    url: `/delay/${input.seconds}`,
  }),
  parseData: (response): Promise<HttpBinDelayResponse> => response.json(),
});

// Status code command - tests error handling
export const statusRequest = defineCommand({
  build: (input: StatusInput) => ({
    method: 'GET',
    url: `/status/${input.code}`,
  }),
  parseData: async (response): Promise<HttpBinStatusResponse> => {
    // Status endpoint returns empty body for non-200 codes
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  },
});

// Auth commands
export const basicAuth = defineCommand({
  build: (input: BasicAuthInput) => ({
    method: 'GET',
    url: `/basic-auth/${input.user}/${input.passwd}`,
  }),
  parseData: (response): Promise<{ authenticated: boolean; user: string }> => response.json(),
});

export const bearerAuth = defineCommand({
  build: (_input: {}) => ({
    method: 'GET',
    url: '/bearer',
  }),
  parseData: (response): Promise<{ authenticated: boolean; token: string }> => response.json(),
});
