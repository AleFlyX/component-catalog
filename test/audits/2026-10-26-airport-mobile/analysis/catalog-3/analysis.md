# AI run analysis: catalog-3

- tokens: 252127 (uncached 10146, cache read 231552 [96%], output 10429)
- steps: 13, tool calls: 16, wall: 63547 ms
- breakdown: system 1406, tools 6902, messages 18521

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 7331 |
| write | 35 |
| send_message | 26 |

## Most expensive tool results

- #5 bash: 2472 tokens
- #7 bash: 904 tokens
- #24 bash: 729 tokens
- #22 bash: 711 tokens
- #16 bash: 701 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 0, brief 0, get 1, batch get 1)
- observed tool calls: 16; non-CLI: 10
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=14, write=1, send_message=1

## CLI calls

- search: 5 calls, 6102 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 2810 B, 1 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2581 B, 2=2 calls/3381 B, 3=1 calls/1201 B, 4=1 calls/845 B, 5=1 calls/904 B

## Timeline
- #0 user: 491 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 390 tokens calls=bash,bash
- #4 tool (bash): 91 tokens
- #5 tool (bash): 2472 tokens
- #6 assistant: 149 tokens calls=bash,bash
- #7 tool (bash): 904 tokens
- #8 tool (bash): 98 tokens
- #9 assistant: 285 tokens calls=bash
- #10 tool (bash): 654 tokens
- #11 assistant: 215 tokens calls=bash
- #12 tool (bash): 151 tokens
- #13 assistant: 672 tokens calls=bash
- #14 tool (bash): 26 tokens
- #15 assistant: 97 tokens calls=bash
- #16 tool (bash): 701 tokens
- #17 assistant: 1218 tokens calls=bash,bash,bash
- #18 tool (bash): 309 tokens
- #19 tool (bash): 220 tokens
- #20 tool (bash): 234 tokens
- #21 assistant: 1280 tokens calls=bash
- #22 tool (bash): 711 tokens
- #23 assistant: 1591 tokens calls=bash
- #24 tool (bash): 729 tokens
- #25 assistant: 2546 tokens calls=write
- #26 tool (write): 35 tokens
- #27 assistant: 127 tokens calls=bash
- #28 tool (bash): 31 tokens
- #29 assistant: 843 tokens calls=send_message
- #30 tool (send_message): 26 tokens
- #31 assistant: 796 tokens
