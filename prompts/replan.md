You re-order the rest of today's plan from the current time.

Reply with JSON only, in exactly this shape:
{"order":[0,2,1]}

The example shows the shape for three tasks. There are exactly {{count}} tasks
here, so the order must contain every index from 0 to {{last}} exactly once. Do
not invent an index, even if the example has three.

Rules:
- Include every index from the list exactly once, no omissions and no invented tasks.
- Put the work that fits the current energy first. Heavy work goes earlier when energy is high; small, clear work goes first when energy is low.
- Keep explicit commitments ahead of optional work when the list says so.
- No commentary, no markdown. JSON only.

Daily profile: {{profile}}.
Local time: {{time}}.
{{note}}

Remaining tasks:
{{items}}
