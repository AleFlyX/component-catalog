# AI run analysis: details-u55-2

- tokens: 151672 (uncached 4965, cache read 138880 [97%], output 7827)
- steps: 10, tool calls: 9, wall: 51128 ms
- breakdown: system 1406, tools 6902, messages 11471

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2487 |
| write | 36 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 857 tokens
- #12 bash: 548 tokens
- #8 bash: 434 tokens
- #10 bash: 431 tokens
- #6 bash: 194 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, get 0, batch get 0)
- observed tool calls: 9; non-CLI: 4
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=7, write=1, send_message=1

## CLI calls

- search: 5 calls, 9688 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3394 B, 2=1 calls/741 B, 3=1 calls/1704 B, 4=1 calls/1690 B, 5=1 calls/2159 B

## Timeline
- #0 user: 544 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 493 tokens calls=bash
- #4 tool (bash): 857 tokens
- #5 assistant: 163 tokens calls=bash
- #6 tool (bash): 194 tokens
- #7 assistant: 785 tokens calls=bash
- #8 tool (bash): 434 tokens
- #9 assistant: 889 tokens calls=bash
- #10 tool (bash): 431 tokens
- #11 assistant: 156 tokens calls=bash
- #12 tool (bash): 548 tokens
- #13 assistant: 2272 tokens calls=bash
- #14 tool (bash): 9 tokens
- #15 assistant: 1159 tokens calls=write
- #16 tool (write): 36 tokens
- #17 assistant: 114 tokens calls=bash
- #18 tool (bash): 14 tokens
- #19 assistant: 848 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 1070 tokens
