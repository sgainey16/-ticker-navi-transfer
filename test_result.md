#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## user_problem_statement: "Universal Highlightly rollout + game-centered highlights. One reusable Highlightly adapter + league registry across 7 leagues (NHL, AHL, ECHL, WHL, OHL, QMJHL, NCAA), additive to existing NHL/HockeyTech feeds. Organize verified video around the GAME (recap video first) into the Ticker game package. No redesign of Live Desk / PLAY·TALK·STOP."

## backend:
##   - task: "Highlightly universal adapter + endpoints"
##     implemented: true
##     working: true
##     file: "/app/backend/highlightly.py, /app/backend/server.py"
##     stuck_count: 0
##     status_history:
##       - working: true
##         agent: "main"
##         comment: "New highlightly.py: HL_LEAGUES registry (7 leagues), lazy key read, in-memory TTL cache (15m), nickname+date matcher. Endpoints: GET /api/highlights?league=&limit= (league feed), GET /api/highlights/match?league=&home=&away=&date= (game package recap+clips). /api/leagues now includes video capability. Verified via curl: NHL Cup Final Game 6 (Carolina@Vegas 2026-06-14) matches exact recap clip yt=3jbQ58HKtXA, series disambiguated by date. All 7 league IDs resolve and return real clips."

## frontend:
##   - task: "Game-centered Highlights module (video-first)"
##     implemented: true
##     working: true
##     file: "/app/frontend/src/components/HighlightsModule.tsx, /app/frontend/src/components/YoutubeInline.tsx(.web.tsx), /app/frontend/app/game/[id].tsx, /app/frontend/src/lib/api.ts"
##     stuck_count: 0
##     status_history:
##       - working: true
##         agent: "main"
##         comment: "HighlightsModule renders on final game pages above the Reggie+Marc desk: recap video hero (thumbnail+play), MORE FROM THIS MATCHUP rail, 'Verified video · Highlightly' credit. Native taps open inline react-native-youtube-iframe player in a modal; web opens verified source URL via Linking (youtube-iframe isolated behind YoutubeInline.web.tsx so web bundle is not broken). Renders nothing when no clip matched. Web smoke screenshot on /game/2025030416 shows real Cup Final Game 6 recap thumbnail + GAME RECAP badge."

## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 1

## test_plan:
##   current_focus:
##     - "Highlightly universal adapter + endpoints"
##     - "Game-centered Highlights module (video-first)"
##   stuck_tasks: []
##   test_all: false
##   test_priority: "high_first"

## agent_communication:
##   - agent: "main"
##     message: "Please test: (1) GET /api/highlights?league=nhl&limit=5 returns clips with youtube_id+thumbnail+title. (2) GET /api/highlights/match for NHL game 2025030416 (home='Vegas Golden Knights' away='Carolina Hurricanes' date='2026-06-15T00:00:00Z') returns recap with youtube_id 3jbQ58HKtXA. (3) /api/leagues includes capabilities.video=true for nhl/whl. (4) unsupported/empty case: match with nonsense teams returns recap:null, clips:[]. (5) Frontend: /game/2025030416 shows HIGHLIGHTS section with recap thumbnail above GAME DESK; module renders nothing on a game with no match. Do NOT test Live Desk PLAY/TALK/STOP (frozen)."
