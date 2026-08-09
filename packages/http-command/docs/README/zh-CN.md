# @hsblabs/http-command

`@hsblabs/http-command` 是面向类型化 HTTP SDK 作者的小型 TypeScript runtime。它提供 client factory、带服务作用域的 Command protocol、中间件、Fetch handler 与统一错误模型。服务专属 endpoint、schema、认证策略和 validation 仍由 SDK 自身负责。

[English](../../README.md) | [日本語](./ja.md) | [Français](./fr.md) | [Deutsch](./de.md) | **简体中文** | [繁體中文](./zh-TW.md)

## 特性

- `client.send(command)` 执行模型
- 使用 `Client<Scope>` 与 `Command<Scope, Output>` 隔离服务
- 基于函数的 Command factory
- 保留 API 前缀且可替换的 URL resolver
- 标量与重复键 query 序列化
- 显式编码动态 path segment
- 分离成功数据与服务错误 decoder
- 考虑可重放性的 request body 与 retry
- 可注入 handler，便于测试
- 仅 ESM，无 runtime dependency

## 安装

```bash
npm install @hsblabs/http-command
```

## 最小示例

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

默认 resolver 将完整 base path 视为 API 前缀，因此目标 URL 为 `https://api.example.com/v1/users/u_1`。

## 服务作用域 SDK

每个 SDK 可声明私有 `unique symbol` 类型，并同时用于 Client 和 Command。带 scope 的 Command 在声明类型中具有 brand，因此应通过 `defineCommand<Scope>()` 或 `defineJsonCommand<Scope>()` 创建，而不是直接使用对象字面量。

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

Scope 只是编译期边界，不是 runtime 授权。带凭据的 SDK 若允许绝对 URL，还应在自定义 resolver 中校验最终 origin。

## URL 解析与路径编码

默认 `resolveUrl` 保留 `baseUrl` 的完整 path 作为 API 前缀并规范化连接处的 slash。`//host/path` 视为协议相对 URL，三个及以上前导 slash 视为 operation path；绝对 operation URL 可绕过 base URL。Base URL 不得带 query 或 fragment，operation 中的 query 与 fragment会保留。SDK 可通过 `ClientConfig.resolveUrl` 替换该策略，随后 `RequestDescriptor.query` 会合并到 resolver 的返回值中。若 resolver 抛出异常，该异常会归一化为 `TRANSPORT` 并保存在 `error.cause`，且不会创建 body 或发送请求。

Query 数组会序列化为重复键。标量替换同名旧值；空数组删除该键；标量 `null` 和 `undefined` 会被忽略，但不会删除 URL 中已有的同名值。编码遵循 `URLSearchParams`。

完整 `RequestDescriptor.url` 不会自动编码。请对每个动态 path parameter 使用 `encodePathSegment()`；该 helper 使用严格 RFC 3986 百分号编码。

## 响应解析与服务错误

`parseData` 处理 2xx response，`parseError` 可选地处理 non-2xx response。HTTP 错误中，服务错误数据位于 `error.errorData`，原始文本尽可能保存在 `error.body`，decoder 失败保存在 `error.cause`。即使 `parseError` 失败，主错误仍是 HTTP 错误。

`parseData` 接收原始成功 `Response`，可返回 JSON、文本、二进制或 stream。Decoder 抛出的错误会归一化为 `PARSE`；此时诊断 body 只能 best effort 获取。

`parseError` 接收克隆后的 Response，并应在 resolve 前完成解码。完成后，Client 会尽力取消任何未读取的克隆 body。不要从 `parseError` 返回仍在使用的 response body stream。

`defineJsonCommand` 使用 `response.json()`，支持可选 `transform`，并对 204、205、null body 或 `content-length: 0` 返回 `undefined`。

## 可重放的请求体

`RequestBody` 接受标准 Fetch `BodyInit` 值以及 Node 兼容的 `AsyncIterable<Uint8Array>` body。Request 只能指定 `body` 或 `bodyFactory` 之一。Factory 在首次发送前及每次 retry 前接收 `{ attempt, signal }`。一般 factory 失败归类为 `TRANSPORT`，abort 归类为 `CANCELLED`。

静态 stream 即使自定义 `shouldRetry` 返回 `true` 也不会重试。需要重放 stream 时必须使用 `bodyFactory`。默认 retry 仅作用于幂等 method 或带 `Idempotency-Key` 的 request，并处理 429、5xx 与 transport error，同时遵守 `Retry-After`。

## 使用中间件

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

数组中的第一个 middleware 是 request 侧最外层，response 以逆序返回。Defaults 合并顺序为 `client < command < send options`。Header 名按大小写不敏感方式合并。

## 创建自定义中间件

Middleware 类型为 `(next: Handler) => Handler`。`defineMiddleware` 提供 `before`、`after` 与 `onError` hook。

```ts
const timing = defineMiddleware({
  before: (context) => ({
    ...context,
    meta: { ...context.meta, startedAt: Date.now() },
  }),
});
```

## API 参考

- `createClient<Scope>(config?)`
- `defineCommand(config)` 与 `defineCommand<Scope>()(config)`
- `defineJsonCommand(config)`
- `client.send(command, options?)`
- `client.with(...middleware)`
- `client.withDefaults(defaults)`
- `resolveUrl`、`appendQuery`、`encodePathSegment`
- `HttpCommandError`：`HTTP`、`TRANSPORT`、`PARSE`、`TIMEOUT`、`CANCELLED`

同时导出 `ClientConfig`、`CommandConfig`、`RequestDescriptor`、`RequestBody`、`Handler`、`Context`、`Middleware`、`UrlResolver`、`BodyFactory` 等扩展类型。

## 开发

```bash
pnpm install
pnpm run check
pnpm run pack:dry-run
```

```bash
npm run docs:check
```

## 许可证

MIT
