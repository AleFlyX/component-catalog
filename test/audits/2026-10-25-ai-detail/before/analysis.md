# AI run analysis: before-run1

- tokens: 233969 (uncached 14043, cache read 211840 [94%], output 8086)
- steps: 12, tool calls: 10, wall: 93226 ms
- breakdown: system 1406, tools 6902, messages 20988

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 11749 |
| send_message | 26 |

## Most expensive tool results

- #10 bash: 3646 tokens
- #16 bash: 1974 tokens
- #8 bash: 1840 tokens
- #14 bash: 1249 tokens
- #12 bash: 886 tokens

## CLI calls

- search: 12 calls, 25229 B, 4 truncated, 0 errors, 0 include-props
- get: 8 calls, 15206 B, 1 truncated, 0 errors, 8 include-props

## Timeline
- #0 user: 494 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 116 tokens
- #4 tool (bash): 109 tokens
- #5 assistant: 101 tokens calls=bash
- #6 tool (bash): 544 tokens
- #7 assistant: 286 tokens calls=bash
- #8 tool (bash): 1840 tokens
- #9 assistant: 294 tokens calls=bash
- #10 tool (bash): 3646 tokens
- #11 assistant: 408 tokens calls=bash
- #12 tool (bash): 886 tokens
- #13 assistant: 417 tokens calls=bash
- #14 tool (bash): 1249 tokens
- #15 assistant: 412 tokens calls=bash
- #16 tool (bash): 1974 tokens
- #17 assistant: 2056 tokens calls=bash
- #18 tool (bash): 655 tokens
- #19 assistant: 1401 tokens calls=bash
- #20 tool (bash): 828 tokens
- #21 assistant: 1541 tokens calls=bash
- #22 tool (bash): 18 tokens
- #23 assistant: 678 tokens calls=send_message
- #24 tool (send_message): 26 tokens
- #25 assistant: 580 tokens
