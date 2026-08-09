# @hsblabs/http-command

`@hsblabs/http-command` ist eine kleine TypeScript-Runtime für Autoren typisierter HTTP-SDKs. Sie stellt Client-Factory, servicegebundenes Command-Protokoll, Middleware, Fetch-Handler und ein einheitliches Fehlermodell bereit. Endpunkte, Schemas und Authentifizierungsregeln bleiben im jeweiligen SDK.

[English](../../README.md) | [日本語](./ja.md) | [Français](./fr.md) | **Deutsch** | [简体中文](./zh-CN.md) | [繁體中文](./zh-TW.md)

## Funktionen

- Ausführung über `client.send(command)`
- Servicegrenzen mit `Client<Scope>` und `Command<Scope, Output>`
- Funktionsbasierte Command-Factorys
- API-Präfix-URL-Auflösung mit austauschbarem Resolver
- Skalare und wiederholte Query-Parameter
- Explizite Kodierung dynamischer Pfadsegmente
- Getrennte Decoder für Daten und Servicefehler
- Replay-sichere Request-Bodies und Retries
- Injizierbarer Handler für Tests
- Nur ESM, keine Runtime-Abhängigkeiten

## Installation

```bash
npm install @hsblabs/http-command
```

## Minimales Beispiel

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

Die Ziel-URL lautet `https://api.example.com/v1/users/u_1`, da der Basispfad als API-Präfix erhalten bleibt.

## Dienstspezifisch typisierte SDKs

Ein SDK deklariert einen privaten `unique symbol`-Typ und verwendet ihn für Client und Commands. Scoped Commands tragen eine reine Deklarationsmarke und werden über `defineCommand<Scope>()` oder `defineJsonCommand<Scope>()` statt als Objektliteral erzeugt.

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

Der Scope ist nur eine Compile-Time-Grenze. SDKs mit Zugangsdaten sollten zusätzlich die aufgelöste Origin prüfen, wenn absolute URLs erlaubt sind.

## URL-Auflösung und Pfadkodierung

Der Standardresolver behandelt den gesamten `baseUrl`-Pfad als API-Präfix. Er normalisiert Slash-Grenzen, behandelt `//host/path` als protokollrelative URL und drei oder mehr führende Slashes als Operationspfad. Absolute Operations-URLs umgehen den Basiswert; Query und Fragment sind im `baseUrl` verboten und werden aus der Operation erhalten. Über `ClientConfig.resolveUrl` kann das SDK diese Regel ersetzen; `RequestDescriptor.query` wird danach in dessen Ergebnis eingefügt. Wirft der Resolver einen Fehler, wird er als `TRANSPORT` normalisiert, in `error.cause` erhalten und weder ein Body erzeugt noch ein Request gesendet.

Query-Arrays werden als wiederholte Schlüssel serialisiert. Skalare ersetzen vorhandene Werte, ein leeres Array entfernt den Schlüssel, und skalare `null`-/`undefined`-Werte werden ausgelassen, ohne einen bereits in der URL vorhandenen Wert zu löschen. Die Kodierung folgt `URLSearchParams`.

Die vollständige `url` wird nicht automatisch kodiert. Dynamische Segmente müssen mit `encodePathSegment()` streng nach RFC 3986 kodiert werden.

## Antwortverarbeitung und Dienstfehler

`parseData` verarbeitet 2xx-Antworten. `parseError` verarbeitet optional non-2xx-Antworten. Bei HTTP-Fehlern steht der dekodierte Servicefehler in `error.errorData`, der Rohtext nach Möglichkeit in `error.body` und ein Decoderfehler in `error.cause`. Der HTTP-Fehler bleibt primär.

`parseData` erhält die ursprüngliche `Response` und kann JSON, Text, Binärdaten oder Streams liefern. Decoderfehler werden als `PARSE` normalisiert; der Body ist dann best effort.

`parseError` erhält eine geklonte Response und muss die Dekodierung vor dem Abschluss beenden. Danach bricht der Client einen ungelesenen geklonten Body nach bestem Bemühen ab. Geben Sie aus `parseError` keinen aktiven Response-Body-Stream zurück.

`defineJsonCommand` verwendet `response.json()`, unterstützt `transform` und liefert für 204, 205, null body oder `content-length: 0` den Wert `undefined`.

## Wiederholbare Request-Bodies

`RequestBody` akzeptiert Fetch-`BodyInit`-Werte sowie Node-kompatible `AsyncIterable<Uint8Array>`-Bodies. Eine Anfrage besitzt entweder `body` oder `bodyFactory`. Die Factory erhält `{ attempt, signal }` vor dem ersten Versand und vor jedem Retry. Normale Fehler werden `TRANSPORT`, Abbrüche `CANCELLED`.

Ein statischer Stream wird selbst bei einem benutzerdefinierten `shouldRetry: () => true` nicht erneut gesendet. Für Streams ist `bodyFactory` erforderlich. Standardmäßig werden idempotente Methoden beziehungsweise Requests mit `Idempotency-Key`, 429/5xx und Transportfehler wiederholt; `Retry-After` wird berücksichtigt.

## Middleware-Verwendung

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

Die erste Middleware ist auf Request-Seite die äußerste Schicht; Responses laufen in umgekehrter Reihenfolge zurück. Defaults werden nach `client < command < send options` zusammengeführt. Header-Namen werden ohne Beachtung der Groß-/Kleinschreibung behandelt.

## Benutzerdefinierte Middleware erstellen

Middleware hat die Form `(next: Handler) => Handler`. `defineMiddleware` stellt `before`, `after` und `onError` bereit.

```ts
const timing = defineMiddleware({
  before: (context) => ({
    ...context,
    meta: { ...context.meta, startedAt: Date.now() },
  }),
});
```

## API-Referenz

- `createClient<Scope>(config?)`
- `defineCommand(config)` und `defineCommand<Scope>()(config)`
- `defineJsonCommand(config)`
- `client.send(command, options?)`
- `client.with(...middleware)`
- `client.withDefaults(defaults)`
- `resolveUrl`, `appendQuery`, `encodePathSegment`
- `HttpCommandError`: `HTTP`, `TRANSPORT`, `PARSE`, `TIMEOUT`, `CANCELLED`

Für SDK- und Middleware-Autoren werden unter anderem `ClientConfig`, `CommandConfig`, `RequestDescriptor`, `RequestBody`, `Handler`, `Context`, `Middleware`, `UrlResolver` und `BodyFactory` exportiert.

## Entwicklung

```bash
pnpm install
pnpm run check
pnpm run pack:dry-run
```

```bash
npm run docs:check
```

## Lizenz

MIT
