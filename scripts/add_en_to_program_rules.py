#!/usr/bin/env python3
"""
Adds *_en sibling fields to data/program-rules.json without removing Korean originals.
This preserves ReportEngine/Firebase storage compatibility while enabling EN UI rendering.
"""
import json
from pathlib import Path
from collections import OrderedDict

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "program-rules.json"

EN = {
    "spec_en": "Custom Execution Program Generation Spec V2.3 + Kim Young-sik Sample Integration",
    "format": {
        "title_en": "📘 Life Portfolio Custom Execution Program",
        "subtitleTpl_en": "A Growth & Execution Strategy Guide for {{name}}",
        "service_en": "Life Portfolio",
        "fonts_family_en": "Inter, system-ui, sans-serif"
    },
    "tones": {
        "principled_designer": {
            "label_en": "The Principle-Centered Analytical Designer",
            "tagline_en": "A leader who connects people and the world through deep inner standards",
            "quarterTheme_en": "A quarter to connect your inner philosophy with the outside world",
            "quarterLeadParas_en": [
                "Clear standards and direction are already established within you.",
                "This quarter is about extending those standards along the flow of \u2018language \u2192 relationships \u2192 influence\u2019.",
                "When designs that lived only in thought connect to real action, the next layer of growth opens up."
            ],
            "weeks_en": [
                {
                    "title_en": "Bringing Thoughts Outside",
                    "actions_en": [
                        "Each morning, write a single sentence describing today\u2019s core intention.",
                        "Articulate each of your three core values in one concrete sentence.",
                        "Have a 30-minute conversation about your current interests with one trusted person."
                    ]
                },
                {
                    "title_en": "Expanding Expression Within Relationships",
                    "actions_en": [
                        "Deliberately express an emotion or feeling in at least one sentence during conversation.",
                        "Engage with one piece of content in your area of interest and write a brief reflection.",
                        "Identify one of your values that is being well realized and one that is lacking."
                    ]
                },
                {
                    "title_en": "Connecting Through Small Completions",
                    "actions_en": [
                        "Choose one meaningful action and complete its first step.",
                        "Review three weeks of records and identify three recurring keywords.",
                        "Connect one execution pattern you discovered to your next goal."
                    ]
                }
            ],
            "month3Goals_en": [
                {"title_en": "Putting My Philosophy Into Words", "criterion_en": "A one-page A4 statement of \u2018my principles & leadership philosophy\u2019, shared with at least one person."},
                {"title_en": "Establishing a Routine of Deeper Relationships", "criterion_en": "At least two deep conversations per month, each followed by a 3-line record."},
                {"title_en": "Securing Real Role Experience", "criterion_en": "Participate in at least one coaching, facilitation, or mentoring activity and record feedback."}
            ],
            "year1_en": {
                "vision_en": [
                    "One year from now you will no longer be merely someone who deliberates,",
                    "but a designer who transforms people through your own philosophy."
                ],
                "milestones_en": [
                    "Secure real project experience in education, leadership, or community",
                    "Reach a level where you can articulate your unique approach (philosophy + execution structure)",
                    "Build trust so that those around you see you as someone they want to work with"
                ]
            },
            "modules_en": [
                {
                    "title_en": "Philosophy-Writing Routine",
                    "summary_en": "The core converter that turns inner insight into outward influence.",
                    "actions_en": ["Write a 500-character piece once a week", "After three months, extract three recurring themes"]
                },
                {
                    "title_en": "Deep Conversation Design Practice",
                    "summary_en": "A core growth lever that raises the emotional density of your relationships.",
                    "actions_en": ["Set one core topic before each conversation", "After each conversation, record what you learned and what felt incomplete"]
                },
                {
                    "title_en": "Career Compass Review Session",
                    "summary_en": "A structure that turns long-range design into actual direction.",
                    "actions_en": ["Each month, record three meaningful moments", "Every three months, analyze recurring patterns and reset direction"]
                }
            ],
            "trackBoardWeekly_en": [
                "Did I record this morning\u2019s intention?",
                "Did I have an experience of small completion?",
                "Was there a moment I expressed emotion in words?"
            ],
            "trackBoardMonthly_en": [
                "Are writings or thought records accumulating?",
                "Did I have at least two deep conversations?",
                "Were there exploration actions in my area of interest?"
            ],
            "risks_en": [
                {"risk_en": "Pursuing perfection may delay your start", "mitigation_en": "Begin with the standard of producing a \u2018first version\u2019 rather than a finished one."},
                {"risk_en": "Energy may drop quickly on tasks that feel less meaningful", "mitigation_en": "Before acting, confirm in one sentence which of your values this work connects to."},
                {"risk_en": "A pattern of designing and executing alone may persist", "mitigation_en": "Once a month, choose someone to share your results with and build a sharing routine."}
            ],
            "effects_en": {
                "fitJob_en": "Stronger fit for strategy planning, organizational design, policy, and consulting roles",
                "expansion_en": "Career expansion possible into education, leadership, and coaching",
                "career_en": "Accumulating trust capital as a principle-based decision maker",
                "vision_en": "\u201cBecome a designer who moves people through my own philosophy.\u201d"
            },
            "newPaths_en": ["Organizational Consultant", "Leadership Coach", "Education Program Designer", "Policy Analyst"],
            "nextSteps_en": {
                "m1_en": "Write your philosophy in one sentence and have one trusted conversation",
                "m3_en": "Establish two deep conversations per month and articulate three core values",
                "y1_en": "At least one coaching/facilitation experience and share a one-page statement of your philosophy"
            },
            "closing_en": [
                "This program is not a design that adds something new.",
                "It is a structure that lets the standards and capabilities you already possess",
                "flow into connection with the world.",
                "One single step from where you stand right now is enough."
            ]
        },
        "warm_connector": {
            "label_en": "The Warm Connector",
            "tagline_en": "An emotional bridge that links people through empathy and trust",
            "quarterTheme_en": "A quarter to connect hearts and build trust",
            "quarterLeadParas_en": [
                "You already carry enough warmth and empathy directed toward people.",
                "This quarter is about structuring that warmth along \u2018listening \u2192 expression \u2192 relational capital\u2019.",
                "When a small routine is placed where the heart flows, trust accumulates at a different pace."
            ],
            "weeks_en": [
                {
                    "title_en": "Building a Routine of Listening to the Heart",
                    "actions_en": [
                        "Each morning, recall the condition of one person you will meet today and write a one-line note.",
                        "During conversations, jot down one core emotion word from the other person.",
                        "At day\u2019s end, record in three lines the scene that lingered most."
                    ]
                },
                {
                    "title_en": "Warming Relationships Through Gratitude and Expression",
                    "actions_en": [
                        "Three times a week, send a short message of thanks to one person.",
                        "In conversations, also express your own emotions honestly in at least one sentence.",
                        "Draft messages to send to three people who have influenced you."
                    ]
                },
                {
                    "title_en": "Organizing Relationships as Capital",
                    "actions_en": [
                        "Have a 30-minute, in-depth conversation with one trusted person.",
                        "Write down three moments when you felt supported, and choose one person you can support.",
                        "Identify the three people who came to mind most often these three weeks and mark them as next month\u2019s \u2018connection priorities\u2019."
                    ]
                }
            ],
            "month3Goals_en": [
                {"title_en": "Establishing a Gratitude & Empathy Routine", "criterion_en": "Three gratitude messages per week and one deep conversation per month."},
                {"title_en": "Visualizing Relational Capital", "criterion_en": "Map your life\u2019s trust network on one page (around 15 people)."},
                {"title_en": "Expanding Your Emotional Safe Zone", "criterion_en": "Accumulate at least 10 \u2018feeling-expression\u2019 journal entries."}
            ],
            "year1_en": {
                "vision_en": [
                    "One year from now you will be known among people as \u2018someone whose presence eases the heart\u2019.",
                    "You will have built your own relational structure where empathy itself becomes influence."
                ],
                "milestones_en": [
                    "A network of 15+ trusted relationships connecting regularly",
                    "Experience running one community or content based on emotion and empathy",
                    "Earn the reputation, \u2018the atmosphere warms when this person is here\u2019"
                ]
            },
            "modules_en": [
                {
                    "title_en": "Gratitude Message Routine",
                    "summary_en": "A core device that maintains a steady emotional temperature in your relationships.",
                    "actions_en": ["A one-sentence message to one person, three times a week", "At month\u2019s end, keep the warmest reply you received"]
                },
                {
                    "title_en": "Emotion Journal & Expression Practice",
                    "summary_en": "The first safe vessel for externalizing your emotions.",
                    "actions_en": ["Once a day, record \u2018today\u2019s feelings\u2019 in three lines", "Once a week, share a feeling honestly with someone close in spoken words"]
                },
                {
                    "title_en": "Trust Network Review Session",
                    "summary_en": "A quarterly structure for managing relationships as capital.",
                    "actions_en": ["Each month, list three \u2018people who lingered in your heart\u2019", "Each quarter, update the strength of each connection (high/medium/low)"]
                }
            ],
            "trackBoardWeekly_en": [
                "Did I send three or more gratitude messages this week?",
                "Was there a moment I expressed an emotion honestly?",
                "Did I record a scene that lingered in my heart?"
            ],
            "trackBoardMonthly_en": [
                "Did I have at least one deep conversation?",
                "Is the trust-network notebook being updated?",
                "Is the emotion journal accumulating?"
            ],
            "risks_en": [
                {"risk_en": "Caring for others can push your own emotions to the back", "mitigation_en": "Once a day, start by writing your own \u2018feelings of today\u2019 first."},
                {"risk_en": "As relationships widen, depth can grow shallow", "mitigation_en": "Each month, choose one person to truly go deep with and reserve specific time."},
                {"risk_en": "Difficulty saying no can collapse your schedule", "mitigation_en": "Block out two hours of \u2018my own recovery time\u2019 in your weekly schedule in advance."}
            ],
            "effects_en": {
                "fitJob_en": "Stronger fit for customer success, HR, coaching, education, and community management roles",
                "expansion_en": "Expansion possible into relationship-based personal brand, communities, or coaching",
                "career_en": "Empathy capital accumulates as trust capital",
                "vision_en": "\u201cBecome the connector people describe as easing their heart.\u201d"
            },
            "newPaths_en": ["Life Coach", "Organizational Culture Facilitator", "Community Builder", "Onboarding Designer"],
            "nextSteps_en": {
                "m1_en": "Establish three gratitude messages per week and start an emotion journal",
                "m3_en": "One deep conversation per month and a one-page trust-network map",
                "y1_en": "Run one empathy-based community and try entering coaching"
            },
            "closing_en": [
                "This program is not a design for making more new people.",
                "It is a structure that keeps the hearts already open toward you",
                "from drifting away.",
                "Today\u2019s single message is enough to begin."
            ]
        },
        "visionary_creator": {
            "label_en": "The Vision-Centered Creative Maker",
            "tagline_en": "A creator who sketches the big picture and proves it through finished work",
            "quarterTheme_en": "A quarter to prove your vision through the work you make",
            "quarterLeadParas_en": [
                "A clear picture of who you want to become already lives in your mind.",
                "This quarter is about putting that picture on a loop of \u2018prototype \u2192 publish \u2192 feedback\u2019.",
                "Publishing\u2014not perfection\u2014opens the door to your next vision."
            ],
            "weeks_en": [
                {
                    "title_en": "Bringing Ideas Outside",
                    "actions_en": [
                        "Each morning, take five minutes to note three ideas that surfaced.",
                        "Choose one \u2018small piece\u2019 to make this week and produce its first screen or first sentence.",
                        "Pick three references worth studying and capture them."
                    ]
                },
                {
                    "title_en": "Finishing a Prototype Quickly",
                    "actions_en": [
                        "Complete the \u2018draft version\u2019 of the chosen piece by the deadline.",
                        "Show it to one trusted person and gather brief feedback.",
                        "Decide on one thing to remove and refine accordingly."
                    ]
                },
                {
                    "title_en": "Publishing and Connecting to the Next Vision",
                    "actions_en": [
                        "Release the draft externally in some form (text/link/image/meetup).",
                        "Record the most striking sentence from the response.",
                        "Define the one-line concept for your next piece."
                    ]
                }
            ],
            "month3Goals_en": [
                {"title_en": "Publish 3 Prototypes", "criterion_en": "Release at least one small piece or content externally each month."},
                {"title_en": "Refine Your One-Sentence Vision", "criterion_en": "Lock in one sentence of copy expressing your vision."},
                {"title_en": "Establish a Feedback Loop", "criterion_en": "Collect feedback from at least three people after each release."}
            ],
            "year1_en": {
                "vision_en": [
                    "One year from now you will not be \u2018a person with many ideas\u2019,",
                    "but a \u2018creator who follows through\u2019 with a steady record of releases."
                ],
                "milestones_en": [
                    "At least one published work or output each quarter",
                    "Able to explain your vision in a single sentence",
                    "Five or more peers/fans connected to you through your work"
                ]
            },
            "modules_en": [
                {
                    "title_en": "Idea Capture Routine",
                    "summary_en": "A daily device that turns scattered inspiration into an asset.",
                    "actions_en": ["Three idea notes a day", "On weekends, choose one and design a small experiment"]
                },
                {
                    "title_en": "Prototype Sprint",
                    "summary_en": "A core module that learns through publishing speed rather than perfection.",
                    "actions_en": ["One prototype deadline per week", "Within 24 hours of release, log a 3-line retrospective"]
                },
                {
                    "title_en": "Vision Copy Review Session",
                    "summary_en": "A quarterly ritual that ties scattered work into one vision sentence.",
                    "actions_en": ["Each month, mark one piece as \u2018the most you-like work this year\u2019", "Update your one-sentence vision each quarter"]
                }
            ],
            "trackBoardWeekly_en": [
                "Did my idea notes accumulate to 15 or more this week?",
                "Did I meet this week\u2019s prototype deadline?",
                "Did I receive at least one piece of feedback?"
            ],
            "trackBoardMonthly_en": [
                "Has at least one release accumulated?",
                "Was the one-sentence vision updated?",
                "Did I record one striking line from external response?"
            ],
            "risks_en": [
                {"risk_en": "Too many ideas may delay publishing", "mitigation_en": "Move all ideas except \u2018this week\u2019s one\u2019 into an idea archive."},
                {"risk_en": "Weak response can quickly drain momentum", "mitigation_en": "Define the act of publishing itself as the achievement; treat reactions only as learning data."},
                {"risk_en": "You may be drawn to new starts more than to finishing", "mitigation_en": "Postpone any new project until the current piece is published."}
            ],
            "effects_en": {
                "fitJob_en": "Stronger fit for planning, content, branding, new business, and design roles",
                "expansion_en": "Expansion possible into solo creator, solo producer, or side projects",
                "career_en": "Your release history itself becomes a portfolio asset",
                "vision_en": "\u201cBecome a creator who proves what was imagined through finished work.\u201d"
            },
            "newPaths_en": ["Content Creator", "Product Designer", "New Business Planner", "Solo Studio Owner"],
            "nextSteps_en": {
                "m1_en": "Capture ideas and release one small piece",
                "m3_en": "Publish three prototypes and lock in your one-sentence vision",
                "y1_en": "Establish a one-release-per-quarter routine and start one vision-driven project"
            },
            "closing_en": [
                "This program is not a design for generating more ideas.",
                "It is a structure that turns the picture already in your mind",
                "into work the world can touch.",
                "Today\u2019s single line of notes is enough to begin."
            ]
        },
        "pragmatic_achiever": {
            "label_en": "The Pragmatic Driving Achiever",
            "tagline_en": "A doer who proves decisions through results",
            "quarterTheme_en": "A quarter to prove yourself through results",
            "quarterLeadParas_en": [
                "You already have more than enough drive to \u2018see things through to the end\u2019.",
                "This quarter is about combining that drive with a loop of \u2018priorities \u2192 measurement \u2192 retrospective\u2019.",
                "When you bind what you do well into a structure that does it even better, the same time produces bigger results."
            ],
            "weeks_en": [
                {
                    "title_en": "Setting This Quarter\u2019s Top Priority",
                    "actions_en": [
                        "Write down this quarter\u2019s \u2018single core goal\u2019 in one sentence.",
                        "Choose one or two KPIs to measure that goal.",
                        "Break it into three weekly milestones and lock them into your calendar."
                    ]
                },
                {
                    "title_en": "Running the Execution Board",
                    "actions_en": [
                        "From Monday to Friday, start each morning with the \u2018single highest-impact item\u2019.",
                        "Three times a week, secure a 30-minute distraction-free focus block.",
                        "Each weekend, check KPI progress in numbers."
                    ]
                },
                {
                    "title_en": "Retrospective \u2192 Linking to the Next Quarter",
                    "actions_en": [
                        "Identify \u2018one thing that went well, one that did not\u2019 from the past two weeks.",
                        "Decide on one corrective action for the cause behind what did not work.",
                        "Note three candidates for next quarter\u2019s top priority."
                    ]
                }
            ],
            "month3Goals_en": [
                {"title_en": "Hit the Quarter\u2019s Top-Priority Goal", "criterion_en": "Reach 80%+ of the chosen KPI."},
                {"title_en": "Establish an Execution Rhythm", "criterion_en": "Three focus blocks a week, plus 12 cumulative weekly retrospectives."},
                {"title_en": "Accumulate Outcome Records", "criterion_en": "12+ result-centered entries (with numbers)."}
            ],
            "year1_en": {
                "vision_en": [
                    "One year from now you will not be \u2018someone who works hard\u2019,",
                    "but \u2018someone who speaks through results\u2019."
                ],
                "milestones_en": [
                    "Complete four quarterly KPI cycles",
                    "Compile a one-page \u2018outcomes portfolio\u2019",
                    "Become known on your team or in your market as \u2018the person who ships\u2019"
                ]
            },
            "modules_en": [
                {
                    "title_en": "Weekly KPI Review Routine",
                    "summary_en": "A core device for examining results in numbers every week.",
                    "actions_en": ["30 minutes on weekends to update the KPI progress sheet", "Decide on \u2018the next week\u2019s single top priority\u2019"]
                },
                {
                    "title_en": "Focus Block Rhythm",
                    "summary_en": "A daily structure that protects the time required to produce results.",
                    "actions_en": ["Three 90-minute distraction-free blocks per week", "Finish only one deliverable per block"]
                },
                {
                    "title_en": "Quarterly Retrospective Session",
                    "summary_en": "A quarterly ritual that converts drive into learning.",
                    "actions_en": ["At quarter\u2019s end, summarize three things that worked and three that did not", "Decide on one top-priority goal for the next quarter"]
                }
            ],
            "trackBoardWeekly_en": [
                "Is this week\u2019s KPI progress at 70%+ of plan?",
                "Did I secure three or more focus blocks?",
                "Did I start every day with the single top priority first?"
            ],
            "trackBoardMonthly_en": [
                "Is the monthly cumulative KPI rate above the trend line?",
                "Have four or more retrospectives accumulated?",
                "Are outcome records preserved in numerical form?"
            ],
            "risks_en": [
                {"risk_en": "Pushing too hard can lead to burnout", "mitigation_en": "Schedule one weekly recovery block on equal footing with KPI work."},
                {"risk_en": "Focusing only on short-term results can blur direction", "mitigation_en": "At the start of the quarter, write one sentence answering \u2018why this KPI?\u2019."},
                {"risk_en": "Going it alone may cause you to miss collaboration signals", "mitigation_en": "Once a week, set a slot to share results and gather feedback."}
            ],
            "effects_en": {
                "fitJob_en": "Stronger fit for PM, sales, business development, operations, and entrepreneurship roles",
                "expansion_en": "Expansion possible into side businesses, freelancing, or founding your own company",
                "career_en": "The execution asset of \u2018the person who ships\u2019 accumulates as your reputation",
                "vision_en": "\u201cBecome a person who proves decisions through results.\u201d"
            },
            "newPaths_en": ["Project Manager", "Business Development Manager", "Solo Entrepreneur", "Operations Lead"],
            "nextSteps_en": {
                "m1_en": "Lock in the quarter\u2019s top goal and one KPI, and start focus blocks",
                "m3_en": "Reach 80% of the quarterly KPI and accumulate 12 retrospectives",
                "y1_en": "Complete four quarterly cycles and compile a one-page outcomes portfolio"
            },
            "closing_en": [
                "This program is not a design that piles on more tasks.",
                "It is a structure that converts the drive you already have",
                "into measurable results.",
                "Starting with today\u2019s single top priority is enough."
            ]
        },
        "reflective_explorer": {
            "label_en": "The Reflective Exploring Learner",
            "tagline_en": "An explorer building their own path through quiet depth",
            "quarterTheme_en": "A quarter to weave reflection into a path",
            "quarterLeadParas_en": [
                "You already have ample depth of reflection and a refined learning grain.",
                "This quarter is about weaving that reflection along the path of \u2018question \u2192 small experiment \u2192 retrospective\u2019.",
                "When quiet exploration accumulates into small footsteps, your own path becomes clear."
            ],
            "weeks_en": [
                {
                    "title_en": "Refining the Question",
                    "actions_en": [
                        "Each evening, record \u2018the question that lingered most today\u2019.",
                        "Distill this quarter\u2019s core question into one sentence.",
                        "Choose three books, articles, or videos that can lead you toward it."
                    ]
                },
                {
                    "title_en": "Designing Small Experiments",
                    "actions_en": [
                        "Decide on one \u2018small experiment\u2019 that can answer the question.",
                        "Run a 30-minute experiment action three times a week.",
                        "Write a single line of insight gained from each experiment."
                    ]
                },
                {
                    "title_en": "Quiet Retrospective and the Next Path",
                    "actions_en": [
                        "Reread three weeks of records and mark three recurring words.",
                        "Tie those words into one sentence \u2014 \u2018this quarter\u2019s small answer\u2019.",
                        "On the next page, note one question to carry into the next quarter."
                    ]
                }
            ],
            "month3Goals_en": [
                {"title_en": "Refine One Quarterly Core Question", "criterion_en": "A one-sentence question paired with a one-paragraph answer."},
                {"title_en": "12 Small Experiments", "criterion_en": "Accumulate 12+ 30-minute experiment actions."},
                {"title_en": "Establish a Reflection Notebook", "criterion_en": "Five or more \u2018one-line daily insights\u2019 per week."}
            ],
            "year1_en": {
                "vision_en": [
                    "One year from now you will not be \u2018someone who knows a lot\u2019,",
                    "but \u2018someone who has their own answers to their own questions\u2019."
                ],
                "milestones_en": [
                    "Accumulate roughly one notebook of reflections over the year",
                    "Hold four cases of \u2018my question \u2192 small experiment \u2192 answer\u2019",
                    "Be recognized in your area as \u2018quietly deep\u2019"
                ]
            },
            "modules_en": [
                {
                    "title_en": "Reflection Notebook Routine",
                    "summary_en": "A daily device that ties scattered thinking into a path.",
                    "actions_en": ["One line of insight per day", "Once a week, mark three recurring keywords"]
                },
                {
                    "title_en": "Small Experiments Module",
                    "summary_en": "The core converter that turns reflection into a path.",
                    "actions_en": ["Three 30-minute experiment actions per week", "A one-line retrospective after each experiment"]
                },
                {
                    "title_en": "Quarterly Question Review Session",
                    "summary_en": "A quarterly ritual that refines exploration into your own path.",
                    "actions_en": ["At quarter\u2019s end, distill \u2018this quarter\u2019s question\u2019 into one sentence", "Note one question for the next quarter"]
                }
            ],
            "trackBoardWeekly_en": [
                "Did I record a \u2018one-line insight\u2019 five or more times this week?",
                "Did I run a 30-minute experiment action three or more times?",
                "Did I leave a one-line retrospective after the experiment?"
            ],
            "trackBoardMonthly_en": [
                "Is the reflection notebook accumulating?",
                "Has the quarterly question become clearer in one sentence?",
                "Was a new \u2018small answer\u2019 created?"
            ],
            "risks_en": [
                {"risk_en": "Reflection can stretch on, never crossing into experiment", "mitigation_en": "Use a clear time-box such as \u2018one week of question, one week of experiment\u2019."},
                {"risk_en": "Weak external stimuli can cause momentum to fade fast", "mitigation_en": "Once a month, have a 30-minute conversation with someone holding the same question."},
                {"risk_en": "Records can scatter and become hard to retrieve", "mitigation_en": "At month\u2019s end, create a \u2018one-page summary of the month\u2019."}
            ],
            "effects_en": {
                "fitJob_en": "Stronger fit for research, analysis, planning, content, and learning-design roles",
                "expansion_en": "Expansion possible into essays, newsletters, or solo learning businesses",
                "career_en": "Depth of reflection accumulates as a uniquely differentiated perspective",
                "vision_en": "\u201cBecome someone who has their own answers to their own questions.\u201d"
            },
            "newPaths_en": ["Researcher", "Essayist / Newsletter Operator", "Curator", "Learning Designer"],
            "nextSteps_en": {
                "m1_en": "One quarterly core question + start a reflection notebook",
                "m3_en": "12 small experiments + write a one-paragraph \u2018small answer\u2019",
                "y1_en": "Roughly one reflection notebook + four \u2018my question \u2192 answer\u2019 cases"
            },
            "closing_en": [
                "This program is not a design for knowing more.",
                "It is a structure that ties the grain of reflection you already have",
                "into your own path.",
                "Today\u2019s single line of insight is enough to begin."
            ]
        }
    },
    "axisHints_en": {
        "self_understanding_en": "The stronger your self-understanding, the more naturally you absorb a \u2018question \u2192 record\u2019 routine.",
        "self_expression_en": "The stronger your self-expression, the faster a \u2018conversation \u2192 message\u2019 routine takes hold.",
        "self_design_en": "The stronger your self-design, the more steadily a \u2018structure \u2192 lock-in-the-calendar\u2019 routine runs.",
        "self_execution_en": "The stronger your self-execution, the more a \u2018single top priority \u2192 deadline\u2019 routine shines."
    },
    "weakAxisBoosters_en": {
        "self_understanding_en": [
            "Each day, write one word for \u2018today\u2019s biggest emotion\u2019",
            "Once a week, secure 30 minutes of stimulus-free time (a solo walk or meditation)"
        ],
        "self_expression_en": [
            "Three times a week, send a short message (gratitude or check-in)",
            "In conversation, voice one of your emotions honestly in one sentence"
        ],
        "self_design_en": [
            "Sunday evenings, take 30 minutes to set next week\u2019s \u2018single top priority\u2019",
            "Lock one block of recovery time into your calendar in advance"
        ],
        "self_execution_en": [
            "Start today\u2019s \u2018single one\u2019 in the first hour of the morning",
            "Close out by \u2018publishing a draft\u2019 instead of \u2018perfecting\u2019"
        ]
    },
    "footerNotice_en": {
        "lines_en": [
            "This execution program is a custom proposal generated by integrating {{name}}\u2019s Life Portfolio assessment data.",
            "Through execution and feedback it can evolve into an even more precise growth strategy."
        ],
        "qualityChecklist_en": [
            "Includes execution guidance, methods, expected effects, and new career possibilities",
            "Designed so the user can act immediately and feel measurable progress"
        ]
    }
}


