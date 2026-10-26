# AI run analysis: details-ui-1

- tokens: 86966 (uncached 4341, cache read 77824 [95%], output 4801)
- steps: 6, tool calls: 6, wall: 28013 ms
- breakdown: system 1406, tools 6902, messages 7458

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2495 |
| write | 36 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 857 tokens
- #8 bash: 548 tokens
- #6 bash: 434 tokens
- #7 bash: 431 tokens
- #5 bash: 194 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, get 0, batch get 0)
- observed tool calls: 9; non-CLI: 4
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=4, write=1, send_message=1

## CLI calls

- search: 5 calls, 9688 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3394 B, 2=1 calls/741 B, 3=1 calls/1704 B, 4=1 calls/1690 B, 5=1 calls/2159 B

## Timeline
- #0 user: 463 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 940 tokens calls=bash,bash,bash
- #4 tool (bash): 857 tokens
- #5 tool (bash): 194 tokens
- #6 tool (bash): 434 tokens
- #7 tool (bash): 431 tokens
- #8 tool (bash): 548 tokens
- #9 assistant: 892 tokens
- #10 tool (bash): 15 tokens
- #11 assistant: 786 tokens calls=write
- #12 tool (write): 36 tokens
- #13 assistant: 142 tokens calls=bash
- #14 tool (bash): 16 tokens
- #15 assistant: 449 tokens calls=send_message
- #16 tool (send_message): 26 tokens
- #17 assistant: 800 tokens
