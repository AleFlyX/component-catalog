# AI run analysis: final-run2

- tokens: 162184 (uncached 7769, cache read 145408 [95%], output 9007)
- steps: 9, tool calls: 11, wall: 57719 ms
- breakdown: system 1406, tools 6902, messages 16324

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 6105 |
| write | 32 |
| send_message | 26 |

## Most expensive tool results

- #6 bash: 2248 tokens
- #8 bash: 845 tokens
- #9 bash: 785 tokens
- #11 bash: 717 tokens
- #13 bash: 643 tokens

## CLI calls

- search: 5 calls, 13123 B, 4 truncated, 0 errors, 0 include-props
- get: 1 calls, 1146 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3348 B, 2=2 calls/4252 B, 3=1 calls/2833 B, 4=1 calls/1296 B, 5=1 calls/2540 B

## Timeline
- #0 user: 551 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 279 tokens calls=bash
- #4 tool (bash): 39 tokens
- #5 assistant: 672 tokens calls=bash
- #6 tool (bash): 2248 tokens
- #7 assistant: 866 tokens calls=bash,bash
- #8 tool (bash): 845 tokens
- #9 tool (bash): 785 tokens
- #10 assistant: 1735 tokens calls=bash,bash,bash
- #11 tool (bash): 717 tokens
- #12 tool (bash): 332 tokens
- #13 tool (bash): 643 tokens
- #14 assistant: 1942 tokens calls=bash
- #15 tool (bash): 295 tokens
- #16 assistant: 2523 tokens calls=write
- #17 tool (write): 32 tokens
- #18 assistant: 100 tokens calls=bash
- #19 tool (bash): 201 tokens
- #20 assistant: 310 tokens calls=send_message
- #21 tool (send_message): 26 tokens
- #22 assistant: 754 tokens
