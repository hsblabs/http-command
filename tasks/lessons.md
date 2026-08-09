# Lessons - 過去の失敗と学び

## 記録ルール

- バグを解決したら、ここにパターンと対策を追記する
- 設計上の判断ミスや整合性の注意点も記録する
- 同じ失敗を繰り返さないための知見をまとめる

## 2026-02-25

- `tsdown@^0.8.5` はnpmに存在しなかった（0.8.1が最大）。`^0.20.3` に更新して解決。
- `Headers.entries()` が `@types/node` の型と衝突し tsc エラー。`forEach` に書き換えて解決。
- tsdown のビルド出力ファイル名（`.mjs`/`.d.mts`）が package.json の `module`/`types` と不一致だった。exports フィールドを追加して正しいファイル名を参照するよう修正。
- `vitest@2.1.8` にRCE脆弱性あり。`^2.1.9` に更新。
- ESM only 化では `tsdown` の format を `esm` のみにし、package.json から `require` 条件と `.cjs/.d.cts` 参照を削除する必要がある。
- `appendQuery` で `new URL(url)` を直接使うと相対URLが壊れる。relative/absolute を文字列分解で扱う実装にして回避。
- examples は build/test 対象外だと README のサンプルズレを見逃す。workspace 全体で `typecheck` を必須化し CI でも実行する。
- retry は abort を通常エラーと同列に扱うと不要な再試行が発生する。AbortError 判定と待機中 abort 伝播を入れて停止性を担保する。
- middleware/event 型の変更時は、多言語 README と examples のコード断片を一括検索で追従する（`rg` で `event.method` などを監査）。
- changesets を monorepo に導入すると private example package まで version/changelog が付与されることがある。`ignore` 設定で公開対象パッケージを明示する。
- `changeset` CLI は非対話環境で `/dev/tty` warning を出すが、`version` の更新自体は継続されるため結果ファイルを確認して判断する。

## 2026-02-26

- Abort 判定を `error.name === 'AbortError'` だけに頼ると、`AbortSignal.reason` が通常 `Error` のケースを取りこぼす。`signal.aborted` 状態も併用して分類する。
- timeout と user cancel はどちらも abort 系例外として現れるため、transport 層で `timedOut` フラグを保持して `TIMEOUT` と `CANCELLED` を明確に分岐する。
- 多言語 README は本文差分で管理すると更新漏れが起きやすい。見出し同期を `sync.config.json` + 自動チェック（`pnpm run docs:check`）で CI に組み込むとドキュメント整合が維持しやすい。
- pre-release changeset は `changeset pre enter <tag>` 後に `changeset version` を実行すると `pre.json` と package version/changelog が更新される。`check` と `pack:dry-run` で配布前に必ず検証する。
- client 設定で `handler` と `transport` を両方受けると優先順が暗黙になって事故る。明示的にエラーにして設定競合を早期検知する。
- timeout/header/meta の既定値は client 毎に持たせると再利用性が上がる。`send` ごとの差分は shallow merge（request優先）で統一する。
- default options は client 全体だけだと operation 単位の最適化がしづらい。`operation.defaultOptions` を挟み、優先順を `client < operation < send` に固定すると予測可能になる。
- retry を全HTTPメソッドで同一挙動にすると POST 等で副作用リスクがある。既定は idempotent method 限定にし、必要時のみ `shouldRetry`/`isRetryableMethod` で拡張する。
- `429 Retry-After` を無視すると API 制限環境で失敗率が上がる。retry delay 計算に header を取り込み、`maxDelayMs` で上限を掛けるのが安全。
- header merge を単純オブジェクト結合にすると `Authorization` と `authorization` が重複しうる。case-insensitive merge を共通関数化して衝突を1箇所で解決する。
- retry で同一 request オブジェクトを再利用すると、middleware の破壊的変更が次試行へ漏れる。attempt ごとに request/headers を複製して隔離する。

## 2026-02-27

- Handler と Transport の二重抽象は、中間変換が増えるだけで利点がない。middleware が直接 Handler を wrap する単一パイプラインが最もシンプル。
- `Command<I, O>` で `input` と `build` を保持すると、利用側が `command.build(command.input)` を呼ぶ冗長な設計になる。factory で build を消費し `Command<O>` にすると、command は `{ request, parse }` だけになり責務が明確化する。
- Operation と Command のような同一型の別名は混乱の元。pre-1.0 なら互換レイヤーを作るより一本化する方がコードベースが健全に保たれる。
- エラーファクトリ関数を個別 export するとインポート量が増える。`HttpCommandError.http()` のような静的メソッドにすると1つの import で全ファクトリにアクセスできる。
- Logger のイベントにヘッダー情報を含めると `Authorization` 等の機密がログに漏れるリスクがある。デフォルトでは method/url/status のみにし、ヘッダーが必要な場合はカスタム middleware で対応する。
- `bearerAuth` が `mergeHeaders` を使わず直接スプレッドしていると、既存の `Authorization` と `authorization` が二重に残る場合がある。middleware でも `mergeHeaders` を統一使用する。
- `isAbortError` のような共通ユーティリティが3箇所に散在していた。エラー分類関連は `error.ts` に集約する。
- `bearerAuth` は sync token のみ対応だったが、OAuth refresh token のような非同期取得が現実には必要。`string | (() => string | Promise<string>)` に拡張しておくと実用性が上がる。

## 2026-03-01

- monorepo の workspace で example が `workspace:*` で本体パッケージを参照していると、TypeScript が build 済み成果物（`dist/index.d.mts`）を探すが、CI で typecheck → build の順だと失敗する。example の `tsconfig.json` に `paths` を追加してソースファイル（`../../packages/http-command/src/index.ts`）を直接参照させることで、build 前に typecheck が可能になる。TypeScript 6では`baseUrl`が非推奨エラーになるため追加しない。

