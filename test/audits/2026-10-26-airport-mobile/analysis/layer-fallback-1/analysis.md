# AI run analysis: layer-fallback-1

- tokens: 108342 (uncached 4083, cache read 94336 [96%], output 9923)
- steps: 8, tool calls: 8, wall: 69801 ms
- breakdown: system 1406, tools 6902, messages 13883

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2641 |

## Most expensive tool results

- #6 bash: 861 tokens
- #18 bash: 553 tokens
- #12 bash: 445 tokens
- #10 bash: 338 tokens
- #8 bash: 198 tokens

## CLI vs non-CLI

- CLI calls: 7 (search 5, details 5, brief 0, layer 5, layer-fallback 5, get 2, batch get 0)
- observed tool calls: 8; non-CLI: 1
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=8

## CLI calls

- search: 5 calls, 8854 B, 0 truncated, 0 errors, 0 include-props
- get: 2 calls, 1317 B, 0 truncated, 1 errors, 0 include-props

By task: 1=1 calls/3412 B, 2=2 calls/2076 B, 3=1 calls/1745 B, 4=2 calls/759 B, 5=1 calls/2179 B

## Timeline
- #0 user: 540 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 444 tokens calls=bash
- #4 tool (bash): 16 tokens
- #5 assistant: 154 tokens calls=bash
- #6 tool (bash): 861 tokens
- #7 assistant: 201 tokens calls=bash
- #8 tool (bash): 198 tokens
- #9 assistant: 494 tokens calls=bash
- #10 tool (bash): 338 tokens
- #11 assistant: 287 tokens calls=bash
- #12 tool (bash): 445 tokens
- #13 assistant: 295 tokens calls=bash
- #14 tool (bash): 198 tokens
- #15 assistant: 4716 tokens calls=bash
- #16 tool (bash): 32 tokens
- #17 assistant: 3682 tokens calls=bash
- #18 tool (bash): 553 tokens
