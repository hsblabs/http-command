import { logger, retry } from '@hsblabs/http-command';

import { createPokeAPIClient } from './client.js';
import { getPokemon, listPokemon } from './commands.js';

const client = createPokeAPIClient({
  middleware: [
    retry({ maxAttempts: 3 }),
    logger((event) => {
      if (event.phase === 'response') {
        console.log(
          `[PokeAPI] ${event.method} ${event.url} - ${event.status} (${event.durationMs}ms)`,
        );
      }
    }),
  ],
});

async function main() {
  console.log('=== PokeAPI Example ===\n');

  console.log('1. Getting Pikachu...');
  const pikachu = await client.send(
    getPokemon({ nameOrId: 'pikachu' }),
  );
  console.log(`  Name: ${pikachu.name}`);
  console.log(`  ID: ${pikachu.id}`);
  console.log(`  Height: ${pikachu.height}`);
  console.log(`  Weight: ${pikachu.weight}`);
  console.log(
    `  Types: ${pikachu.types.map((type) => type.type.name).join(', ')}`,
  );
  console.log();

  console.log('2. Getting Pokemon #25...');
  const pokemon25 = await client.send(getPokemon({ nameOrId: 25 }));
  console.log(`  Name: ${pokemon25.name}`);
  console.log(
    `  Abilities: ${pokemon25.abilities.map((ability) => ability.ability.name).join(', ')}`,
  );
  console.log();

  console.log('3. Listing first 5 Pokemon...');
  const list = await client.send(listPokemon({ limit: 5, offset: 0 }));
  console.log(`  Total Pokemon: ${list.count}`);
  console.log('  First 5:');
  list.results.forEach((pokemon, index) => {
    console.log(`    ${index + 1}. ${pokemon.name}`);
  });
  console.log();

  console.log('✓ All examples completed successfully!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
