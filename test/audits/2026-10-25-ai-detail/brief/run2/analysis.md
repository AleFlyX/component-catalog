# AI run analysis: brief-run2

- tokens: 169444 (uncached 7579, cache read 152320 [95%], output 9545)
- steps: 10, tool calls: 8, wall: 60871 ms
- breakdown: system 1406, tools 6902, messages 15923

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 5232 |
| send_message | 26 |

## Most expensive tool results

- #10 bash: 2168 tokens
- #8 bash: 1440 tokens
- #12 bash: 806 tokens
- #14 bash: 521 tokens
- #6 bash: 159 tokens

## CLI calls

- search: 5 calls, 14224 B, 0 truncated, 0 errors, 0 include-props
- get: 3 calls, 5230 B, 1 truncated, 0 errors, 0 include-props

By task: 1=2 calls/6045 B, 2=2 calls/3787 B, 3=1 calls/2687 B, 4=1 calls/2703 B, 5=2 calls/4232 B

## Timeline
- #0 user: 564 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 101 tokens
- #4 tool (bash): 74 tokens
- #5 assistant: 91 tokens calls=bash
- #6 tool (bash): 159 tokens
- #7 assistant: 285 tokens calls=bash
- #8 tool (bash): 1440 tokens
- #9 assistant: 1009 tokens calls=bash
- #10 tool (bash): 2168 tokens
- #11 assistant: 1143 tokens calls=bash
- #12 tool (bash): 806 tokens
- #13 assistant: 1780 tokens calls=bash
- #14 tool (bash): 521 tokens
- #15 assistant: 2347 tokens calls=bash
- #16 tool (bash): 46 tokens
- #17 assistant: 1847 tokens calls=bash
- #18 tool (bash): 18 tokens
- #19 assistant: 431 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 638 tokens
