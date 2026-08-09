import { animechanClient } from './client.js';
import { getRandomQuote, listQuotes, type Quote } from './commands.js';

function printQuote(label: string, quote: Quote): void {
  console.log(label);
  console.log(`  "${quote.quote}"`);
  console.log(`   - ${quote.character} (${quote.anime})`);
}

async function main() {
  console.log('=== Animechan Example ===\n');

  const randomQuote = await animechanClient.send(getRandomQuote({}));
  printQuote('1. Random quote:', randomQuote);
  console.log();

  const narutoQuote = await animechanClient.send(getRandomQuote({ anime: 'Naruto' }));
  printQuote('2. Random quote from "Naruto":', narutoQuote);
  console.log();

  console.log('3. Quotes by character "Spike Spiegel":');
  const spikeQuotes = await animechanClient.send(listQuotes({ character: 'Spike Spiegel' }));
  if (spikeQuotes.length === 0) {
    console.log('  No quotes found.');
  } else {
    spikeQuotes.slice(0, 3).forEach((quote, index) => {
      console.log(`  ${index + 1}. "${quote.quote}" - ${quote.character} (${quote.anime})`);
    });
  }
  console.log();

  console.log('✓ All examples completed successfully!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
