# AI run analysis: details-u55-layer-1

- tokens: 92507 (uncached 4334, cache read 79360 [95%], output 8813)
- steps: 6, tool calls: 5, wall: 52889 ms
- breakdown: system 1406, tools 6902, messages 12348

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2449 |
| send_message | 26 |

## Most expensive tool results

- #6 bash: 861 tokens
- #11 bash: 553 tokens
- #9 bash: 439 tokens
- #10 bash: 300 tokens
- #8 bash: 198 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, layer 5, get 0, batch get 0)
- observed tool calls: 8; non-CLI: 3
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=4, send_message=1

## CLI calls

- search: 5 calls, 9239 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3412 B, 2=1 calls/759 B, 3=1 calls/1722 B, 4=1 calls/1167 B, 5=1 calls/2179 B

## Timeline
- #0 user: 489 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 1040 tokens
- #4 tool (bash): 11 tokens
- #5 assistant: 122 tokens calls=bash
- #6 tool (bash): 861 tokens
- #7 assistant: 494 tokens calls=bash,bash,bash
- #8 tool (bash): 198 tokens
- #9 tool (bash): 439 tokens
- #10 tool (bash): 300 tokens
- #11 tool (bash): 553 tokens
- #12 assistant: 5479 tokens
- #13 tool (bash): 87 tokens
- #14 assistant: 803 tokens calls=send_message
- #15 tool (send_message): 26 tokens
- #16 assistant: 1017 tokens
