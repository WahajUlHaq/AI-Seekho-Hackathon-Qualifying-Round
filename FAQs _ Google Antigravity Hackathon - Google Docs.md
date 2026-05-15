

This document addresses frequently asked questions regarding eligibility,
timelines, submissions, platform usage, credits, evaluation process, and
participation guidelines. Shortlisted participants must review this alongside the
Challenges Document and official instructions.
Q1. Can team leads apply or pitch solo without a team?
No. A minimum team of  2 members  is mandatory for pitching  rounds. Max is 5
members
Q2. Are tech enthusiasts under 18 eligible for the hackathon?
The age limit for participants MUST 18 – 45 years.
Q3. What is the submission process and timeline?
Selected participants should have received the Challenges Document and a Google
Form for Challenge Selection. Please read both thoroughly.
## Important Dates:
May 15, 2026  Deadline to select and submit your  challenge/idea. You need to
select only 1 challenge and the deploy your solution
May 20, 2026  Final project submission deadline (Instructions  for submission will
be shared separately)
## May 25–26, 2026  Virtual Regional Pitching Rounds
June 07, 2026  National Finale in Islamabad (Logistic  support will be provided
ONLY from Lahore/ Karachi to Islamabad)
From all submissions,  10–15 teams will be shortlisted  from each regions for virtual
pitching. Regional winners/runners-up will qualify for the National Finale.

Q4. Can we use tools like n8n, Google AI Studio, Vertex AI, LangGraph, CrewAI,
or external services with Antigravity?
Yes.  As long as Antigravity remains the main orchestrator  and development logs/
reasoning traces can be submitted. You are free to build agents in any framework
(Vertex AI, LangGraph, etc.) and connect them via Antigravity.
Q5. Are the provided $5 credits enough for the hackathon?
Each team member will get $5 credit. We can facilitate teams with  additional GCP
credits  as required. These credits are intended for  solution development on Google
Cloud Platform services.
Q7. Can we use other LLMs inside Antigravity?
Yes.  As long as your solution operates within the  Antigravity environment, you may
integrate other LLMs.
Q8. Is Mobile app mandatory?
Yes.  Yes Mobile app is mandatory for all challenges.  Web app is optional.
Q9. Do we have to submit the final solution on May 15?
No.  May 15 is only for challenge/idea selection. The  final project submission is due  May
## 20, 2026  .
Q10. Can we use our previous Phase #1 project in the Hackathon?
No, You will build your solution based on the explicit requirements of the selected
challenge.
Q11. Can we make changes in the team composition?
Yes.  You may make changes to your team composition  during the development phase.
However, you will be required to submit the finalized team details along with your final
project submission.
## App & Platform Requirements

Q12: Is a full mobile app required, or can teams build a web app/dashboard and
keep the mobile app minimal (e.g., just for alerts)?
A: A working prototype with a mobile app is mandatory across all challenges, while a
web app or dashboard is strictly optional.
Q13: Are Progressive Web Apps (PWAs) allowed (converting a web app to an
APK), or does the app need to be built and compiled natively (e.g., using Kotlin)?
A: Only APKs are acceptable.
Q14: Can teams use a pre-existing MVP and simply integrate Antigravity features
into it, or must the project be built entirely from scratch?
A: The project must be built in Antigravity and from scratch.
Q15: Are participants allowed to build an app that falls outside of the 4 official
challenges?
## A:  NO
Antigravity & AI Tools
Q16: Are participants strictly required to use Antigravity, or are other AI models
and chatbots (like Claude Pro) allowed?
A: You must use Google Antigravity as the core platform or orchestrator. However, you
are allowed to use external LLMs, APIs, databases, and visualization tools as long as
Antigravity remains in control of the central agentic logic and workflows.
Q17: What is the minimum required use of Antigravity? Does it only need to act
as the agent planner?
A: Antigravity must be the primary orchestrator for complex workflows like intent
understanding, reasoning, planning, tool/API integration, and action execution.
Q18: Can teams use extensions within Antigravity?
## A: Yes
Q19: Are there Antigravity credits provided, and is a $5 credit limit for the whole
team enough to build the required solution?
A: Only Google Cloud Credits are provided. Initially $5 each and can be asked multiple
times for each member if expended.

APIs & Technical Implementation
Q20: How should teams provide or log the prompts and transactions they used?
A: You must submit Antigravity agent traces or logs that explicitly show the IDE's
reasoning steps, task plans, tool calls, decision rationale, action execution, and
fallback/recovery behavior.
Q21: Where can teams get API keys for services like Google Maps, weather data,
or emergency alerts?
A: All Google Cloud APIs can be used through Cloud Credits. For other use cases, any
free versions of APIs can be used.
## Submissions & Demos
Q22: For the demo video, can the presentation be in Urdu, or is English
mandatory? Are AI-generated voices allowed for the voiceover, or must
participants use their real voices?
A: Your presentations should clearly showcase the product and solution you have built.
There is no compulsion of English or method to make the demos.
Q23: If the Antigravity setup being used doesn't natively support simulation, how
should the team demonstrate the workflow?
A:  Antigravity is an IDE. For simulation of workflows, you will have to simulate the use
case through the app you have built.
Q23: For the grand finale, do teams need to build a brand-new app, or are they
expected to improve the same app submitted during the regional rounds?
A: Details for the Final challenge will be shared after Regional Rounds are over.
Important Note:  Please ask all questions within the  official community channels or
Discord. Queries will not be addressed via direct messages.

