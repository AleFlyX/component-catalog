# AI run analysis: tuned-run3

- tokens: 256710 (uncached 9150, cache read 238464 [96%], output 9096)
- steps: 14, tool calls: 13, wall: 61740 ms
- breakdown: system 1406, tools 6902, messages 16380

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 6436 |
| write | 32 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 1760 tokens
- #22 bash: 949 tokens
- #20 bash: 551 tokens
- #14 bash: 527 tokens
- #8 bash: 487 tokens

## CLI calls

- search: 7 calls, 12428 B, 6 truncated, 0 errors, 0 include-props
- get: 1 calls, 2172 B, 1 truncated, 0 errors, 0 include-props

By task: 1=1 calls/1770 B, 2=2 calls/4086 B, 3=3 calls/5374 B, 4=1 calls/1296 B, 5=1 calls/2074 B

## Timeline
- #0 user: 603 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 171 tokens calls=bash
- #4 tool (bash): 1760 tokens
- #5 assistant: 197 tokens calls=bash
- #6 tool (bash): 451 tokens
- #7 assistant: 152 tokens calls=bash
- #8 tool (bash): 487 tokens
- #9 assistant: 284 tokens calls=bash
- #10 tool (bash): 448 tokens
- #11 assistant: 1448 tokens calls=bash
- #12 tool (bash): 332 tokens
- #13 assistant: 126 tokens calls=bash
- #14 tool (bash): 527 tokens
- #15 assistant: 2229 tokens calls=bash
- #16 tool (bash): 454 tokens
- #17 assistant: 725 tokens calls=bash
- #18 tool (bash): 467 tokens
- #19 assistant: 385 tokens calls=bash
- #20 tool (bash): 551 tokens
- #21 assistant: 905 tokens calls=bash
- #22 tool (bash): 949 tokens
- #23 assistant: 1159 tokens calls=write
- #24 tool (write): 32 tokens
- #25 assistant: 58 tokens calls=bash
- #26 tool (bash): 10 tokens
- #27 assistant: 294 tokens calls=send_message
- #28 tool (send_message): 26 tokens
- #29 assistant: 721 tokens
