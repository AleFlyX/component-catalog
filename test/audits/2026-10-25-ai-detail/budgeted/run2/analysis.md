# AI run analysis: budgeted-run2

- tokens: 178577 (uncached 6235, cache read 166144 [96%], output 6198)
- steps: 12, tool calls: 11, wall: 46277 ms
- breakdown: system 1406, tools 6902, messages 11398

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 4317 |
| write | 32 |
| send_message | 26 |

## Most expensive tool results

- #12 bash: 1047 tokens
- #22 bash: 637 tokens
- #6 bash: 544 tokens
- #8 bash: 523 tokens
- #10 bash: 490 tokens

## CLI calls

- search: 6 calls, 12095 B, 6 truncated, 0 errors, 0 include-props
- get: 1 calls, 1082 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2144 B, 2=3 calls/4954 B, 3=1 calls/1925 B, 4=1 calls/2005 B, 5=1 calls/2149 B

## Timeline
- #0 user: 609 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 108 tokens calls=bash
- #4 tool (bash): 108 tokens
- #5 assistant: 219 tokens calls=bash
- #6 tool (bash): 544 tokens
- #7 assistant: 360 tokens calls=bash
- #8 tool (bash): 523 tokens
- #9 assistant: 582 tokens calls=bash
- #10 tool (bash): 490 tokens
- #11 assistant: 409 tokens calls=bash
- #12 tool (bash): 1047 tokens
- #13 assistant: 335 tokens calls=bash
- #14 tool (bash): 279 tokens
- #15 assistant: 653 tokens calls=bash
- #16 tool (bash): 462 tokens
- #17 assistant: 1362 tokens calls=bash
- #18 tool (bash): 227 tokens
- #19 assistant: 1266 tokens calls=write
- #20 tool (write): 32 tokens
- #21 assistant: 61 tokens calls=bash
- #22 tool (bash): 637 tokens
- #23 assistant: 390 tokens calls=send_message
- #24 tool (send_message): 26 tokens
- #25 assistant: 240 tokens
