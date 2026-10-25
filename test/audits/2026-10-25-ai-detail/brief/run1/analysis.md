# AI run analysis: brief-run1

- tokens: 189675 (uncached 7298, cache read 176640 [96%], output 5737)
- steps: 12, tool calls: 13, wall: 45037 ms
- breakdown: system 1406, tools 6902, messages 11065

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 4631 |
| write | 32 |
| send_message | 26 |

## Most expensive tool results

- #6 bash: 801 tokens
- #7 bash: 709 tokens
- #9 bash: 705 tokens
- #12 bash: 591 tokens
- #10 bash: 500 tokens

## CLI calls

- search: 4 calls, 10727 B, 0 truncated, 0 errors, 0 include-props
- get: 3 calls, 4379 B, 1 truncated, 0 errors, 0 include-props

By task: 1=2 calls/4323 B, 2=2 calls/4651 B, 3=2 calls/4165 B, 4=1 calls/1967 B

## Timeline
- #0 user: 564 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 71 tokens calls=bash
- #4 tool (bash): 116 tokens
- #5 assistant: 367 tokens calls=bash,bash
- #6 tool (bash): 801 tokens
- #7 tool (bash): 709 tokens
- #8 assistant: 539 tokens calls=bash,bash
- #9 tool (bash): 705 tokens
- #10 tool (bash): 500 tokens
- #11 assistant: 524 tokens calls=bash
- #12 tool (bash): 591 tokens
- #13 assistant: 470 tokens calls=bash
- #14 tool (bash): 470 tokens
- #15 assistant: 363 tokens calls=bash
- #16 tool (bash): 353 tokens
- #17 assistant: 431 tokens calls=bash
- #18 tool (bash): 297 tokens
- #19 assistant: 1047 tokens calls=bash
- #20 tool (bash): 33 tokens
- #21 assistant: 761 tokens calls=write
- #22 tool (write): 32 tokens
- #23 assistant: 76 tokens calls=bash
- #24 tool (bash): 56 tokens
- #25 assistant: 551 tokens calls=send_message
- #26 tool (send_message): 26 tokens
- #27 assistant: 183 tokens
