# @hsblabs/http-command

`@hsblabs/http-command`は、型付きHTTP SDKを実装するサービス提供者向けの小さなTypeScript runtimeです。client factory、service scope付きCommand protocol、middleware、Fetch handler、共通errorを提供します。API固有のendpoint、schema、認証方針、validationはSDK側の責務です。

[English](../../README.md) | **日本語** | [Français](./fr.md) | [Deutsch](./de.md) | [简体中文](./zh-CN.md) | [繁體中文](./zh-TW.md)

## 特徴

- `client.send(command)`を中心とした実行モデル
- `Client<Scope>`と`Command<Scope, Output>`によるservice境界
- input/output型を推論する関数ベースのCommand factory
- API prefixを保持する既定URL resolverとSDK側の差し替え
- scalarおよびrepeated-key query serialization
- dynamic path segmentの明示的なencoding
- 成功responseとservice error responseの個別decoder
- replay可能性を考慮したrequest bodyとretry
- testや独自transport向けのhandler注入
- ESM only、runtime dependencyなし

## インストール

```bash
npm install @hsblabs/http-command
```

```bash
pnpm add @hsblabs/http-command
```

## 最小利用例

Service分離が不要な場合はdefault scopeを利用できます。

```ts
import {
  createClient,
  defineCommand,
  encodePathSegment,
} from '@hsblabs/http-command';

type User = Readonly<{
  id: string;
  name: string;
}>;

const getUser = defineCommand({
  build: (input: Readonly<{ id: string }>) => ({
    method: 'GET',
    url: `/users/${encodePathSegment(input.id)}`,
  }),
  parseData: (response): Promise<User> => response.json(),
});

const client = createClient({
  baseUrl: 'https://api.example.com/v1',
});

const user = await client.send(getUser({ id: 'u_1' }));
```

既定resolverは`baseUrl`をAPI prefixとして扱うため、送信先は`https://api.example.com/v1/users/u_1`です。

## Scope付きSDKの定義

Service SDKはprivateな`unique symbol`型を1つ宣言し、ClientとCommandの両方へ適用します。これにより、別SDKのCommandを誤ったClientへ送るコードが型エラーになります。Scope付きCommandは宣言型上のbrandを持つため、object literalではなく`defineCommand<Scope>()`または`defineJsonCommand<Scope>()`から生成します。

```ts
import {
  createClient,
  defineCommand,
  encodePathSegment,
  type Client,
  type ClientConfig,
} from '@hsblabs/http-command';

declare const POKE_API_SCOPE: unique symbol;
type PokeAPIScope = typeof POKE_API_SCOPE;

export type PokeAPIClient = Client<PokeAPIScope>;
export type PokeAPIClientOptions = Omit<
  ClientConfig<PokeAPIScope>,
  'baseUrl'
> & {
  baseUrl?: string;
};

const definePokeAPICommand = defineCommand<PokeAPIScope>();

export const getPokemon = definePokeAPICommand({
  build: (input: Readonly<{ nameOrId: string | number }>) => ({
    method: 'GET',
    url: `/pokemon/${encodePathSegment(input.nameOrId)}`,
  }),
  parseData: (response): Promise<{ id: number; name: string }> =>
    response.json(),
  parseError: (response) => response.json(),
});

export function createPokeAPIClient(
  options: PokeAPIClientOptions = {},
): PokeAPIClient {
  return createClient<PokeAPIScope>({
    ...options,
    baseUrl: options.baseUrl ?? 'https://pokeapi.co/api/v2',
  });
}
```

SDK利用者は公開されたfactoryとCommandだけを使います。

```ts
const client = createPokeAPIClient({ middleware: [] });
const pokemon = await client.send(
  getPokemon({ nameOrId: 1 }),
);
```

Scopeはcompile-time identifierであり、runtimeの認可境界ではありません。Credentialを付与するSDKでabsolute URLを許容する場合は、custom resolverで送信先originも検証してください。

## URLとparameterの仕様

既定の`resolveUrl(baseUrl, operationUrl)`は次の規則を持ちます。

- relative operation URLはbase path全体をAPI prefixとして結合する
- join境界のslashを正規化する
- absolute operation URLは`baseUrl`を無視する
- `//host/path`はprotocol-relative URLとしてabsolute base URLのschemeを使い、3本以上のleading slashはoperation pathとしてjoin時に正規化する
- `baseUrl`にqueryまたはfragmentを含めない
- operation URLのqueryとfragmentを保持する
- `baseUrl`未指定時はoperation URLをそのまま返す

`ClientConfig.resolveUrl`でSDK固有の規則へ差し替えられます。`RequestDescriptor.query`はresolverの戻り値へ後からmergeされます。Resolverがthrowした場合は`TRANSPORT`へ正規化して`error.cause`へ保持し、request bodyの生成もdispatchも行いません。

Queryはscalarとreadonly arrayを受け付けます。Arrayは同名keyの繰り返しになります。

```ts
query: {
  tag: ['typescript', 'sdk'],
  page: 2,
  preview: true,
  omitted: undefined,
}
// ?tag=typescript&tag=sdk&page=2&preview=true
```

