export const sampleExcerpts = [
  {
    title: "Agile Mindset vs Practices",
    content: `The Agile Extension to the BABOK Guide v2 (AE v2) recognizes that agile is fundamentally a mindset expressed via context-appropriate practices, not a rigid methodology. This mindset emphasizes adaptive planning, evolutionary development, early delivery, and continuous improvement, all while encouraging rapid and flexible response to change.

The AE v2 maps mindset-led BA practices to BABOK v3, providing guidance rather than a fixed checklist. Business analysts working in agile environments must understand that practices should be selected and adapted based on the specific context, team dynamics, and project constraints.

The agile mindset values individuals and interactions over processes and tools, working software over comprehensive documentation, customer collaboration over contract negotiation, and responding to change over following a plan. These values guide the selection and implementation of practices rather than prescribing specific activities.

Business analysts play a crucial role in translating business needs into actionable requirements while maintaining the agile principles of collaboration, adaptation, and continuous feedback. The focus shifts from comprehensive upfront documentation to just-enough analysis that enables the team to move forward productively.`
  },
  {
    title: "Three Horizons Planning",
    content: `The Three Horizons model provides a framework for understanding different planning timeframes in agile environments: Strategy, Initiative, and Delivery (SID). Each horizon has distinct characteristics, stakeholders, and planning approaches that business analysts must navigate effectively.

Horizon 1 (Strategy) typically spans 12-18 months and focuses on long-term vision, market positioning, and strategic objectives. At this level, business analysts work with senior stakeholders to understand business drivers, competitive landscape, and organizational goals. The analysis is broad and exploratory, aimed at identifying opportunities and constraints.

Horizon 2 (Initiative) spans 3-6 months and translates strategic goals into specific initiatives or programs. Business analysts facilitate the decomposition of strategic objectives into actionable initiatives, working with product owners and portfolio managers to prioritize and sequence work. This horizon bridges strategy and execution.

Horizon 3 (Delivery) operates in 1-4 week cycles and focuses on immediate delivery activities. Business analysts collaborate closely with development teams, facilitating requirements elaboration, acceptance criteria definition, and continuous feedback loops. The emphasis is on just-in-time analysis and rapid value delivery.

Rolling-wave planning, also known as progressive elaboration, connects these horizons by maintaining alignment between strategic intent and tactical execution while allowing for adaptation as new information emerges.`
  },
  {
    title: "Requirements in Agile Contexts",
    content: `Requirements in agile contexts differ significantly from traditional approaches, emphasizing collaboration, conversation, and continuous refinement over comprehensive documentation. The focus shifts from capturing all requirements upfront to enabling ongoing discovery and adaptation throughout the development process.

User stories serve as lightweight requirement artifacts that capture the who, what, and why of a requirement from the user's perspective. They are intentionally brief and serve as conversation starters rather than complete specifications. The real value lies in the conversations between business analysts, product owners, developers, and stakeholders.

Acceptance criteria provide the conditions that must be met for a user story to be considered done. These criteria are typically written in a Given-When-Then format or as a checklist of conditions. Business analysts facilitate the collaborative definition of acceptance criteria, ensuring clarity and testability while avoiding over-specification.

The Definition of Ready and Definition of Done establish shared understanding about when work is ready to begin and when it is considered complete. Business analysts contribute to these definitions by ensuring that analysis activities and acceptance criteria are appropriately included.

Backlog refinement is an ongoing activity where requirements are continuously elaborated, estimated, and prioritized. Business analysts facilitate these sessions, helping teams understand user needs, clarify requirements, and maintain a healthy backlog that supports predictable delivery.`
  },
  {
    title: "Stakeholder Engagement in Agile",
    content: `Effective stakeholder engagement in agile environments requires a shift from formal, scheduled interactions to continuous, collaborative relationships. Business analysts must adapt their stakeholder management approaches to support the frequent feedback loops and rapid decision-making that characterize agile delivery.

Daily standups, sprint reviews, and retrospectives provide regular touchpoints for stakeholder engagement, but business analysts must also facilitate informal communications and ad-hoc conversations. The goal is to maintain stakeholder alignment and satisfaction while avoiding the overhead of excessive meetings.

Product owners serve as the primary business stakeholders on agile teams, representing user needs and making prioritization decisions. Business analysts work closely with product owners to ensure they have the information and analysis needed to make informed decisions about product direction and feature prioritization.

End users and customers become more directly involved in the development process through user research, usability testing, and regular feedback sessions. Business analysts facilitate these interactions, ensuring that user insights are captured and incorporated into product decisions.

Stakeholder feedback loops must be established and maintained throughout the development process. This includes regular demonstrations of working software, feedback collection mechanisms, and rapid response to stakeholder concerns or changing needs.`
  },
  {
    title: "Business Value and Agile Delivery",
    content: `Business value delivery is at the heart of agile approaches, requiring business analysts to think beyond feature completion to focus on outcomes and impact. This shift demands new skills in value identification, measurement, and optimization throughout the delivery process.

Value stream mapping helps teams understand the flow of value from concept to customer, identifying bottlenecks, waste, and opportunities for improvement. Business analysts use these techniques to optimize the delivery process and ensure that analysis activities contribute to rather than hinder value flow.

Minimum Viable Products (MVPs) and Minimum Viable Features (MVFs) represent approaches to delivering value incrementally while learning from user feedback. Business analysts help define what constitutes "minimum" and "viable" in specific contexts, balancing user needs with technical constraints and business objectives.

Return on Investment (ROI) and other value metrics must be defined and tracked throughout development. Business analysts work with stakeholders to establish success criteria, identify leading and lagging indicators, and create feedback mechanisms that inform ongoing product decisions.

Continuous delivery practices enable teams to release value frequently, requiring business analysts to think about features in terms of independent, valuable increments rather than comprehensive solutions. This approach demands careful consideration of dependencies, integration points, and user impact.`
  }
];

export const getRandomSample = () => {
  const randomIndex = Math.floor(Math.random() * sampleExcerpts.length);
  return sampleExcerpts[randomIndex];
};