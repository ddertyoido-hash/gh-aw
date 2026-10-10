/**
 * Single source of truth for the site's copy and destinations.
 * Every link points at a real GitHub Agentic Workflows resource.
 */

export const site = {
  name: 'GitHub Agentic Workflows',
  shortName: 'gh-aw',
  command: 'gh extension install github/gh-aw',
}

export const links = {
  home: 'https://github.com/github/gh-aw',
  docs: 'https://github.github.com/gh-aw/',
  quickstart: 'https://github.github.com/gh-aw/setup/quick-start/',
  howTheyWork: 'https://github.github.com/gh-aw/introduction/how-they-work/',
  architecture: 'https://github.github.com/gh-aw/introduction/architecture/',
  engines: 'https://github.github.com/gh-aw/reference/engines/',
  safeOutputs: 'https://github.github.com/gh-aw/reference/safe-outputs/',
  audit: 'https://github.github.com/gh-aw/reference/audit/',
  changelog: 'https://github.com/github/gh-aw/blob/main/CHANGELOG.md',
  security: 'https://github.com/github/gh-aw/security/advisories',
}

export const nav = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'Showcase', href: '#showcase' },
  { label: 'Story', href: '#story' },
]

export const hero = {
  eyebrow: 'GitHub CLI extension',
  words: ['AGENTIC', 'WORKFLOWS'] as const,
  lede:
    'Define AI-powered repository automation in Markdown, compile it into GitHub Actions, and keep every write validated, scoped and reviewable.',
  primary: { label: 'Install the extension', href: links.quickstart },
  secondary: { label: 'Read the docs', href: links.docs },
  scrollHint: 'Scroll',
}

export const transversal = {
  eyebrow: 'The pipeline',
  title: 'HOW IT WORKS',
  panels: [
    {
      index: '01',
      title: 'AUTHOR',
      body:
        'An agentic workflow is a Markdown file with YAML frontmatter. The frontmatter configures triggers, permissions, tools and the AI engine. The body tells the agent what to accomplish.',
      meta: 'workflow.md',
      visual: 'document' as const,
    },
    {
      index: '02',
      title: 'COMPILE',
      body:
        'The gh aw compile command validates the source — triggers, tool allowlists, permission ceilings, prompt safety — and generates the lock file that GitHub Actions executes.',
      meta: 'workflow.lock.yml',
      visual: 'rings' as const,
    },
    {
      index: '03',
      title: 'CONTAIN',
      body:
        'Agent jobs run read-only and sandboxed. Configured writes are buffered as safe outputs, validated, then applied in separate jobs with scoped permissions.',
      meta: 'safe-outputs',
      visual: 'perimeter' as const,
    },
  ],
}

export const features = [
  {
    eyebrow: 'Authoring',
    title: 'MARKDOWN IN. ACTIONS OUT.',
    body:
      'Write intent, not infrastructure. Frontmatter configures triggers, permissions and tools; the Markdown body describes the outcome. Compilation turns the pair into a standard GitHub Actions workflow you can review and diff.',
    link: { label: 'How they work', href: links.howTheyWork },
    visual: 'frost' as const,
  },
  {
    eyebrow: 'Compilation',
    title: 'VALIDATED BEFORE IT RUNS.',
    body:
      'Compilation is a gate, not a formality. The compiler checks triggers, tool allowlists, permission ceilings and prompt safety, then emits a lock file that lives in your repository and travels through review like any other change.',
    link: { label: 'The architecture', href: links.architecture },
    visual: 'chrome' as const,
  },
  {
    eyebrow: 'Safety',
    title: 'READ-ONLY BY DEFAULT.',
    body:
      'The supported agent path defaults to read-only GitHub access and sandboxed execution. Configured writes are buffered as safe outputs, validated, and applied afterwards in separate jobs with scoped permissions.',
    link: { label: 'Safe outputs', href: links.safeOutputs },
    visual: 'perimeter' as const,
  },
]

export const showcase = {
  eyebrow: 'A system of parts',
  title: 'BUILT TO BE INSPECTED',
  body: 'Every moving part is visible, reviewable and replaceable — engines, writes and run history.',
  cards: [
    {
      tag: 'engine',
      title: 'Engines',
      body:
        'Bring your own reasoning. GitHub Copilot, Claude Code, OpenAI Codex, Google Gemini and Pi are supported out of the box.',
      linkLabel: 'Compare engines',
      href: links.engines,
      visual: 'chrome' as const,
    },
    {
      tag: 'permissions',
      title: 'Safe outputs',
      body:
        'Agent output is a proposal. Writes are buffered, validated against declared schemas, and applied by separate scoped jobs.',
      linkLabel: 'Read the reference',
      href: links.safeOutputs,
      visual: 'frost' as const,
    },
    {
      tag: 'observability',
      title: 'Audit & cost',
      body:
        'Every run leaves a trace. Inspect prompts, tool calls, token usage and cost for any agentic workflow run.',
      linkLabel: 'Audit a run',
      href: links.audit,
      visual: 'rings' as const,
    },
  ],
}

export const immersive = {
  eyebrow: 'The perimeter',
  headline: 'SAFETY IS THE ARCHITECTURE',
  caption: 'Read-only agent jobs. Sandboxed execution. Validated writes. Scoped permissions.',
}

export const story = {
  eyebrow: 'The philosophy',
  statement: 'Deterministic when it should be. Agentic when it matters.',
  paragraphs: [
    'Conventional GitHub Actions are excellent at the deterministic work: builds, tests, linting, deployments, reproducible scripts. Those jobs should stay exactly as they are.',
    'Agentic workflows exist for the other tasks — the ones that need reasoning or interpretation. Issue triage. Pull-request review. CI failure investigation. Documentation maintenance. Dependency analysis. Repository reporting.',
    'GitHub Agentic Workflows complements existing CI/CD; it does not replace it. Add an agent where judgement is required, and leave the deterministic path untouched.',
  ],
  stats: [
    { value: '5', label: 'Built-in AI engines' },
    { value: 'Read-only', label: 'Default agent access' },
    { value: 'Safe outputs', label: 'Validated, scoped writes' },
  ],
  caveat:
    'Using agentic workflows in your repository requires careful attention to security considerations and careful human supervision, and even then things can still go wrong. Use it with caution, and at your own risk.',
}

export const closing = {
  headline: ['START', 'BUILDING'],
  lede: 'Install the extension, write a workflow in Markdown, and let GitHub Actions do the rest.',
  command: site.command,
  copyLabel: 'Copy install command',
  copiedLabel: 'Copied to clipboard',
  secondary: { label: 'Read the docs', href: links.docs },
}

export const footerLinks = [
  { label: 'Documentation', href: links.docs },
  { label: 'GitHub', href: links.home },
  { label: 'Install', href: links.quickstart },
  { label: 'Changelog', href: links.changelog },
  { label: 'Security advisories', href: links.security },
]
