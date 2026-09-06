# Patch 2.74.36

## Mixed visual-wrap Auto Style consistency

Mixed input may fold a physical visual wrap back into one logical paragraph. A compact labelled mechanics row that was line-leading in another source can therefore appear inline after a completed sentence, for example `... one creature. Hit: ...`.

Auto Style now treats `Sentence. Label: prose` as the same presentation shape as a line-leading compact labelled row, with two safeguards:

- no vocabulary is consulted; the existing generic compact `Label:` surface proof is reused;
- when a paragraph begins with a feature title, the title terminator itself is excluded from the scan, so the first mechanics clause after `Name.` is not accidentally restyled (`Bite. Melee Weapon Attack: ...` remains unchanged apart from the feature title).

This is presentation-only. Parser ownership, source coordinates, mixed wrapping decisions, and multiline physical-row geometry are unchanged.
