# AI run analysis: layer-auto-2

- tokens: 157337 (uncached 5967, cache read 141056 [96%], output 10314)
- steps: 10, tool calls: 8, wall: 69855 ms
- breakdown: system 1406, tools 6902, messages 15257

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2626 |
| read | 1163 |
| send_message | 26 |

## Most expensive tool results

- #18 read: 1163 tokens
- #4 bash: 867 tokens
- #12 bash: 558 tokens
- #8 bash: 444 tokens
- #14 bash: 338 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, layer 5, layer-fallback 0, get 1, batch get 0)
- observed tool calls: 9; non-CLI: 3
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=6, read=1, send_message=1

## CLI calls

- search: 5 calls, 8936 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1317 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3433 B, 2=2 calls/2097 B, 3=1 calls/1743 B, 4=1 calls/780 B, 5=1 calls/2200 B

## Timeline
- #0 user: 490 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 342 tokens
- #4 tool (bash): 867 tokens
- #5 assistant: 164 tokens calls=bash
- #6 tool (bash): 203 tokens
- #7 assistant: 461 tokens calls=bash
- #8 tool (bash): 444 tokens
- #9 assistant: 176 tokens calls=bash
- #10 tool (bash): 203 tokens
- #11 assistant: 866 tokens calls=bash
- #12 tool (bash): 558 tokens
- #13 assistant: 145 tokens calls=bash
- #14 tool (bash): 338 tokens
- #15 assistant: 5682 tokens calls=bash
- #16 tool (bash): 13 tokens
- #17 assistant: 95 tokens calls=read
- #18 tool (read): 1163 tokens
- #19 assistant: 1261 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 1331 tokens
