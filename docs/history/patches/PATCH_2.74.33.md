# Patch 2.74.33

- Auto Style now recognizes a title-shaped feature when copied text loses only the whitespace after its punctuation terminator (for example `Fling.The ...`). The source text is not rewritten.
- The fallback is presentation-only and surface-based: it requires the compact prefix itself to pass the existing title-shape test and the following character to be uppercase.
- Added regression coverage proving that an independently compiled `Hit:` paragraph is already italicized by current Auto Style. No extra `Hit` special case was added because the formatter path itself is not the cause of a fresh-import failure.
