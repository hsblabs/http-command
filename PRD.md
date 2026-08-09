# PRD: @hsblabs/http-command

## 概要

`@hsblabs/http-command`は、サービス提供者がTypeScript向けHTTP SDKを実装するための小さなruntimeである。利用者向けAPIは`client.send(command)`を中心とし、coreはclient factory、Command protocol、middleware pipeline、Fetch handler、共通エラー契約だけを提供する。

サービス固有のendpoint、request/response型、認証設定、error schema、validation、code generationはSDK側の責務とする。

## 想定利用者

主な利用者は、APIやSaaSのTypeScript SDKを提供する開発者である。SDKの最終利用者は、次の形でAPIを呼び出す。

```ts
const client = createServiceClient({ middleware: [] });
const result = await client.send(getResource({ id: 'r_1' }));
```

## ゴール

- `Client<Scope>`と`Command<Scope, Output>`による型付き実行契約を提供する
- 異なるサービスのClientとCommandを型チェック時に混在させない
- Commandをclassではなくfactory関数で定義する
- SDK固有のURL解決方針をclient factoryから差し替えられる
- 成功responseとサービス固有error responseを別々にdecodeできる
- retry可能なbodyと一度しか読めないbodyを明確に区別する
- 認証、retry、logging、計測などをmiddlewareとして追加できる
- Fetchベースの標準handlerと、テスト用のhandler注入を提供する
- Node.jsとbrowserで利用できるESM packageとして配布する
- runtime dependencyを持たない

## 非ゴール

- OpenAPIなどからのcode generation
- サービス固有schemaやvalidation libraryの同梱
- APIごとの認証フロー、pagination、rate-limit policyの標準化
- REST以外のprotocolの抽象化
- HTTP cache、connection pool、undici固有最適化
- runtime上でのサービスscope認証

## 責務境界

```text
@hsblabs/http-command
  Client / Command protocol / URL-query-body contract
  middleware pipeline / Fetch handler / normalized errors

サービスSDK
  Scope / client factory / commands / service types
  auth middleware configuration / error decoders / validation

SDK利用アプリケーション
  client configuration / command invocation / result handling
```

## 公開プロトコル

### Scope

- `Client<Scope>`は同じ`Scope`を持つ`Command<Scope, Output>`だけを受け取る
- Scope付きCommandは宣言型上のbrandを持ち、対応する`defineCommand<Scope>()`または`defineJsonCommand<Scope>()`から生成する
- `Scope`はSDKごとに宣言したprivateな`unique symbol`型を推奨する
- Scopeは型レベルの識別子であり、runtime security boundaryではない
- Scopeを不要とする単一用途向けに`DefaultScope`を提供する
- `@hsblabs/http-cli`にも同じScopeを伝播させる

### Command

Commandはfactory実行後の操作値であり、次を持つ。

- `request: RequestDescriptor`
- `defaults?: Defaults`
- `parseData(response): Output | Promise<Output>`
- `parseError?(response): unknown | Promise<unknown>`

`defineCommand(config)`はdefault scope向けfactoryを返す。`defineCommand<Scope>()(config)`はservice scope付きfactoryを返す。

`defineJsonCommand`は成功responseに`response.json()`を適用し、任意の`transform`を通す。204、205、null body、明示的な`content-length: 0`は`undefined`として扱う。

### Client

`createClient<Scope>(config)`は不変な`Client<Scope>`を返す。

- `send(command, options?)`: request実行とdecode
- `with(...middleware)`: middlewareを追加した派生Client
- `withDefaults(defaults)`: defaultsをmergeした派生Client

Defaultsの優先順は次で固定する。

```text
client defaults < command defaults < send options
```

Header名はcase-insensitiveにmergeし、後勝ちとする。

## URL契約

既定の`resolveUrl(baseUrl, operationUrl)`は、`baseUrl`をWeb page相対URLではなくAPI prefixとして扱う。

- `https://api.example.com/v1` + `/users`は`https://api.example.com/v1/users`
- join境界のslashは正規化する
- absolute operation URLはbase URLを無視する
- `//host/path`はprotocol-relative operation URLとしてabsolute base URLのschemeを利用する
- 3本以上のleading slashはoperation pathとしてjoin時に正規化する
- base URLにqueryまたはfragmentを含めない
- operation URLに含まれるqueryとfragmentは保持する
- base URL未指定時はoperation URLをそのまま使う

SDK提供者は`ClientConfig.resolveUrl`で規則を差し替えられる。`RequestDescriptor.query`はresolverの戻り値へ後からmergeする。認証middlewareを使うSDKは、必要に応じてresolverで許可originを検証し、absolute URLによるcredential送信先の逸脱を防ぐ。Resolver failureはbody生成・dispatch前に`TRANSPORT`へ正規化し、元エラーを`cause`へ保持する。

