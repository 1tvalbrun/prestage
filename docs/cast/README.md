# Cast

One file per lane in `personalities/`, with a section per role, nine roles in all, each with `{{name}}` where the face's name goes. Every face in a role carries the same personality; the role is the personality, the face is casting. Name, photo, and voice are the only things that differ within a role, and all three live in the tables below. `scripts/push-personalities.ts` joins a role's file to each face in this table and updates the Character through the Runway API; `--dry-run` shows the diff first.

Heritage labels live in the design notes only. They never appear in the product, in a persona bio, or in a personality.

## Voices

Each avatar gets a custom voice generated from a description. The rule: accent follows the character's biography, not their ethnicity. US-born characters get General American with regional color; the few written as immigrants (Osei, Ortega, Nair, Okafor) get a light accent over clear English. Every description states clear, easily understood English. The preset column is the fallback if a custom voice comes out wrong.

| Lane | Role | Avatar | Custom voice | Preset fallback |
|---|---|---|---|---|
| founder | VC | Victoria Chen | Woman in her early 40s, General American accent, clear and easily understood English, low-medium pitch, measured unhurried pace, crisp consonants, quiet authority, little warmth. | Victoria (Firm) |
| founder | VC | Andrew Caldwell | Man in his late 40s, General American with a faint East Coast edge, clear and easily understood English, medium-low pitch, brisk clipped delivery, cool and economical, no filler words. | Roman (Cool) |
| founder | VC | Daniel Osei | Man in his mid 40s, light Ghanaian accent over clear and easily understood English, rich low pitch, calm even pace, composed and deliberate. | Adrian (Smooth) |
| founder | Target customer | Marcus Rivera | Man in his early 40s, General American accent, clear and easily understood English, medium pitch, direct quick delivery, blunt, slightly impatient. | Marcus (Firm) |
| founder | Target customer | Megan Sullivan | Woman in her late 30s, General American with a slight Midwestern flatness, clear and easily understood English, medium pitch, brisk businesslike pace, direct and dry. | Petra (Forward) |
| founder | Target customer | Angela Whitfield | Woman in her late 30s, General American with a subtle Southern lilt, clear and easily understood English, warm medium-low pitch, even pace, poised and skeptical. | Emma (Clear) |
| founder | Technical architect | Dr. Sarah Okafor | Woman in her mid 40s, light British accent, Nigerian-British, clear and easily understood English, medium pitch, calm methodical pace, thoughtful and constructive. | Clara (Soft) |
| founder | Technical architect | Erik Larsen | Man in his mid 40s, General American, Pacific Northwest, clear and easily understood English, medium-low pitch, slow deliberate pace, analytical and understated. | Sam (Even) |
| founder | Technical architect | Arjun Mehta | Man in his mid 30s, General American with a very light Indian-American inflection, clear and easily understood English, medium pitch, quick precise delivery, curious, thinks out loud. | Jasper (Clear) |
| sales | Meeting buyer | Cole Merritt | Man in his mid 30s, General American accent, clear and easily understood English, warm medium pitch, easy unhurried pace, friendly until he turns firm. | Nathan (Firm) |
| sales | Meeting buyer | Denise Jackson | Woman in her late 40s, General American with a warm Southern undertone, clear and easily understood English, low-medium pitch, patient unhurried pace, kind but immovable. | Ruby (Easy-going) |
| sales | Meeting buyer | Omar Nasser | Man in his early 40s, General American with a faint Arabic inflection, clear and easily understood English, medium-low pitch, steady courteous pace, calm and evaluating. | Leo (Easy-going) |
| sales | Cold-call prospect | Greg Hollis | Man in his 50s, General American accent, clear and easily understood English, gravelly and slightly gruff, short clipped phrases, distracted and busy. | Blake (Gravelly) |
| sales | Cold-call prospect | Luis Ortega | Man in his early 60s, light Mexican-American accent over clear and easily understood English, warm weathered medium-low pitch, unhurried, friendly but busy. | Adam (Friendly) |
| sales | Cold-call prospect | Tammy Nguyen | Woman in her mid 40s, General American with a faint Vietnamese-American inflection, clear and easily understood English, medium-high pitch, quick clipped pace, polite and guarded. | Skye (Bright) |
| audit | Assessor | Priya Nair | Woman in her mid 50s, soft Indian accent over clear and easily understood English, mature medium-low pitch, slow calm pace, warm and precise, never hurried. | Georgia (Mature) |
| audit | Assessor | Mark Sorensen | Man in his mid 50s, General American, Upper Midwest, clear and easily understood English, medium pitch, slow even pace, flat and unreadable, precise. | David (Informative) |
| audit | Assessor | Malcolm Pierce | Man in his late 50s, General American accent, clear and easily understood English, deep resonant low pitch, slow patient pace, calm, reassuring, methodical. | Drew (Breathy) |
| interview | Recruiter | Jun Park | Man in his early 30s, General American, West Coast, clear and easily understood English, medium pitch, quick casual conversational pace, warm and upbeat. | Zach (Casual) |
| interview | Recruiter | Emily Hartman | Woman in her early 30s, General American accent, clear and easily understood English, bright medium-high pitch, fast friendly pace, energetic and engaging. | Maya (Upbeat) |
| interview | Recruiter | Camila Duarte | Preset Clara, chosen over the custom voice after audition. | Clara (Soft) |
| interview | Hiring manager | Renee Calloway | Woman around 50, General American accent, clear and easily understood English, smooth medium-low pitch, steady unhurried pace, direct and fair. | Nina (Smooth) |
| interview | Hiring manager | Tom Hendricks | Man in his late 40s, General American accent, clear and easily understood English, medium pitch, steady measured pace, direct, even, probing. | Nathan (Firm) |
| interview | Hiring manager | Valeria Castillo | Woman in her mid 40s, General American with a subtle Southwestern, Mexican-American inflection, clear and easily understood English, warm medium pitch, composed steady pace, attentive. | Aurora (Bright) |
| interview | Senior practitioner | Tomás Reyes | Man in his mid 50s, General American with a light Latin American inflection, clear and easily understood English, medium-low pitch, calm dry precise delivery. | Vincent (Knowledgeable) |
| interview | Senior practitioner | Ryan Mitchell | Man in his early 40s, General American accent, clear and easily understood English, medium pitch, focused measured pace, dry and slightly wry. | Morgan (Informative) |
| interview | Senior practitioner | Anjali Desai | Woman around 40, General American accent, clear and easily understood English, medium pitch, crisp confident pace, sharp and direct. | Luna (Persuasive) |

