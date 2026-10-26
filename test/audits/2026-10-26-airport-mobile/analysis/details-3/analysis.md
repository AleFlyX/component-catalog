# AI run analysis: details-3

- tokens: 87723 (uncached 5633, cache read 78464 [93%], output 3626)
- steps: 6, tool calls: 2, wall: 23683 ms
- breakdown: system 1406, tools 6902, messages 8035

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 3673 |
| write | 37 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 857 tokens
- #5 bash: 747 tokens
- #8 bash: 696 tokens
- #6 bash: 692 tokens
- #7 bash: 661 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, get 0, batch get 0)
- observed tool calls: 9; non-CLI: 4
- search truncated: 0; omitted by limit 12, by bytes 0
- tool calls by name: write=1, bash=1

## CLI calls

- search: 5 calls, 14444 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3394 B, 2=1 calls/2956 B, 3=1 calls/2733 B, 4=1 calls/2612 B, 5=1 calls/2749 B

## Timeline
- #0 user: 479 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 573 tokens
- #4 tool (bash): 857 tokens
- #5 tool (bash): 747 tokens
- #6 tool (bash): 692 tokens
- #7 tool (bash): 661 tokens
- #8 tool (bash): 696 tokens
- #9 assistant: 335 tokens
- #10 tool (bash): 9 tokens
- #11 assistant: 1204 tokens calls=write
- #12 tool (write): 37 tokens
- #13 assistant: 62 tokens calls=bash
- #14 tool (bash): 11 tokens
- #15 assistant: 530 tokens
- #16 tool (send_message): 26 tokens
- #17 assistant: 687 tokens
