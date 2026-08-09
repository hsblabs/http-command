import { defineCommand } from '@hsblabs/http-command';

export interface Quote {
  anime: string;
  character: string;
  quote: string;
}

export interface RandomQuoteInput {
  anime?: string;
  character?: string;
}

export interface ListQuotesInput {
  anime?: string;
  character?: string;
}

export const getRandomQuote = defineCommand<RandomQuoteInput, Quote>({
  build: (input) => ({
    method: 'GET',
    url: '/quotes/random',
    query: {
      anime: input.anime,
      character: input.character,
    },
  }),
  parseData: (response): Promise<Quote> => response.json(),
});

export const listQuotes = defineCommand<ListQuotesInput, Quote[]>({
  build: (input) => ({
    method: 'GET',
    url: '/quotes',
    query: {
      anime: input.anime,
      character: input.character,
    },
  }),
  parseData: (response): Promise<Quote[]> => response.json(),
});
