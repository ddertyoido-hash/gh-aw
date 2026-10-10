import { story } from '../data/content'
import Reveal from './Reveal'

/** Editorial chapter: one statement, a short story, and three facts. */
export default function Story() {
  return (
    <section className="story" id="story" aria-label="The philosophy">
      <div className="story__head">
        <Reveal as="p" className="eyebrow" text={story.eyebrow} />
        <Reveal
          as="h2"
          className="story__statement"
          text={story.statement}
          stagger={0.045}
          duration={1.15}
        />
      </div>

      <div className="story__columns">
        {story.paragraphs.map((paragraph) => (
          <Reveal
            key={paragraph}
            as="p"
            className="story__para"
            text={paragraph}
            stagger={0.012}
            duration={0.7}
          />
        ))}
      </div>

      <dl className="story__stats">
        {story.stats.map((stat) => (
          <div className="story__stat" key={stat.label}>
            <dt className="story__statLabel">{stat.label}</dt>
            <dd className="story__statValue">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <p className="story__caveat">{story.caveat}</p>
    </section>
  )
}
