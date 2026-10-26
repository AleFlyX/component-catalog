# AI run analysis: catalog-1

- tokens: 161961 (uncached 6006, cache read 147328 [96%], output 8627)
- steps: 10, tool calls: 9, wall: 54858 ms
- breakdown: system 1406, tools 6902, messages 13078

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 3866 |
| write | 35 |
| send_message | 26 |
| skill | 25 |

## Most expensive tool results

- #10 bash: 2570 tokens
- #8 bash: 591 tokens
- #12 bash: 425 tokens
- #14 bash: 170 tokens
- #4 bash: 97 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 0, brief 0, get 1, batch get 1)
- observed tool calls: 9; non-CLI: 3
- search truncated: 0; omitted by limit 12, by bytes 0
- tool calls by name: bash=6, skill=1, write=1, send_message=1

## CLI calls

- search: 5 calls, 10192 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1667 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2409 B, 2=2 calls/3801 B, 3=1 calls/1871 B, 4=1 calls/1856 B, 5=1 calls/1922 B

## Timeline
- #0 user: 491 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 188 tokens calls=bash
- #4 tool (bash): 97 tokens
- #5 assistant: 343 tokens calls=skill
- #6 tool (skill): 25 tokens
- #7 assistant: 105 tokens calls=bash
- #8 tool (bash): 591 tokens
- #9 assistant: 925 tokens calls=bash
- #10 tool (bash): 2570 tokens
- #11 assistant: 2742 tokens calls=bash
- #12 tool (bash): 425 tokens
- #13 assistant: 1736 tokens calls=bash
- #14 tool (bash): 170 tokens
- #15 assistant: 1181 tokens calls=write
- #16 tool (write): 35 tokens
- #17 assistant: 81 tokens calls=bash
- #18 tool (bash): 13 tokens
- #19 assistant: 302 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 603 tokens