def merge_en(base: dict, en: dict) -> dict:
    """Insert *_en sibling keys into base while preserving original keys."""
    out = OrderedDict()
    # Add top-level non-tones first (preserve order)
    out["version"] = base["version"]
    out["spec"] = base["spec"]
    out["spec_en"] = en["spec_en"]

    # format
    fmt_in = base["format"]
    fmt_out = OrderedDict()
    for k, v in fmt_in.items():
        fmt_out[k] = v
        if k == "title":
            fmt_out["title_en"] = en["format"]["title_en"]
        elif k == "subtitleTpl":
            fmt_out["subtitleTpl_en"] = en["format"]["subtitleTpl_en"]
        elif k == "service":
            fmt_out["service_en"] = en["format"]["service_en"]
        elif k == "fonts":
            # add an EN font family alongside
            fmt_out[k]["family_en"] = en["format"]["fonts_family_en"]
    out["format"] = fmt_out

    # tones
    tones_out = OrderedDict()
    for tone_id, tone in base["tones"].items():
        tone_en = en["tones"][tone_id]
        t = OrderedDict()
        # Copy keys + EN siblings in stable order
        t["label"] = tone["label"]
        t["label_en"] = tone_en["label_en"]
        t["tagline"] = tone["tagline"]
        t["tagline_en"] = tone_en["tagline_en"]
        t["quarterTheme"] = tone["quarterTheme"]
        t["quarterTheme_en"] = tone_en["quarterTheme_en"]
        t["quarterLeadParas"] = tone["quarterLeadParas"]
        t["quarterLeadParas_en"] = tone_en["quarterLeadParas_en"]

        # weeks: preserve KO and add weeks_en alongside
        weeks_ko = tone["weeks"]
        weeks_en = tone_en["weeks_en"]
        # Add an "_en" inside each week object as siblings
        new_weeks = []
        for i, w in enumerate(weeks_ko):
            nw = OrderedDict()
            nw["title"] = w["title"]
            nw["title_en"] = weeks_en[i]["title_en"]
            nw["actions"] = w["actions"]
            nw["actions_en"] = weeks_en[i]["actions_en"]
            new_weeks.append(nw)
        t["weeks"] = new_weeks

        # month3Goals
        new_goals = []
        for i, g in enumerate(tone["month3Goals"]):
            ng = OrderedDict()
            ng["title"] = g["title"]
            ng["title_en"] = tone_en["month3Goals_en"][i]["title_en"]
            ng["criterion"] = g["criterion"]
            ng["criterion_en"] = tone_en["month3Goals_en"][i]["criterion_en"]
            new_goals.append(ng)
        t["month3Goals"] = new_goals

        # year1
        y = OrderedDict()
        y["vision"] = tone["year1"]["vision"]
        y["vision_en"] = tone_en["year1_en"]["vision_en"]
        y["milestones"] = tone["year1"]["milestones"]
        y["milestones_en"] = tone_en["year1_en"]["milestones_en"]
        t["year1"] = y

        # modules
        new_mods = []
        for i, m in enumerate(tone["modules"]):
            nm = OrderedDict()
            nm["title"] = m["title"]
            nm["title_en"] = tone_en["modules_en"][i]["title_en"]
            nm["summary"] = m["summary"]
            nm["summary_en"] = tone_en["modules_en"][i]["summary_en"]
            nm["actions"] = m["actions"]
            nm["actions_en"] = tone_en["modules_en"][i]["actions_en"]
            new_mods.append(nm)
        t["modules"] = new_mods

        # trackBoards
        t["trackBoardWeekly"] = tone["trackBoardWeekly"]
        t["trackBoardWeekly_en"] = tone_en["trackBoardWeekly_en"]
        t["trackBoardMonthly"] = tone["trackBoardMonthly"]
        t["trackBoardMonthly_en"] = tone_en["trackBoardMonthly_en"]

        # risks
        new_risks = []
        for i, r in enumerate(tone["risks"]):
            nr = OrderedDict()
            nr["risk"] = r["risk"]
            nr["risk_en"] = tone_en["risks_en"][i]["risk_en"]
            nr["mitigation"] = r["mitigation"]
            nr["mitigation_en"] = tone_en["risks_en"][i]["mitigation_en"]
            new_risks.append(nr)
        t["risks"] = new_risks

        # effects
        eff = OrderedDict()
        for k in ["fitJob", "expansion", "career", "vision"]:
            eff[k] = tone["effects"][k]
            eff[f"{k}_en"] = tone_en["effects_en"][f"{k}_en"]
        t["effects"] = eff

        # newPaths
        t["newPaths"] = tone["newPaths"]
        t["newPaths_en"] = tone_en["newPaths_en"]

        # nextSteps
        ns = OrderedDict()
        for k in ["m1", "m3", "y1"]:
            ns[k] = tone["nextSteps"][k]
            ns[f"{k}_en"] = tone_en["nextSteps_en"][f"{k}_en"]
        t["nextSteps"] = ns

        # closing
        t["closing"] = tone["closing"]
        t["closing_en"] = tone_en["closing_en"]

        tones_out[tone_id] = t

    out["tones"] = tones_out

    # axisHints
    ah = OrderedDict()
    for k, v in base["axisHints"].items():
        ah[k] = v
        ah[f"{k}_en"] = en["axisHints_en"][f"{k}_en"]
    out["axisHints"] = ah

    # weakAxisBoosters
    wab = OrderedDict()
    for k, v in base["weakAxisBoosters"].items():
        wab[k] = v
        wab[f"{k}_en"] = en["weakAxisBoosters_en"][f"{k}_en"]
    out["weakAxisBoosters"] = wab

    # footerNotice
    fn = OrderedDict()
    fn["lines"] = base["footerNotice"]["lines"]
    fn["lines_en"] = en["footerNotice_en"]["lines_en"]
    fn["qualityChecklist"] = base["footerNotice"]["qualityChecklist"]
    fn["qualityChecklist_en"] = en["footerNotice_en"]["qualityChecklist_en"]
    out["footerNotice"] = fn

    return out


def main():
    base = json.loads(SRC.read_text(encoding="utf-8"))
    merged = merge_en(base, EN)
    SRC.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # sanity counters
    en_keys = 0
    def count(obj):
        nonlocal en_keys
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k.endswith("_en"):
                    if isinstance(v, list):
                        en_keys += len(v)
                    elif isinstance(v, dict):
                        en_keys += 1
                        count(v)
                    else:
                        en_keys += 1
                else:
                    count(v)
        elif isinstance(obj, list):
            for x in obj:
                count(x)
    count(merged)
    print(f"OK — wrote {SRC} with {en_keys} EN leaf entries (incl. list items).")


if __name__ == "__main__":
    main()
