# @hsblabs/http-command

`@hsblabs/http-command` 是提供給型別化 HTTP SDK 作者的小型 TypeScript runtime。它提供 client factory、帶服務作用域的 Command protocol、中介軟體、Fetch handler 與統一錯誤模型。服務專屬 endpoint、schema、驗證與認證策略仍由 SDK 本身負責。

[English](../../README.md) | [日本語](./ja.md) | [Français](./fr.md) | [Deutsch](./de.md) | [简体中文](./zh-CN.md) | **繁體中文**

## 特性

- `client.send(command)` 執行模型
- 使用 `Client<Scope>` 與 `Command<Scope, Output>` 隔離服務
- 函數式 Command factory
- 保留 API 前綴且可替換的 URL resolver
- Scalar 與重複 key query serialization
- 明確編碼動態 path segment
- 分離成功資料與服務錯誤 decoder
- 考慮可重放性的 request body 與 retry
- 可注入 handler，方便測試
- 僅 ESM，無 runtime dependency

## 安裝

```bash
npm install @hsblabs/http-command
```

## 最小範例

```ts
import {
  createClient,
  defineCommand,
  encodePathSegment,
} from '@hsblabs/http-command';

const getUser = defineCommand({
  build: (input: Readonly<{ id: string }>) => ({
    method: 'GET',
    url: `/users/${encodePathSegment(input.id)}`,
  }),
  parseData: (response): Promise<{ id: string; name: string }> =>
    response.json(),
  parseError: (response) => response.json(),
});

const client = createClient({
  baseUrl: 'https://api.example.com/v1',
});

const user = await client.send(getUser({ id: 'u_1' }));
```

預設 resolver 將完整 base path 視為 API 前綴，因此目標 URL 為 `https://api.example.com/v1/users/u_1`。

## 服務作用域 SDK

每個 SDK 可宣告私有 `unique symbol` 型別，並同時套用至 Client 與 Command。帶 scope 的 Command 在宣告型別中具有 brand，因此應透過 `defineCommand<Scope>()` 或 `defineJsonCommand<Scope>()` 建立，而不是直接使用物件字面值。

```ts
import { createClient, defineCommand, type Client } from '@hsblabs/http-command';

declare const SERVICE_SCOPE: unique symbol;
type ServiceScope = typeof SERVICE_SCOPE;

export type ServiceClient = Client<ServiceScope>;
const defineServiceCommand = defineCommand<ServiceScope>();

export const getResource = defineServiceCommand({
  build: () => ({ method: 'GET', url: '/resource' }),
  parseData: (response) => response.json(),
});

export const createServiceClient = (): ServiceClient =>
  createClient<ServiceScope>({
    baseUrl: 'https://api.example.com/v1',
  });
```

Scope 只是編譯期邊界，不是 runtime 授權。帶憑證的 SDK 若允許絕對 URL，還應在自訂 resolver 驗證最終 origin。

## URL 解析與路徑編碼

預設 `resolveUrl` 會保留 `baseUrl` 的完整 path 作為 API 前綴並正規化接合處 slash。`//host/path` 視為 protocol-relative URL，三個以上的前導 slash 視為 operation path；絕對 operation URL 可略過 base URL。Base URL 不得帶 query 或 fragment，operation 中的 query 與 fragment會保留。SDK 可透過 `ClientConfig.resolveUrl` 取代此策略，之後 `RequestDescriptor.query` 會合併到 resolver 的回傳值。若 resolver 拋出例外，該例外會正規化為 `TRANSPORT` 並保存在 `error.cause`，且不會建立 body 或傳送 request。

Query array 會序列化成重複 key。Scalar 會取代同名既有值；空 array 會刪除該 key；scalar `null` 與 `undefined` 會被省略，但不會刪除 URL 中既有的同名值。編碼遵循 `URLSearchParams`。

完整 `RequestDescriptor.url` 不會自動編碼。請對每個動態 path parameter 使用 `encodePathSegment()`；此 helper 使用嚴格 RFC 3986 百分比編碼。

## 回應解析與服務錯誤

`parseData` 處理 2xx response，`parseError` 可選擇處理 non-2xx response。HTTP 錯誤的服務資料位於 `error.errorData`，原始文字盡可能放入 `error.body`，decoder 失敗放入 `error.cause`。即使 `parseError` 失敗，主要錯誤仍是 HTTP 錯誤。

`parseData` 接收原始成功 `Response`，可回傳 JSON、文字、binary 或 stream。Decoder 例外會正規化成 `PARSE`；此時診斷 body 只能 best effort 取得。

`parseError` 接收複製後的 Response，並應在 resolve 前完成解碼。完成後，Client 會盡力取消任何未讀取的複製 body。不要從 `parseError` 回傳仍在使用的 response body stream。

`defineJsonCommand` 使用 `response.json()`、支援可選 `transform`，並對 204、205、null body 或 `content-length: 0`回傳 `undefined`。

## 可重播的請求本文

`RequestBody` 接受標準 Fetch `BodyInit` 值以及 Node 相容的 `AsyncIterable<Uint8Array>` body。Request 只能指定 `body` 或 `bodyFactory` 其中之一。Factory 在首次傳送前及每次 retry 前接收 `{ attempt, signal }`。一般 factory 失敗歸類為 `TRANSPORT`，abort 歸類為 `CANCELLED`。

靜態 stream 即使自訂 `shouldRetry` 回傳 `true` 也不會重試。需要重放 stream 時必須使用 `bodyFactory`。預設 retry 僅套用於冪等 method 或帶 `Idempotency-Key` 的 request，處理 429、5xx 與 transport error，並遵守 `Retry-After`。

## 使用中介軟體

```ts
const client = createClient({
  baseUrl: 'https://api.example.com/v1',
  middleware: [
    bearerAuth(() => process.env.API_TOKEN ?? ''),
    retry({ maxAttempts: 3 }),
    logger((event) => console.log(event)),
  ],
});
```

陣列中的第一個 middleware 是 request 側最外層，response 以反向順序返回。Defaults 合併順序為 `client < command < send options`。Header 名稱以不分大小寫方式合併。

## 建立自訂中介軟體

Middleware 型別為 `(next: Handler) => Handler`。`defineMiddleware` 提供 `before`、`after` 與 `onError` hook。

```ts
const timing = defineMiddleware({
  before: (context) => ({
    ...context,
    meta: { ...context.meta, startedAt: Date.now() },
  }),
});
```

## API 參考

- `createClient<Scope>(config?)`
- `defineCommand(config)` 與 `defineCommand<Scope>()(config)`
- `defineJsonCommand(config)`
- `client.send(command, options?)`
- `client.with(...middleware)`
- `client.withDefaults(defaults)`
- `resolveUrl`、`appendQuery`、`encodePathSegment`
- `HttpCommandError`：`HTTP`、`TRANSPORT`、`PARSE`、`TIMEOUT`、`CANCELLED`

另匯出 `ClientConfig`、`CommandConfig`、`RequestDescriptor`、`RequestBody`、`Handler`、`Context`、`Middleware`、`UrlResolver`、`BodyFactory` 等擴充型別。

## 開發

```bash
pnpm install
pnpm run check
pnpm run pack:dry-run
```

```bash
npm run docs:check
```

## 授權

MIT
