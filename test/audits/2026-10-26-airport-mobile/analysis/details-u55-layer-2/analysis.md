# AI run analysis: details-u55-layer-2

- tokens: 115763 (uncached 4743, cache read 106240 [96%], output 4780)
- steps: 9, tool calls: 7, wall: 29598 ms
- breakdown: system 1406, tools 6902, messages 8376

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2699 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 861 tokens
- #12 bash: 553 tokens
- #8 bash: 439 tokens
- #14 bash: 338 tokens
- #10 bash: 300 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, layer 5, get 1, batch get 0)
- observed tool calls: 8; non-CLI: 2
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=6, send_message=1

## CLI calls

- search: 5 calls, 9239 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1317 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3412 B, 2=2 calls/2076 B, 3=1 calls/1722 B, 4=1 calls/1167 B, 5=1 calls/2179 B

## Timeline
- #0 user: 489 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 157 tokens
- #4 tool (bash): 861 tokens
- #5 assistant: 133 tokens calls=bash
- #6 tool (bash): 198 tokens
- #7 assistant: 297 tokens calls=bash
- #8 tool (bash): 439 tokens
- #9 assistant: 114 tokens calls=bash
- #10 tool (bash): 300 tokens
- #11 assistant: 110 tokens calls=bash
- #12 tool (bash): 553 tokens
- #13 assistant: 232 tokens calls=bash
- #14 tool (bash): 338 tokens
- #15 assistant: 1248 tokens calls=bash
- #16 tool (bash): 10 tokens
- #17 assistant: 1291 tokens calls=send_message
- #18 tool (send_message): 26 tokens
- #19 assistant: 1151 tokens
