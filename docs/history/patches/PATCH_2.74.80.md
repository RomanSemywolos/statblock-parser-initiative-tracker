# 2.74.80

Test-contract cleanup after enforcing the multiline physical-line invariant.

- Updated the end-to-end candidate-transport regression fixture so its Bite feature is physically one line.
- The old fixture placed a continuation sentence on a second non-empty physical line while still expecting multiline to merge both lines into one feature; under the routing contract that source shape is mixed, not multiline.
- No production parser behavior changed from 2.74.79.