## Changes to existing Characters

- Marcus Rivera: voice Nathan to Marcus (was a duplicate of Cole).
- Sarah Okafor: voice Georgia to Clara (was a duplicate of Priya).
- Victoria Chen, Marcus Rivera, Sarah Okafor: the stored personalities still describe a live three-person panel with each other. The room is one-on-one; the push script replaces them with the role files.

## Images

All in `public/avatars/`, slug-named, downscaled to 1920px wide (the largest render is the counterpart stage's 5:3 tile). Runway holds the originals. New images are 16:9 to match the landscape tile.

## Runway Character ids

Captured from the Runway API on 2026-09-16. Register each against its pack persona once the persona exists in code.

| Slug | Character | Runway id |
|---|---|---|
| andrew-caldwell | Andrew Caldwell | 94f5e284-5874-476c-b1e7-ed5c953b2b51 |
| angela-whitfield | Angela Whitfield | 20c14a23-6368-4d53-ac6b-a8b4771fa45b |
| anjali-desai | Anjali Desai | 9592dfaa-acc9-4c43-89a3-d31c63a098ac |
| arjun-mehta | Arjun Mehta | 6beee5fc-69d1-4ab3-a8ee-18d9861d7b16 |
| camila-duarte | Camila Duarte | 6992442f-398e-40f0-93aa-323844f44e0a |
| cole-merritt | Cole Merritt | 958d917a-716e-4a10-933d-5b1fc9684c19 |
| daniel-osei | Daniel Osei | 973cec5d-f2c8-4b3c-acac-9d225614cbec |
| denise-jackson | Denise Jackson | e0d0a1d6-45e2-4100-9a66-fa84a4699540 |
| emily-hartman | Emily Hartman | 16e22462-0d03-4b97-8044-5f47932c9f70 |
| erik-larsen | Erik Larsen | 1b163e2e-8273-4d40-821c-d291666abc4e |
| greg-hollis | Greg Hollis | d5b2d794-35b9-41d1-99ad-0a74f14db53b |
| jun-park | Jun Park | e4da878f-8d71-430b-bf90-5bd17745922f |
| luis-ortega | Luis Ortega | 26a71a8b-1020-423a-bf14-8c526ac09b0e |
| malcolm-pierce | Malcolm Pierce | c46f24dc-1520-42b5-86d1-3ff266b4117f |
| marcus-rivera | Marcus Rivera | 4b0e4ef1-57b8-4144-b373-d95f1e8cf875 |
| mark-sorensen | Mark Sorensen | 0c665f5b-a187-4f86-87b2-986979e8a368 |
| megan-sullivan | Megan Sullivan | 2632f8f8-71de-4e35-8bf8-32fb08ffd061 |
| omar-nasser | Omar Nasser | afb922f6-119f-439c-b516-ba069ccd807a |
| priya-nair | Priya Nair | edf39a29-264d-41c0-94a4-4919157ab563 |
| renee-calloway | Renee Calloway | 5d44147b-82ab-40be-a863-ffafcfebe138 |
| ryan-mitchell | Ryan Mitchell | fcbaa9c2-7c69-4294-b593-38608dc543f3 |
| sarah-okafor | Sarah Okafor | 0e829c42-0163-495e-b644-fd018ee87f36 |
| tammy-nguyen | Tammy Nguyen | 8a60c7c9-e10c-420e-8c78-e948ee96ec85 |
| tom-hendricks | Tom Hendricks | 12cb3477-169e-4ee4-81ce-f7506ee1d4dc |
| tomas-reyes | Tomás Reyes | a0b8290c-d07e-4582-916d-f81041378728 |
| valeria-castillo | Valeria Castillo | 7597a32e-0340-4adb-b390-1fdc3dd3e521 |
| victoria-chen | Victoria Chen | c5c27032-9663-404e-9587-d5a25012d5da |
