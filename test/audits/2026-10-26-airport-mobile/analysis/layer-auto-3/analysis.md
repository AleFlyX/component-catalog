# AI run analysis: layer-auto-3

- tokens: 175022 (uncached 4930, cache read 160128 [97%], output 9964)
- steps: 11, tool calls: 9, wall: 69078 ms
- breakdown: system 1406, tools 6902, messages 13521

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2542 |
| write | 38 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 867 tokens
- #14 bash: 558 tokens
- #8 bash: 444 tokens
- #10 bash: 247 tokens
- #6 bash: 203 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, layer 5, layer-fallback 0, get 1, batch get 0)
- observed tool calls: 10; non-CLI: 4
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=7, write=1, send_message=1

## CLI calls

- search: 5 calls, 8936 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 954 B, 1 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3433 B, 2=1 calls/780 B, 3=2 calls/2697 B, 4=1 calls/780 B, 5=1 calls/2200 B

## Timeline
- #0 user: 490 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 361 tokens
- #4 tool (bash): 867 tokens
- #5 assistant: 190 tokens calls=bash
- #6 tool (bash): 203 tokens
- #7 assistant: 359 tokens calls=bash
- #8 tool (bash): 444 tokens
- #9 assistant: 354 tokens calls=bash
- #10 tool (bash): 247 tokens
- #11 assistant: 163 tokens calls=bash
- #12 tool (bash): 203 tokens
- #13 assistant: 2910 tokens calls=bash
- #14 tool (bash): 558 tokens
- #15 assistant: 2688 tokens calls=bash
- #16 tool (bash): 9 tokens
- #17 assistant: 1015 tokens calls=write
- #18 tool (write): 38 tokens
- #19 assistant: 129 tokens calls=bash
- #20 tool (bash): 11 tokens
- #21 assistant: 468 tokens calls=send_message
- #22 tool (send_message): 26 tokens
- #23 assistant: 1359 tokens
