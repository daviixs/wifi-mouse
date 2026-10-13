const MAX_COMMAND_BYTES = 1024;

export type TextEdit = { backspaces: number; insertedText: string };

export function diffKeyboardText(previous: string, next: string): TextEdit {
  const previousCharacters = Array.from(previous);
  const nextCharacters = Array.from(next);
  let commonPrefixLength = 0;

  while (
    commonPrefixLength < previousCharacters.length &&
    commonPrefixLength < nextCharacters.length &&
    previousCharacters[commonPrefixLength] === nextCharacters[commonPrefixLength]
  ) {
    commonPrefixLength += 1;
  }

  return {
    backspaces: previousCharacters.length - commonPrefixLength,
    insertedText: nextCharacters.slice(commonPrefixLength).join(''),
  };
}

function utf8ByteLength(text: string): number {
  let byteLength = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) byteLength += 1;
    else if (codePoint <= 0x7ff) byteLength += 2;
    else if (codePoint <= 0xffff) byteLength += 3;
    else byteLength += 4;
  }
  return byteLength;
}

function escapedCharacterByteLength(character: string): number {
  const escaped = JSON.stringify(character).slice(1, -1);
  return utf8ByteLength(escaped);
}

export function splitKeyboardText(text: string, maxCommandBytes = MAX_COMMAND_BYTES): string[] {
  const emptyCommand = JSON.stringify({
    version: 1,
    type: 'keyboard.text',
    payload: { text: '' },
  });
  const maxTextBytes = maxCommandBytes - utf8ByteLength(emptyCommand);
  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;

  for (const character of text) {
    const characterBytes = escapedCharacterByteLength(character);
    if (chunk && chunkBytes + characterBytes > maxTextBytes) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }

  if (chunk) chunks.push(chunk);
  return chunks;
}
