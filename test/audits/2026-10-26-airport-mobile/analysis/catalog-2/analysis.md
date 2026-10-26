# AI run analysis: catalog-2

- tokens: 200600 (uncached 8519, cache read 178304 [95%], output 13777)
- steps: 10, tool calls: 13, wall: 82035 ms
- breakdown: system 1406, tools 6902, messages 19835

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 4695 |
| read | 776 |
| write | 35 |
| send_message | 26 |

## Most expensive tool results

- #7 read: 776 tokens
- #20 bash: 727 tokens
- #10 bash: 654 tokens
- #24 bash: 620 tokens
- #8 bash: 591 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 0, brief 0, get 1, batch get 1)
- observed tool calls: 15; non-CLI: 9
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: bash=10, read=1, write=1, send_message=1

## CLI calls

- search: 5 calls, 6102 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 2228 B, 1 truncated, 0 errors, 1 include-props

By task: 1=1 calls/2581 B, 2=1 calls/571 B, 3=2 calls/3429 B, 4=1 calls/845 B, 5=1 calls/904 B

## Timeline
- #0 user: 491 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 398 tokens calls=bash,bash
- #4 tool (bash): 443 tokens
- #5 tool (bash): 68 tokens
- #6 assistant: 122 tokens calls=read,bash
- #7 tool (read): 776 tokens
- #8 tool (bash): 591 tokens
- #9 assistant: 631 tokens calls=bash,bash,bash
- #10 tool (bash): 654 tokens
- #11 tool (bash): 151 tokens
- #12 tool (bash): 309 tokens
- #13 tool (bash): 220 tokens
- #14 tool (bash): 234 tokens
- #15 assistant: 1489 tokens calls=bash
- #16 tool (bash): 113 tokens
- #17 assistant: 608 tokens calls=bash
- #18 tool (bash): 565 tokens
- #19 assistant: 4719 tokens calls=bash
- #20 tool (bash): 727 tokens
- #21 assistant: 3085 tokens calls=write
- #22 tool (write): 35 tokens
- #23 assistant: 124 tokens calls=bash
- #24 tool (bash): 620 tokens
- #25 assistant: 1338 tokens calls=send_message
- #26 tool (send_message): 26 tokens
- #27 assistant: 869 tokens
