# PranVayu: submission kit

Judging, as listed on the event page: Idea and Impact; Built on AWS; Design and usability; The execution; The demo video. Each track is judged on its own. "A small problem solved well beats a big one solved vaguely." "One feature that runs beats five that almost do." There is no live demo, so the video is what the judges see.

Re-read the Rules tab at 08:00. Where this kit and the live rules differ, the live rules win. Items marked (verify) come from my reading of the rules earlier and from the event page; check them against the text.

## 1. Rules and eligibility checklist

- [ ] Student verified on AWS Builder Center (required to compete).
- [ ] Team registered (code ACHYRS, name PranVayu). Team cannot change after submit. Decide teammates before submitting.
- [ ] Uses an AWS open-source tool or is deployed on AWS (we do both: SAM CLI and Lambda, API Gateway, DynamoDB, S3, EventBridge, Amplify Hosting; Strands only if P1 shipped).
- [ ] Project is new: repo created during the event, first commit on or after Oct 8, history consistent with the event dates (verify).
- [ ] No code, weights or data files carried from VayuMind or JointPINN. Domain knowledge only.
- [ ] Public GitHub repository with the full source.
- [ ] Demo video: 3 minutes or less, on YouTube, shows what it does, who it is for, where AWS fits (verify the visibility requirement; default public).
- [ ] Writeup in the submission form.
- [ ] AI tools used are listed (README and form), as the rules ask (verify).
- [ ] Blog published on AWS Builder Center and linked in the submission (for the AirPods blog prize; the page says to link it in your submission).
- [ ] Track selected: Air.
- [ ] Submit before the deadline, with the buffer. Open the submitted entry afterwards and click every link.

## 2. Repository readiness (Gate G5)

- [ ] README: what it is in two sentences, live URL, screenshot, architecture picture, data sources and licences, limits, how to run on fixtures, how to deploy, AI tools used.
- [ ] `docs/` contains the pack, `docs/BUILD-LOG.md` has real entries.
- [ ] `LICENSE` file (MIT or Apache-2.0).
- [ ] No secrets in the tree or git history (search for the MAP_KEY and OpenAQ key strings; check `.env` is ignored).
- [ ] No force-push, no rewritten history.
- [ ] `make test` passes offline.
- [ ] `config/` has the generated calibration files from the final evaluation run, and `evidence/` holds the JSON the live page shows.
- [ ] Attribution on the method page: Open-Meteo (CC BY 4.0), Copernicus CAMS, NASA FIRMS, OpenAQ, CPCB data source, OpenStreetMap if a map is used.
- [ ] The disclaimer is visible: advisory, not medical advice, not official; follow school and CAQM orders.

## 3. Demo video (3:00 maximum, aim for 2:45)

Record the live site on a phone-width browser window for the app parts and the AWS console in a second window. 1080p, clear voice, no music needed. Write the narration from the script below in your own words; read it aloud twice before recording. Burn in captions if you can; judges may watch muted.

| Time | Show | Say (idea, not a script to read out) |
|---|---|---|
| 0:00 to 0:20 | A school gate in the morning, or the home screen at 7 am | Delhi parents decide at night whether tomorrow's assembly or PE happens outdoors. AQI numbers do not tell them that, and smoke from stubble fires arrives on its own schedule |
| 0:20 to 1:15 | Home screen: pick Dwarka, headline, timetable rows, expand PE, change a time | The school day is the interface. Go, limit, skip for each period, with the range and the threshold behind it. Editing a time recomputes in the browser |
| 1:15 to 1:45 | Air line, smoke card, why block, confidence and freshness | Smoke window from 24 to 48 hours out, as a range, with a confidence label. Smoke is one cause among several; the app says so |
| 1:45 to 2:10 | Replay and evidence page | We ran a past stubble event through the same pipeline and published how it did against simple baselines, including where it failed |
| 2:10 to 2:40 | AWS console: EventBridge schedules, Lambda functions and a recent invocation, DynamoDB item, API Gateway route, Amplify app, CloudWatch alarm; then the architecture picture | Hourly jobs fetch fires, winds, CAMS and station data; a model Lambda writes the answer to DynamoDB; the API only reads, so a worried parent at 9 pm never waits on an external service |
| 2:40 to 3:00 | Method page limits line, then the URL | What it cannot know, who it is for, where to try it |

