// netlify/functions/ask.js
// Netlify Function. Receives the conversation so far,
// checks a shared password, applies a light rate limit, prepends the survey
// RULES + DATA PACK as a cached system prompt, and calls the Anthropic API
// directly with a server-side key. The API key and password never reach the
// browser.

const RULES_AND_DATA = `You are "Ask the Survey", an internal u‑mee staff tool that answers questions about u‑mee's customer survey data (2024, 2025 and 2026 waves). You must answer ONLY using the JSON data pack provided below - never invent, estimate, or assume a number that is not directly derivable from it.

RULES (follow strictly):
1. Every number in your answer must come from the data pack, or be a direct arithmetic calculation from numbers in it. If asked for something the data pack does not contain (a year not covered, a breakdown not present, e.g. respondent-level age/gender/income which this survey never collected), set "cannot_answer": true, explain briefly what's missing, and suggest what IS available instead.
2. When a question spans years or a metric that was not asked in every year (see meta.questions_not_asked_every_year), say so explicitly rather than comparing silently across an gap.
3. When interpreting a subjective word the respondent used ("unhappy", "biggest complaint"), state the assumption you used (e.g. "unhappy = rated 1 or 2 out of 5") in the calculation object.
4. Percentages: round to 1 decimal place. Always be ready to state the underlying sample size (n) - never give a percentage without knowing its n.
5. Distinguish clearly between: (a) what the data directly shows, (b) a correlation/pattern across two data points, (c) a possible explanation you are inferring. Never state (c) as if it were (a).
6. Keep "headline" short (one or two sentences, the direct answer up front, can use **bold** around the key number). Keep "detail" to 1-4 sentences of supporting context.
7. Use "table" only for genuine multi-row/multi-year comparisons. Use "chart" only when a bar or line chart would clearly aid understanding of a trend or comparison (do not add one to every answer).
8. This is a follow-up-aware conversation - if the user's question is short/ambiguous like "what about 2024?" or "why?", interpret it in light of the previous exchange in this conversation.
9. Reply with ONLY one JSON object, no other text, matching exactly this shape:
{
 "headline": string,
 "detail": string,
 "table": null | {"columns": [string,...], "rows": [[string,...], ...]},
 "chart": null | {"type": "bar"|"line", "title": string, "categories": [string,...], "series": [{"name": string, "values": [number,...]}, ...]},
 "calculation": null | {"survey_year": string, "question": string, "valid_responses": number, "matching": number|null, "calculation_text": string, "filters_applied": string|null},
 "comparability_note": null | string,
 "cannot_answer": boolean,
 "suggested_followups": [string, string, string]
}

DATA PACK (u‑mee customer survey, 2024-2026):
{"meta":{"years_covered":[2024,2025,2026],"note_years":"No 2023 data exists in any form. 2026 data is provisional, collected 17 Aug - 8 Sep 2026 (survey still fielding); 2024 and 2025 are complete annual waves.","respondents":{"2024":1423,"2025":2233,"2026":1414},"respondent_note_2024":"2024's raw export had 4,288 rows but only 1,423 were validated as genuine unique respondents (survey tool created duplicate resubmission rows); all 2024 figures here already use the cleaned 1,423 base.","questions_not_asked_every_year":"eero, Amazon devices, GT Fibre/competitor questions, social media, and household age-bracket composition were NOT asked in 2024 (pre-eero rollout) - only in 2025 and 2026. Router-brand 'Nokia' question is NEW in 2026 only.","no_individual_respondent_demographics":"The survey does NOT record each respondent's own age, gender, or income. 'household_composition' below is a COUNT of people in each age bracket living in the household, not the respondent's age - so questions like 'which age group is most likely to use eero' CANNOT be answered directly from this data; only household-level presence of children can be assessed."},"field_legend":{"pct_yes":"% of valid respondents who answered Yes to a Yes/No question","pct":"% of respondents matching a category (denominator noted separately as n/denom)","n":"sample size (number of respondents who answered this specific question)","denom":"the denominator used for a pct calculation, when different from n","mean":"average rating on a 1-5 scale (1=worst, 5=best) unless noted otherwise","dist":"count of respondents choosing each rating value, e.g. {'1':4,'2':21,'3':195,'4':660,'5':543} - sum equals n. Use this to answer 'how many were unhappy' type questions (typically ratings of 1-2 = unhappy/dissatisfied, 4-5 = happy/satisfied, unless the user specifies otherwise - state this assumption in the calculation notes)"},"overall_happy_yes_no":{"2024":{"pct_yes":98.3,"n":1423},"2025":{"pct_yes":97.7,"n":2233},"2026":{"pct_yes":97.2,"n":1414}},"would_recommend_yes_no":{"2024":{"pct_yes":98.0,"n":1423},"2025":{"pct_yes":97.0,"n":2233},"2026":{"pct_yes":96.7,"n":1414}},"umee_service_ratings_1to5":{"Features":{"2024":{"mean":4.21,"n":1423,"dist":{"1":4,"2":21,"3":195,"4":660,"5":543}},"2025":{"mean":4.21,"n":2233,"dist":{"1":7,"2":29,"3":309,"4":1032,"5":856}},"2026":{"mean":4.22,"n":1414,"dist":{"1":4,"2":19,"3":192,"4":641,"5":558}}},"Reliability":{"2024":{"mean":4.31,"n":1423,"dist":{"1":8,"2":30,"3":147,"4":568,"5":670}},"2025":{"mean":4.32,"n":2233,"dist":{"1":12,"2":43,"3":231,"4":879,"5":1068}},"2026":{"mean":4.3,"n":1414,"dist":{"1":11,"2":32,"3":151,"4":544,"5":676}}},"Quality":{"2024":{"mean":4.33,"n":1423,"dist":{"1":12,"2":22,"3":146,"4":547,"5":696}},"2025":{"mean":4.32,"n":2233,"dist":{"1":10,"2":38,"3":243,"4":868,"5":1074}},"2026":{"mean":4.31,"n":1414,"dist":{"1":6,"2":34,"3":149,"4":547,"5":678}}},"Support":{"2024":{"mean":4.35,"n":1325,"dist":{"1.0":21,"2.0":36,"3.0":140,"4.0":383,"5.0":745}},"2025":{"mean":4.31,"n":2107,"dist":{"1.0":30,"2.0":59,"3.0":274,"4.0":610,"5.0":1134}},"2026":{"mean":4.31,"n":1270,"dist":{"1":15,"2":71,"3":132,"4":345,"5":707}}},"Value":{"2024":{"mean":4.1,"n":1423,"dist":{"1":10,"2":46,"3":265,"4":566,"5":536}},"2025":{"mean":3.93,"n":2233,"dist":{"1":31,"2":97,"3":536,"4":901,"5":668}},"2026":{"mean":3.97,"n":1414,"dist":{"1":16,"2":60,"3":328,"4":559,"5":451}}}},"importance_of_decision_factors_1to5":{"Bandwidth":{"2024":{"mean":4.47,"n":1423,"dist":{"1":15,"2":12,"3":141,"4":382,"5":873}},"2025":{"mean":4.38,"n":2233,"dist":{"1":28,"2":25,"3":256,"4":677,"5":1247}},"2026":{"mean":4.43,"n":1414,"dist":{"1":12,"2":25,"3":140,"4":408,"5":829}}},"Wi-Fi":{"2024":{"mean":4.4,"n":1423,"dist":{"1":41,"2":22,"3":136,"4":356,"5":868}},"2025":{"mean":4.35,"n":2233,"dist":{"1":56,"2":29,"3":235,"4":666,"5":1247}},"2026":{"mean":4.36,"n":1414,"dist":{"1":33,"2":35,"3":142,"4":385,"5":819}}},"TV Platform":{"2024":{"mean":4.37,"n":1423,"dist":{"1":31,"2":27,"3":143,"4":408,"5":814}},"2025":{"mean":4.31,"n":2233,"dist":{"1":48,"2":50,"3":281,"4":637,"5":1217}},"2026":{"mean":4.34,"n":1414,"dist":{"1":26,"2":32,"3":151,"4":430,"5":775}}},"Smart DNS":{"2024":{"mean":4.05,"n":1423,"dist":{"1":74,"2":66,"3":245,"4":365,"5":673}},"2025":{"mean":4.01,"n":2233,"dist":{"1":111,"2":108,"3":405,"4":625,"5":984}},"2026":{"mean":4.04,"n":1414,"dist":{"1":70,"2":69,"3":238,"4":392,"5":645}}},"Talk":{"2024":{"mean":3.08,"n":1423,"dist":{"1":376,"2":163,"3":248,"4":241,"5":395}},"2025":{"mean":3.08,"n":2233,"dist":{"1":595,"2":212,"3":432,"4":405,"5":589}},"2026":{"mean":3.02,"n":1414,"dist":{"1":388,"2":145,"3":281,"4":255,"5":345}}},"Apps":{"2024":{"mean":3.49,"n":1423,"dist":{"1":189,"2":135,"3":307,"4":368,"5":424}},"2025":{"mean":3.45,"n":2233,"dist":{"1":298,"2":227,"3":524,"4":550,"5":634}},"2026":{"mean":3.43,"n":1414,"dist":{"1":190,"2":138,"3":338,"4":375,"5":373}}}},"home_wifi_rating_1to5":{"Reliability of coverage":{"2024":{"mean":3.92,"n":1423,"dist":{"1":24,"2":89,"3":305,"4":570,"5":435}},"2025":{"mean":4.19,"n":2233,"dist":{"1":22,"2":65,"3":310,"4":902,"5":934}},"2026":{"mean":4.15,"n":1414,"dist":{"1":15,"2":44,"3":208,"4":594,"5":553}}},"Speed near router":{"2024":{"mean":4.46,"n":1423,"dist":{"1":10,"2":13,"3":106,"4":478,"5":816}},"2025":{"mean":4.5,"n":2233,"dist":{"1":16,"2":26,"3":156,"4":666,"5":1369}},"2026":{"mean":4.51,"n":1414,"dist":{"1":5,"2":14,"3":101,"4":429,"5":865}}},"Speed at worst spot":{"2024":{"mean":2.99,"n":1423,"dist":{"1":248,"2":276,"3":355,"4":337,"5":207}},"2025":{"mean":3.43,"n":2233,"dist":{"1":218,"2":293,"3":548,"4":669,"5":505}},"2026":{"mean":3.47,"n":1414,"dist":{"1":107,"2":192,"3":377,"4":411,"5":327}}}},"tv_feature_importance_1to5":{"TV Guide":{"2024":{"mean":4.26,"n":1423,"dist":{"1":63,"2":39,"3":179,"4":323,"5":819}},"2025":{"mean":4.28,"n":2200,"dist":{"1.0":65,"2.0":61,"3.0":292,"4.0":546,"5.0":1236}},"2026":{"mean":4.24,"n":1376,"dist":{"1":63,"2":42,"3":188,"4":295,"5":788}}},"Catch-up":{"2024":{"mean":4.36,"n":1423,"dist":{"1":59,"2":47,"3":139,"4":252,"5":926}},"2025":{"mean":4.38,"n":2200,"dist":{"1.0":80,"2.0":63,"3.0":200,"4.0":449,"5.0":1408}},"2026":{"mean":4.3,"n":1376,"dist":{"1":63,"2":42,"3":147,"4":285,"5":839}}},"Personal recordings":{"2024":{"mean":3.44,"n":1423,"dist":{"1":218,"2":181,"3":275,"4":261,"5":488}},"2025":{"mean":3.5,"n":2200,"dist":{"1.0":327,"2.0":214,"3.0":460,"4.0":422,"5.0":777}},"2026":{"mean":3.49,"n":1376,"dist":{"1":202,"2":134,"3":297,"4":275,"5":468}}},"Series-link recordings":{"2024":{"mean":3.24,"n":1423,"dist":{"1":264,"2":186,"3":313,"4":260,"5":400}},"2025":{"mean":3.3,"n":2200,"dist":{"1.0":407,"2.0":236,"3.0":499,"4.0":413,"5.0":645}},"2026":{"mean":3.31,"n":1376,"dist":{"1":242,"2":142,"3":325,"4":282,"5":385}}}},"tv_vs_competitors_rating_1to5":{"Channels":{"2024":{"mean":4.61,"n":1344,"dist":{"1.0":7,"2.0":12,"3.0":65,"4.0":329,"5.0":931}},"2025":{"mean":4.59,"n":2072,"dist":{"1.0":12,"2.0":12,"3.0":124,"4.0":527,"5.0":1397}},"2026":{"mean":4.44,"n":1075,"dist":{"1":11,"2":19,"3":101,"4":301,"5":643}}},"Reliability":{"2024":{"mean":4.5,"n":1345,"dist":{"1.0":10,"2.0":16,"3.0":77,"4.0":435,"5.0":807}},"2025":{"mean":4.49,"n":2073,"dist":{"1.0":15,"2.0":26,"3.0":140,"4.0":649,"5.0":1243}},"2026":{"mean":4.4,"n":1089,"dist":{"1":9,"2":24,"3":114,"4":315,"5":627}}},"Picture quality":{"2024":{"mean":4.54,"n":1331,"dist":{"1.0":7,"2.0":16,"3.0":79,"4.0":382,"5.0":847}},"2025":{"mean":4.5,"n":2062,"dist":{"1.0":11,"2.0":40,"3.0":139,"4.0":594,"5.0":1278}},"2026":{"mean":4.4,"n":1084,"dist":{"1":7,"2":20,"3":106,"4":346,"5":605}}},"Programme guide":{"2024":{"mean":4.58,"n":1319,"dist":{"1.0":10,"2.0":6,"3.0":69,"4.0":358,"5.0":876}},"2025":{"mean":4.54,"n":2052,"dist":{"1.0":17,"2.0":22,"3.0":130,"4.0":546,"5.0":1337}},"2026":{"mean":4.45,"n":1083,"dist":{"1":7,"2":24,"3":95,"4":307,"5":650}}},"Catch-up":{"2024":{"mean":4.44,"n":1293,"dist":{"1.0":13,"2.0":24,"3.0":117,"4.0":363,"5.0":776}},"2025":{"mean":4.44,"n":2019,"dist":{"1.0":16,"2.0":56,"3.0":183,"4.0":538,"5.0":1226}},"2026":{"mean":4.36,"n":1075,"dist":{"1":8,"2":35,"3":123,"4":310,"5":599}}},"Personal recordings":{"2024":{"mean":4.13,"n":1127,"dist":{"1.0":33,"2.0":52,"3.0":180,"4.0":331,"5.0":531}},"2025":{"mean":4.16,"n":1807,"dist":{"1.0":58,"2.0":89,"3.0":273,"4.0":466,"5.0":921}},"2026":{"mean":4.05,"n":988,"dist":{"1":26,"2":53,"3":188,"4":300,"5":421}}}},"satisfied_with_alternative_content_options_yes_no":{"2024":{"pct_yes":86.3,"n":1423},"2025":{"pct_yes":85.8,"n":2233},"2026":{"pct_yes":86.3,"n":1414}},"streaming_setup_ease_1to5":{"2024":{"mean":3.87,"n":1335,"dist":{"1.0":71,"2.0":69,"3.0":309,"4.0":395,"5.0":491}},"2025":{"mean":3.88,"n":2039,"dist":{"1.0":119,"2.0":121,"3.0":404,"4.0":636,"5.0":759}},"2026":{"mean":4.16,"n":1310,"dist":{"1":40,"2":46,"3":213,"4":381,"5":630}}},"smart_dns_awareness_yes_no":{"2024":{"pct_yes":66.8,"n":1423},"2025":{"pct_yes":59.7,"n":2233},"2026":{"pct_yes":59.4,"n":1414}},"4k_uhd_awareness_yes_no":{"2024":{"pct_yes":62.6,"n":1357},"2025":{"pct_yes":59.1,"n":2136},"2026":{"pct_yes":62.9,"n":1363},"note":"2024/2025 asked general 4K-UHD awareness; 2026 reworded to ask specifically about 4K source requirement for broadcast TV - directional only, not strictly comparable."},"num_smart_tvs_avg":{"2024":{"mean":1.96,"n":1423},"2025":{"mean":1.95,"n":2233},"2026":{"mean":2.08,"n":1414}},"num_umee_tv_boxes_avg":{"2024":{"mean":1.76,"n":1423},"2025":{"mean":1.69,"n":2233},"2026":{"mean":1.64,"n":1414}},"paid_streaming_app_usage_pct":{"Netflix":{"2024":{"pct":85.5,"n":1216,"denom":1423},"2025":{"pct":83.8,"n":1871,"denom":2233},"2026":{"pct":81.1,"n":1147,"denom":1414}},"Disney+":{"2024":{"pct":52.4,"n":745,"denom":1423},"2025":{"pct":54.6,"n":1220,"denom":2233},"2026":{"pct":54.7,"n":774,"denom":1414}},"BritBox":{"2024":{"pct":0.4,"n":5,"denom":1423},"2025":{"pct":0.3,"n":6,"denom":2233},"2026":{"pct":0.2,"n":3,"denom":1414}},"Now TV":{"2024":{"pct":1.4,"n":20,"denom":1423},"2025":{"pct":1.8,"n":41,"denom":2233},"2026":{"pct":3.3,"n":46,"denom":1414}},"Hayu":{"2024":{"pct":0.6,"n":9,"denom":1423},"2025":{"pct":1.2,"n":26,"denom":2233},"2026":{"pct":1.3,"n":18,"denom":1414}},"Discovery+":{"2024":{"pct":2.2,"n":32,"denom":1423},"2025":{"pct":3.1,"n":69,"denom":2233},"2026":{"pct":3.4,"n":48,"denom":1414}},"Prime Video":{"2024":{"pct":44.4,"n":632,"denom":1423},"2025":{"pct":53.0,"n":1183,"denom":2233},"2026":{"pct":54.4,"n":769,"denom":1414}},"HBO Max":{"2024":{"pct":1.6,"n":23,"denom":1423},"2025":{"pct":1.4,"n":32,"denom":2233},"2026":{"pct":4.6,"n":65,"denom":1414}},"Apple TV":{"2024":{"pct":15.7,"n":224,"denom":1423},"2025":{"pct":19.3,"n":432,"denom":2233},"2026":{"pct":23.0,"n":325,"denom":1414}},"Paramount+":{"2024":{"pct":2.7,"n":39,"denom":1423},"2025":{"pct":4.7,"n":106,"denom":2233},"2026":{"pct":6.6,"n":94,"denom":1414}}},"free_streaming_app_usage_pct":{"BBC iPlayer":{"2024":{"pct":50.5,"n":719,"denom":1423},"2025":{"pct":47.4,"n":1059,"denom":2233},"2026":{"pct":47.3,"n":669,"denom":1414}},"ITVx":{"2024":{"pct":39.1,"n":556,"denom":1423},"2025":{"pct":36.6,"n":818,"denom":2233},"2026":{"pct":39.5,"n":559,"denom":1414}},"All 4":{"2024":{"pct":26.2,"n":373,"denom":1423},"2025":{"pct":25.1,"n":560,"denom":2233},"2026":{"pct":23.8,"n":337,"denom":1414}},"My5":{"2024":{"pct":16.1,"n":229,"denom":1423},"2025":{"pct":15.7,"n":351,"denom":2233},"2026":{"pct":17.0,"n":240,"denom":1414}},"Pluto TV":{"2024":{"pct":3.4,"n":49,"denom":1423},"2025":{"pct":3.2,"n":71,"denom":2233},"2026":{"pct":2.8,"n":39,"denom":1414}}},"viewing_balance_now_pct":{"2024":{"n":1423,"dist":{"50:50":34.8,"Mostly u-mee":28.2,"Mostly streaming":18.6,"Only u-mee":16.4,"Only streaming":2.0}},"2025":{"n":2039,"dist":{"50:50":37.2,"Mostly u-mee":25.1,"Mostly streaming":22.9,"Only u-mee":12.9,"Only streaming":1.9}},"2026":{"n":1310,"dist":{"Only u-mee":10.4,"Mostly u-mee":25.6,"50:50":34.9,"Mostly streaming":26.2,"Only streaming":3.0}}},"viewing_balance_predicted_5yr_pct":{"2024":{"n":1423,"dist":{"Same":66.2,"More streaming":26.8,"More broadcast":7.0}},"2025":{"n":2040,"dist":{"Same":64.4,"More streaming":29.3,"More broadcast":6.3}},"2026":{"n":1310,"dist":{"More streaming":28.1,"More broadcast":5.3,"Same":66.6}}},"eero_wifi_2025_vs_2026_only":{"installed_at_least_one":{"2025":{"pct":89.6,"n":2233},"2026":{"pct":91.2,"n":1414}},"aware_eero_app":{"2025":{"pct_yes":79.8,"n":2000},"2026":{"pct_yes":74.7,"n":1290}},"installed_eero_app":{"2025":{"pct_yes":81.9,"n":1595},"2026":{"pct_yes":82.4,"n":964}},"aware_eero_secure":{"2025":{"pct_yes":44.5,"n":1307},"2026":{"pct_yes":37.0,"n":794}},"intend_to_install":{"2025":{"pct_yes":30.0,"n":233},"2026":{"pct_yes":35.5,"n":124}},"wifi_vs_before":{"Reliability":{"2025":{"mean":0.55,"n":2000,"pct_better":58.0,"pct_worse":2.5},"2026":{"mean":0.55,"n":1290,"pct_better":57.7,"pct_worse":2.5}},"Speed near router":{"2025":{"mean":0.53,"n":2000,"pct_better":53.9,"pct_worse":1.2},"2026":{"mean":0.55,"n":1290,"pct_better":55.9,"pct_worse":0.5}},"Speed at worst spot":{"2025":{"mean":0.48,"n":2000,"pct_better":51.1,"pct_worse":3.4},"2026":{"mean":0.45,"n":1290,"pct_better":48.6,"pct_worse":3.6}}},"returned_spare_eero_yes":{"2025":{"pct":12.1,"n":91,"note":"Among the ~4% of 2025 respondents who received a spare eero and answered this question"},"2026":{"pct":7.0,"n":57}}},"supplementary_own_wifi_kit_reliance_pct":{"2024":{"pct":27.5,"n":391,"denom":1423,"note":"All respondents; used their own Access Points (mesh/boosters) rather than router alone, pre-eero rollout"},"2025":{"pct":10.4,"n":233,"denom":2233,"note":"All respondents; did not install u-mee eero and therefore rely on own router/booster/mesh kit"},"2026":{"pct":8.8,"n":124,"denom":1414,"note":"All respondents; did not install u-mee eero and therefore rely on own router/booster/mesh kit"}},"own_router_booster_brand_pct_2025_2026_only_non_eero_users":{"Google":{"2024":{"pct":1.8,"n":25,"denom":1423},"2025":{"pct":0.2,"n":5,"denom":2233},"2026":{"pct":0.2,"n":3,"denom":1414}},"eero":{"2024":{"pct":0.2,"n":3,"denom":1423},"2025":{"pct":0.0,"n":0,"denom":2233},"2026":{"pct":0.1,"n":2,"denom":1414}},"Unifi":{"2024":{"pct":1.3,"n":19,"denom":1423},"2025":{"pct":0.9,"n":19,"denom":2233},"2026":{"pct":1.1,"n":15,"denom":1414}},"Tenda":{"2024":{"pct":3.3,"n":47,"denom":1423},"2025":{"pct":0.4,"n":8,"denom":2233},"2026":{"pct":0.1,"n":2,"denom":1414}},"Netgear":{"2024":{"pct":2.7,"n":38,"denom":1423},"2025":{"pct":0.4,"n":8,"denom":2233},"2026":{"pct":0.4,"n":5,"denom":1414}},"Apple":{"2024":{"pct":0.9,"n":13,"denom":1423},"2025":{"pct":0.0,"n":1,"denom":2233},"2026":{"pct":0.0,"n":0,"denom":1414}},"Cisco":{"2024":{"pct":0.4,"n":6,"denom":1423},"2025":{"pct":0.1,"n":3,"denom":2233},"2026":{"pct":0.1,"n":2,"denom":1414}},"TP-Link":{"2024":{"pct":12.6,"n":179,"denom":1423},"2025":{"pct":1.2,"n":27,"denom":2233},"2026":{"pct":1.8,"n":26,"denom":1414}},"D-Link":{"2024":{"pct":2.2,"n":31,"denom":1423},"2025":{"pct":0.0,"n":1,"denom":2233},"2026":{"pct":0.3,"n":4,"denom":1414}},"HP":{"2024":{"pct":0.2,"n":3,"denom":1423},"2025":{"pct":0.0,"n":0,"denom":2233},"2026":{"pct":0.0,"n":0,"denom":1414}}},"amazon_ecosystem_2025_2026_only":{"has_prime":{"2025":{"pct_yes":48.0,"n":2233},"2026":{"pct_yes":54.0,"n":1414}},"devices":{"Echo":{"2025":{"pct":26.2,"n":585,"denom":2233},"2026":{"pct":27.7,"n":392,"denom":1414}},"Fire Tablet":{"2025":{"pct":6.4,"n":142,"denom":2233},"2026":{"pct":5.6,"n":79,"denom":1414}},"Fire TV":{"2025":{"pct":9.1,"n":203,"denom":2233},"2026":{"pct":8.8,"n":124,"denom":1414}},"Ring cameras":{"2025":{"pct":4.0,"n":90,"denom":2233},"2026":{"pct":5.1,"n":72,"denom":1414}},"Ring doorbells":{"2025":{"pct":6.4,"n":143,"denom":2233},"2026":{"pct":8.2,"n":116,"denom":1414}},"Kindle":{"2025":{"pct":28.7,"n":640,"denom":2233},"2026":{"pct":32.2,"n":456,"denom":1414}}},"alexa_non_amazon":{"2025":{"pct_yes":19.7,"n":2233},"2026":{"pct_yes":21.0,"n":1414}}},"other_online_devices_pct":{"Smartphone":{"2024":{"pct":93.3,"n":1328,"denom":1423},"2025":{"pct":87.3,"n":1950,"denom":2233},"2026":{"pct":84.8,"n":1199,"denom":1414}},"Tablet":{"2024":{"pct":81.4,"n":1158,"denom":1423},"2025":{"pct":74.9,"n":1673,"denom":2233},"2026":{"pct":71.0,"n":1004,"denom":1414}},"Computer (laptop/desktop)":{"2024":{"pct":80.9,"n":1151,"denom":1423},"2025":{"pct":69.8,"n":1558,"denom":2233},"2026":{"pct":67.5,"n":955,"denom":1414}},"Gaming console":{"2024":{"pct":46.5,"n":662,"denom":1423},"2025":{"pct":45.3,"n":1012,"denom":2233},"2026":{"pct":43.6,"n":616,"denom":1414}},"Smart speaker":{"2024":{"pct":29.0,"n":412,"denom":1423},"2025":{"pct":20.4,"n":456,"denom":2233},"2026":{"pct":21.1,"n":299,"denom":1414}},"_caveat":"The list of device options offered GREW each year (2024: 8 options, 2025: 12, 2026: 13), which mechanically lowers % per option even with no real ownership change. Treat apparent declines here cautiously."},"ethernet_connected_devices_pct_2025_2026_only":{"Computer":{"2025":{"pct":34.2,"n":764,"denom":2233},"2026":{"pct":30.3,"n":428,"denom":1414}},"Console":{"2025":{"pct":34.0,"n":760,"denom":2233},"2026":{"pct":31.5,"n":445,"denom":1414}},"Hub":{"2025":{"pct":3.8,"n":84,"denom":2233},"2026":{"pct":2.8,"n":39,"denom":1414}},"Camera":{"2025":{"pct":3.9,"n":88,"denom":2233},"2026":{"pct":3.0,"n":42,"denom":1414}},"Music/Hi-Fi":{"2025":{"pct":5.0,"n":111,"denom":2233},"2026":{"pct":4.0,"n":56,"denom":1414}},"Set-top box":{"2025":{"pct":2.3,"n":52,"denom":2233},"2026":{"pct":2.8,"n":39,"denom":1414}}},"gt_fibre_competitor_pct_2025_2026_only":{"has_gt_fibre":{"2025":{"pct":10.2,"n":227,"denom":2233},"2026":{"pct":9.8,"n":139,"denom":1414}},"has_gt_copper":{"2025":{"pct":1.7,"n":37,"denom":2233},"2026":{"pct":1.2,"n":17,"denom":1414}},"has_gibfibre":{"2025":{"pct":2.3,"n":51,"denom":2233},"2026":{"pct":1.9,"n":27,"denom":1414}}},"social_media_usage_pct_2025_2026_only":{"Facebook":{"2025":{"pct":45.6,"n":1019,"denom":2233},"2026":{"pct":43.1,"n":610,"denom":1414}},"Instagram":{"2025":{"pct":16.0,"n":358,"denom":2233},"2026":{"pct":18.9,"n":267,"denom":1414}}},"household_age_composition_avg_people_per_household_2025_2026_only":{"0-5":{"2025_avg_per_household":0.22,"2026_avg_per_household":0.2},"6-12":{"2025_avg_per_household":0.31,"2026_avg_per_household":0.29},"13-17":{"2025_avg_per_household":0.22,"2026_avg_per_household":0.24},"18-39":{"2025_avg_per_household":0.88,"2026_avg_per_household":0.85},"40-64":{"2025_avg_per_household":1.05,"2026_avg_per_household":1.05},"65+":{"2025_avg_per_household":0.3,"2026_avg_per_household":0.33},"pct_households_with_children_under18":{"2025":40.4,"2026":39.8}},"segment_households_with_vs_without_children_2026_only":{"happy_by_children_2026":{"Households with children under 18":{"pct_yes":97.7,"n":563},"Households without children under 18":{"pct_yes":96.8,"n":851}},"viewing_balance_by_children_2026":{"Households with children under 18":{"Only u-mee":9.2,"Mostly u-mee":14.5,"50:50":39.9,"Mostly streaming":32.1,"Only streaming":4.4},"Households without children under 18":{"Only u-mee":11.3,"Mostly u-mee":33.5,"50:50":31.3,"Mostly streaming":22.0,"Only streaming":2.0}},"kids_content_interest_by_children_2026":{"Households with children under 18":{"pct":37.7,"n":563},"Households without children under 18":{"pct":6.5,"n":851}}},"segment_eero_installers_vs_not_2026_only":{"Installed eero":{"n_households":1290,"wifi_reliability_mean":4.14,"wifi_reliability_n":1290,"happy_pct":97.4},"Did not install eero":{"n_households":124,"wifi_reliability_mean":4.22,"wifi_reliability_n":124,"happy_pct":95.2}},"correlation_service_ratings_vs_recommend_2026_only":{"Features":{"correlation_with_recommend":0.28,"mean_rating_among_recommenders":4.26,"mean_rating_among_non_recommenders":3.07,"n":1414},"Reliability":{"correlation_with_recommend":0.37,"mean_rating_among_recommenders":4.36,"mean_rating_among_non_recommenders":2.65,"n":1414},"Quality":{"correlation_with_recommend":0.37,"mean_rating_among_recommenders":4.37,"mean_rating_among_non_recommenders":2.72,"n":1414},"Support":{"correlation_with_recommend":0.34,"mean_rating_among_recommenders":4.37,"mean_rating_among_non_recommenders":2.61,"n":1270},"Value":{"correlation_with_recommend":0.36,"mean_rating_among_recommenders":4.03,"mean_rating_among_non_recommenders":2.2,"n":1414}},"open_text_themes":{"note":"The surveys have NO general 'additional comments' field - only small 'Other, please specify' text boxes attached to specific multiple-choice questions. Open-text volume is low (n=10-15 typically) - always state the small sample size when answering open-text questions.","why_keeping_spare_eero_2026_n11":"8 of 11 said they're keeping it as a future backup/spare in case of expansion or failure; a few were unclear whether they were meant to return it.","streaming_attraction_other_reasons_2026_n13":"Themes: content not on u-mee (sport, K-dramas, Spanish-language content specifically named); simplicity/ease of use (contrasted against u-mee platform friction; one respondent didn't know about Smart DNS or recording features); specific UX complaints (one respondent named an 'irritating voice-over' on u-mee's catch-up interface).","why_not_using_eero_own_router_2026_n10":"Reasons given: already-satisfied with existing higher-end personal equipment (e.g. a central Cisco access point); desire for greater range in larger properties than eero alone provides; difficulty getting eero installed with adequate support.","no_reliable_year_over_year_open_text_theme_comparison":"Open-text volume is too low in every year to confidently say a theme is 'new' or 'growing' vs 2025 - say so if asked."},"top_significant_changes_2024_to_2026_summary":["Reliance on own Wi-Fi kit instead of eero: 27.5% -> 8.8% of all customers (2024->2026), the single largest shift in the dataset.","Awareness of free eero Secure subscription: 44.5% -> 37.0% (2025->2026 only, not asked in 2024) - a declining-awareness concern.","Awareness of u-mee's Smart DNS feature: 66.8% -> 59.4% (2024->2026) - another declining-awareness concern.","Amazon Prime Video subscription: 44.4% -> 54.4% (2024->2026).","'Only u-mee' viewers (no streaming apps at all): 16.4% -> 10.4% (2024->2026), while 'mostly/only streaming' rose steadily each year.","u-mee TV rated against competitors softened slightly but consistently across ALL 6 comparison sub-dimensions between 2024 and 2026 (each down 0.08-0.17 of a point on a 1-5 scale).","Ease of streaming setup improved from 3.87 to 4.16 out of 5 (2024->2026) - the largest positive rating movement in the dataset.","Overall happy: 98.3% -> 97.2% (2024->2026), a small, gentle decline; would-recommend: 98.0% -> 96.7%."]}`;

