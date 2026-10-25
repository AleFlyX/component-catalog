# AI run analysis: tuned-run1

- tokens: 118782 (uncached 6126, cache read 107776 [95%], output 4880)
- steps: 8, tool calls: 12, wall: 34266 ms
- breakdown: system 1406, tools 6902, messages 9786

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 4143 |
| write | 32 |
| send_message | 26 |

## Most expensive tool results

- #5 bash: 569 tokens
- #12 bash: 536 tokens
- #7 bash: 524 tokens
- #19 bash: 521 tokens
- #11 bash: 495 tokens

## CLI calls

- search: 5 calls, 9886 B, 5 truncated, 0 errors, 0 include-props
- get: 1 calls, 1589 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2063 B, 2=2 calls/3519 B, 3=1 calls/1836 B, 4=1 calls/1948 B, 5=1 calls/2109 B

## Timeline
- #0 user: 603 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 223 tokens calls=bash,bash
- #4 tool (bash): 103 tokens
- #5 tool (bash): 569 tokens
- #6 assistant: 367 tokens calls=bash,bash
- #7 tool (bash): 524 tokens
- #8 tool (bash): 491 tokens
- #9 assistant: 695 tokens calls=bash,bash,bash
- #10 tool (bash): 467 tokens
- #11 tool (bash): 495 tokens
- #12 tool (bash): 536 tokens
- #13 assistant: 686 tokens calls=bash
- #14 tool (bash): 406 tokens
- #15 assistant: 1867 tokens calls=write,bash
- #16 tool (write): 32 tokens
- #17 tool (bash): 31 tokens
- #18 assistant: 93 tokens calls=bash
- #19 tool (bash): 521 tokens
- #20 assistant: 305 tokens calls=send_message
- #21 tool (send_message): 26 tokens
- #22 assistant: 317 tokens