Rules of thumb for the video: show real data, not the mock; show a real timestamp; do not read numbers aloud that you cannot defend; the AWS segment must show actual console pages with your resources, not slides alone.

## 4. Where each judging criterion is answered

| Criterion | Evidence in the product |
|---|---|
| Idea and impact | Narrow user (parent) and decision (school-day outdoor activity); Delhi stubble season; evidence table in the PRD; honest limits |
| Built on AWS | Deployed serverless pipeline, console segment in the video, IaC in `infra/template.yaml`, architecture picture |
| Design and usability | School-diary timetable, 20-second test result, bilingual, states, accessibility |
| Execution | Live URL with fresh data, tests, health endpoint, alarms, replay |
| Demo video | Section 3 |

## 5. Submission form writeup (about 250 words; fill the brackets with real results)

> **Problem.** In Delhi's stubble-burning season, parents and schools decide the day before whether assembly, break and PE happen outdoors. A single AQI figure does not answer that, and smoke from fires in Punjab and Haryana arrives on a schedule that depends on winds.
>
> **What we built.** PranVayu gives a school-day answer for 12 Delhi localities: Go, Limit or Skip for each period, the cleanest window of the day, a 48-hour air line with an uncertainty band, and a smoke arrival range from an ensemble of backward trajectories scored against recent satellite fire detections. It shows confidence and data age on every screen, in English and Hindi.
>
> **How it works.** [One sentence on the pipeline.] Station readings correct the CAMS forecast; rules, not a language model, produce the verdicts.
>
> **How we checked it.** We replayed [window] through the same code and compared it with fire-count and wind-direction baselines and persistence. [Two honest numbers, including one that looks bad.] The evidence page publishes all of it.
>
> **On AWS.** EventBridge, Lambda, S3, DynamoDB, API Gateway, Amplify Hosting, CloudWatch, deployed with SAM. [Bedrock/Strands only if shipped.]
>
> **Limits.** Smoke share of Delhi PM2.5 is uncertain; we show influence, not percentages. Thresholds are a proposal aligned to CPCB category edges. Not medical advice; follow CAQM and school orders.

## 6. Builder Center blog outline

Title: a plain description, for example "Telling a Delhi parent whether PE can happen outside tomorrow". Sections:
1. The decision a parent actually makes (one paragraph, a real example).
2. Why not a dashboard (what we rejected).
3. The pipeline on AWS (picture, why precompute, cost).
4. The smoke arrival estimate and why it is a range.
5. What fought back: pull the real entries from `docs/BUILD-LOG.md` (rate limits, stale stations, Lambda time, the first replay results).
6. What the replay told us, including the part that did not work.
7. What we would do next, with limits.
The prize is for the top blogs, so specific, first-person problems beat generic tutorial text.

## 7. AI tools disclosure (README and form)

List exactly what was used and for what, for example: "Claude (Anthropic) for requirements, architecture and documentation drafting; Claude Code and/or Google Antigravity for implementation under the written specifications in `docs/`. All code was reviewed and run by the team. No code, weights or data from earlier projects were used." Edit to match what actually happened.

## 8. Claims guard

Do not say:
- that smoke "causes" a stated share of Delhi's PM2.5;
- that the app predicts air quality with a stated accuracy unless the evidence page shows it and the data mode is named;
- "real-time" for anything older than the freshness line says;
- that it is validated, certified or official;
- that Hindi text was reviewed unless it was.

Do say what the evidence page shows, including negative results.

## 9. Final hour checklist

- [ ] Live site loads on a phone on mobile data, shows data under 90 minutes old.
- [ ] Video plays logged out of YouTube and is 3:00 or less.
- [ ] Repo opens logged out, README renders, no secrets.
- [ ] Blog is public and linked.
- [ ] Form submitted; confirmation seen; entry re-opened and every link clicked.
- [ ] AWS budget alert set so the account stays within credits after the event.