Scalarは同名の既存値を置換します。Arrayは既存値を削除してnon-null itemをappendします。Empty arrayは同名keyを削除します。Scalarの`null`／`undefined`は追加せず、URL内の既存値は保持します。Encodingは`URLSearchParams`準拠です。

`RequestDescriptor.url`全体は自動encodeされません。Dynamic path parameterだけを`encodePathSegment()`でencodeしてください。このhelperはstrict RFC 3986 percent encodingを行います。

## Responseとerrorのdecode

Commandは成功用`parseData`と失敗用`parseError`を分けて定義します。

```ts
const command = defineCommand({
  build: () => ({ method: 'GET', url: '/resource' }),
  parseData: (response) => response.json(),
  parseError: (response) => response.json(),
});
```

`parseData`には元の成功`Response`が渡るため、JSON、text、binary、streamを選択できます。Decoderがthrowすると`PARSE`になります。Decoderがbodyを消費済みの場合、errorの`body`は取得できないことがあります。

Non-2xx responseは`HTTP` errorになります。

- `parseError`の戻り値は`error.errorData`
- raw textは可能な限り`error.body`
- `parseError`の失敗は`error.cause`
- `parseError`が失敗しても主エラーはHTTP errorのまま

`parseError`には複製したResponseが渡されます。Decoderはresolveする前にdecodeを完了させてください。完了後、clientは未読の複製bodyをbest effortでcancelします。`parseError`から生きたresponse body streamを返さないでください。

`defineJsonCommand`は成功responseをJSON decodeし、204、205、null body、`content-length: 0`を空の結果として扱います。必要に応じて`transform`でJSON値を変換できます。

## Request bodyとretry

`RequestBody`は標準Fetchの`BodyInit`とNode互換の`AsyncIterable<Uint8Array>`を受け付けます。Requestは`body`または`bodyFactory`のどちらか一方を持ちます。

```ts
bodyFactory: ({ attempt, signal }) => {
  signal?.throwIfAborted();
  return createReadableStream(attempt);
}
```

`bodyFactory`は初回dispatch前と各retry前に呼ばれます。`attempt`は1始まりです。通常のfactory失敗は`TRANSPORT`、abort起因は`CANCELLED`になります。

Staticな`ReadableStream`やasync iterableは安全に再送できないため、custom `shouldRetry`が`true`を返してもretryしません。Streamをretryする場合は`bodyFactory`を利用します。

既定retryはidempotent methodまたは`Idempotency-Key`付きrequestに限定し、429、5xx、transport errorを対象にします。Timeoutとcancelはretryせず、`Retry-After`を尊重します。Retry前には失敗response bodyをbest effortでcancelします。

## Middlewareの使用

配列先頭のmiddlewareがrequest側の最外層になり、responseは逆順に戻ります。

```ts
import {
  bearerAuth,
  createClient,
  logger,
  retry,
} from '@hsblabs/http-command';

const client = createClient({
  baseUrl: 'https://api.example.com/v1',
  middleware: [
    bearerAuth(() => process.env.API_TOKEN ?? ''),
    retry({ maxAttempts: 3 }),
    logger((event) => console.log(event)),
  ],
});
```

Defaultsの優先順は`client < command < send options`です。Headerはcase-insensitiveにmergeされます。`with()`と`withDefaults()`は元Clientを変更せず、派生Clientを返します。

## Custom middlewareの作成

Middlewareは`(next: Handler) => Handler`です。`defineMiddleware`でbefore／after／onError hookを定義できます。

```ts
const timing = defineMiddleware({
  before: (context) => ({
    ...context,
    meta: { ...context.meta, startedAt: Date.now() },
  }),
  after: (result, context) => {
    console.log(Date.now() - Number(context.meta.startedAt));
    return result;
  },
});
```

I/Oや状態変更はhandler／middleware境界へ寄せ、Commandの`build`やdecoderは単体でtestできる形を推奨します。

## APIリファレンス

- `createClient<Scope>(config?)`: `Client<Scope>`を生成
- `defineCommand(config)`: default scopeのCommand factoryを生成
- `defineCommand<Scope>()(config)`: service scope付きfactoryを生成
- `defineJsonCommand`: JSON success decoder付きfactoryを生成
- `client.send(command, options?)`: request実行とdecode
- `client.with(...middleware)`: middleware付き派生Client
- `client.withDefaults(defaults)`: defaults付き派生Client
- `resolveUrl`: API prefix方式の既定resolver
- `appendQuery`: query追加
- `encodePathSegment`: dynamic path segment encoder
- `HttpCommandError`: `HTTP`、`TRANSPORT`、`PARSE`、`TIMEOUT`、`CANCELLED`

SDK／middleware実装用に`ClientConfig`、`CommandConfig`、`JsonCommandConfig`、`RequestDescriptor`、`RequestBody`、`Handler`、`Context`、`Middleware`、`UrlResolver`、`BodyFactory`などをexportします。

## 開発

```bash
pnpm install
pnpm run check
pnpm run pack:dry-run
```

README構造の確認だけなら次でも実行できます。

```bash
npm run docs:check
```

## ライセンス

MIT
