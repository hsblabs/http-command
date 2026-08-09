import { defineCommand, encodePathSegment } from '@hsblabs/http-command';

import type { PokeAPIScope } from './scope.js';

const definePokeAPICommand = defineCommand<PokeAPIScope>();

// Types for PokeAPI responses
export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number;
  sprites: {
    front_default: string | null;
    back_default: string | null;
  };
  types: Array<{
    slot: number;
    type: {
      name: string;
      url: string;
    };
  }>;
  abilities: Array<{
    ability: {
      name: string;
      url: string;
    };
    is_hidden: boolean;
    slot: number;
  }>;
}

export interface PokemonListItem {
  name: string;
  url: string;
}

export interface PokemonList {
  count: number;
  next: string | null;
  previous: string | null;
  results: PokemonListItem[];
}

// Input types
export interface GetPokemonInput {
  nameOrId: string | number;
}

export interface ListPokemonInput {
  limit?: number;
  offset?: number;
}

// Command factories using defineCommand for type-safe API calls
export const getPokemon = definePokeAPICommand({
  build: (input: GetPokemonInput) => ({
    method: 'GET',
    url: `/pokemon/${encodePathSegment(input.nameOrId)}`,
  }),
  parseData: (response): Promise<Pokemon> => response.json(),
  parseError: async (response) => ({ message: await response.text() }),
});

export const listPokemon = definePokeAPICommand({
  build: (input: ListPokemonInput) => ({
    method: 'GET',
    url: '/pokemon',
    query: {
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
    },
  }),
  parseData: (response): Promise<PokemonList> => response.json(),
  parseError: async (response) => ({ message: await response.text() }),
});
