# AI run analysis: tuned-run2

- tokens: 123258 (uncached 7698, cache read 111744 [94%], output 3816)
- steps: 8, tool calls: 5, wall: 29875 ms
- breakdown: system 1406, tools 6902, messages 10452

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 5741 |
| send_message | 26 |

## Most expensive tool results

- #9 bash: 2433 tokens
- #4 bash: 1707 tokens
- #11 bash: 593 tokens
- #7 bash: 569 tokens
- #13 bash: 383 tokens

## CLI calls

- search: 5 calls, 9443 B, 4 truncated, 0 errors, 0 include-props
- get: 1 calls, 2340 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2143 B, 2=2 calls/4270 B, 3=1 calls/1925 B, 4=1 calls/1296 B, 5=1 calls/2149 B

## Timeline
- #0 user: 603 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 133 tokens
- #4 tool (bash): 1707 tokens
- #5 tool (bash): 45 tokens
- #6 assistant: 208 tokens calls=bash
- #7 tool (bash): 569 tokens
- #8 assistant: 335 tokens calls=bash
- #9 tool (bash): 2433 tokens
- #10 assistant: 976 tokens
- #11 tool (bash): 593 tokens
- #12 assistant: 858 tokens calls=bash
- #13 tool (bash): 383 tokens
- #14 assistant: 267 tokens calls=bash
- #15 tool (bash): 11 tokens
- #16 assistant: 312 tokens calls=send_message
- #17 tool (send_message): 26 tokens
- #18 assistant: 564 tokens
