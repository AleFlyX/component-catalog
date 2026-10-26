# AI run analysis: layer-self-3

- tokens: 151639 (uncached 3346, cache read 138112 [98%], output 10181)
- steps: 8, tool calls: 10, wall: 159059 ms
- breakdown: system 1406, tools 6902, messages 13959

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2982 |
| write | 38 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 861 tokens
- #8 bash: 553 tokens
- #10 bash: 439 tokens
- #13 bash: 338 tokens
- #11 bash: 300 tokens

## CLI vs non-CLI

- CLI calls: 8 (search 7, details 7, brief 0, layer 7, layer-fallback 0, get 1, batch get 0)
- observed tool calls: 12; non-CLI: 4
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=8, write=1, send_message=1

## CLI calls

- search: 7 calls, 10217 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1317 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3412 B, 2=2 calls/2076 B, 3=2 calls/1941 B, 4=2 calls/1926 B, 5=1 calls/2179 B

## Timeline
- #0 user: 554 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 1600 tokens calls=bash,bash,bash
- #4 tool (bash): 861 tokens
- #5 tool (bash): 198 tokens
- #6 tool (bash): 63 tokens
- #7 tool (bash): 198 tokens
- #8 tool (bash): 553 tokens
- #9 assistant: 3071 tokens calls=bash,bash
- #10 tool (bash): 439 tokens
- #11 tool (bash): 300 tokens
- #12 assistant: 854 tokens calls=bash
- #13 tool (bash): 338 tokens
- #14 assistant: 1228 tokens calls=bash
- #15 tool (bash): 22 tokens
- #16 assistant: 1141 tokens calls=write
- #17 tool (write): 38 tokens
- #18 assistant: 109 tokens calls=bash
- #19 tool (bash): 10 tokens
- #20 assistant: 799 tokens calls=send_message
- #21 tool (send_message): 26 tokens
- #22 assistant: 1128 tokens
