# AI run analysis: layer-fallback-2

- tokens: 136171 (uncached 6403, cache read 124928 [95%], output 4840)
- steps: 9, tool calls: 3, wall: 33563 ms
- breakdown: system 1406, tools 6902, messages 9757

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 4025 |
| write | 39 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 861 tokens
- #6 bash: 780 tokens
- #7 bash: 695 tokens
- #10 bash: 670 tokens
- #9 bash: 654 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, layer 5, layer-fallback 5, get 1, batch get 0)
- observed tool calls: 10; non-CLI: 4
- search truncated: 0; omitted by limit 26, by bytes 0
- tool calls by name: write=1, bash=1, send_message=1

## CLI calls

- search: 5 calls, 14469 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1317 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3412 B, 2=2 calls/4402 B, 3=1 calls/2746 B, 4=1 calls/2581 B, 5=1 calls/2645 B

## Timeline
- #0 user: 540 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 153 tokens
- #4 tool (bash): 861 tokens
- #5 assistant: 408 tokens
- #6 tool (bash): 780 tokens
- #7 tool (bash): 695 tokens
- #8 assistant: 915 tokens
- #9 tool (bash): 654 tokens
- #10 tool (bash): 670 tokens
- #11 assistant: 855 tokens
- #12 tool (bash): 338 tokens
- #13 assistant: 266 tokens
- #14 tool (bash): 9 tokens
- #15 assistant: 1043 tokens calls=write
- #16 tool (write): 39 tokens
- #17 assistant: 99 tokens calls=bash
- #18 tool (bash): 18 tokens
- #19 assistant: 461 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 498 tokens