## SHARED SUBMISSION CHECKLIST
●  Working prototype  : Mobile app is mandatory for all  challenges. Web app/dashboard is
optional unless needed for demonstration.
●  Demo video  : 3-5 minutes for Challenges 1-3; around  3 minutes for Challenge 4. Must
show agentic workflow end to end.
●  Demo video:  2–3-minute video which shows a screen  recording on how your team
made use of Antigravity solutions
●  Antigravity trace/logs  : Workplan, task plan, agent  observations, reasoning, decisions,
tool calls, action execution, error recovery, and final outcomes.
●  README/documentation  : Architecture, data schemas,  tools/APIs, Antigravity role,
setup steps, assumptions, privacy note, cost/latency, scalability, baseline comparison,
and limitations.
●  Baseline comparison  : Show how agentic system performs  better than simple heuristic
or non-agentic implementation.
●  Robustness evidence  : At least one failure, edge case,  contradiction, missing data, or
fallback scenario demonstrated.
●  Cost and scalability note  : Cost per operation or API  call estimate; 10x/100x scaling
discussion; latency or throughput estimate.

Challenge 1: Autonomous Content-to-Action Agent (Insight → Action System)
## CHALLENGE OVERVIEW
Organizations are flooded with reports, dashboards, news, policy updates, spreadsheets,
customer feedback, and operational signals. Most AI systems stop at summarization. This
challenge requires teams to build an agentic system that understands multi-source content,
extracts meaningful insights, resolves conflicting evidence, decides what should be done,
executes simulated action chains, and shows measurable outcome changes.
## PROBLEM STATEMENT
●  Ingest multiple content sources at the same time, including unstructured,
semi-structured, and structured inputs.
●  Extract meaningful insights, trends, risks, contradictions, and opportunities.
●  Analyze implications under real-world constraints such as cost, time, resources, urgency,
and API limits.
●  Generate and prioritize 3-5 interconnected actions instead of a single action.
●  Simulate execution of the action chain with visible state changes after every step.
●  Recover from partial failures, conflicting evidence, or missing data through fallback or
clarification actions.
## MANDATORY REQUIREMENT: GOOGLE ANTIGRAVITY
●  Use Google Antigravity as the core platform for agent orchestration, reasoning, planning,
tool/API integration, and action execution.
●  Use Antigravity logs to show the workplan, task plan, decision trace, tool calls, action
execution, and recovery steps.
●  External LLMs, APIs, databases, dashboards, and visualization tools are allowed, but
Antigravity must remain central to the system logic.
## SYSTEM REQUIREMENTS
●  Advanced content understanding  : Process at least five  input items across multiple
types: PDF/report, website/article, CSV/JSON, table/dashboard, and mock real-time
feed.
●  Temporal analysis  : Detect how key signals change over  time, such as sales decline,
inventory shortage, complaint spike, price change, or public sentiment shift.
●  Contradiction detection  : Identify conflicting claims  across sources, score source
credibility and recency, and propose resolution actions.

●  Noise filtering  : Separate real signals from irrelevant, duplicate, spam-like, stale, or
low-credibility content.
●  Insight resolution  : When data conflicts, explain the  conflict and generate an
investigation path instead of forcing a false conclusion.
●  Multi-step action chain  : Each scenario must trigger  3-5 connected actions, such as
diagnose cause -> notify stakeholder -> update system -> launch mitigation -> schedule
follow-up monitoring.
●  Constraint-based decision-making  : Attach budget, time,  resource, urgency, and
rate-limit constraints to actions. The system must choose feasible actions and
reject/modify infeasible ones.
●  Failure recovery and rollback  : Show what happens if  one action fails, such as API
failure, invalid data, notification failure, or rejected update. Recover, retry, or roll back
state.
●  Outcome visualization  : Show before vs after state,  action logs, cost/latency metrics,
and projected impact.
## EXAMPLE SCENARIO
Input  : Five sources indicate a possible inventory  shortage: warehouse spreadsheet, supplier
email, sales dashboard, customer complaints, and news about transport delays. One source
says stock is sufficient while another says stock will run out in two days.
●  Insight:  Demand is rising while supplier reliability  is falling; one source is stale and
contradicts newer data.
●  Resolution logic:  Check timestamp, credibility, and  affected SKUs; mark the older
warehouse sheet as stale.
●  Action chain:  1) validate stock, 2) notify procurement,  3) simulate emergency order, 4)
update customer delivery estimates, 5) schedule 24-hour monitoring.
●  Constraints:  Emergency order budget limit PKR equivalent,  supplier lead-time limit, and
notification deadline.
●  Outcome:  Dashboard shows reduced stockout risk, updated  supplier status, customer
notification draft, and cost/latency summary.
## RECOMMENDED STRESS-TEST SCENARIOS
●  Same metric appears in three sources with conflicting values.
●  Recommended action violates budget or deadline constraints.
●  One action in the chain fails and must be retried, replaced, or rolled back.
●  A low-credibility source creates a false signal that the system must down-rank.
●  One action creates a side effect in another business area, requiring what-if analysis.
## DELIVERABLES

●  Working prototype with a mobile app as mandatory and web app as optional.
●  Demo video of 3-5 minutes showing input -> insight -> contradiction or constraint
handling -> action chain -> simulation -> outcome.
●  Antigravity agent trace/logs showing workplan, task plan, reasoning steps, tool calls,
decisions, failures, and recovery.
●  README with architecture, data sources, tools/APIs, Antigravity role, assumptions,
constraints, cost/latency analysis, baseline comparison, and limitations.
## EVALUATION CRITERIA
●  Antigravity integration 20%
●  Agentic reasoning and workflow 20%
●  Insight quality and contradiction handling 20%
●  Action chain and outcome simulation 15%
●  Robustness, scalability, cost and latency 15%
●  Innovation and UX 10%