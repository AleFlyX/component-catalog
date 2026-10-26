# AI run analysis: layer-self-2

- tokens: 125459 (uncached 5144, cache read 112000 [96%], output 8315)
- steps: 8, tool calls: 11, wall: 60370 ms
- breakdown: system 1406, tools 6902, messages 12217

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 3003 |
| write | 38 |
| send_message | 26 |

## Most expensive tool results

- #5 bash: 861 tokens
- #12 bash: 553 tokens
- #10 bash: 434 tokens
- #14 bash: 338 tokens
- #11 bash: 300 tokens

## CLI vs non-CLI

- CLI calls: 8 (search 6, details 6, brief 0, layer 5, layer-fallback 0, get 2, batch get 0)
- observed tool calls: 11; non-CLI: 3
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=9, write=1, send_message=1

## CLI calls

- search: 6 calls, 9440 B, 0 truncated, 0 errors, 0 include-props
- get: 2 calls, 2271 B, 1 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3412 B, 2=2 calls/2076 B, 3=3 calls/2877 B, 4=1 calls/1167 B, 5=1 calls/2179 B

## Timeline
- #0 user: 554 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 367 tokens calls=bash,bash
- #4 tool (bash): 9 tokens
- #5 tool (bash): 861 tokens
- #6 assistant: 341 tokens calls=bash,bash
- #7 tool (bash): 198 tokens
- #8 tool (bash): 63 tokens
- #9 assistant: 1353 tokens calls=bash,bash,bash
- #10 tool (bash): 434 tokens
- #11 tool (bash): 300 tokens
- #12 tool (bash): 553 tokens
- #13 assistant: 991 tokens calls=bash
- #14 tool (bash): 338 tokens
- #15 assistant: 851 tokens calls=bash
- #16 tool (bash): 247 tokens
- #17 assistant: 2443 tokens calls=write
- #18 tool (write): 38 tokens
- #19 assistant: 611 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 1210 tokens
