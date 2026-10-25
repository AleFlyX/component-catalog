# AI run analysis: final-run1

- tokens: 191617 (uncached 6385, cache read 177920 [97%], output 7312)
- steps: 12, tool calls: 12, wall: 47093 ms
- breakdown: system 1406, tools 6902, messages 12253

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 3943 |
| write | 32 |
| send_message | 26 |

## Most expensive tool results

- #5 bash: 575 tokens
- #15 bash: 546 tokens
- #7 bash: 544 tokens
- #9 bash: 491 tokens
- #11 bash: 490 tokens

## CLI calls

- search: 5 calls, 10039 B, 5 truncated, 0 errors, 0 include-props
- get: 1 calls, 1146 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2144 B, 2=2 calls/3076 B, 3=1 calls/1925 B, 4=1 calls/1891 B, 5=1 calls/2149 B

## Timeline
- #0 user: 551 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 242 tokens calls=bash,bash
- #4 tool (bash): 465 tokens
- #5 tool (bash): 575 tokens
- #6 assistant: 372 tokens calls=bash
- #7 tool (bash): 544 tokens
- #8 assistant: 443 tokens calls=bash
- #9 tool (bash): 491 tokens
- #10 assistant: 445 tokens calls=bash
- #11 tool (bash): 490 tokens
- #12 assistant: 190 tokens calls=bash
- #13 tool (bash): 481 tokens
- #14 assistant: 168 tokens calls=bash
- #15 tool (bash): 546 tokens
- #16 assistant: 1342 tokens calls=bash
- #17 tool (bash): 295 tokens
- #18 assistant: 1756 tokens calls=bash
- #19 tool (bash): 45 tokens
- #20 assistant: 761 tokens calls=write
- #21 tool (write): 32 tokens
- #22 assistant: 168 tokens calls=bash
- #23 tool (bash): 11 tokens
- #24 assistant: 650 tokens calls=send_message
- #25 tool (send_message): 26 tokens
- #26 assistant: 735 tokens
