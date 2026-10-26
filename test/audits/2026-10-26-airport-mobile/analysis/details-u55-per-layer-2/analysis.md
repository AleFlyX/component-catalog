# AI run analysis: details-u55-per-layer-2

- tokens: 76545 (uncached 6451, cache read 63232 [91%], output 6862)
- steps: 5, tool calls: 5, wall: 40293 ms
- breakdown: system 1406, tools 6902, messages 10578

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2663 |
| write | 37 |
| send_message | 26 |

## Most expensive tool results

- #8 bash: 596 tokens
- #9 bash: 589 tokens
- #6 bash: 563 tokens
- #7 bash: 556 tokens
- #4 bash: 359 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, layer 0, layer-fallback 0, get 0, batch get 0)
- observed tool calls: 7; non-CLI: 2
- search truncated: 0; omitted by limit 0, by bytes 0
- tool calls by name: bash=4, send_message=1

## CLI calls

- search: 5 calls, 10486 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/1404 B, 2=1 calls/2218 B, 3=1 calls/2192 B, 4=1 calls/2349 B, 5=1 calls/2323 B

## Timeline
- #0 user: 467 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 958 tokens calls=bash
- #4 tool (bash): 359 tokens
- #5 assistant: 637 tokens calls=bash,bash,bash
- #6 tool (bash): 563 tokens
- #7 tool (bash): 556 tokens
- #8 tool (bash): 596 tokens
- #9 tool (bash): 589 tokens
- #10 assistant: 4017 tokens
- #11 tool (write): 37 tokens
- #12 assistant: 528 tokens calls=send_message
- #13 tool (send_message): 26 tokens
- #14 assistant: 816 tokens
