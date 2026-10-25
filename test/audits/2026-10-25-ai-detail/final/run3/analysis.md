# AI run analysis: final-run3

- tokens: 155271 (uncached 6171, cache read 144000 [96%], output 5100)
- steps: 11, tool calls: 10, wall: 33422 ms
- breakdown: system 1406, tools 6902, messages 9797

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 3830 |
| send_message | 26 |

## Most expensive tool results

- #18 bash: 565 tokens
- #14 bash: 546 tokens
- #6 bash: 544 tokens
- #12 bash: 495 tokens
- #8 bash: 491 tokens

## CLI calls

- search: 5 calls, 10096 B, 5 truncated, 0 errors, 0 include-props
- get: 1 calls, 984 B, 1 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2144 B, 2=2 calls/2914 B, 3=1 calls/1925 B, 4=1 calls/1948 B, 5=1 calls/2149 B

## Timeline
- #0 user: 551 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 289 tokens calls=bash
- #4 tool (bash): 420 tokens
- #5 assistant: 187 tokens calls=bash
- #6 tool (bash): 544 tokens
- #7 assistant: 179 tokens calls=bash
- #8 tool (bash): 491 tokens
- #9 assistant: 372 tokens calls=bash
- #10 tool (bash): 490 tokens
- #11 assistant: 202 tokens calls=bash
- #12 tool (bash): 495 tokens
- #13 assistant: 158 tokens calls=bash
- #14 tool (bash): 546 tokens
- #15 assistant: 431 tokens calls=bash
- #16 tool (bash): 254 tokens
- #17 assistant: 1576 tokens calls=bash
- #18 tool (bash): 565 tokens
- #19 assistant: 138 tokens calls=bash
- #20 tool (bash): 25 tokens
- #21 assistant: 754 tokens calls=send_message
- #22 tool (send_message): 26 tokens
- #23 assistant: 675 tokens
