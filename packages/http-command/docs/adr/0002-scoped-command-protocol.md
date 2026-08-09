---
status: accepted
date: 2026-08-09
model: GPT-5.6 Pro
---

# ADR 0002: Scoped Command Protocol and HTTP Semantics

## Context

`@hsblabs/http-command`の中心用途を、汎用fetch wrapperではなく「サービス提供者が型付きTypeScript SDKを実装するためのruntime」として明確化する。

従来の`Command<Output>`では、異なるサービスのCommandを別サービスのClientへ送る誤りを型で検出できなかった。また、`baseUrl`とoperation pathの結合、query array、dynamic path、service error response、stream bodyのretryについて公開契約が不足していた。

## Decision

### Service scope

- 公開型を`Client<Scope>`と`Command<Scope, Output>`にする
- Scope付き`Command`はrequiredなinvariant phantom brandを持ち、`Client`は受け入れるCommand型を通じてinvariantにする
- SDKごとにprivateな`unique symbol`型を宣言する
- `defineCommand<Scope>()`と`defineJsonCommand<Scope>()`でscope付きfactoryを定義する
- Scope不要時は`DefaultScope`を既定値として維持する
- `@hsblabs/http-cli`のClient factoryとCLI Commandにも同じScopeを伝播させる

Scopeはcompile-time boundaryであり、runtimeの認証・認可を提供しない。

### URL resolution

既定の`resolveUrl`は`baseUrl`をAPI prefixとして扱う。

- base path全体を保持してoperation pathを結合する
- join境界のslashを正規化する
- absolute operation URLはbase URLを迂回する
- `//host/path`はprotocol-relative operation URLとしてabsolute base URLのschemeを利用する
- 3本以上のleading slashはoperation pathとしてjoin時に正規化する
- base URLのqueryとfragmentは禁止する
- operation URLのqueryとfragmentは保持する
- base URL未指定時はoperation URLを変更しない

SDK提供者は`ClientConfig.resolveUrl`で規則を差し替えられる。`RequestDescriptor.query`はresolverの戻り値へ後からmergeする。Credentialを付与するSDKがabsolute URLを許容する場合は、custom resolverで許可originを検証する。Resolver failureはbody生成・dispatch前に`TRANSPORT`へ正規化し、元エラーを`cause`へ保持する。

### Query and path parameters

- Query scalarは`string | number | boolean`
- Readonly arrayは同名keyの繰り返しとしてserializeする
- Arrayは同名の既存値を置換し、empty arrayは削除を意味する
- Scalarの`null | undefined`は追加せず、既存URL値を保持する
- Encodingは`URLSearchParams`に従う
- `RequestDescriptor.url`全体は自動encodeしない
- Dynamic path parameterには`encodePathSegment`を使い、strict RFC 3986 encodingを適用する

### Request body replay

- `body`と`bodyFactory`は型上排他的にする
- `bodyFactory`は初回dispatch前と各retry前に実行する
- Factoryへ1始まりの`attempt`とcallerの`AbortSignal`を渡す
- 通常のfactory失敗は`TRANSPORT`、abort起因は`CANCELLED`にする
- Static stream-like bodyはcustom `shouldRetry`の結果にかかわらずretryしない
- Streamをretryする場合は`bodyFactory`を必須とする

### Response decoding

- 成功decoderの名前を`parseData`とする
- Non-2xx用に任意の`parseError`を追加する
- `parseData`には元の成功`Response`を渡し、streamingを妨げない
- `parseError`には複製したerror `Response`を渡し、完了後に未読の複製bodyをbest effortでcancelする
- `parseError`の戻り値を`HttpCommandError.errorData`へ格納する
- Raw error bodyを可能な限り`HttpCommandError.body`へ格納する
- `parseError`が失敗してもHTTP errorを主エラーとして維持し、decoder failureを`cause`へ格納する
- `defineJsonCommand`の既存`transform`は維持する
- 204、205、null body、明示的な`content-length: 0`をempty successとして扱う

### Compatibility and release policy

本protocolを初回`0.1.0`の公開契約とする。公開前のprototypeに対するmigrationや互換layerは提供しない。README、翻訳README、PRD、ADR、examples、testsを同じ契約へ同期する。

今後のbreaking changeは次を必要とする。

- ADRまたは既存ADRのsupersede
- Changeset
- Compile-time contract test
- Runtime contract test
- 全READMEの同期

## Consequences

### Positive

- SDK間のCommand取り違えを型チェックで検出できる
- SDK factoryがURL policyを所有できる
- Service固有errorを共通HTTP errorの診断情報として保持できる
- Query、path、body replayのcode generation規則を固定できる
- Streaming responseとsafe retryを両立できる

### Costs

- 既存Command定義は`parse`から`parseData`へ移行する必要がある
- Service SDKはscope typeとscoped definerを定義する必要がある
- Stream retryにはbody factoryが必要になる
- Scopeはruntime securityではないため、origin policyは別途必要になる
- `parseError`は完了後に複製bodyを閉じるため、生きたresponse body streamを戻り値として引き渡せない

## Rejected Alternatives

### Standard `new URL(operation, base)` semantics only

Leading slash付きoperationがbase pathを破棄し、OpenAPI由来の`/users`とAPI prefixの組み合わせで誤送信しやすいため採用しない。必要なSDKはcustom resolverで選択できる。

### Parse all responses in one decoder

Successとservice errorの型・責務が混ざり、共通HTTP error normalizationが曖昧になるため採用しない。

### Retry a static stream when custom policy requests it

一度消費されたbodyを安全に再送できず、silent data lossの可能性があるため採用しない。明示的な`bodyFactory`を要求する。
