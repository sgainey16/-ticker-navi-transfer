# THE TICKER WEBBING BIBLE — canonical product architecture

> From a sports database to a living hockey world. This is a product-architecture
> doc, not a marketing artifact. All future Ticker work should honour it.

## 1. Central idea
Hockey is already a web. The Ticker's job is to make the web visible and alive.
The database isn't the product — the CONNECTIONS are the product. Reggie + Marc
bring those connections to life.

## 2. The Webbing Rule
A Ticker story should rarely end where it began. Move naturally:
TEAM → PEOPLE → STORIES → CONNECTIONS → DISCOVERY.

## 3. Four directions of the web
- DOWN — into the people (League → Team → Player → story).
- UP — into the hockey world (Player → Team → Division → League).
- SIDEWAYS — through relationships (teammate → rival → draft class → hometown → NCAA → Europe → NHL).
- BACK — through history (season → era → alumni → hockey family → where are they now). History is PERSONALIZED, not dumped.

## 4. People first
The desk already knows the numbers; it must know when to LEAVE them.
Internal rhythm: SETTLE (what happened) → PEOPLE (who matters) → CONNECT (why it
connects to the fan's world) → INVITE (somewhere natural to go next — a statement,
not "would you like more info?").

## 5. Reggie AND Marc
The relationship is USER + REGGIE + MARC. Not user→chatbot→answer.
Reggie initiates/reacts/teases/connects/brings energy. Marc corrects/contextualizes/
remembers history/slows Reggie/surprises. Both interact with the fan. The user JOINS
the desk. Not interchangeable narrators.

## 6. Engagement ≠ interrogation
Prompt-fatigue + recommendation cooldowns. They don't end every thought with a
question. Sometimes they talk, sometimes they show, sometimes they shut up.
Objective: maximum relationship, minimum annoyance.

## 7. Every question does something
A conversational recommendation resolves into a real Ticker action. "He's in
Switzerland now" → tappable player. "Want me to keep an eye on him?" → Yes creates
the Follow. Conversation and navigation are the same system.

## 8. The Follow compounds
Once a fan follows a person, the Ticker carries that relationship forward as the
league changes around them (WHL → NCAA → AHL → NHL → Europe → coaching). It carries
their relationships forward for them.

## 9. Era intelligence
Learn the fan's hockey eras (age where known, teams/players followed, historical
stories opened, highlights watched, questions asked, alumni followed). Then history
becomes emotionally relevant, not a roster dump.

## 10. Relationship graph (target)
PERSON ↔ Team, League, Season, Era, Coach, Teammate, Opponent, Hometown, Family,
Draft, Camp, Tournament, School, Country, Former/Current team, Game, Event, Stat,
Highlight, Story. Elite Prospects fills historical career identity; Sportlogiq adds
analytics; Sportradar adds immediacy; youth providers add the beginning of the story.

## 11. Youth-to-pro
Don't build the 20-year database now — just make sure today's work doesn't throw away
tomorrow's history. Every season should enrich the graph automatically.

## 12. Local to global
Not "we cover Kamloops and also Sweden" — it's "Kamloops CONNECTS to Sweden" through
players, coaches, drafts, tournaments, families, and language.

## 13. Value to leagues/teams
A fan-development engine: help people discover players, understand teams, follow
careers, and get invested. A stronger proposition to rights holders than "give us
your highlights." Video improves the machine.

## 14. What we change NOW (no new APIs required)
Design the Team Desk around "MAKE ME CARE ABOUT THIS TEAM." Start with verified
standings/results, then move toward people wherever data permits. Never fabricate
missing stories. As new sources arrive, the SAME desk gets deeper.

## 15. The show should breathe (autoplay policy evolves)
- PRIMARY SHOW (Home / main Recap / maybe Next): may eventually be hands-free —
  the show starts and keeps going; the user can Mute/Stop. (Car / headphones / kitchen.)
- DISCOVERY DESKS (Team / Player / Game / Stats / individual objects): remain
  deliberate Play or Ask.
NOTE: the absolute "no autoplay anywhere" rule was for proving the audio architecture;
it is not necessarily the final experience. The user controls silence; the Ticker
supplies momentum.

## 16. Don't just make everything longer
Give every segment somewhere interesting to GO. Nothing verified worth saying → finish.
Six fascinating connections → keep moving. Interestingness determines duration, not a timer.

## 17. The Webbing test
Before surfacing any fact/story/destination, ask: "Why would THIS fan care about THIS
connection RIGHT NOW?" Strong answer → surface it. No answer → don't. Prevents trivia soup.

## 18. Ultimate experience
Open Ticker → Reggie + Marc already know your hockey world → catch you up → tell you
something new → introduce someone worth remembering → Marc ties it to your era →
Reggie remembers someone you followed → they take you Kamloops → NHL camp → a former
teammate now in NCAA (you follow him) → another in Switzerland (you hear it in English,
his family hears the WHL in German) → you ask, Marc disagrees, they chirp → you talk
hockey for another ten minutes, and your hockey web quietly gets better.

---

## Implementation status vs the Bible (living)
- §5 / §7 PROVEN on the TEAM PAGE (this build): live USER + REGGIE + MARC voice
  conversation, one shared context, grounded in the team's verified facts, with
  suggestions that resolve to real navigation OR a Follow (incl. voice-"yes" → Follow).
- §14 honoured: no new data providers added; conversation is grounded only in existing
  verified provider facts + a whitelist of linkable entities (no fabrication possible).
- §15 NOT yet applied: all desks remain deliberate-Play (no autoplay) for now. The
  PRIMARY-SHOW hands-free relaxation is a FUTURE, separately-approved change.
- §8/§9/§10/§11 (Follow-carry-forward, era intelligence, full relationship graph,
  youth-to-pro) are FUTURE and depend on Elite Prospects / Sportlogiq / youth sources.
- Scope guardrails still in force: no Highlightly, no Sportlogiq, no AI play-by-play,
  no new leagues, no page redesigns until separately approved.
