# AI run analysis: details-ui-3

- tokens: 104914 (uncached 4619, cache read 94336 [95%], output 5959)
- steps: 7, tool calls: 3, wall: 34549 ms
- breakdown: system 1406, tools 6902, messages 9354

## Tool results

| tool | result tokens |
| --- | --- |
| bash | 2516 |
| write | 36 |
| send_message | 26 |

## Most expensive tool results

- #6 bash: 1403 tokens
- #4 bash: 1045 tokens
- #12 bash: 59 tokens
- #10 write: 36 tokens
- #14 send_message: 26 tokens

## CLI vs non-CLI

- CLI calls: 5 (search 5, details 5, brief 0, get 0, batch get 0)
- observed tool calls: 6; non-CLI: 1
- search truncated: 0; omitted by limit 1, by bytes 0
- tool calls by name: write=1, bash=1, send_message=1

## CLI calls

- search: 5 calls, 9688 B, 0 truncated, 0 errors, 0 include-props

By task: 1=1 calls/3394 B, 2=1 calls/741 B, 3=1 calls/1704 B, 4=1 calls/1690 B, 5=1 calls/2159 B

## Timeline
- #0 user: 463 tokens
- #1 inject: 355 tokens
- #2 inject: 74 tokens
- #3 assistant: 1072 tokens
- #4 tool (bash): 1045 tokens
- #5 assistant: 932 tokens
- #6 tool (bash): 1403 tokens
- #7 assistant: 950 tokens
- #8 tool (bash): 9 tokens
- #9 assistant: 1120 tokens calls=write
- #10 tool (write): 36 tokens
- #11 assistant: 232 tokens calls=bash
- #12 tool (bash): 59 tokens
- #13 assistant: 416 tokens calls=send_message
- #14 tool (send_message): 26 tokens
- #15 assistant: 1162 tokens