// Very lightweight in-memory rate limiter. This resets whenever the
// serverless function cold-starts, and isn't shared across regions/instances,
// so treat it as "best effort" abuse protection for an internal tool, not a
// hard guarantee. For real production-scale limiting, swap this for
// Vercel KV / Upstash Redis.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const buckets = new Map();

function isRateLimited(key) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_REQUESTS_PER_WINDOW) {
    buckets.set(key, arr);
    return true;
  }
  arr.push(now);
  buckets.set(key, arr);
  return false;
}

// Same Basic Auth credentials that protect the report page itself
// (see netlify/functions/gate.js), so there is only one password for
// colleagues to remember, and only one place to change it.
function checkBasicAuth(reqHeaders) {
  const username = process.env.SITE_USERNAME;
  const password = process.env.SITE_PASSWORD;
  if (!username || !password) return { ok: false, misconfigured: true };

  const authHeader = reqHeaders.authorization || reqHeaders.Authorization || '';
  if (!authHeader.startsWith('Basic ')) return { ok: false };
  let decoded;
  try {
    decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  } catch (e) {
    return { ok: false };
  }
  const sepIndex = decoded.indexOf(':');
  const suppliedUser = sepIndex === -1 ? decoded : decoded.slice(0, sepIndex);
  const suppliedPass = sepIndex === -1 ? '' : decoded.slice(sepIndex + 1);
  return { ok: suppliedUser === username && suppliedPass === password };
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  const reqHeaders = event.headers || {};
  const auth = checkBasicAuth(reqHeaders);
  if (auth.misconfigured) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'server_misconfigured', detail: 'SITE_USERNAME / SITE_PASSWORD are not set.' }) };
  }
  if (!auth.ok) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  const ip = (reqHeaders['x-nf-client-connection-ip'] || reqHeaders['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'rate_limited' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'bad_request' }) };
  }
  const turns = Array.isArray(body?.turns) ? body.turns : null;
  if (!turns || turns.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'bad_request', detail: 'Expected { turns: [...] }' }) };
  }

  // Keep only the last 12 turns (6 exchanges) to bound cost/context growth.
  const trimmedTurns = turns.slice(-12).map((t) => ({
    role: t.role === 'assistant' ? 'assistant' : 'user',
    content: String(t.content || '').slice(0, 4000),
  }));

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'server_misconfigured', detail: 'ANTHROPIC_API_KEY is not set.' }) };
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // Check console.anthropic.com/docs for the current recommended model
        // string at deploy time \u2014 this is a sensible default as of writing.
        model: process.env.ASK_MODEL || 'claude-sonnet-5',
        max_tokens: 1200,
        system: [
          {
            type: 'text',
            text: RULES_AND_DATA,
            cache_control: { type: 'ephemeral' }, // cuts repeat-read cost ~90%
          },
        ],
        messages: trimmedTurns,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'upstream_error', detail: data }) };
    }

    const textBlock = (data.content || []).find((b) => b.type === 'text');
    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (e) {
      parsed = {
        headline: "I couldn't format that answer properly \u2014 please try rephrasing the question.",
        detail: '',
        table: null,
        chart: null,
        calculation: null,
        comparability_note: null,
        cannot_answer: true,
        suggested_followups: [],
      };
    }
    return { statusCode: 200, headers, body: JSON.stringify(parsed) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'server_error', detail: String(e) }) };
  }
};
