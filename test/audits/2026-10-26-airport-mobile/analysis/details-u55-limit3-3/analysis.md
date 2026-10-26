# AI run analysis: details-u55-limit3-3

- tokens: 154178 (uncached 5264, cache read 139520 [96%], output 9394)
- steps: 10, tool calls: 9, wall: 53682 ms
- breakdown: system 1406, tools 6902, messages 12474

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2044 |
| read | 748 |
| write | 36 |
| send_message | 26 |

## Most expensive tool results

- #18 read: 748 tokens
- #6 bash: 540 tokens
- #14 bash: 435 tokens
- #10 bash: 434 tokens
- #12 bash: 431 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, get 0, batch get 0)
- observed tool calls: 9; non-CLI: 4
- search truncated: 0; omitted by limit 4, by bytes 0
- tool calls by name: bash=6, write=1, read=1, send_message=1

## CLI calls

- search: 5 calls, 7969 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/2126 B, 2=1 calls/741 B, 3=1 calls/1704 B, 4=1 calls/1690 B, 5=1 calls/1708 B

## Timeline
- #0 user: 446 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 1551 tokens calls=bash
- #4 tool (bash): 10 tokens
- #5 assistant: 116 tokens calls=bash
- #6 tool (bash): 540 tokens
- #7 assistant: 168 tokens calls=bash
- #8 tool (bash): 194 tokens
- #9 assistant: 1044 tokens calls=bash
- #10 tool (bash): 434 tokens
- #11 assistant: 241 tokens calls=bash
- #12 tool (bash): 431 tokens
- #13 assistant: 291 tokens calls=bash
- #14 tool (bash): 435 tokens
- #15 assistant: 2674 tokens calls=write
- #16 tool (write): 36 tokens
- #17 assistant: 191 tokens calls=read
- #18 tool (read): 748 tokens
- #19 assistant: 1609 tokens calls=send_message
- #20 tool (send_message): 26 tokens
- #21 assistant: 860 tokens
