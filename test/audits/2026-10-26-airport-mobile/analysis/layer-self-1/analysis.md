# AI run analysis: layer-self-1

- tokens: 130391 (uncached 6652, cache read 117248 [95%], output 6491)
- steps: 8, tool calls: 10, wall: 41334 ms
- breakdown: system 1406, tools 6902, messages 11285

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 4419 |
| write | 38 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 857 tokens
- #8 bash: 695 tokens
- #13 bash: 670 tokens
- #12 bash: 631 tokens
- #7 bash: 492 tokens

## CLI vs non-CLI

- CLI calls: 8 (search 5, details 5, brief 0, layer 4, layer-fallback 0, get 3, batch get 0)
- observed tool calls: 12; non-CLI: 4
- search truncated: 0; omitted by limit 12, by bytes 0
- tool calls by name: bash=8, write=1, send_message=1

## CLI calls

- search: 5 calls, 13208 B, 0 truncated, 0 errors, 0 include-props
- get: 3 calls, 3474 B, 1 truncated, 0 errors, 0 include-props

By task: 1=2 calls/4574 B, 2=2 calls/3250 B, 3=2 calls/3723 B, 4=1 calls/2490 B, 5=1 calls/2645 B

## Timeline
- #0 user: 554 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 136 tokens
- #4 tool (bash): 857 tokens
- #5 assistant: 749 tokens calls=bash,bash,bash
- #6 tool (bash): 303 tokens
- #7 tool (bash): 492 tokens
- #8 tool (bash): 695 tokens
- #9 assistant: 888 tokens calls=bash,bash,bash
- #10 tool (bash): 338 tokens
- #11 tool (bash): 253 tokens
- #12 tool (bash): 631 tokens
- #13 tool (bash): 670 tokens
- #14 assistant: 1512 tokens calls=bash
- #15 tool (bash): 57 tokens
- #16 assistant: 1158 tokens calls=write
- #17 tool (write): 38 tokens
- #18 assistant: 164 tokens calls=bash
- #19 tool (bash): 123 tokens
- #20 assistant: 647 tokens calls=send_message
- #21 tool (send_message): 26 tokens
- #22 assistant: 565 tokens
