# AI run analysis: details-u55-limit3-2

- tokens: 145909 (uncached 4740, cache read 132992 [97%], output 8177)
- steps: 10, tool calls: 9, wall: 49523 ms
- breakdown: system 1406, tools 6902, messages 10655

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2376 |
| write | 36 |
| send_message | 26 |

## Most expensive tool results

- #6 bash: 540 tokens
- #8 bash: 473 tokens
- #14 bash: 450 tokens
- #10 bash: 435 tokens
- #12 bash: 431 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, get 0, batch get 0)
- observed tool calls: 9; non-CLI: 4
- search truncated: 0; omitted by limit 31, by bytes 0
- tool calls by name: bash=7, write=1, send_message=1

## CLI calls

- search: 5 calls, 9147 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2126 B, 2=1 calls/1858 B, 3=1 calls/1707 B, 4=1 calls/1690 B, 5=1 calls/1766 B

## Timeline
- #0 user: 446 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 769 tokens calls=bash
- #4 tool (bash): 16 tokens
- #5 assistant: 116 tokens calls=bash
- #6 tool (bash): 540 tokens
- #7 assistant: 161 tokens calls=bash
- #8 tool (bash): 473 tokens
- #9 assistant: 862 tokens calls=bash
- #10 tool (bash): 435 tokens
- #11 assistant: 362 tokens calls=bash
- #12 tool (bash): 431 tokens
- #13 assistant: 174 tokens calls=bash
- #14 tool (bash): 450 tokens
- #15 assistant: 3064 tokens calls=write
- #16 tool (write): 36 tokens
- #17 assistant: 319 tokens calls=bash
- #18 tool (bash): 31 tokens
- #19 assistant: 570 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 945 tokens
