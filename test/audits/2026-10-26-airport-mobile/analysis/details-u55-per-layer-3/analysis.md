# AI run analysis: details-u55-per-layer-3

- tokens: 106558 (uncached 4857, cache read 94592 [95%], output 7109)
- steps: 7, tool calls: 8, wall: 41704 ms
- breakdown: system 1406, tools 6902, messages 10164

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2787 |
| write | 37 |
| send_message | 26 |

## Most expensive tool results

- #16 bash: 764 tokens
- #9 bash: 442 tokens
- #6 bash: 382 tokens
- #12 bash: 338 tokens
- #10 bash: 328 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, layer 0, layer-fallback 0, get 1, batch get 0)
- observed tool calls: 10; non-CLI: 4
- search truncated: 0; omitted by limit 0, by bytes 0
- tool calls by name: bash=6, write=1, send_message=1

## CLI calls

- search: 5 calls, 6508 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1317 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/1493 B, 2=2 calls/2092 B, 3=1 calls/1225 B, 4=1 calls/1736 B, 5=1 calls/1279 B

## Timeline
- #0 user: 467 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 771 tokens calls=bash
- #4 tool (bash): 16 tokens
- #5 assistant: 536 tokens calls=bash,bash,bash
- #6 tool (bash): 382 tokens
- #7 tool (bash): 202 tokens
- #8 tool (bash): 315 tokens
- #9 tool (bash): 442 tokens
- #10 tool (bash): 328 tokens
- #11 assistant: 1453 tokens calls=bash
- #12 tool (bash): 338 tokens
- #13 assistant: 2002 tokens calls=write
- #14 tool (write): 37 tokens
- #15 assistant: 42 tokens calls=bash
- #16 tool (bash): 764 tokens
- #17 assistant: 735 tokens calls=send_message
- #18 tool (send_message): 26 tokens
- #19 assistant: 879 tokens
