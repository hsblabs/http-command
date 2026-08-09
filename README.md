# http-command

`@hsblabs/http-command` は、TypeScript SDK提供者向けのHTTP実行ランタイムです。client factory、型付きCommand protocol、middleware、Fetch transport、共通エラー契約を提供し、API固有のendpoint・型・認証方針は各SDK側に残します。

## 利用モデル

```text
@hsblabs/http-command
  └─ Client / Command protocol / middleware / transport / error

poke-api-ts-sdkなどのサービスSDK
  └─ createServiceClient / service commands / service types

SDK利用アプリケーション
  └─ client.send(command)
```

## 最小例

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

サービスSDKでは`Client<Scope>`と`Command<Scope, Output>`を同じ`unique symbol`型で束縛し、別サービスのCommandを誤ったClientへ送れないようにします。既定のURL解決は`baseUrl`のpathをAPI prefixとして保持し、SDK提供者は`resolveUrl`で独自ポリシーへ差し替えられます。

詳しい公開契約、query・path・body replay・error decodingの仕様は[`packages/http-command/README.md`](./packages/http-command/README.md)を参照してください。

## Workspace

- `packages/http-command`: SDK authoring runtime
- `packages/http-cli`: 同じCommand protocolをCLIへ接続する補助パッケージ
- `examples`: `http-command`の利用例

## 開発

```bash
pnpm install
pnpm run check
pnpm run release:check
```

README同期チェックのみであればnpmでも実行できます。

```bash
npm run docs:check
```

## リリース

`@hsblabs/http-command`と`@hsblabs/http-cli`はChangesetsのfixed groupとして同じversionで公開します。初回手動公開と、その後のOIDC自動公開の手順は[`docs/releases/initial-release.md`](./docs/releases/initial-release.md)を参照してください。
