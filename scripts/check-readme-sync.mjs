import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'packages/http-command/docs/README/sync.config.json');
const configDir = path.dirname(configPath);

function headingLine(content, index) {
  return content.slice(0, index).split('\n').length;
}

function extractLevel2Headings(content) {
  const headings = [];
  const pattern = /^##\s+(.+?)\s*$/gm;
  let match = pattern.exec(content);
  while (match) {
    headings.push({
      text: match[1],
      line: headingLine(content, match.index),
    });
    match = pattern.exec(content);
  }
  return headings;
}

function validateHeadingOrder(fileLabel, headings, expectedHeadings) {
  const errors = [];
  let cursor = -1;

  for (const expected of expectedHeadings) {
    const nextIndex = headings.findIndex((entry, index) => index > cursor && entry.text === expected);
    if (nextIndex === -1) {
      errors.push(`${fileLabel}: missing heading "## ${expected}"`);
      continue;
    }
    cursor = nextIndex;
  }

  return errors;
}

const config = JSON.parse(await readFile(configPath, 'utf8'));
const sourcePath = path.resolve(configDir, config.sourceFile);
const sourceContent = await readFile(sourcePath, 'utf8');
const sourceHeadings = extractLevel2Headings(sourceContent);

const expectedSourceHeadings = config.sections.map((section) => section.sourceHeading);
const errors = [
  ...validateHeadingOrder(path.relative(repoRoot, sourcePath), sourceHeadings, expectedSourceHeadings),
];

function validateForbiddenPatterns(fileLabel, content, patterns = []) {
  const violations = [];
  for (const source of patterns) {
    const pattern = new RegExp(source, 'm');
    if (pattern.test(content)) {
      violations.push(`${fileLabel}: forbidden legacy API pattern /${source}/`);
    }
  }
  return violations;
}

errors.push(
  ...validateForbiddenPatterns(
    path.relative(repoRoot, sourcePath),
    sourceContent,
    config.forbiddenPatterns,
  ),
);

for (const [locale, localeFile] of Object.entries(config.localeFiles)) {
  const localePath = path.resolve(configDir, localeFile);
  const localeContent = await readFile(localePath, 'utf8');
  const localeHeadings = extractLevel2Headings(localeContent);
  const expectedLocaleHeadings = config.sections.map((section) => {
    const localized = section.localizedHeadings?.[locale];
    if (!localized) {
      throw new Error(`sync.config.json is missing localizedHeadings.${locale} for section "${section.id}"`);
    }
    return localized;
  });

  errors.push(
    ...validateHeadingOrder(path.relative(repoRoot, localePath), localeHeadings, expectedLocaleHeadings),
    ...validateForbiddenPatterns(
      path.relative(repoRoot, localePath),
      localeContent,
      config.forbiddenPatterns,
    ),
  );
}

if (errors.length > 0) {
  console.error('README sync check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('README sync check passed.');
