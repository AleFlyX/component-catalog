# AI run analysis: budgeted-run1

- tokens: 145179 (uncached 5945, cache read 133760 [96%], output 5474)
- steps: 10, tool calls: 10, wall: 37398 ms
- breakdown: system 1406, tools 6902, messages 9814

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 3465 |
| write | 32 |
| send_message | 26 |

## Most expensive tool results

- #15 bash: 807 tokens
- #7 bash: 544 tokens
- #9 bash: 523 tokens
- #11 bash: 495 tokens
- #10 bash: 467 tokens

## CLI calls

- search: 5 calls, 9800 B, 5 truncated, 0 errors, 0 include-props
- get: 1 calls, 3193 B, 1 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2144 B, 2=3 calls/7065 B, 3=1 calls/1836 B, 4=1 calls/1948 B

## Timeline
- #0 user: 609 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 105 tokens
- #4 tool (bash): 38 tokens
- #5 tool (bash): 81 tokens
- #6 assistant: 266 tokens calls=bash
- #7 tool (bash): 544 tokens
- #8 assistant: 711 tokens calls=bash,bash,bash
- #9 tool (bash): 523 tokens
- #10 tool (bash): 467 tokens
- #11 tool (bash): 495 tokens
- #12 assistant: 714 tokens calls=bash
- #13 tool (bash): 462 tokens
- #14 assistant: 547 tokens calls=bash
- #15 tool (bash): 807 tokens
- #16 assistant: 833 tokens calls=bash
- #17 tool (bash): 32 tokens
- #18 assistant: 747 tokens calls=write
- #19 tool (write): 32 tokens
- #20 assistant: 66 tokens calls=bash
- #21 tool (bash): 16 tokens
- #22 assistant: 383 tokens calls=send_message
- #23 tool (send_message): 26 tokens
- #24 assistant: 881 tokens
