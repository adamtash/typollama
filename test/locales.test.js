import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const localesDirectory = new URL("../_locales/", import.meta.url);
const requiredKeys = [
  "extensionName",
  "extensionDescription",
  "contextMenuSpellcheck",
  "contextMenuProofread",
  "contextMenuCustom"
];

function readMessages(locale) {
  return JSON.parse(readFileSync(new URL(`${locale}/messages.json`, localesDirectory), "utf8"));
}

test("every locale supplies the complete v2 message catalog", () => {
  const locales = readdirSync(localesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.equal(locales.length, 30, "keep the supported locale set intentional");

  for (const locale of locales) {
    const messages = readMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), requiredKeys.slice().sort(), `${locale} has an out-of-date message catalog`);

    for (const key of requiredKeys) {
      assert.equal(typeof messages[key].message, "string", `${locale}.${key} must have a message`);
      assert.ok(messages[key].message.trim(), `${locale}.${key} must not be blank`);
      assert.equal(typeof messages[key].description, "string", `${locale}.${key} must describe its message`);
    }
  }
});

test("all runtime i18n references exist in the English source catalog", () => {
  const source = readFileSync(join(new URL("..", import.meta.url).pathname, "background.js"), "utf8");
  const englishMessages = readMessages("en");
  const referencedKeys = [
    ...source.matchAll(/\["typollama-[^"]+", "([^"]+)"/g)
  ].map((match) => match[1]);

  assert.deepEqual(referencedKeys.sort(), [
    "contextMenuCustom",
    "contextMenuProofread",
    "contextMenuSpellcheck"
  ]);
  for (const key of referencedKeys) {
    assert.ok(englishMessages[key], `background.js references missing i18n key ${key}`);
  }
});
