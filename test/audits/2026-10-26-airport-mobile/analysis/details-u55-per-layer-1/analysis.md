# AI run analysis: details-u55-per-layer-1

- tokens: 127514 (uncached 5135, cache read 118016 [96%], output 4363)
- steps: 10, tool calls: 7, wall: 33848 ms
- breakdown: system 1406, tools 6902, messages 7886

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2761 |
| write | 37 |
| send_message | 26 |

## Most expensive tool results

- #14 bash: 589 tokens
- #10 bash: 587 tokens
- #12 bash: 564 tokens
- #8 bash: 563 tokens
- #6 bash: 382 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, layer 0, layer-fallback 0, get 0, batch get 0)
- observed tool calls: 9; non-CLI: 4
- search truncated: 0; omitted by limit 0, by bytes 0
- tool calls by name: bash=6, send_message=1

## CLI calls

- search: 5 calls, 10571 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/1493 B, 2=1 calls/2218 B, 3=1 calls/2316 B, 4=1 calls/2221 B, 5=1 calls/2323 B

## Timeline
- #0 user: 467 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 93 tokens
- #4 tool (bash): 13 tokens
- #5 assistant: 130 tokens calls=bash
- #6 tool (bash): 382 tokens
- #7 assistant: 168 tokens calls=bash
- #8 tool (bash): 563 tokens
- #9 assistant: 165 tokens calls=bash
- #10 tool (bash): 587 tokens
- #11 assistant: 221 tokens calls=bash
- #12 tool (bash): 564 tokens
- #13 assistant: 115 tokens calls=bash
- #14 tool (bash): 589 tokens
- #15 assistant: 1776 tokens
- #16 tool (write): 37 tokens
- #17 assistant: 105 tokens calls=bash
- #18 tool (bash): 63 tokens
- #19 assistant: 915 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 478 tokens
