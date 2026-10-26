# AI run analysis: layer-auto-1

- tokens: 168488 (uncached 6266, cache read 155264 [96%], output 6958)
- steps: 11, tool calls: 9, wall: 50741 ms
- breakdown: system 1406, tools 6902, messages 11357

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 3974 |
| write | 38 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 827 tokens
- #6 bash: 785 tokens
- #10 bash: 736 tokens
- #12 bash: 675 tokens
- #8 bash: 588 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, layer 5, layer-fallback 0, get 1, batch get 0)
- observed tool calls: 10; non-CLI: 4
- search truncated: 0; omitted by limit 10, by bytes 0
- tool calls by name: bash=7, write=1, send_message=1

## CLI calls

- search: 5 calls, 14274 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1317 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3274 B, 2=1 calls/3106 B, 3=1 calls/2317 B, 4=2 calls/4228 B, 5=1 calls/2666 B

## Timeline
- #0 user: 490 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 153 tokens
- #4 tool (bash): 827 tokens
- #5 assistant: 186 tokens calls=bash
- #6 tool (bash): 785 tokens
- #7 assistant: 694 tokens calls=bash
- #8 tool (bash): 588 tokens
- #9 assistant: 169 tokens calls=bash
- #10 tool (bash): 736 tokens
- #11 assistant: 372 tokens calls=bash
- #12 tool (bash): 675 tokens
- #13 assistant: 384 tokens calls=bash
- #14 tool (bash): 338 tokens
- #15 assistant: 2154 tokens calls=bash
- #16 tool (bash): 9 tokens
- #17 assistant: 849 tokens calls=write
- #18 tool (write): 38 tokens
- #19 assistant: 71 tokens calls=bash
- #20 tool (bash): 16 tokens
- #21 assistant: 418 tokens calls=send_message
- #22 tool (send_message): 26 tokens
- #23 assistant: 950 tokens
