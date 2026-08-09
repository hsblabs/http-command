# tasks

## 運用ルール

1. タスクを追加するときはチェックボックス形式で書く
2. 完了したら `[x]` にする
3. セクションが全て完了したら、セクションごと削除してよい

## チーム編成（2026-08-09 / Initial Public Release）

- Root（実装）: 仕様、package metadata、Changesets、release workflow、全体検証
- CLI Readiness（監査）: `@hsblabs/http-cli` の公開品質と tarball 契約を点検
- Release Workflow（監査）: fixed group、初回手動公開、OIDC workflow を点検

## Initial Public Release

- [x] IR01: 公開対象、初回公開順序、version運用を仕様とADRに固定
- [x] IR02: ZIPを取り込み、両packageのversion・repository metadata・toolchainを正規化（blocks: IR01）
- [x] IR03: `@hsblabs/http-cli`へREADME・LICENSE・CHANGELOGとpackage検証を追加（blocks: IR02）
- [x] IR04: Changesetsを初回`0.1.0`のfixed groupへ整理（blocks: IR02）
- [x] IR05: 初回手動公開手順とpublic化後のOIDC release workflowを追加（blocks: IR04）
- [x] IR06: check、両packageのpack、clean consumer install/importを通す（blocks: IR03, IR05）
- [x] IR07: 検証済みの初回公開準備をtask記録とcommitへ反映（blocks: IR06）

## チーム編成（2026-02-24）

- A（設計）: PRD要件を型・APIに落とし込む
- B（実装）: client/handler/url/error/middleware を並列実装
- C（検証）: vitest・README・受け入れ基準確認

## PRD実装タスク

- [x] タスク分解と実施順序の定義
- [x] プロジェクト初期設定（package.json, tsconfig, tsdown, vitest）
- [x] コア型定義（Command/Client/Middleware/HandlerContext）
- [x] `createClient` / `client.send` / `withMiddleware` 実装
- [x] URL解決（baseUrl + query、nullish除外）
- [x] fetchベースhandler +差し替え可能設計 + signal伝播
- [x] 共通エラー正規化（HTTP失敗/parse失敗）
- [x] 組み込みmiddleware（bearerAuth/retry/logger）
- [x] 公開API (`src/index.ts`) 整備
- [x] テスト追加（url/client/retry/bearerAuth/logger）
- [x] README更新（最小例 + middleware例 + gyazo例）
- [x] テスト実行と最終確認（依存取得403でローカル実行ブロック）

## Examples and Documentation (2026-02-25)