## Query契約

`RequestDescriptor.query`は次を受け付ける。

- scalar: `string | number | boolean`
- array: 上記scalarのreadonly array
- `null | undefined`

Serialize規則は次で固定する。

- scalarは同名の既存値を置き換える
- arrayは既存値を削除し、non-null itemを同名keyとして繰り返す
- empty arrayは同名keyを削除する
- scalarのnullish値は追加せず、URLに既存値があれば保持する
- `URLSearchParams`のencoding規則を使う
- fragmentはquery追加後も保持する

## Path parameter契約

`RequestDescriptor.url`全体は自動encodeしない。slash、query delimiter、fragment delimiterまでencodeするとURL構造を壊すためである。

SDK側はdynamic path parameterごとに`encodePathSegment(value)`を適用する。このhelperはstrict RFC 3986 percent encodingを行う。

## Request bodyとretry契約

`RequestDescriptor`は`body`と`bodyFactory`を排他的に受け付ける。

- `body`: static body。Fetch `BodyInit`またはNode互換の`AsyncIterable<Uint8Array>`を受け付ける
- `bodyFactory`: attemptごとにbodyを生成する関数

`bodyFactory`には1始まりの`attempt`とcallerの`AbortSignal`を渡す。初回dispatch前と各retry前に呼び出す。

- factoryの通常失敗は`TRANSPORT`
- abort起因の失敗は`CANCELLED`
- staticなReadableStreamまたはasync iterable bodyは既定でretryしない
- custom `shouldRetry`を指定してもstatic streamはretryしない
- streamをretryする場合は`bodyFactory`を必須とする
- retry前に失敗response bodyをbest effortでcancelする

既定retry条件は次とする。

- idempotent method、または`Idempotency-Key`付きrequestだけを対象とする
- 429、5xx、transport errorを対象とする
- timeoutとcancelは対象外とする
- `Retry-After`を尊重する

## Responseとerror契約

成功responseは元の`Response`を`parseData`へ渡す。JSON、text、binary、streamのいずれもCommand側で選択できる。

non-2xx responseは`HttpCommandError`の`HTTP`としてthrowする。

- `parseError`の戻り値を`errorData`へ格納する
- raw response textを可能な限り`body`へ格納する
- `parseError`がthrowしてもHTTP errorを主エラーとして維持する
- decoder failureは`cause`へ格納する
- statusとheadersをnormalized response metadataとして保持する
- `parseError`には複製したResponseを渡し、完了後に未読の複製bodyをbest effortでcancelする
- `parseError`はresolve前にdecodeを完了し、生きたresponse body streamを戻り値として引き渡さない

`parseData`失敗は`PARSE`とする。decoderがresponse bodyを消費済みの場合、`body`は取得できないことがある。

共通error codeは次の5種類とする。

- `HTTP`
- `TRANSPORT`
- `PARSE`
- `TIMEOUT`
- `CANCELLED`

## Middleware契約

Middlewareは`(next: Handler) => Handler`である。配列先頭をrequest側の最外層とし、responseは逆順で戻る。

標準middlewareは次を提供する。

- `bearerAuth`
- `retry`
- `logger`
- `defineMiddleware`

Loggerはcredentialを誤って出力しないよう、既定eventにheaderを含めない。

## Handler契約

既定handlerは`globalThis.fetch`を使用する。`handler`注入により、unit test、mock transport、環境固有transportへ差し替えられる。

Node.jsでstream bodyを送る場合はFetch実装向けに`duplex: 'half'`を設定する。callerのcancelとtimeoutを区別して共通errorへ正規化する。

## Package要件

- ESM only
- Node.js 18以上
- browserのFetch APIを前提とする
- TypeScript declarationを配布する
- runtime dependencyなし
- `sideEffects: false`
- tsdownでbuildする
- vitestでunit/contract testを実行する

## Acceptance Criteria

- Service AのClientがService BのCommandを型エラーにする
- default scopeの既存利用が成立する
- base pathを保持したURL prefix joinが動作する
- custom URL resolverをclient factoryから注入できる
- query arrayがrepeated keyとしてserializeされる
- dynamic path segmentがstrictにencodeされる
- `parseData`と`parseError`が別々に実行される
- service error data、raw body、decoder failureを同時に診断できる
- `bodyFactory`が各attemptで再実行される
- static stream bodyをretryしない
- middleware、timeout、cancel、header mergeの既存契約を維持する
- README、PRD、ADR、Changeset、examplesが同じAPI名と意味論を参照する
- typecheck、test、build、README同期check、package dry-runをrelease前に通す

## 将来拡張

将来のOpenAPI code generatorは別packageとし、このCommand protocolを出力先として利用できる。coreへgenerator固有metadataを先回りして追加しない。必要な表現力が実際の生成事例で不足した場合に限り、RequestDescriptorを拡張する。