## 2026-03-10

- CLI フレームワークの `CLICommandDef` で `command` というフィールド名を使うと、http-command の `Command` 型と紛らわしい。`run` の方が「このCLIコマンドが呼ばれたら何を実行するか」が明確。
- `arg.string({ description: '...' })` のような単一目的の呼び出しが頻出する場合、`arg.string('...')` のショートハンドを提供すると DX が大幅に向上する。内部で `normalizeOpts` ヘルパーを共通化すれば DRY も保てる。
- 未知コマンドのエラーメッセージに Levenshtein 距離ベースの候補提示を入れると UX が格段に改善する。ただし CLI はエラーパスでしか使わないため、アルゴリズムの最適化より可読性を優先してよい。
- `toRegistered` のような型変換関数でオブジェクトを spread する場合、変換が不要なケース（`args` が既に存在する）は条件分岐で元オブジェクトを返すと不要なアロケーションを回避できる。

## 2026-03-09

- workspace 内の別パッケージ（http-cli）から http-command を参照する場合、tsconfig の `paths` だけでは Vitest (Vite) のランタイム解決に効かない。`vitest.config.ts` の `resolve.alias` にも同じマッピングを追加する必要がある。
- `InferArgs` で `T[K]['default'] extends D` のようにオプショナルプロパティを直接チェックすると、`D | undefined extends D` になり常に false。代わりに `T[K] extends { default: D }` で構造的にチェックし、arg ヘルパーの返り値型を `ArgDef<T> & O` にして `default` の有無を型レベルで保持する。
- `Number.isNaN()` だけでは `Number('Infinity')` を弾けない。CLI の数値引数には `Number.isFinite()` を使うのが正解（NaN と Infinity を同時に排除）。
- `defineJsonCommand` は `response.json()` を無条件に呼ぶため、204 No Content で SyntaxError が発生する。`status === 204` または `content-length: 0` の場合は `undefined` を返す早期リターンが必要。
- CLI フレームワークで `help` のような予約コマンド名は、登録時に即座にエラーにしないとユーザーが気づかないまま上書きされる。

## 2026-02-24

- 依存インストール時に npm registry へのアクセスが 403 で失敗し、`vitest`/`tsdown` が実行不能だった。
- 対策: 実装・テストコードは先行して追加し、CI/ネットワーク許可環境で `pnpm install && pnpm test && pnpm build` を再実行する。

## 2026-08-09

- npm libraryの公開監査はproduction依存だけでは足りない。OIDC release jobがinstallして実行するdevelopment/release依存も供給網に含まれるため、`pnpm audit --audit-level=high`をrelease gateへ組み込む。
- GitHub Actionsのmajor tagは可変参照であり、特に`changesets/action@v1`はbranchである。公開前にfull commit SHAへ固定し、検査scriptとrepository settingのSHA pin要求で退行を防ぐ。
- Abort対応のfetch test doubleはlistener追加だけでは不十分で、callerが同一tickでabortすると登録前にeventを取り逃す。`signal.aborted`を先に判定して即時rejectし、その後listenerを登録する。
- TypeScript 6では`baseUrl`が非推奨エラーになる。`paths`のtargetはtsconfig所在を基準に解決できるため、不要な`baseUrl`を削除する。
- Changesets 2はworkspaceのpackage managerをpublishに使う。pnpm 11はpublishをnpm CLIへ委譲しないため、npm trusted publishingをChangesets経由で使う間はOIDC対応npmへ委譲するpnpm 10を固定する。
- SDKごとのCommand混在を防ぐには、Scope付き`Command<Scope, Output>`へrequiredなinvariant phantom brandを持たせる。`Client<Scope>`はそのCommandを`send`引数に取ることでinvariantになり、Client自体をprivate brandで閉じずにmock可能性を維持できる。Default scopeだけはinline Commandとの互換性を残す。
- 標準`new URL('/users', 'https://api.example.com/v1')`はbase pathを破棄する。API SDK向け既定値ではbase pathをprefixとして結合し、RFC相対解決やorigin制約が必要なSDKは`resolveUrl`を注入できるようにする。
- Protocol-relative URL判定を単純な`startsWith('//')`にすると`///users`をhostとして誤解釈する。Authorityが始まる形だけをprotocol-relativeとして扱い、3本以上のslashはoperation pathとして正規化する。
- Non-2xx responseでraw bodyとservice error dataを両方残すには`Response.clone()`が必要。`parseError`は完了後に複製bodyをbest effortでcancelし、生きたbody streamを戻り値として引き渡さない契約にするとresource ownershipが明確になる。
- Retry可能性はHTTP methodだけでなくrequest bodyの再生可能性でも判定する。Staticな`ReadableStream`や`AsyncIterable`はcustom retry policyでも再送せず、attemptごとに新しいbodyを返す`bodyFactory`を要求する。
- Node.js Fetchへstreaming request bodyを渡す場合は`duplex: 'half'`が必要。DOMの`BodyInit`だけではNodeのasync iterable bodyを型付けできないため、公開`RequestBody`型で明示する。
- 多言語READMEの見出し同期だけでは古いAPI名の残存を検出できない。見出し順に加えてlegacy API patternの禁止チェックを実行し、コード断片はtypecheck対象へ含める。
- npm registryへ接続できない環境では、利用可能なTypeScriptでsource/test型検査とdeclaration emitを行い、Node標準test runnerで主要runtime contractを補完できる。ただしVitest・tsdown・catalog指定TypeScriptの公式検証と同一扱いにしない。