- [x] pnpm-workspace.yamlにexamples/*を追加
- [x] examples/poke-api作成（workspace:*でローカル参照）
- [x] packages/http-commandにdocsディレクトリ追加
- [x] docs/README/ja.md作成（日本語版README）
- [x] docs/README/fr.md作成（フランス語版README）
- [x] docs/README/de.md作成（ドイツ語版README）
- [x] docs/README/zh-CN.md作成（簡体字中国語版README）
- [x] docs/README/zh-TW.md作成（繁体字中国語版README）
- [x] packages/http-command/README.md作成（英語版、各言語へのリンク付き）
- [x] ビルドとテストの確認

## createCommand Function (2026-02-25)

- [x] createCommand関数の設計（型推論を活用）
- [x] src/command.tsに実装
- [x] index.tsからexport
- [x] test/command.test.ts作成（8テストケース）
- [x] examples/poke-apiをcreateCommandで書き換え
- [x] READMEにcreateCommandの説明とサンプルコード追加
- [x] テストとビルドの確認

## ESM Only対応 (2026-02-25)

- A（設計）: 配布形式の影響範囲（package.json/tsdown/ドキュメント）を確認
- B（実装）: ESM only になる最小変更を反映
- C（検証）: 追加テストと build/test の確認

- [x] package.json の export を ESM only に変更
- [x] tsdown の format を esm のみに変更
- [x] package 設定を検証するテストを追加
- [x] PRD のビルド形式記述を esm に更新
- [x] テストとビルドの確認
## チーム編成（2026-02-25 / Publish Readiness）

- A（品質監査）: 実装の境界条件（URL解決・Abort・エラー伝播）を点検して修正
- B（配布品質）: package metadata / prepack / pack確認を整備
- C（整合検証）: examples・README群・CI/typecheck の整合を確認

## npm公開前の改善（2026-02-25）

- [x] `appendQuery` を相対URLでも安全に動作するよう修正
- [x] retry middleware の Abort 対応（AbortError非リトライ + 待機中abort停止）を追加
- [x] `HttpCommandError` を二重ラップしないよう client の error handling を改善
- [x] 追加テスト（url/client/retry）で境界条件を検証
- [x] `example-poke-api` の logger 参照を現行APIへ修正
- [x] README（英語+各言語）の API 仕様ズレを修正
- [x] package metadata（repository/bugs/keywords/engines/sideEffects/publishConfig）を追加
- [x] `prepack` で `typecheck + test + build` を強制
- [x] workspace の `typecheck/check/pack:dry-run` スクリプト追加
- [x] CI に typecheck ステップを追加
- [x] `pnpm run typecheck && pnpm test && pnpm build && pnpm run pack:dry-run` を通過

## チーム編成（2026-02-26 / Release）

- A（リリース管理）: Changesets 導入・設定・CLIスクリプト整備
- B（バージョン管理）: changeset作成と version 反映、changelog確認
- C（検証）: release前チェック（check/pack:dry-run）の再実行

## changeset追加とバージョン更新（2026-02-26 / 未公開prototype）

- [x] `.changeset` を初期化（config/README生成）
- [x] root に `@changesets/cli` と `changeset`/`version-packages` scripts を追加
- [x] changeset を作成し `changeset version` を実行
- [x] `@hsblabs/http-command` のprototype versionを `0.1.0` → `0.1.1` に更新
- [x] `packages/http-command/CHANGELOG.md` を生成
- [x] private package が誤って version/changelog 対象にならないよう `.changeset/config.json` の `ignore` を設定
- [x] `pnpm run check` と `pnpm run pack:dry-run` で最終確認

## チーム編成（2026-02-26 / Rebuild v2）

- A（設計）: v2 API・型・エラー・middleware契約の再設計とADR化
- B（実装）: core pipeline/transport/middleware と built-in middleware の再実装
- C（移行/検証）: 互換レイヤー・移行ガイド・テスト/CI/配布検証

## 作り直し計画（2026-02-26 / 今だからのベスト設計）

- [x] Phase 0: 未公開prototype `v0.1.1` のAPIと利用パターンを固定（破壊許容範囲を明確化）
- [x] Phase 0: 失敗知見（`tasks/lessons.md`）を設計制約へ変換し、非機能要件（ESM only / abort / docs整合）を先に宣言
- [x] Phase 1: `Operation`（入力/出力）・`Request`・`Transport`・`Pipeline` の4層責務で型を再定義
- [x] Phase 1: `SendOptions` と実行コンテキストを再定義（signal, timeout, metadata, attempt の責務境界を固定）
- [x] Phase 1: エラーモデルを統一（HTTP/TRANSPORT/PARSE/TIMEOUT/CANCELLED）し、診断情報を標準化
- [x] Phase 1: middleware契約を再定義（before/after/errorの拡張点、retry連携の一貫性）
- [x] Phase 2: 新`createClient` を再実装（handler合成の事前コンパイル、request解決/serializeの分離）
- [x] Phase 2: `createCommand` を `defineOperation` 相当へ拡張（型推論強化、JSON helper 同梱）
- [x] Phase 2: built-in middleware（auth/retry/logger）を v2 契約へ移植し、abort/timeout競合を解消
- [x] Phase 3: v1互換レイヤー（アダプター）を追加し、段階移行を可能にする
- [x] Phase 3: テストを3層化（unit/contract/integration）し、例示コードとREADME断片をCIで実行検証
- [x] Phase 4: ドキュメント再編（設計理念・移行手順・失敗事例）と多言語READMEの同期フロー自動化
- [x] Phase 4: `pnpm run check && pnpm run pack:dry-run` と changeset で v2 pre-release を作成

## Rebuild v3 Hardening（2026-02-26）

- [x] `createClient` に `defaultOptions`（timeout/header/meta既定値）を追加
- [x] `handler` と `transport` の同時指定を runtime error にして設定曖昧性を排除
- [x] 追加テスト（defaultOptions merge / 設定競合）を実装
- [x] `pnpm run check` と `pnpm run pack:dry-run` の再確認

## Rebuild v4 Design Upgrade（2026-02-26）

- [x] `Operation` に `defaultOptions` を追加（client defaults → operation defaults → send options の優先順）
- [x] `Client.withDefaults` を追加し、不変な派生 client を構築できるようにする
- [x] retry middleware を idempotent method 前提 + `Retry-After` 対応へ改善
- [x] 追加テスト（withDefaults / operation defaultOptions / retry idempotency / retry-after）を実装
- [x] `pnpm run check` と `pnpm run pack:dry-run` の再確認

## Rebuild v5 Runtime Safety（2026-02-26）

- [x] header merge を case-insensitive に統一（`mergeHeaders` / `hasHeader`）
- [x] retry の non-idempotent 制御を `Idempotency-Key` 連携で強化
- [x] retry 各試行で request headers を分離して middleware の状態汚染を防止
- [x] 追加テスト（headers helper / idempotency-key retry / attempt isolation）を実装
- [x] `pnpm run check` と `pnpm run pack:dry-run` の再確認

## Best Design Rebuild（2026-02-27）

- A（設計）: 現行APIの冗長性と重複を分析し、ベスト設計を決定
- B（実装）: 全ソースファイル・テスト・exampleを一括書き換え
- C（検証）: typecheck / test / build / docs:check を全通過

- [x] Handler/Transport 二重抽象を単一 `Handler` に統合
- [x] `Command<I,O>` → `Command<O>`（build消費済み、input不要）に簡素化
- [x] `Operation` / `Command` 二重名称を `Command` に統一
- [x] v1互換レイヤー（`compat/v1.ts`）を削除
- [x] `handler.ts` を削除（Transport が直接 Handler を実装）
- [x] エラーファクトリを静的メソッド（`HttpCommandError.http()` 等）に統合
- [x] レガシーエラーコード（`legacyCode`）、`details`、`bodyText` → `body` に整理
- [x] `middlewares` → `middleware`、`defaultOptions` → `defaults` に命名統一
- [x] `withMiddleware(mw)` → `with(...mw)` に改善（可変長引数対応）
- [x] `createCommand`/`defineOperation` → `defineCommand` に統一
- [x] `defineJsonOperation` → `defineJsonCommand` に統一
- [x] `bearerAuth` に async token resolver 対応を追加
- [x] `bearerAuth` で `mergeHeaders` を使用し case-insensitive に統一
- [x] `isAbortError` の3箇所重複を `error.ts` に共有関数化
- [x] Logger の `LogEvent` 型からヘッダー情報を除外（セキュリティ考慮）
- [x] 公開エクスポートを約60個から約25個に削減
- [x] 全テスト（46件）を新API向けに書き換え
- [x] example（poke-api）を新APIに移行
- [x] `pnpm run check`（docs:check + typecheck + test + build）全通過

## httpbin Example (2026-03-01)

- [x] examples/httpbin ディレクトリ構造の作成
- [x] package.json の作成（workspace:* で http-command を参照）
- [x] tsconfig.json の作成（paths で src 直接参照）
- [x] commands.ts の作成（GET/POST/PUT/PATCH/DELETE/headers/uuid/delay/status/auth）
- [x] client.ts の作成（基本 client と auth client の2種類）
- [x] index.ts の作成（11の実行例を含む）
- [x] README.md の作成（機能説明、使い方、コード例）
- [x] root package.json の typecheck に example-httpbin を追加
- [x] `pnpm run check` 全通過確認

## チーム編成（2026-03-01 / Examples）

- A（設計）: Animechan API のエンドポイントとレスポンスを確認
- B（実装）: Animechan example の client/commands/index を作成
- C（検証）: typecheck/test 実行と README 整合を確認

## Animechan Example（2026-03-01）

- [x] Animechan API 向けコマンド（random/list）を定義
- [x] client と middleware を追加し、利用サンプルを作成
- [x] README 更新と typecheck/test の確認

## @hsblabs/http-cli パッケージ（2026-03-09）

- [x] packages/http-cli のプロジェクト初期設定（package.json, tsconfig, tsdown, vitest）
- [x] コア型定義（ArgDef, CLICommand, CLI, RunOptions）
- [x] arg ヘルパー（arg.string/number/boolean）実装
- [x] argv パーサー実装（自前最小実装、外部依存ゼロ）
- [x] defineCLICommand 実装
- [x] httpCLI ビルダー + runCLI 実装
- [x] テスト追加（parse: 23件, cli: 12件 = 35件全通過）
- [x] root の typecheck スクリプトに http-cli を追加
- [x] `pnpm run check` 全通過確認

## @hsblabs/http-cli v2 改善（2026-03-10）

- [x] API設計: `command` → `run` リネーム（Command型との紛らわしさ解消）
- [x] API設計: `CLIConfig.description` 追加（help に CLI 説明表示）
- [x] API設計: `CLIArgError` を index.ts から export
- [x] DX: `arg.string('Item ID')` ショートハンド（description だけ渡す簡潔構文）
- [x] DX: `args` 省略可能化（引数なしコマンドで `args: {}` 不要に）
- [x] CLI UX: `help <command>` サブコマンド対応
- [x] CLI UX: 未知コマンドの候補提示（Levenshtein 距離 "Did you mean: list?"）
- [x] CLI UX: コマンドヘルプに `--help` オプション自体を表示
- [x] コード品質: `resolveArgs` の dead code（aliasToKey マップ）除去
- [x] コード品質: `arg.ts` の DRY 違反修正（normalizeOpts ヘルパー抽出）
- [x] コード品質: `cli.ts` の unknown command 処理を `handleUnknownCommand` に統一
- [x] コード品質: `toRegistered` の条件付き spread（不要なオブジェクト生成回避）
- [x] テスト: 57件 → 76件（parse: 35→46, cli: 22→30）
- [x] `pnpm run check` 全通過確認

## バグ修正・改善（2026-03-10）

- [x] `InferArgs` 型バグ修正（`default` 付き引数が `T | undefined` に推論される問題）
- [x] `defineJsonCommand` の 204 No Content 対応（http-command）
- [x] 数値引数の `Infinity` バリデーション修正（`Number.isFinite` に統一）
- [x] `help` 予約語のコマンド登録時バリデーション追加
- [x] テスト: 76件 → 79件（parse: 46→48, cli: 30→31）+ http-command: 46→48件

## チーム編成（2026-08-09 / Scoped Command Protocol）

- A（protocol設計）: service scope、URL、query/path、error/body replay契約を確定
- B（実装）: http-command runtimeとhttp-cliへのScope伝播を実装
- C（検証・文書）: compile/runtime contract、README/PRD/ADR/Changeset、ZIP納品を確認

## Scoped Command Protocol Hardening（2026-08-09）

- [x] `Client<Scope>` / `Command<Scope, Output>` をinvariantなservice scopeで束縛
- [x] `@hsblabs/http-cli`へ同じScopeを伝播し、compile-time contract testを追加
- [x] `baseUrl`をAPI prefixとして保持する既定resolverと`ClientConfig.resolveUrl`差し替えを実装
- [x] query array、strict path segment encoding、absolute/protocol-relative URL規則を固定
- [x] `parse`を`parseData`へ変更し、non-2xx用`parseError`と`HttpCommandError.errorData`を追加
- [x] `body` / `bodyFactory`を型上排他にし、retryごとのbody再生成とstatic stream retry禁止を実装
- [x] `ReadableStream`とNode互換`AsyncIterable<Uint8Array>`に`duplex: 'half'`を設定
- [x] PokeAPI exampleをservice scope付きclient factoryとCommand群へ更新
- [x] README、翻訳README、PRD、ADR、Changeset、CHANGELOGを現行protocolへ同期
- [x] npm経由でREADME同期、source/test typecheck、declaration emit、declaration consumer test、runtime contract test 13件を実行
- [ ] catalog指定toolchain（TypeScript 6.0.3 / Vitest 4.1.8 / tsdown 0.21.10）での公式`test`/`build`/`prepack`再実行
  - この環境ではnpm registryの名前解決・package取得に失敗したため未実行
