# AI run analysis: details-ui-2

- tokens: 151877 (uncached 6794, cache read 139520 [95%], output 5563)
- steps: 11, tool calls: 5, wall: 38332 ms
- breakdown: system 1406, tools 6902, messages 8888

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2839 |
| write | 36 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 857 tokens
- #14 bash: 548 tokens
- #10 bash: 434 tokens
- #12 bash: 431 tokens
- #8 bash: 338 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, get 1, batch get 0)
- observed tool calls: 10; non-CLI: 4
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=3, write=1, send_message=1

## CLI calls

- search: 5 calls, 9688 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1317 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3394 B, 2=2 calls/2058 B, 3=1 calls/1704 B, 4=1 calls/1690 B, 5=1 calls/2159 B

## Timeline
- #0 user: 463 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 136 tokens
- #4 tool (bash): 857 tokens
- #5 assistant: 140 tokens
- #6 tool (bash): 194 tokens
- #7 assistant: 639 tokens calls=bash
- #8 tool (bash): 338 tokens
- #9 assistant: 131 tokens
- #10 tool (bash): 434 tokens
- #11 assistant: 277 tokens
- #12 tool (bash): 431 tokens
- #13 assistant: 194 tokens
- #14 tool (bash): 548 tokens
- #15 assistant: 811 tokens calls=bash
- #16 tool (bash): 21 tokens
- #17 assistant: 1553 tokens calls=write
- #18 tool (write): 36 tokens
- #19 assistant: 91 tokens calls=bash
- #20 tool (bash): 16 tokens
- #21 assistant: 473 tokens calls=send_message
- #22 tool (send_message): 26 tokens
- #23 assistant: 650 tokens
