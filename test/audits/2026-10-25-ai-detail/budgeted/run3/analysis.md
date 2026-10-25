# AI run analysis: budgeted-run3

- tokens: 142799 (uncached 6135, cache read 130432 [96%], output 6232)
- steps: 9, tool calls: 10, wall: 43856 ms
- breakdown: system 1406, tools 6902, messages 10968

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 3857 |
| write | 32 |
| send_message | 26 |

## Most expensive tool results

- #5 bash: 592 tokens
- #13 bash: 546 tokens
- #7 bash: 544 tokens
- #8 bash: 523 tokens
- #11 bash: 467 tokens

## CLI calls

- search: 6 calls, 11282 B, 5 truncated, 0 errors, 0 include-props
- get: 1 calls, 846 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2144 B, 2=3 calls/4703 B, 3=1 calls/1836 B, 4=1 calls/1296 B, 5=1 calls/2149 B

## Timeline
- #0 user: 609 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 177 tokens
- #4 tool (bash): 106 tokens
- #5 tool (bash): 592 tokens
- #6 assistant: 279 tokens calls=bash,bash
- #7 tool (bash): 544 tokens
- #8 tool (bash): 523 tokens
- #9 assistant: 1492 tokens calls=bash,bash,bash
- #10 tool (bash): 458 tokens
- #11 tool (bash): 467 tokens
- #12 tool (bash): 332 tokens
- #13 tool (bash): 546 tokens
- #14 assistant: 1161 tokens calls=bash
- #15 tool (bash): 220 tokens
- #16 assistant: 888 tokens calls=bash
- #17 tool (bash): 42 tokens
- #18 assistant: 884 tokens calls=write
- #19 tool (write): 32 tokens
- #20 assistant: 54 tokens calls=bash
- #21 tool (bash): 27 tokens
- #22 assistant: 383 tokens calls=send_message
- #23 tool (send_message): 26 tokens
- #24 assistant: 697 tokens
