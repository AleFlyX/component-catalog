# AI run analysis: details-u55-layer-3

- tokens: 76435 (uncached 4799, cache read 65920 [93%], output 5716)
- steps: 5, tool calls: 6, wall: 31486 ms
- breakdown: system 1406, tools 6902, messages 8620

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2853 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 861 tokens
- #8 bash: 670 tokens
- #7 bash: 631 tokens
- #6 bash: 439 tokens
- #5 bash: 198 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, layer 5, get 0, batch get 0)
- observed tool calls: 8; non-CLI: 3
- search truncated: 0; omitted by limit 9, by bytes 0
- tool calls by name: bash=5, send_message=1

## CLI calls

- search: 5 calls, 11028 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3412 B, 2=1 calls/759 B, 3=1 calls/1722 B, 4=1 calls/2490 B, 5=1 calls/2645 B

## Timeline
- #0 user: 489 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 892 tokens calls=bash,bash,bash
- #4 tool (bash): 861 tokens
- #5 tool (bash): 198 tokens
- #6 tool (bash): 439 tokens
- #7 tool (bash): 631 tokens
- #8 tool (bash): 670 tokens
- #9 assistant: 1834 tokens calls=bash
- #10 tool (bash): 25 tokens
- #11 assistant: 147 tokens calls=bash
- #12 tool (bash): 29 tokens
- #13 assistant: 981 tokens calls=send_message
- #14 tool (send_message): 26 tokens
- #15 assistant: 969 tokens
