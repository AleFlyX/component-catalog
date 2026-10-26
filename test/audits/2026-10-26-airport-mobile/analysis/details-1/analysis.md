# AI run analysis: details-1

- tokens: 78024 (uncached 3883, cache read 69760 [95%], output 4381)
- steps: 6, tool calls: 1, wall: 25862 ms
- breakdown: system 1406, tools 6902, messages 7531

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2235 |
| write | 37 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 857 tokens
- #7 bash: 434 tokens
- #9 bash: 431 tokens
- #10 bash: 319 tokens
- #6 bash: 194 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, get 0, batch get 0)
- observed tool calls: 7; non-CLI: 2
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: send_message=1

## CLI calls

- search: 5 calls, 8772 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3394 B, 2=1 calls/741 B, 3=1 calls/1704 B, 4=1 calls/1690 B, 5=1 calls/1243 B

## Timeline
- #0 user: 479 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 156 tokens
- #4 tool (bash): 857 tokens
- #5 assistant: 338 tokens
- #6 tool (bash): 194 tokens
- #7 tool (bash): 434 tokens
- #8 assistant: 523 tokens
- #9 tool (bash): 431 tokens
- #10 tool (bash): 319 tokens
- #11 assistant: 1732 tokens
- #12 tool (write): 37 tokens
- #13 assistant: 609 tokens calls=send_message
- #14 tool (send_message): 26 tokens
- #15 assistant: 967 tokens
