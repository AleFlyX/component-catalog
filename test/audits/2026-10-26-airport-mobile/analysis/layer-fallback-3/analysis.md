# AI run analysis: layer-fallback-3

- tokens: 170862 (uncached 7389, cache read 157568 [96%], output 5905)
- steps: 11, tool calls: 9, wall: 41404 ms
- breakdown: system 1406, tools 6902, messages 11203

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 3891 |
| read | 941 |
| write | 39 |
| send_message | 26 |

## Most expensive tool results

- #15 read: 941 tokens
- #4 bash: 861 tokens
- #6 bash: 780 tokens
- #9 bash: 695 tokens
- #11 bash: 631 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, layer 5, layer-fallback 5, get 1, batch get 0)
- observed tool calls: 11; non-CLI: 5
- search truncated: 0; omitted by limit 8, by bytes 0
- tool calls by name: bash=6, read=1, write=1, send_message=1

## CLI calls

- search: 5 calls, 13912 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1317 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3412 B, 2=2 calls/4402 B, 3=1 calls/2746 B, 4=1 calls/2490 B, 5=1 calls/2179 B

## Timeline
- #0 user: 540 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 144 tokens
- #4 tool (bash): 861 tokens
- #5 assistant: 202 tokens
- #6 tool (bash): 780 tokens
- #7 assistant: 703 tokens calls=bash,bash
- #8 tool (bash): 338 tokens
- #9 tool (bash): 695 tokens
- #10 assistant: 228 tokens calls=bash
- #11 tool (bash): 631 tokens
- #12 assistant: 203 tokens calls=bash
- #13 tool (bash): 553 tokens
- #14 assistant: 393 tokens calls=read
- #15 tool (read): 941 tokens
- #16 assistant: 457 tokens calls=bash
- #17 tool (bash): 12 tokens
- #18 assistant: 1645 tokens calls=write
- #19 tool (write): 39 tokens
- #20 assistant: 78 tokens calls=bash
- #21 tool (bash): 21 tokens
- #22 assistant: 732 tokens calls=send_message
- #23 tool (send_message): 26 tokens
- #24 assistant: 552 tokens
