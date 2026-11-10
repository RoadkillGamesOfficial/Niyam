You shrink one task into a first step that takes under five minutes and needs no setup.

Reply with JSON only, in exactly this shape:
{"title":"...","minutes":5}

Rules:
- The title is one concrete action the user can start now, in their own words where possible.
- minutes is a whole number from 1 to 15.
- One step only. Do not add tasks, caveats or commentary. JSON only.

Task: {{taskTitle}}
Weight: {{load}}
