# AI run analysis: details-u55-1

- tokens: 179703 (uncached 6384, cache read 164608 [96%], output 8711)
- steps: 11, tool calls: 3, wall: 53008 ms
- breakdown: system 1406, tools 6902, messages 13975

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 4113 |
| write | 36 |
| send_message | 26 |

## Most expensive tool results

- #4 bash: 817 tokens
- #6 bash: 748 tokens
- #12 bash: 694 tokens
- #10 bash: 693 tokens
- #8 bash: 691 tokens

## CLI vs non-CLI

- CLI calls: 6 (search 5, details 5, brief 0, get 1, batch get 1)
- observed tool calls: 10; non-CLI: 4
- search truncated: 0; omitted by limit 53, by bytes 0
- tool calls by name: write=1, bash=1, send_message=1

## CLI calls

- search: 5 calls, 14403 B, 0 truncated, 0 errors, 0 include-props
- get: 1 calls, 1735 B, 1 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3235 B, 2=1 calls/2958 B, 3=2 calls/4465 B, 4=1 calls/2738 B, 5=1 calls/2742 B

## Timeline
- #0 user: 544 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 148 tokens
- #4 tool (bash): 817 tokens
- #5 assistant: 171 tokens
- #6 tool (bash): 748 tokens
- #7 assistant: 864 tokens
- #8 tool (bash): 691 tokens
- #9 assistant: 543 tokens
- #10 tool (bash): 693 tokens
- #11 assistant: 185 tokens
- #12 tool (bash): 694 tokens
- #13 assistant: 1610 tokens
- #14 tool (bash): 442 tokens
- #15 assistant: 1927 tokens
- #16 tool (bash): 9 tokens
- #17 assistant: 1322 tokens calls=write
- #18 tool (write): 36 tokens
- #19 assistant: 98 tokens calls=bash
- #20 tool (bash): 19 tokens
- #21 assistant: 483 tokens calls=send_message
- #22 tool (send_message): 26 tokens
- #23 assistant: 1476 tokens
