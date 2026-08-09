# @hsblabs/http-command

`@hsblabs/http-command` est un petit runtime TypeScript destiné aux auteurs de SDK HTTP typés. Il fournit une fabrique de clients, un protocole de commandes avec portée de service, des middlewares, un handler Fetch et un modèle d’erreur commun. Les endpoints, schémas et règles d’authentification restent dans le SDK du service.

[English](../../README.md) | [日本語](./ja.md) | **Français** | [Deutsch](./de.md) | [简体中文](./zh-CN.md) | [繁體中文](./zh-TW.md)

## Caractéristiques

- Modèle d’exécution `client.send(command)`
- Séparation des services avec `Client<Scope>` et `Command<Scope, Output>`
- Fabriques de commandes fonctionnelles
- Résolution d’URL conservant le préfixe API, remplaçable par le SDK
- Paramètres de requête scalaires ou répétés
- Encodage explicite des segments de chemin dynamiques
- Décodeurs distincts pour les données et les erreurs du service
- Corps rejouables et retry sûr
- Handler injectable pour les tests
- ESM uniquement, sans dépendance runtime

## Installation

```bash
npm install @hsblabs/http-command
```

## Exemple minimal

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

L’URL finale est `https://api.example.com/v1/users/u_1` car le chemin de base est conservé comme préfixe API.

## SDK délimités par service

Chaque SDK peut déclarer un type privé `unique symbol` et l’utiliser pour son client et ses commandes. Les commandes avec portée portent une marque de type déclarative et doivent être créées via `defineCommand<Scope>()` ou `defineJsonCommand<Scope>()`, pas comme littéraux d’objet.

```ts
import {
  createClient,
  defineCommand,
  type Client,
} from '@hsblabs/http-command';

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

La portée est une frontière de typage, pas une autorisation runtime. Un SDK qui ajoute des identifiants doit aussi contrôler l’origine résolue si les URL absolues sont acceptées.

## Résolution d’URL et encodage des chemins

Le resolver par défaut conserve tout le chemin de `baseUrl` comme préfixe. Il normalise les slashs de jonction, laisse passer une URL d’opération absolue, traite `//host/path` comme une URL relative au protocole et considère trois slashs initiaux ou plus comme un chemin d’opération. Il refuse query et fragment dans `baseUrl` et préserve ceux de l’opération. `ClientConfig.resolveUrl` permet de remplacer cette politique; `RequestDescriptor.query` est ensuite fusionné dans son résultat. Si le resolver lève une exception, elle est normalisée en `TRANSPORT`, conservée dans `error.cause`, et aucun body n’est créé ni envoyé.

Les tableaux de query deviennent des clés répétées. Les scalaires remplacent une valeur existante. Un tableau vide supprime la clé. Les valeurs scalaires `null` et `undefined` sont omises sans supprimer une valeur déjà présente dans l’URL. La sérialisation suit `URLSearchParams`.

Le champ `url` complet n’est pas encodé automatiquement. Utilisez `encodePathSegment()` pour chaque paramètre dynamique; il applique un encodage strict RFC 3986.

## Analyse des réponses et erreurs de service

`parseData` décode les réponses 2xx. `parseError`, s’il est défini, décode les réponses non-2xx. Une erreur HTTP expose la valeur décodée dans `error.errorData`, le texte brut dans `error.body` lorsque disponible, et une éventuelle erreur du décodeur dans `error.cause`. L’erreur HTTP reste l’erreur principale.

`parseData` reçoit la `Response` originale et peut retourner JSON, texte, binaire ou flux. Une exception devient une erreur `PARSE`; le body de diagnostic est alors best effort.

`parseError` reçoit une copie de la réponse et doit terminer le décodage avant de se résoudre. Ensuite, le client annule au mieux tout body copié non lu. Ne retournez pas un flux de body encore actif depuis `parseError`.

`defineJsonCommand` appelle `response.json()`, accepte `transform`, et renvoie `undefined` pour 204, 205, un body nul ou `content-length: 0`.

## Corps de requête rejouables

`RequestBody` accepte les valeurs Fetch `BodyInit` ainsi que les corps Node compatibles `AsyncIterable<Uint8Array>`. Une requête définit soit `body`, soit `bodyFactory`. La factory reçoit `{ attempt, signal }` avant le premier envoi puis avant chaque retry. Une erreur normale devient `TRANSPORT`; une interruption devient `CANCELLED`.

Un flux statique n’est jamais retenté, même si un `shouldRetry` personnalisé renvoie `true`. Utilisez `bodyFactory` pour recréer un flux. Par défaut, le retry vise les méthodes idempotentes ou les requêtes avec `Idempotency-Key`, les réponses 429/5xx et les erreurs de transport; il respecte `Retry-After`.

## Utilisation des middlewares

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

Le premier middleware est la couche externe de la requête; les réponses reviennent dans l’ordre inverse. Les valeurs par défaut sont fusionnées selon `client < commande < options send`. Les headers sont fusionnés sans tenir compte de la casse.

## Créer un middleware personnalisé

Un middleware a la forme `(next: Handler) => Handler`. `defineMiddleware` fournit les hooks `before`, `after` et `onError`.

```ts
const timing = defineMiddleware({
  before: (context) => ({
    ...context,
    meta: { ...context.meta, startedAt: Date.now() },
  }),
});
```

## Référence API

- `createClient<Scope>(config?)`
- `defineCommand(config)` et `defineCommand<Scope>()(config)`
- `defineJsonCommand(config)`
- `client.send(command, options?)`
- `client.with(...middleware)`
- `client.withDefaults(defaults)`
- `resolveUrl`, `appendQuery`, `encodePathSegment`
- `HttpCommandError` avec `HTTP`, `TRANSPORT`, `PARSE`, `TIMEOUT`, `CANCELLED`

Les types d’extension `ClientConfig`, `CommandConfig`, `RequestDescriptor`, `RequestBody`, `Handler`, `Context`, `Middleware`, `UrlResolver` et `BodyFactory` sont exportés.

## Développement

```bash
pnpm install
pnpm run check
pnpm run pack:dry-run
```

```bash
npm run docs:check
```

## Licence

MIT
