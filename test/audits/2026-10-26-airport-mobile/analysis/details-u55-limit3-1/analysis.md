# AI run analysis: details-u55-limit3-1

- tokens: 155699 (uncached 4512, cache read 141312 [97%], output 9875)
- steps: 10, tool calls: 8, wall: 60784 ms
- breakdown: system 1406, tools 6902, messages 13323

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2383 |
| write | 36 |
| send_message | 26 |

## Most expensive tool results

- #6 bash: 540 tokens
- #14 bash: 435 tokens
- #10 bash: 434 tokens
- #12 bash: 431 tokens
- #16 bash: 338 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, get 1, batch get 0)
- observed tool calls: 9; non-CLI: 3
- search truncated: 0; omitted by limit 4, by bytes 0
- tool calls by name: bash=6, write=1, send_message=1

## CLI calls

- search: 5 calls, 7969 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1317 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2126 B, 2=2 calls/2058 B, 3=1 calls/1704 B, 4=1 calls/1690 B, 5=1 calls/1708 B

## Timeline
- #0 user: 446 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 2027 tokens
- #4 tool (bash): 11 tokens
- #5 assistant: 129 tokens calls=bash
- #6 tool (bash): 540 tokens
- #7 assistant: 167 tokens calls=bash
- #8 tool (bash): 194 tokens
- #9 assistant: 1220 tokens calls=bash
- #10 tool (bash): 434 tokens
- #11 assistant: 164 tokens calls=bash
- #12 tool (bash): 431 tokens
- #13 assistant: 167 tokens calls=bash
- #14 tool (bash): 435 tokens
- #15 assistant: 333 tokens calls=bash
- #16 tool (bash): 338 tokens
- #17 assistant: 3119 tokens calls=write
- #18 tool (write): 36 tokens
- #19 assistant: 1519 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 1158 tokens
